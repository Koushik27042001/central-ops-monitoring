import { afterEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { env } from "./env.js";
import { connectDatabase, databaseConnectionHint } from "./database.js";

describe("database connection security", () => {
  it('identifies nested Atlas TLS alerts without exposing driver messages', () => {
    const error = {message:'private-password', reason:{servers:new Map([['host',{error:{cause:{code:'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR',message:'private-password'}}}]])}};
    expect(databaseConnectionHint(error)).toContain('Atlas rejected the TLS handshake before authentication');
    expect(databaseConnectionHint(error)).not.toContain('private-password');
  });
  it('distinguishes authentication, DNS, and refused connections', () => {
    expect(databaseConnectionHint({code:18})).toContain('Database authentication failed');
    expect(databaseConnectionHint({code:'ENOTFOUND'})).toContain('DNS lookup failed');
    expect(databaseConnectionHint({cause:{code:'ECONNREFUSED'}})).toContain('Connection refused');
  });
  const previous = env.MONGODB_URI;
  afterEach(() => { env.MONGODB_URI = previous; vi.restoreAllMocks(); });
  it("enforces verified TLS for SRV connections", async () => {
    env.MONGODB_URI = "mongodb+srv://example.invalid/centralops?tls=false";
    const connect = vi.spyOn(mongoose, "connect").mockResolvedValue(mongoose);
    await connectDatabase();
    expect(connect).toHaveBeenCalledWith(env.MONGODB_URI, expect.objectContaining({
      tls: true, tlsInsecure: false,
    }));
    const options = connect.mock.calls[0]?.[1];
    expect(options).not.toHaveProperty("tlsAllowInvalidCertificates");
    expect(options).not.toHaveProperty("tlsAllowInvalidHostnames");
  });
  it("does not expose driver errors containing credentials", async () => {
    env.MONGODB_URI = "mongodb+srv://example.invalid/centralops";
    vi.spyOn(mongoose, "connect").mockRejectedValue(new Error("private-password"));
    await expect(connectDatabase()).rejects.toThrow("MongoDB connection failed.");
    await expect(connectDatabase()).rejects.not.toThrow("private-password");
  });
});

