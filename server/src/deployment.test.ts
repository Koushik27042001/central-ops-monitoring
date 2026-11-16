import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";
import { env, envSchema } from "./config/env.js";

describe("deployment configuration", () => {
 const production = {NODE_ENV:"production",CLIENT_ORIGIN:"https://orbitops.example",MONGODB_URI:"mongodb+srv://example.invalid/centralops",INTEGRATION_ENCRYPTION_KEY:"a".repeat(64)};
 it("accepts Render's assigned port and explicit proxy trust", () => {
  const settings=envSchema.parse({...production,PORT:"10000",TRUST_PROXY_HOPS:"1"});
  expect(settings.PORT ?? settings.API_PORT).toBe(10000);
  expect(settings.TRUST_PROXY_HOPS).toBe(1);
  expect(envSchema.parse({}).TRUST_PROXY_HOPS).toBe(0);
 });
 it("fails early for missing production credentials and insecure frontend origins", () => {
  for(const key of ["MONGODB_URI","INTEGRATION_ENCRYPTION_KEY"] as const) expect(envSchema.safeParse({...production,[key]:undefined}).success).toBe(false);
  expect(envSchema.safeParse({...production,CLIENT_ORIGIN:"http://localhost:5173"}).success).toBe(false);
  expect(envSchema.safeParse({...production,CLIENT_ORIGIN:"https://orbitops.example/"}).success).toBe(false);
  expect(envSchema.safeParse({...production,PORT:"0"}).success).toBe(false);
 });
 it.each(['-1','1.5','6','true','not-a-number'])('rejects unsafe proxy configuration: %s',value=>{
  expect(envSchema.safeParse({TRUST_PROXY_HOPS:value}).success).toBe(false);
 });
 it('applies the proxy boundary without trusting extra forwarded hops',()=>{
  expect(app.get('trust proxy')).toBe(env.TRUST_PROXY_HOPS);
  const trust=app.get('trust proxy fn') as (address:string,hop:number)=>boolean;
  expect(trust('198.51.100.10',env.TRUST_PROXY_HOPS)).toBe(false);
  if(env.TRUST_PROXY_HOPS>0)expect(trust('198.51.100.10',env.TRUST_PROXY_HOPS-1)).toBe(true);
 });
 it('provides workspace defaults and validates every workspace limit',()=>{
  const defaults=envSchema.parse({});
  expect([defaults.WORKSPACE_MAX_WEBSITES,defaults.WORKSPACE_MAX_ENDPOINTS,defaults.WORKSPACE_MAX_RECORDS,defaults.WORKSPACE_MAX_PENDING_JOBS]).toEqual([25,100,1000,25]);
  for(const key of ['WORKSPACE_MAX_WEBSITES','WORKSPACE_MAX_ENDPOINTS','WORKSPACE_MAX_RECORDS','WORKSPACE_MAX_PENDING_JOBS']){
   for(const value of ['0','-1','1.5','invalid'])expect(envSchema.safeParse({[key]:value}).success).toBe(false);
   expect(envSchema.safeParse({[key]:'10'}).success).toBe(true);
  }
 });
 it("prevents proxy caching of health and protected API responses", async () => {
  for(const path of ["/api/v1/health/live","/api/v1/clients"]){
   const response=await request(app).get(path);
   expect(response.headers["cache-control"]).toBe("private, no-store");
  }
 });
});
