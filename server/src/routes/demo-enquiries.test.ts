import request from "supertest";
import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../app.js";
import { DemoEnquiry } from "../models/index.js";
import { demoEnquirySchema } from "./demo-enquiries.js";
const input = {name: "Test Visitor", email: "visitor@example.com", company: "Example", website: "https://example.com", interest: "Full platform demo", message: "I would like to monitor my websites."};
afterEach(() => vi.restoreAllMocks());
describe("public demo enquiries", () => {
 it("rejects submissions from an untrusted origin", async () => {
  expect((await request(app).post("/api/v1/demo-enquiries").set("Origin", "https://untrusted.example").send(input)).status).toBe(403);
 });
 it("validates fields before accessing the database", async () => {
  expect((await request(app).post("/api/v1/demo-enquiries").set("Origin", "http://localhost:5173").send({...input,email:"invalid"})).status).toBe(400);
 });
 it("does not claim success when the database is unavailable", async () => {
  vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0);
  expect((await request(app).post("/api/v1/demo-enquiries").set("Origin", "http://localhost:5173").send(input)).status).toBe(503);
 });
 it("saves an enquiry without returning private details", async () => {
  vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(1);
  const create = vi.spyOn(DemoEnquiry, "create").mockResolvedValue({} as never);
  const response = await request(app).post("/api/v1/demo-enquiries").set("Origin", "http://localhost:5173").send(input);
  expect(response.status).toBe(201);
  expect(response.body).toEqual({data:{success:true}});
  expect(create).toHaveBeenCalledWith(input);
 });
 it("rejects unknown fields and credential-bearing URLs", () => {
  expect(demoEnquirySchema.safeParse({...input,status:"CLOSED"}).success).toBe(false);
  expect(demoEnquirySchema.safeParse({...input,website:"https://secret:password@example.com"}).success).toBe(false);
 });
});
