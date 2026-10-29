import { createServer } from "node:http";
import { db } from "../functions/src/db";

const server = createServer(async (req, res) => {
  if (req.url === "/work") {
    await db().collection("orders").doc("x").update({ done: true });
  }
  res.end();
});
server.listen(8080);
