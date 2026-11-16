import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";
import { cookieToken, hashPassword, verifyPassword } from "./services/auth.js";
import { isPublicIPv4 } from "./services/outbound.js";
import { clientSchema, websiteSchema } from "./validators/index.js";
describe("authentication and request boundaries", () => {
 it("rejects unauthenticated management reads", async () => {expect((await request(app).get("/api/v1/clients")).status).toBe(401);});
 it("rejects mutation without allowed origin", async () => {expect((await request(app).post("/api/v1/clients").send({name:"A"})).status).toBe(403);});
 it("validates login before database access", async () => {const r = await request(app).post("/api/v1/auth/login").set("Origin", "http://localhost:5173").send({email:"invalid"}); expect(r.status).toBe(400); expect(r.body.error.code).toBe("VALIDATION_ERROR");});
 it("returns a 400 for malformed JSON", async () => {expect((await request(app).post("/api/v1/auth/login").set("Content-Type", "application/json").send("{")).status).toBe(400);});
 it("hashes passwords with independent salts", () => {const a=hashPassword("long secure password"); const b=hashPassword("long secure password"); expect(a).not.toBe(b); expect(verifyPassword("long secure password",a)).toBe(true); expect(verifyPassword("incorrect",a)).toBe(false);});
 it("parses the exact session cookie", () => {expect(cookieToken("other=x; centralops=abc")).toBe("abc"); expect(cookieToken("centralops_fake=abc")).toBeUndefined();});
});
describe("validation", () => {
 it("rejects empty names and unknown fields", () => {expect(clientSchema.safeParse({name:" "}).success).toBe(false); expect(clientSchema.safeParse({name:"A",role:"SUPER_ADMIN"}).success).toBe(false);});
 it("accepts frontend-only websites", () => {expect(websiteSchema.safeParse({name:"A", clientId:"a".repeat(24), frontendUrl:"https://example.com"}).success).toBe(true);});
 it("rejects unsafe URL protocols and embedded credentials", () => {for (const frontendUrl of ["file:///etc/passwd","https://u:p@example.com"]) expect(websiteSchema.safeParse({name:"A",clientId:"a".repeat(24),frontendUrl}).success).toBe(false);});
});
describe("outbound address policy", () => {
 it("blocks internal, metadata, reserved and IPv6 destinations", () => {for (const address of ["127.0.0.1","10.0.0.2","169.254.169.254","172.16.0.1","192.168.1.1","100.64.0.1","0.0.0.0","224.0.0.1","::1","::ffff:127.0.0.1"]) expect(isPublicIPv4(address)).toBe(false);});
 it("accepts public IPv4", () => {expect(isPublicIPv4("8.8.8.8")).toBe(true);});
});
