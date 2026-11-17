import { env } from "./config/env.js";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { isAllowedClientOrigin } from "./config/origins.js";
import { healthRouter } from "./routes/health.js";
import { logger } from "./utils/logger.js";
import { managementRouter } from "./routes/management.js";
import { demoEnquiryRouter } from "./routes/demo-enquiries.js";
import { ZodError } from "zod";
import { randomUUID } from 'node:crypto';
import { requestDiagnostic } from './utils/request-diagnostic.js';

export const app = express();

app.disable("x-powered-by");
// Trust exactly the configured proxy hops, including zero for direct/local use.
// Never trust all forwarded addresses: request IPs are used for rate limiting.
app.set("trust proxy", env.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || isAllowedClientOrigin(origin)),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "100kb", strict: true }));
app.use(pinoHttp({ logger,autoLogging:env.LOG_HTTP_REQUESTS,
 customSuccessMessage:(_req,res)=>`A request finished (status ${res.statusCode}).`,
 customErrorMessage:()=> 'A request could not be completed.',
}));
// Session and management responses must never be cached by a hosting proxy.
app.use("/api", (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); });

app.get("/api/v1/health", (_request, response) => {
  response.status(200).json({ status: "alive" });
});
app.use("/api/health", healthRouter);
app.use("/api/v1/health/status", healthRouter);
app.use("/api/v1/health", healthRouter);
app.use("/api/v1", demoEnquiryRouter);
app.use("/api/v1", managementRouter);

app.use((_request, response) => {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
    },
  });
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof ZodError) { response.status(400).json({error: {code: "VALIDATION_ERROR", message: "Invalid request", details: error.issues}}); return; }
    if (typeof error === "object" && error && "status" in error && error.status === 413) {response.status(413).json({error: {code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds 100 KiB"}}); return;}
    if (error instanceof SyntaxError && "body" in error) { response.status(400).json({error: {code: "INVALID_JSON", message: "Invalid JSON body"}}); return; }
    if (typeof error === "object" && error && "code" in error && error.code === 11000) {response.status(409).json({error: {code: "CONFLICT", message: "Record already exists"}}); return;}
    const reference = randomUUID();
    const diagnostic = requestDiagnostic(error, response.locals.saveStage ?? 'request', reference);
    logger.error({ err: error,diagnostic,area:'Website service',hint:'Use the diagnostic reference and stage to investigate this failure.' }, "A request could not be completed.");
    response.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: `An unexpected error occurred. Reference: ${reference}`,
        reference,
      },
    });
  },
);
