import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../app.js";
import { databaseState } from "../config/database.js";
vi.mock("../config/database.js", () => ({databaseState:vi.fn(()=>"connected")}));
afterEach(()=>vi.mocked(databaseState).mockReturnValue("connected"));
describe("public browser health summary",()=>{
 it("shows feature dependency status without claiming worker execution",async()=>{
  const response=await request(app).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.body.features.authentication.status).toBe('DEPENDENCY_READY');
  expect(response.body.features.monitoring.status).toBe('NOT_VERIFIED');
  expect(response.body.features.monitoring.httpStatus).toBeNull();
  expect(response.body.statusCodeReference['503']).toContain('Service Unavailable');
  expect(response.headers['cache-control']).toBe('private, no-store');
 });
 it.each(['disconnected','not_configured'] as const)('reports dependency failures for %s',async state=>{
  vi.mocked(databaseState).mockReturnValue(state);
  const response=await request(app).get('/api/health');
  expect(response.status).toBe(503);
  expect(response.body.checks.api.httpStatus).toBe(200);
  expect(response.body.features.websites.httpStatus).toBe(503);
  expect(response.body.features.publishing.status).toBe('UNAVAILABLE');
 });
 it('supports the versioned summary and preserves existing liveness',async()=>{
  expect((await request(app).get('/api/v1/health/status')).body.service).toBe('OrbitOps API');
  expect((await request(app).get('/api/v1/health')).body).toEqual({status:'alive'});
 });
 it('never returns credentials or connection URLs',async()=>{
  const response=await request(app).get('/api/health');
  expect(response.text).not.toMatch(/mongodb(?:\+srv)?:\/\/|passwordHash|INTEGRATION_ENCRYPTION_KEY|MONGODB_URI/);
 });
});
