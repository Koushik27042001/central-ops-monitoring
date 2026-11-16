import { app } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

async function start(): Promise<void> {
  await connectDatabase();

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve,reject)=>{
   const instance=app.listen((env.PORT ?? env.API_PORT), "0.0.0.0", () => {
    logger.info({ area:'Website service',port:env.PORT ?? env.API_PORT }, `Ready to accept connections on port ${env.PORT ?? env.API_PORT}.`);
    logger.info({area:'Accounts'},`Sign-in sessions last ${env.AUTH_SESSION_DAYS} days. Each account has its own workspace.`);
    instance.off('error',reject);
    resolve(instance);
   });
   instance.once('error',reject);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal,area:'Website service' }, "Stopping safely. Please wait...");
    server.close((error) => {
      if (error) {
        logger.error({ err: error,area:'Website service' }, "The website service could not finish stopping cleanly.");
        process.exitCode = 1;
      }
      void Promise.allSettled([disconnectDatabase()]).then(() => process.exit(process.exitCode || 0));
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((error: unknown) => {
  const code=error && typeof error==='object' && 'code' in error?error.code:undefined;
  const hint=code==='EADDRINUSE'?'The selected port is in use. Stop the other running copy, then try again.':error instanceof Error && error.message.startsWith('MongoDB connection failed.')?error.message:'Run npm run check:config to find which setting needs attention.';
  logger.fatal({ err:error,area:'Website service',hint }, "Could not start the website service.");
  process.exitCode = 1;
  void Promise.allSettled([disconnectDatabase()]);
});
