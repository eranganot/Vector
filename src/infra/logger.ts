import pino from "pino";

/** Structured JSON logs (visible in Railway). Add requestId/actorId as child bindings. */
export const logger = pino({ level: process.env.LOG_LEVEL ?? "info", base: { service: "vector-web" } });
