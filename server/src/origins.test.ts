import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";
import { clientOrigins } from "./config/origins.js";

describe("frontend origins", () => {
  it.each(["http://localhost:5173", "http://127.0.0.1:5173", "http://[::1]:5173"])("accepts local login validation from %s", async origin => {
    const response = await request(app).post("/api/v1/auth/login").set("Origin", origin).send({email: "invalid"});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
  });
  it.each(["http://localhost.evil.test:5173", "http://localhost:5174", "https://untrusted.example", "null"])("rejects mutations from %s", async origin => {
    const response = await request(app).post("/api/v1/clients").set("Origin", origin).send({name: "Blocked"});
    expect(response.status).toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
  it("keeps production restricted to its configured origin", () => {
    expect([...clientOrigins({NODE_ENV: "production", CLIENT_ORIGIN: "http://localhost:5173"})]).toEqual(["http://localhost:5173"]);
    expect([...clientOrigins({NODE_ENV: "development", CLIENT_ORIGIN: "https://admin.example.com"})]).toEqual(["https://admin.example.com"]);
  });
});
