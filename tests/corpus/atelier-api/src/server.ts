import { app } from "./app";
import { env } from "./env";
import { startCrons } from "./jobs";
import { logger } from "./logger";

app.listen(env.PORT, () => logger.info({ port: env.PORT }, "api listening"));
startCrons();
