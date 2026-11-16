import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "./app.js";

vi.mock("./config/database.js", () => ({
  databaseState: () => "not_configured",
}));

describe("health endpoints", () => {
  it("reports liveness without exposing dependency details", async () => {
    const response = await request(app).get("/api/v1/health/live");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "alive" });
  });

  it("does not claim readiness when MongoDB is not configured", async () => {
    const response = await request(app).get("/api/v1/health/ready");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: "not_ready",
      dependencies: { mongodb: "not_configured" },
    });
  });

  it("returns a generic not-found response", async () => {
    const response = await request(app).get("/api/v1/missing");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("sets baseline security headers", async () => {
    const response = await request(app).get("/api/v1/health/live");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});
