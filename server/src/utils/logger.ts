import pino from "pino";
import { env } from "../config/env.js";
import { terminalDestination } from './terminal-log.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "passwordHash",
      "token",
      "secret",
      "credential",
      "MONGODB_URI",
      "INTEGRATION_ENCRYPTION_KEY",
      "ADMIN_PASSWORD",
      "FIREBASE_PRIVATE_KEY",
      "idToken",
      "req.body.idToken",
      "req.headers[\"x-api-key\"]",
      "res.headers[\"set-cookie\"]",
    ],
    censor: "[REDACTED]",
  },
},env.LOG_FORMAT==='text'?terminalDestination:undefined);
