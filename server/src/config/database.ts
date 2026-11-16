import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export function databaseConnectionHint(error: unknown): string {
  // Inspect errors internally, but return only fixed text: driver messages can contain credentials.
  const codes = new Set<string>();
  const seen = new Set<object>();
  function inspect(value: unknown): void {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    const item = value as {code?: unknown; cause?: unknown; reason?: unknown; error?: unknown; servers?: unknown};
    if (item.code !== undefined) codes.add(String(item.code));
    for (const nested of [item.cause, item.reason, item.error]) inspect(nested);
    if (item.servers instanceof Map) for (const server of item.servers.values()) inspect(server);
  }
  inspect(error);
  if (codes.has('18') || codes.has('8000')) return 'Database authentication failed. Check the Atlas database user, password encoding, and authSource.';
  if (codes.has('ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR')) return 'Atlas rejected the TLS handshake before authentication. Check Atlas Network Access: allow this machine’s current public IP, confirm the cluster is running, and check VPN/firewall TLS interception. Certificate verification remains enabled.';
  if ([...codes].some(code => /CERT|TLS|SSL/.test(code))) return 'TLS negotiation failed. Check trusted certificates, the system clock, and VPN/firewall TLS interception.';
  if ([...codes].some(code => ['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL', 'ETIMEOUT'].includes(code))) return 'DNS lookup failed. Check the Atlas hostname, cluster status, and the network DNS resolver.';
  if (codes.has('ECONNREFUSED')) return 'Connection refused. Check that MongoDB is running and reachable at the configured host and port.';
  return 'Check credentials, Atlas network access, DNS, and TLS configuration.';
}

export async function connectDatabase(): Promise<void> {
  if (!env.MONGODB_URI) {
    if (env.NODE_ENV === "production") {
      throw new Error("MONGODB_URI must be configured in production");
    }
    logger.warn({area:'Database',hint:'Add your database connection to MONGODB_URI in server/.env, then restart.'},"No database connection has been configured.");
    return;
  }

  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      ...(env.MONGODB_URI.startsWith("mongodb+srv://") ? {
        tls: true,
        // This enforces certificate and hostname verification. The driver rejects
        // combining tlsInsecure with either tlsAllowInvalid* option.
        tlsInsecure: false,
      } : {}),
    });
  } catch (error) {
    // Driver errors may contain connection details. Never log the raw error.
    throw new Error("MongoDB connection failed. " + databaseConnectionHint(error));
  }
  logger.info({area:'Database'},"Connected. Saved workspace data is available.");
}

export function databaseState(): "connected" | "disconnected" | "not_configured" {
  if (!env.MONGODB_URI) return "not_configured";
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
