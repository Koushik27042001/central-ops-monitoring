import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app.js";
import { envSchema } from "./config/env.js";
import { parsePatch, endpointSchema, maintenanceSchema, websiteSchema } from "./validators/index.js";
import { validateResponse } from "./services/assertions.js";
const websiteId = 'a'.repeat(24);
describe('API response assertions', () => {
 it('checks nested fields and exact falsy values', () => {
  expect(validateResponse('{"data":{"active":false,"count":0,"value":null}}', [{path:'data.active',value:false},{path:'data.count',value:0},{path:'data.value',value:null}])).toEqual([]);
 });
 it('reports missing fields, mismatches and invalid JSON', () => {
  expect(validateResponse('{}',[{path:'data.id'}])).toEqual(['data.id is missing']);
  expect(validateResponse('{"ok":false}',[{path:'ok',value:true}])).toEqual(['ok does not match expected value']);
  expect(validateResponse('html',[{path:'ok'}])).toEqual(['Response is not valid JSON']);
 });
 it('rejects GraphQL errors even for HTTP 200',()=>expect(validateResponse('{"data":null,"errors":[{"message":"failed"}]}',[{path:'data'}])).toContain('GraphQL response contains errors'));
 it('does not traverse inherited properties',()=>expect(validateResponse('{}',[{path:'constructor'}])).toEqual(['constructor is missing']));
});
describe('configuration and feature boundaries',()=>{
 it('rejects malformed database configuration and origins with paths',()=>{
  expect(envSchema.safeParse({MONGODB_URI:'https://example.com'}).success).toBe(false);
  expect(envSchema.safeParse({CLIENT_ORIGIN:'http://localhost:5173/'}).success).toBe(false);
  expect(envSchema.parse({MONGODB_URI:''}).MONGODB_URI).toBeUndefined();
 });
 it('limits API checks to non-destructive methods',()=>{
  expect(endpointSchema.safeParse({websiteId,name:'Read',url:'https://example.com'}).success).toBe(true);
  expect(endpointSchema.safeParse({websiteId,name:'Delete',url:'https://example.com',method:'DELETE'}).success).toBe(false);
 });
 it('validates maintenance dates and states',()=>expect(maintenanceSchema.safeParse({websiteId,maintenanceType:'Update',description:'Patch dependencies',date:'invalid',developer:'Admin',status:'COMPLETED'}).success).toBe(false));
 it('does not reset website defaults during partial updates',()=>expect(parsePatch(websiteSchema, {name:'Renamed'})).toEqual({name:'Renamed'}));
 it.each(['api-endpoints','maintenance','incidents','notifications','analytics/performance'])('protects %s',async path=>expect((await request(app).get('/api/v1/'+path)).status).toBe(401));
});
