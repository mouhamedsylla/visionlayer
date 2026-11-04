import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { publishedDocs, selectDocs, untar } from "../vision/writer/published-docs.js";

/** Une archive tar écrite à la main : le même format que npm. */
function tar(files: Record<string, string>): Buffer {
  const parts: Buffer[] = [];
  for (const [name, text] of Object.entries(files)) {
    const h = Buffer.alloc(512);
    h.write(name, 0);
    h.write(`${Buffer.byteLength(text).toString(8).padStart(11, "0")}\0`, 124);
    h.write("0", 156);
    parts.push(h, Buffer.from(text), Buffer.alloc((512 - (Buffer.byteLength(text) % 512)) % 512));
  }
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}

test("écrivain : une archive se lit en mémoire ; seuls la documentation et les types sont gardés", () => {
  const files = untar(tar({ "package/README.md": "lisez-moi", "package/index.js": "code", "package/types/a.d.ts": "type A", "package/docs/Routes.md": "routes" }));
  assert.deepEqual(files.map((f) => f.path).sort(), ["README.md", "docs/Routes.md", "types/a.d.ts"]);
  assert.equal(files.find((f) => f.path === "docs/Routes.md")?.text, "routes");
});

test("écrivain : la référence passe avant les autres pages, et docs/ a une taille bornée", () => {
  const big = "x".repeat(140_000);
  const docs = selectDocs([{ path: "docs/Guides/a.md", text: big }, { path: "docs/Reference/Routes.md", text: big }, { path: "README.md", text: "r" }], (p) => p);
  assert.deepEqual(docs.map((d) => d.source), ["README.md", "docs/Reference/Routes.md"]);
});

test("écrivain : la version déclarée par le projet, sinon la dernière ; sans réseau, rien", async () => {
  const asked: string[] = [];
  const archive = gzipSync(tar({ "package/README.md": "doc" }));
  const get = (async (url: string) => {
    asked.push(url);
    if (url.endsWith(".tgz")) return new Response(archive);
    if (url.includes("@types")) return new Response("", { status: 404 });
    return Response.json({ version: "5.6.2", dist: { tarball: "https://x/fastify.tgz" } });
  }) as unknown as typeof fetch;
  const docs = await publishedDocs("fastify", "^5.6.2", get);
  assert.deepEqual(docs, [{ source: "npm : fastify@5.6.2/README.md", text: "doc" }]);
  assert.equal(asked[0], "https://registry.npmjs.org/fastify/5.6.2");
  const down = (async () => { throw new Error("hors ligne"); }) as unknown as typeof fetch;
  assert.deepEqual(await publishedDocs("fastify", undefined, down), []);
});
