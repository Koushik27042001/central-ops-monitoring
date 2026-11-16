import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const verify = vi.hoisted(() => vi.fn());
const claims=()=>({iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+172800});
vi.mock('./firebase.js', () => ({firebaseAdminAuth: () => ({verifySessionCookie: verify})}));
import { authenticate } from './auth.js';
import { env } from '../config/env.js';
import mongoose from 'mongoose';
import { User } from '../models/index.js';

describe('Firebase authentication boundaries', () => {
 const previous = {...env};
 const app = express();
 app.get('/', authenticate, (_req, res) => res.json({ok:true}));
 beforeEach(() => {
  Object.assign(env, {PUBLIC_REGISTRATION:false, AUTH_PROVIDER:'firebase', FIREBASE_PROJECT_ID:'test', FIREBASE_CLIENT_EMAIL:'admin@test.invalid', FIREBASE_PRIVATE_KEY:'test', FIREBASE_ADMIN_EMAILS:'admin@example.com'});
  verify.mockReset();
 });
 afterEach(() => { Object.assign(env, previous); vi.restoreAllMocks(); });
 it.each([true, false])('enforces database account activation: %s', async active => {
  verify.mockResolvedValue({...claims(),uid:'test',email:'admin@example.com',email_verified:true});
  vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
  vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue({get:(key:string) => key === 'isActive' ? active : key === 'firebaseUid' ? 'test' : 'SUPER_ADMIN'} as never);
  expect((await request(app).get('/').set('Cookie','centralops_firebase=valid')).status).toBe(active ? 200 : 403);
 });
 it('rejects missing tokens and ignores legacy cookies', async () => {
  expect((await request(app).get('/').set('Cookie','centralops=old')).status).toBe(401);
  expect(verify).not.toHaveBeenCalled();
 });
 it('rejects invalid tokens and checks revocation', async () => {
  verify.mockRejectedValue(new Error('invalid'));
  expect((await request(app).get('/').set('Cookie','centralops_firebase=bad')).status).toBe(401);
  expect(verify).toHaveBeenCalledWith('bad', true);
 });
 it.each([{email:'other@example.com',email_verified:true}, {email:'admin@example.com',email_verified:false}])('blocks unauthorized identities %j', async identity => {
  verify.mockResolvedValue({uid:'test',...identity});
  expect((await request(app).get('/').set('Cookie','centralops_firebase=valid')).status).toBe(403);
 });
 it('reports incomplete server configuration', async () => {
  env.FIREBASE_PRIVATE_KEY='';
  expect((await request(app).get('/')).status).toBe(503);
 });
 it('allows a verified freelancer outside the admin allowlist in public mode',async()=>{
  env.PUBLIC_REGISTRATION=true;
  verify.mockResolvedValue({...claims(),uid:'freelancer',email:'freelancer@example.com',email_verified:true});
  vi.spyOn(mongoose.connection,'readyState','get').mockReturnValue(1);
  const create=vi.spyOn(User,'findOneAndUpdate').mockResolvedValue({get:(key:string)=>({isActive:true,role:'OWNER',firebaseUid:'freelancer'}[key])} as never);
  expect((await request(app).get('/').set('Cookie','centralops_firebase=valid')).status).toBe(200);
  expect(create).toHaveBeenCalledWith({email:'freelancer@example.com'},expect.objectContaining({$setOnInsert:expect.objectContaining({role:'OWNER',firebaseUid:'freelancer',onboardingStatus:'PENDING'})}),expect.anything());
 });
 it('blocks unverified accounts in public mode',async()=>{
  env.PUBLIC_REGISTRATION=true;
  verify.mockResolvedValue({uid:'freelancer',email:'freelancer@example.com',email_verified:false});
  expect((await request(app).get('/').set('Cookie','centralops_firebase=valid')).status).toBe(403);
 });
 it('blocks a mismatched Firebase identity',async()=>{
  env.PUBLIC_REGISTRATION=true;
  verify.mockResolvedValue({...claims(),uid:'different',email:'freelancer@example.com',email_verified:true});
  vi.spyOn(mongoose.connection,'readyState','get').mockReturnValue(1);
  vi.spyOn(User,'findOneAndUpdate').mockResolvedValue({get:(key:string)=>({isActive:true,role:'OWNER',firebaseUid:'original'}[key])} as never);
  expect((await request(app).get('/').set('Cookie','centralops_firebase=valid')).status).toBe(403);
 });
});
