import { env } from "./env.js";

export function clientOrigins(config: { NODE_ENV: string; CLIENT_ORIGIN: string }): Set<string> {
  const origins = new Set([config.CLIENT_ORIGIN]);
  const primary = new URL(config.CLIENT_ORIGIN);
  if (config.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(primary.hostname)) {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      origins.add(`${primary.protocol}//${host}${primary.port ? `:${primary.port}` : ""}`);
    }
  }
  return origins;
}

export function isAllowedClientOrigin(origin: string | undefined): boolean {
  return !!origin && clientOrigins(env).has(origin);
}
