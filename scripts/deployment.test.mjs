import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateRenderApiOrigin } from './render-api-origin.mjs';
const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
test('Vercel has one static routing configuration with explicit destinations',()=>{
 assert.equal(existsSync(new URL('../vercel.mjs',import.meta.url)),false);
 assert.equal(config.outputDirectory,'client/dist');
 assert.equal(config.buildCommand,'npm run build:frontend');
 assert.equal(config.installCommand,'npm ci --include=dev');
 assert.equal(config.rewrites,undefined);assert.equal(config.headers,undefined);
 for(const route of config.routes)assert.ok(route.handle||route.continue||typeof route.dest==='string');
 assert.ok(!JSON.stringify(config).includes('MONGODB_URI'));
});
test('API routes resolve the configured backend before any SPA fallback',()=>{
 const proxy=config.routes.find(route=>route.env?.includes('RENDER_API_ORIGIN'));
 assert.equal(proxy.dest,'$RENDER_API_ORIGIN/api/$1');
 assert.equal(proxy.headers['Cache-Control'],'private, no-store');
 const origin=validateRenderApiOrigin('https://orbitops-api.example');
 for(const path of ['/api/v1/auth/session','/api/v1/clients','/api/v1/health/ready','/api']){
  const match=path.match(new RegExp('^'+proxy.src));assert.ok(match);
  const destination=proxy.dest.replace('$RENDER_API_ORIGIN',origin).replace('$1',match[1]||'');
  assert.equal(destination,origin+path+(path==='/api'?'/':''));
 }
 const fallback=config.routes.at(-1);
 assert.equal(fallback.dest,'/index.html');
 for(const path of ['/features','/login','/privacy','/clients'])assert.ok(new RegExp('^'+fallback.src+'$').test(path));
 for(const path of ['/api','/api/v1/clients'])assert.ok(!new RegExp('^'+fallback.src+'$').test(path));
 assert.ok(config.routes.findIndex(route=>route.handle==='filesystem')<config.routes.length-1);
});
test('missing or unsafe backend addresses fail with an actionable build message',()=>{
 for(const value of [undefined,'','http://example.com','https://user:password@example.com','https://example.com/api/v1','https://example.com?token=secret','https://example.com/'])assert.throws(()=>validateRenderApiOrigin(value),/Set RENDER_API_ORIGIN/);
});
test('a missing deployment origin stops before compilation with a clear message',()=>{
 const environment={...process.env};delete environment.RENDER_API_ORIGIN;
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('./build-frontend.mjs',import.meta.url))],{env:environment,encoding:'utf8'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/DEPLOYMENT SETTING NEEDED/);
 assert.match(result.stderr,/RENDER_API_ORIGIN/);
 assert.ok(!result.stderr.includes('at validateRenderApiOrigin'));
});
test('the deployment build script also runs from the client workspace',()=>{
 const client=JSON.parse(readFileSync(new URL('../client/package.json',import.meta.url),'utf8'));
 const environment={...process.env};delete environment.RENDER_API_ORIGIN;
 assert.equal(client.scripts['build:frontend'],'node ../scripts/build-frontend.mjs');
 const result=spawnSync(process.execPath,['../scripts/build-frontend.mjs'],{cwd:fileURLToPath(new URL('../client/',import.meta.url)),env:environment,encoding:'utf8'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/DEPLOYMENT SETTING NEEDED/);
 assert.ok(!result.stderr.includes('Cannot find module'));
});
test('reviewed build install scripts are approved for the locked package versions',()=>{
 const root=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
 for(const name of ['esbuild','protobufjs']){
  const version=lock.packages['node_modules/'+name].version;
  assert.equal(root.allowScripts[name+'@'+version],true);
 }
 assert.equal(root.allowScripts['*'],undefined);
});
