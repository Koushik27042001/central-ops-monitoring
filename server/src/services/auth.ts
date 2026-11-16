import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { Session, User } from "../models/index.js";
import mongoose from "mongoose";
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function hashPassword(password: string) { const salt = randomBytes(16).toString("hex"); return salt + ":" + scryptSync(password, salt, 64).toString("hex"); }
export function verifyPassword(password: string, stored: string) { const [salt, hash] = stored.split(":"); if (!salt || !hash) return false; const actual = scryptSync(password, salt, 64); const expected = Buffer.from(hash, "hex"); return expected.length === actual.length && timingSafeEqual(actual, expected); }
export function cookieToken(header = "") { return header.split(";").map(x => x.trim()).find(x => x.startsWith("centralops="))?.slice(11); }
import { env } from '../config/env.js';
import { firebaseAdminAuth } from './firebase.js';
import { firebaseSessionCookie, FIREBASE_SESSION_COOKIE, sessionCookieOptions, sessionLifetimeMs } from './session.js';
export const authenticate: RequestHandler = async (req, res, next) => {
 if (env.AUTH_PROVIDER === 'firebase') {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {res.status(503).json({error:{code:'AUTH_NOT_CONFIGURED',message:'Configure Firebase Admin credentials in server/.env'}});return;}
  const token = firebaseSessionCookie(req.headers.cookie);
  if (!token) {res.status(401).json({error:{code:'UNAUTHORIZED',message:'Sign in required'}});return;}
  let identity;
  try {identity = await firebaseAdminAuth().verifySessionCookie(token, true);}
  catch {res.clearCookie(FIREBASE_SESSION_COOKIE,sessionCookieOptions).status(401).json({error:{code:'UNAUTHORIZED',message:'Session expired. Please sign in again.'}});return;}
  if ((identity.iat && Date.now()-identity.iat*1000>=sessionLifetimeMs()) || (req.headers['x-account-uid'] && req.headers['x-account-uid']!==identity.uid)) {res.status(401).json({error:{code:'UNAUTHORIZED',message:'Session expired or account changed. Please sign in again.'}});return;}
  const email = identity.email?.toLowerCase();
  const allowed = env.FIREBASE_ADMIN_EMAILS.split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!email || !identity.email_verified || (!env.PUBLIC_REGISTRATION && !allowed.includes(email))) {res.status(403).json({error:{code:'FORBIDDEN',message:'A verified account with workspace access is required.'}});return;}
  if (mongoose.connection.readyState !== 1) {res.status(503).json({error:{code:'DATABASE_UNAVAILABLE',message:'Database unavailable'}});return;}
  const user = await User.findOneAndUpdate({email}, {$setOnInsert:{onboardingStatus:'PENDING', firebaseUid:identity.uid, name:identity.name || email, email, role:env.PUBLIC_REGISTRATION ? 'OWNER' : 'SUPER_ADMIN', isActive:true}}, {upsert:true,new:true});
  if (!user?.get('isActive') || !['SUPER_ADMIN','OWNER'].includes(user.get('role'))) {res.status(403).json({error:{code:'FORBIDDEN',message:'Workspace access disabled'}});return;}
  if(user.get('firebaseUid') && user.get('firebaseUid') !== identity.uid){res.status(403).json({error:{code:'FORBIDDEN',message:'Account identity does not match'}});return;}
  if(!user.get('firebaseUid')) {
   const binding=await User.updateOne({_id:user._id, firebaseUid:{$exists:false}},{$set:{firebaseUid:identity.uid}});
   if(!binding.modifiedCount && !await User.exists({_id:user._id,firebaseUid:identity.uid})){res.status(403).json({error:{code:'FORBIDDEN',message:'Account identity does not match'}});return;}
   user.set('firebaseUid',identity.uid);
  }
  res.locals.sessionExpiresAt=new Date(Math.min(identity.exp*1000,identity.iat*1000+sessionLifetimeMs())).toISOString();
  res.locals.user = user; res.locals.firebaseUid = identity.uid;
  next(); return;
 }
 const token = cookieToken(req.headers.cookie);
 if (!token) { res.status(401).json({error: {code: "UNAUTHORIZED", message: "Sign in required"}}); return; }
 if (mongoose.connection.readyState !== 1) {res.status(503).json({error: {code: "DATABASE_UNAVAILABLE", message: "Database unavailable"}}); return;}
 const session = await Session.findOne({tokenHash: hashToken(token), expiresAt: {$gt: new Date()}});
 const user = session && await User.findOne({_id: session.get("userId"), isActive: true});
 if (!user || user.get("role") !== "SUPER_ADMIN") { res.status(401).json({error: {code: "UNAUTHORIZED", message: "Session expired"}}); return; }
 res.locals.sessionExpiresAt=new Date(session!.get('expiresAt')).toISOString();
 res.locals.user = user; next();
};
