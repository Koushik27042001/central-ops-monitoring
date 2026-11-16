import { env } from '../config/env.js';

export const FIREBASE_SESSION_COOKIE='centralops_firebase';
export const sessionLifetimeMs=()=>env.AUTH_SESSION_DAYS*24*60*60*1000;
export const sessionCookieOptions={httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'strict' as const,path:'/api/v1'};
export function firebaseSessionCookie(header='') {
 return header.split(';').map(value=>value.trim()).find(value=>value.startsWith(FIREBASE_SESSION_COOKIE+'='))?.slice(FIREBASE_SESSION_COOKIE.length+1);
}
