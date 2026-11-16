import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Vercel proxies APIs before SPA routes and never exposes secrets', async () => {
 const previous=process.env.RENDER_API_ORIGIN;
 try {
  process.env.RENDER_API_ORIGIN='https://orbitops-api.example';
  const {config}=await import('../vercel.mjs?valid');
  assert.equal(config.outputDirectory,'client/dist');
  assert.deepEqual(config.rewrites[0],{source:'/api/:path*',destination:'https://orbitops-api.example/api/:path*'});
  assert.equal(config.rewrites[1].destination,'/index.html');
  assert.ok(new RegExp('^'+config.rewrites[1].source+'$').test('/features'));
  assert.ok(!new RegExp('^'+config.rewrites[1].source+'$').test('/api/v1/health/ready'));
  assert.ok(!new RegExp('^'+config.rewrites[1].source+'$').test('/api'));
  assert.ok(!JSON.stringify(config).includes('MONGODB_URI'));
  for (const [index,value] of [undefined,'http://example.com','https://user:password@example.com','https://example.com/api/v1','https://example.com?token=secret'].entries()){
   if(value===undefined)delete process.env.RENDER_API_ORIGIN;else process.env.RENDER_API_ORIGIN=value;
   await assert.rejects(import('../vercel.mjs?invalid'+index),/Set RENDER_API_ORIGIN/);
  }
 } finally {if(previous===undefined)delete process.env.RENDER_API_ORIGIN;else process.env.RENDER_API_ORIGIN=previous;}
});
