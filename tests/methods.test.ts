import { test } from "node:test";
import assert from "node:assert/strict";
import { mapOf } from "./pack-fixture.js";

// Un serveur Express en classes : routes → contrôleur injecté → service statique, instance exportée, champ typé, this.
const files = {
  "package.json": JSON.stringify({ name: "app", main: "src/server.ts", dependencies: { express: "4", pg: "8" } }),
  "Dockerfile": "FROM node:22\nCOPY . .\nCMD [\"node\", \"src/server.ts\"]\n",
  "src/server.ts": [
    "import express from \"express\";",
    "import { OrderController } from \"./order.controller\";",
    "import { ordersRouter } from \"./order.routes\";",
    "const app = express();",
    "const orderController = new OrderController();",
    "app.use(\"/orders\", ordersRouter(orderController));",
    "app.listen(3000);",
  ].join("\n"),
  "src/order.routes.ts": [
    "import { Router } from \"express\";",
    "import { OrderController } from \"./order.controller\";",
    "export const ordersRouter = (ctrl: OrderController) => {",
    "  const router = Router();",
    "  router.get(\"/:id\", ctrl.findById);",
    "  router.post(\"/\", ctrl.create);",
    "  return router;",
    "};",
  ].join("\n"),
  "src/order.controller.ts": [
    "import type { Request, Response } from \"express\";",
    "import { OrderService } from \"./order.service\";",
    "import { audit } from \"./audit.service\";",
    "export class OrderController {",
    "  public findById = async (req: Request, res: Response) => {",
    "    const order = await OrderService.find(req.params.id);",
    "    if (!order) return res.status(404).json({ message: \"not found\" });",
    "    return res.json(order);",
    "  };",
    "  async create(req: Request, res: Response) {",
    "    const order = await OrderService.create(req.body);",
    "    await audit.record(\"create\");",
    "    return res.status(201).json(order);",
    "  }",
    "}",
  ].join("\n"),
  "src/order.service.ts": [
    "import { db } from \"./db\";",
    "import { Mailer } from \"./mailer\";",
    "export class OrderService {",
    "  constructor(private readonly mailer: Mailer) {}",
    "  static async find(id: string) {",
    "    const r = await db.query(\"SELECT * FROM orders WHERE id = $1\", [id]);",
    "    return r.rows[0];",
    "  }",
    "  static async create(input: { item: string }) {",
    "    const r = await db.query(\"INSERT INTO orders (item) VALUES ($1) RETURNING *\", [input.item]);",
    "    return r.rows[0];",
    "  }",
    "  async notify() { await this.mailer.send(); this.log(); }",
    "  log() {}",
    "}",
  ].join("\n"),
  "src/audit.service.ts": [
    "import { db } from \"./db\";",
    "class AuditService {",
    "  async record(what: string) {",
    "    await db.query(\"INSERT INTO audit_log (what) VALUES ($1)\", [what]);",
    "  }",
    "}",
    "export const audit = new AuditService();",
  ].join("\n"),
  "src/mailer.ts": "export class Mailer {\n  async send() { return true; }\n}\n",
  "src/db.ts": "import { Pool } from \"pg\";\nexport const db = new Pool({ connectionString: process.env.DATABASE_URL });\n",
};

test("classes : une route qui passe la méthode d'un contrôleur injecté a son déroulé, à travers un service statique et une instance exportée", async () => {
  const m = await mapOf(files);
  const app = m.nodes.find((n) => n.level === "deployable" && n.facets.entrypoints?.some((e) => e.kind === "http"))!;
  const get = app.facets.entrypoints!.find((e) => e.key === "GET /orders/:id")!;
  assert.equal(get.handler?.path, "src/order.controller.ts", "le gestionnaire est la méthode du contrôleur");
  const steps = (get.flow ?? []).map((x) => [x.depth, x.kind, x.name, x.target?.entity].filter((v) => v !== undefined).join(" "));
  assert.ok(steps.includes("0 invoke OrderService.find"), steps.join(" | "));
  assert.ok(steps.includes("1 read orders"), steps.join(" | "));

  const post = app.facets.entrypoints!.find((e) => e.key === "POST /orders")!;
  const names = (post.flow ?? []).map((x) => `${x.kind} ${x.name ?? x.target?.entity ?? ""}`);
  assert.ok(names.includes("invoke OrderService.create"), names.join(" | "));
  assert.ok(names.includes("invoke audit.record"), "l'instance exportée mène à la méthode de sa classe");
  assert.ok(names.includes("write audit_log"), names.join(" | "));
});

test("classes : les méthodes sont des fonctions, et this.champ typé ou this.méthode mènent à la bonne méthode", async () => {
  const m = await mapOf(files);
  const fns = m.nodes.flatMap((n) => n.facets.functions ?? []);
  // Une méthode qu'une autre appelle est une fonction de l'écran Code, avec la ligne qui l'appelle.
  const log = fns.find((f) => f.name === "OrderService.log");
  assert.ok(log, `OrderService.log est une fonction : ${fns.map((f) => f.name).join(", ")}`);
  assert.deepEqual(log.calledFrom?.map((c) => c.fn), ["OrderService.notify"], "this.log() mène à OrderService.log");
  const send = fns.find((f) => f.name === "Mailer.send");
  assert.deepEqual(send?.calledFrom?.map((c) => c.fn), ["OrderService.notify"], "this.mailer.send(), champ typé par le constructeur, mène à Mailer.send");
});
