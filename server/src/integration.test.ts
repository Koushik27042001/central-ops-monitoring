import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createIntegrationRouter } from '../../packages/client-sdk/index.js';
import { encryptSecret, decryptSecret } from './services/secrets.js';
import { env } from './config/env.js';
describe('integration credentials',()=>{
 it('encrypts with authenticated unique nonces and rejects tampering',()=>{
  const previous=env.INTEGRATION_ENCRYPTION_KEY;
  env.INTEGRATION_ENCRYPTION_KEY='1'.repeat(64);
  try {const first=encryptSecret('a private credential');expect(first).not.toContain('a private credential');expect(encryptSecret('a private credential')).not.toBe(first);expect(decryptSecret(first)).toBe('a private credential');const parts=first.split('.');parts[2]='00';expect(()=>decryptSecret(parts.join('.'))).toThrow();}finally{env.INTEGRATION_ENCRYPTION_KEY=previous;}
 });
});
describe('client SDK',()=>{
 const token='t'.repeat(40), key='a'.repeat(64);
 function setup(){const adapter=vi.fn(async()=>({id:'remote-id'}));const app=express();app.use(express.json());app.use('/api/integrations',createIntegrationRouter({token,upsertBlog:adapter}));return {app,adapter};}
 it('requires authentication for integration endpoints',async()=>{const {app}=setup();expect((await request(app).get('/api/integrations/health')).status).toBe(401);expect((await request(app).get('/api/integrations/health').set('Authorization','Bearer '+token)).status).toBe(200);});
 it('validates payloads before calling the adapter',async()=>{const {app,adapter}=setup();expect((await request(app).post('/api/integrations/blogs').set('Authorization','Bearer '+token).send({title:'Bad'})).status).toBe(400);expect(adapter).not.toHaveBeenCalled();});
 it('passes only allowed fields and a durable idempotency key to the adapter',async()=>{const {app,adapter}=setup();const result=await request(app).post('/api/integrations/blogs').set('Authorization','Bearer '+token).set('Idempotency-Key',key).send({_id:'b'.repeat(24),title:'Hello',slug:'hello',content:'Content',role:'admin'});expect(result.status).toBe(200);expect(adapter).toHaveBeenCalledWith({externalId:'b'.repeat(24),title:'Hello',slug:'hello',content:'Content',excerpt:''},key);});
});
