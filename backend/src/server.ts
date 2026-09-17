import { createApp } from "./app";
import { connectDB, disconnectDB } from "./config/db";
import { env } from "./config/env";

async function main(): Promise<void> {
  await connectDB();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`[server] listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // Atlas (and any managed DB) expects clients to close connections
  // cleanly rather than being killed out from under an open pool.
  const shutdown = (signal: string): void => {
    console.log(`[server] received ${signal}, shutting down...`);
    server.close(() => {
      disconnectDB()
        .then(() => {
          console.log("[server] shutdown complete");
          process.exit(0);
        })
        .catch((err) => {
          console.error("[server] error during shutdown:", err);
          process.exit(1);
        });
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
