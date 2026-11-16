import request from 'supertest';
import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const sdk=vi.hoisted(()=>({verifyIdToken:vi.fn(),createSessionCookie:vi.fn(),verifySessionCookie:vi.fn(),revokeRefreshTokens:vi.fn()}));
vi.mock('./firebase.js',()=>({firebaseAdminAuth:()=>sdk}));
import { app } from '../app.js';
import { env } from '../config/env.js';
import { User, AuditLog, Session } from '../models/index.js';
import { sessionLifetimeMs } from './session.js';

describe('fixed two-day JWT sessions',()=>{
 const previous={...env};
 const now=Math.floor(Date.now()/1000);
 const identity=()=>({uid:'user-a',email:'a@example.com',email_verified:true,auth_time:now,iat:now,exp:now+172800});
 const login=()=>request(app).post('/api/v1/auth/session').set('Origin','http://localhost:5173').set('X-Account-Uid','user-a');
 beforeEach(()=>{
  Object.assign(env,{AUTH_PROVIDER:'firebase',AUTH_SESSION_DAYS:2,PUBLIC_REGISTRATION:true,FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test@example.com',FIREBASE_PRIVATE_KEY:'test'});
  for(const mock of Object.values(sdk))mock.mockReset();
  sdk.verifyIdToken.mockResolvedValue(identity());sdk.createSessionCookie.mockResolvedValue('signed-session-jwt');sdk.verifySessionCookie.mockResolvedValue(identity());
  vi.spyOn(mongoose.connection,'readyState','get').mockReturnValue(1);
  vi.spyOn(User,'findOne').mockResolvedValue(null);
 });
 afterEach(()=>{Object.assign(env,previous);vi.restoreAllMocks();});
 it('creates an HttpOnly session JWT with exactly 172800 seconds of cookie lifetime',async()=>{
  const response=await login().send({idToken:'fresh-id-token'});
  expect(response.status).toBe(200);
  expect(sdk.verifyIdToken).toHaveBeenCalledWith('fresh-id-token',true);
  expect(sdk.createSessionCookie).toHaveBeenCalledWith('fresh-id-token',{expiresIn:172800000});
  const cookie=String(response.headers['set-cookie']);
  expect(cookie).toContain('centralops_firebase=signed-session-jwt');expect(cookie).toContain('Max-Age=172800');expect(cookie).toContain('HttpOnly');expect(cookie).toContain('SameSite=Strict');expect(cookie).toContain('Path=/api/v1');
  expect(response.body.data).not.toHaveProperty('token');expect(Date.parse(response.body.data.expiresAt)).toBeGreaterThan(Date.now()+sessionLifetimeMs()-5000);
 });
 it('rejects login CSRF from a different origin',async()=>{
  expect((await request(app).post('/api/v1/auth/session').set('Origin','https://other.invalid').send({idToken:'token'})).status).toBe(403);
  expect(sdk.createSessionCookie).not.toHaveBeenCalled();
 });
 it('rejects invalid ID tokens',async()=>{
  sdk.verifyIdToken.mockRejectedValue(new Error('invalid'));
  expect((await login().send({idToken:'invalid'})).status).toBe(401);
  expect(sdk.createSessionCookie).not.toHaveBeenCalled();
 });
 it('cannot renew a session using an old refreshed Firebase sign-in',async()=>{
  sdk.verifyIdToken.mockResolvedValue({...identity(),auth_time:now-600});
  expect((await login().send({idToken:'old-sign-in'})).status).toBe(401);
  expect(sdk.createSessionCookie).not.toHaveBeenCalled();
 });
 it('rejects unverified accounts',async()=>{
  sdk.verifyIdToken.mockResolvedValue({...identity(),email_verified:false});
  expect((await login().send({idToken:'unverified'})).status).toBe(403);
  expect(sdk.createSessionCookie).not.toHaveBeenCalled();
 });
 it('rejects inactive workspace accounts',async()=>{
  vi.mocked(User.findOne).mockResolvedValue({get:(key:string)=>key==='isActive'?false:'OWNER'} as never);
  expect((await login().send({idToken:'inactive'})).status).toBe(403);
 });
 it('rejects account changes during exchange',async()=>{
  expect((await login().set('X-Account-Uid','user-b').send({idToken:'user-a'})).status).toBe(401);
  expect(sdk.createSessionCookie).not.toHaveBeenCalled();
 });
 it('does not accept a Firebase ID token in place of a session cookie',async()=>{
  expect((await request(app).get('/api/v1/clients').set('Authorization','Bearer refreshed-token')).status).toBe(401);
  expect(sdk.verifySessionCookie).not.toHaveBeenCalled();
 });
 it('rejects expired/revoked session JWTs and clears the cookie',async()=>{
  sdk.verifySessionCookie.mockRejectedValue(new Error('expired or revoked'));
  const response=await request(app).get('/api/v1/auth/me').set('Cookie','centralops_firebase=expired');
  expect(response.status).toBe(401);expect(String(response.headers['set-cookie'])).toContain('centralops_firebase=;');
  expect(sdk.verifySessionCookie).toHaveBeenCalledWith('expired',true);
 });
 it('caps old sessions at the configured two days',async()=>{
  sdk.verifySessionCookie.mockResolvedValue({...identity(),iat:now-172801,exp:now+86400});
  expect((await request(app).get('/api/v1/auth/me').set('Cookie','centralops_firebase=too-old')).status).toBe(401);
 });
 it('does not expose another account through a stale cookie after an account switch',async()=>{
  expect((await request(app).get('/api/v1/auth/me').set('Cookie','centralops_firebase=user-a').set('X-Account-Uid','user-b')).status).toBe(401);
 });
 it('reports expiry to the browser without extending the JWT on each request',async()=>{
  const user={_id:new mongoose.Types.ObjectId(),get:(key:string)=>({isActive:true,role:'OWNER',firebaseUid:'user-a'}[key])};
  vi.spyOn(User,'findOneAndUpdate').mockResolvedValue(user as never);
  const response=await request(app).get('/api/v1/auth/me').set('Cookie','centralops_firebase=valid').set('X-Account-Uid','user-a');
  expect(response.status).toBe(200);expect(Date.parse(response.body.data.sessionExpiresAt)).toBe((now+172800)*1000);
  expect(sdk.createSessionCookie).not.toHaveBeenCalled();expect(response.headers['set-cookie']).toBeUndefined();
 });
 it('revokes the signed-in account and clears cookies at logout',async()=>{
  const user={_id:new mongoose.Types.ObjectId(),get:(key:string)=>({isActive:true,role:'OWNER',firebaseUid:'user-a'}[key])};
  vi.spyOn(User,'findOneAndUpdate').mockResolvedValue(user as never);
  vi.spyOn(Session,'deleteOne').mockResolvedValue({deletedCount:1,acknowledged:true});
  vi.spyOn(AuditLog,'create').mockResolvedValue({} as never);
  const response=await request(app).post('/api/v1/auth/logout').set('Origin','http://localhost:5173').set('Cookie','centralops_firebase=valid');
  expect(response.status).toBe(200);expect(sdk.revokeRefreshTokens).toHaveBeenCalledWith('user-a');expect(String(response.headers['set-cookie'])).toContain('centralops_firebase=;');
 });
});
