import { config } from 'dotenv';
import assert from 'node:assert/strict';
config({path:'server/.env'});
const origin=process.argv[2] || 'http://localhost:5173';
const base='http://localhost:5173/api/v1/';
async function request(path,options={}){const response=await fetch(base+path,{signal:AbortSignal.timeout(15000),...options});const body=await response.json();assert.equal(response.status,200,path+' failed ('+response.status+'): '+(body.error?.message || 'Unexpected response'));return {response,body};}
await request('health/live');await request('health/ready');
const {response}=await request('auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
const cookie=response.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'Login must set a session cookie');
const headers={Cookie:cookie,Origin:origin};
for(const path of ['auth/me','analytics/overview','analytics/performance','clients','websites','api-endpoints','incidents','blogs','tickets','maintenance','notifications','integrations','audit-logs']){
 const {body}=await request(path,{headers});assert.ok(body.data,path+' must return data');console.log('PASS '+path);
}
await request('auth/logout',{method:'POST',headers});
const afterLogout=await fetch(base+'auth/me',{headers,signal:AbortSignal.timeout(15000)});assert.equal(afterLogout.status,401);
console.log('PASS: API readiness, login, all dashboard data requests, logout and session invalidation through the frontend proxy.');
