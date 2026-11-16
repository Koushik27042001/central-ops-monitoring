import { config as loadDotEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

loadDotEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

export const envSchema = z.object({
  LOG_FORMAT:z.enum(['text','json']).default('text'),
  LOG_HTTP_REQUESTS:z.enum(['true','false']).default('false').transform(value=>value==='true'),
  AUTH_SESSION_DAYS:z.coerce.number().int().min(1).max(14).default(2),
  PUBLIC_REGISTRATION: z.enum(['true','false']).default('false').transform(value => value === 'true'),
  WORKSPACE_MAX_WEBSITES: z.coerce.number().int().min(1).max(10000).default(25),
  WORKSPACE_MAX_ENDPOINTS: z.coerce.number().int().min(1).max(10000).default(100),
  WORKSPACE_MAX_RECORDS: z.coerce.number().int().min(1).max(100000).default(1000),
  WORKSPACE_MAX_PENDING_JOBS: z.coerce.number().int().min(1).max(10000).default(25),
  AUTH_PROVIDER: z.enum(['firebase', 'local']).default('local'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_ADMIN_EMAILS: z.string().default(''),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.preprocess(value => value === "" ? undefined : value, z.coerce.number().int().min(1).max(65535).optional()),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().url().refine(value => new URL(value).origin === value, "Use an origin without a path or trailing slash").default("http://localhost:5173"),
  MONGODB_URI: z.preprocess(value => value === "" ? undefined : value, z.string().regex(/^mongodb(?:\+srv)?:\/\//, "Use a MongoDB connection string").optional()),
  INTEGRATION_ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/i, "Use a 32-byte hexadecimal key").optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "production") return;
  for (const name of ["MONGODB_URI", "INTEGRATION_ENCRYPTION_KEY"] as const) {
    if (!value[name]) context.addIssue({code:"custom",path:[name],message:"Required in production"});
  }
  if (!value.CLIENT_ORIGIN.startsWith("https://")) context.addIssue({code:"custom",path:["CLIENT_ORIGIN"],message:"Use the exact HTTPS frontend origin in production"});
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error("Invalid environment configuration: " + parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "));
}
export const env = parsed.data;
