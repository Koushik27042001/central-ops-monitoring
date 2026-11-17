import { inWorkspace, workspaceModel } from "../services/workspace.js";
import { endpointHealth } from '../services/endpoint-health.js';
import { probeEndpoint } from '../services/probe-endpoint.js';
import { ApiCheckResult as RawApiCheckResult } from '../models/index.js';
import { FIREBASE_SESSION_COOKIE, firebaseSessionCookie, sessionCookieOptions, sessionLifetimeMs } from '../services/session.js';
import { firebaseAdminAuth } from "../services/firebase.js";
import { encryptSecret } from "../services/secrets.js";
import { checkUrl } from "../services/outbound.js";
import { decryptSecret } from "../services/secrets.js";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { isAllowedClientOrigin } from "../config/origins.js";
import { authenticate, cookieToken, hashPassword, hashToken, verifyPassword } from "../services/auth.js";
import { Integration as RawIntegration, CredentialRotation as RawCredentialRotation, PublishingJob as RawPublishingJob, ApiEndpoint as RawApiEndpoint, MaintenanceRecord as RawMaintenanceRecord, BlogRevision as RawBlogRevision, AuditLog as RawAuditLog, BlogPost as RawBlogPost, Client as RawClient, Incident as RawIncident, MonitoringCheck as RawMonitoringCheck, MonitoringTarget as RawMonitoringTarget, Notification as RawNotification, Session, SupportTicket as RawSupportTicket, User, Website as RawWebsite } from "../models/index.js";
import { parsePatch, endpointSchema, maintenanceSchema, blogSchema, clientSchema, id, ticketSchema, websiteSchema } from "../validators/index.js";
const Integration = workspaceModel(RawIntegration);
const CredentialRotation = workspaceModel(RawCredentialRotation);
const PublishingJob = workspaceModel(RawPublishingJob);
const ApiEndpoint = workspaceModel(RawApiEndpoint);
const ApiCheckResult = workspaceModel(RawApiCheckResult);
const MaintenanceRecord = workspaceModel(RawMaintenanceRecord);
const BlogRevision = workspaceModel(RawBlogRevision);
const AuditLog = workspaceModel(RawAuditLog);
const BlogPost = workspaceModel(RawBlogPost);
const Client = workspaceModel(RawClient);
const Incident = workspaceModel(RawIncident);
const MonitoringCheck = workspaceModel(RawMonitoringCheck);
const MonitoringTarget = workspaceModel(RawMonitoringTarget);
const Notification = workspaceModel(RawNotification);
const SupportTicket = workspaceModel(RawSupportTicket);
const Website = workspaceModel(RawWebsite);
export const managementRouter = Router();
managementRouter.use((req, _res, next) => {
 if (!/^\/(auth|clients|websites|tickets|blogs|incidents|notifications|audit-logs|monitoring|analytics|api-endpoints|maintenance|integrations)(\/|$)/.test(req.path)) {next("router"); return;}
 next();
});
const cookieOptions = sessionCookieOptions;
const dummyHash = hashPassword(randomBytes(32).toString("hex"));
managementRouter.use((req, res, next) => {
 if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !isAllowedClientOrigin(req.headers.origin)) {res.status(403).json({error: {code: "INVALID_ORIGIN", message: "Request origin is not allowed"}}); return;}
 next();
});
managementRouter.post("/auth/login", rateLimit({windowMs: 900000, limit: 10}), async (req, res) => {
 if (env.AUTH_PROVIDER === "firebase") {res.status(400).json({error:{code:"FIREBASE_REQUIRED",message:"Sign in using Firebase"}});return;}
 const input = z.object({email: z.email(), password: z.string().min(1).max(256)}).parse(req.body);
 if (mongoose.connection.readyState !== 1) {res.status(503).json({error: {code: "DATABASE_UNAVAILABLE", message: "Database unavailable"}}); return;}
 const user = await User.findOne({email: input.email.toLowerCase(), isActive: true}).select("+passwordHash");
 const valid = verifyPassword(input.password, String(user?.get("passwordHash") ?? dummyHash));
 if (!user || !valid || user.get("role") !== "SUPER_ADMIN") {res.status(401).json({error: {code: "INVALID_LOGIN", message: "Invalid email or password"}}); return;}
 const token = randomBytes(32).toString("hex");
 await Session.create({userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + sessionLifetimeMs())});
 await User.updateOne({_id: user._id}, {$set: {lastLogin: new Date()}});
 await RawAuditLog.create({ownerId:user._id, userId: user._id, action: "login", entityType: "auth", entityId: String(user._id)});
 res.cookie("centralops", token, {...cookieOptions, maxAge: sessionLifetimeMs()}).json({data: {sessionExpiresAt:new Date(Date.now()+sessionLifetimeMs()).toISOString(),_id:user._id,name: user.get("name"), email: user.get("email"),role:user.get("role"),onboardingStatus:user.get("onboardingStatus")}});
});
managementRouter.post('/auth/session',rateLimit({windowMs:900000,limit:20}),async(req,res)=>{
 if(env.AUTH_PROVIDER!=='firebase'){res.status(400).json({error:{code:'FIREBASE_REQUIRED',message:'Firebase authentication is not enabled'}});return;}
 const {idToken}=z.object({idToken:z.string().min(1).max(10000)}).strict().parse(req.body);
 if(!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY){res.status(503).json({error:{code:'AUTH_NOT_CONFIGURED',message:'Configure Firebase Admin credentials'}});return;}
 let identity;
 try{identity=await firebaseAdminAuth().verifyIdToken(idToken,true);}
 catch{res.status(401).json({error:{code:'UNAUTHORIZED',message:'Invalid sign-in. Please sign in again.'}});return;}
 const now=Math.floor(Date.now()/1000);
 if(!Number.isFinite(identity.auth_time) || now-identity.auth_time>300 || identity.auth_time>now+60){res.status(401).json({error:{code:'RECENT_LOGIN_REQUIRED',message:'Please sign in again to start a new session.'}});return;}
 const allowed=env.FIREBASE_ADMIN_EMAILS.split(',').map(value=>value.trim().toLowerCase());
 if(!identity.email || !identity.email_verified || (!env.PUBLIC_REGISTRATION && !allowed.includes(identity.email.toLowerCase()))){res.status(403).json({error:{code:'FORBIDDEN',message:'A verified account with workspace access is required.'}});return;}
 if(req.headers['x-account-uid'] && req.headers['x-account-uid']!==identity.uid){res.status(401).json({error:{code:'UNAUTHORIZED',message:'Account changed. Please sign in again.'}});return;}
 if(mongoose.connection.readyState!==1){res.status(503).json({error:{code:'DATABASE_UNAVAILABLE',message:'Database unavailable'}});return;}
 const existing=await User.findOne({email:identity.email.toLowerCase()});
 if(existing && (!existing.get('isActive') || !['SUPER_ADMIN','OWNER'].includes(existing.get('role')) || (existing.get('firebaseUid') && existing.get('firebaseUid')!==identity.uid))){res.status(403).json({error:{code:'FORBIDDEN',message:'Workspace access disabled'}});return;}
 const expiresIn=sessionLifetimeMs();
 let cookie;
 try{cookie=await firebaseAdminAuth().createSessionCookie(idToken,{expiresIn});}
 catch{res.status(503).json({error:{code:'SESSION_UNAVAILABLE',message:'Unable to start a session. Please try again.'}});return;}
 res.cookie(FIREBASE_SESSION_COOKIE,cookie,{...sessionCookieOptions,maxAge:expiresIn}).json({data:{expiresAt:new Date(Date.now()+expiresIn).toISOString()}});
});
// An ordinary signed-out visit is not an authentication failure. Existing
// cookies still go through the full signature, revocation and workspace checks.
managementRouter.get('/auth/session',(req,res,next)=>{
 const token=env.AUTH_PROVIDER==='firebase'?firebaseSessionCookie(req.headers.cookie):cookieToken(req.headers.cookie);
 if(!token){res.json({data:null});return;}
 return authenticate(req,res,next);
},(_req,res)=>res.json({data:{...(res.locals.user.toObject?.() ?? res.locals.user),sessionExpiresAt:res.locals.sessionExpiresAt}}));
managementRouter.get('/auth/config', (_req,res)=>res.json({data:{provider:env.AUTH_PROVIDER, publicRegistration:env.AUTH_PROVIDER === 'firebase' && env.PUBLIC_REGISTRATION}}));
managementRouter.use(authenticate);
managementRouter.use((_req,res,next)=>inWorkspace(res.locals.user._id,()=>next()));
managementRouter.use(rateLimit({windowMs:60000,limit:120,keyGenerator:(_req,res)=>String(res.locals.user._id),standardHeaders:'draft-8',legacyHeaders:false}));
managementRouter.get("/auth/me", (_req, res) => res.json({data: {...(res.locals.user.toObject?.() ?? res.locals.user),sessionExpiresAt:res.locals.sessionExpiresAt}}));
managementRouter.patch('/auth/onboarding',async(req,res)=>{
 const input=z.object({status:z.enum(['COMPLETED','SKIPPED'])}).strict().parse(req.body);
 const result=await User.updateOne({_id:res.locals.user._id,isActive:true},{$set:{onboardingStatus:input.status}});
 if(!result.matchedCount){res.status(401).json({error:{code:'UNAUTHORIZED',message:'Sign in required'}});return;}
 res.json({data:{onboardingStatus:input.status}});
});
managementRouter.post("/auth/logout", async (req, res) => { if (res.locals.firebaseUid) await firebaseAdminAuth().revokeRefreshTokens(res.locals.firebaseUid); await Session.deleteOne({userId:res.locals.user._id,tokenHash: hashToken(cookieToken(req.headers.cookie) ?? "")}); await AuditLog.create({userId: res.locals.user._id, action: "logout", entityType: "auth", entityId: String(res.locals.user._id)}); res.clearCookie(FIREBASE_SESSION_COOKIE,sessionCookieOptions).clearCookie("centralops", cookieOptions).json({data: {success: true}}); });
managementRouter.use((_req, res, next) => {
 if (mongoose.connection.readyState !== 1) {res.status(503).json({error: {code: "DATABASE_UNAVAILABLE", message: "Database unavailable"}}); return;} next();
});
managementRouter.get('/auth/limits',(_req,res)=>res.json({data:{websites:env.WORKSPACE_MAX_WEBSITES,apiEndpoints:env.WORKSPACE_MAX_ENDPOINTS,recordsPerResource:env.WORKSPACE_MAX_RECORDS,pendingPublishingJobs:env.WORKSPACE_MAX_PENDING_JOBS}}));
const resources = [
 {path: "api-endpoints", model: ApiEndpoint, schema: endpointSchema},
 {path: "maintenance", model: MaintenanceRecord, schema: maintenanceSchema},
 {path: "clients", model: Client, schema: clientSchema},
 {path: "websites", model: Website, schema: websiteSchema},
 {path: "tickets", model: SupportTicket, schema: ticketSchema},
 {path: "blogs", model: BlogPost, schema: blogSchema},
];
async function syncTargets(websiteId: unknown) {
 const website = await Website.findById(websiteId);
 if (!website) return;
 const fields = {frontendUrl: "FRONTEND", backendUrl: "BACKEND", healthUrl: "HEALTH", readinessUrl: "READINESS", adminUrl: "ADMIN_PAGE"};
 for (const [field, type] of Object.entries(fields)) {
  const url = website.get(field);
  if (!url) {await MonitoringTarget.deleteMany({websiteId, type}); continue;}
  await MonitoringTarget.updateOne({websiteId, type}, {$set: {name: type, url, enabled: website.get("monitoringEnabled"), intervalSeconds: website.get("monitoringInterval"), nextCheckAt: new Date()}}, {upsert: true});
 }
}
for (const resource of resources) {
 const {path, model, schema} = resource;
 managementRouter.get(`/${path}`, async (req, res) => {
  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
  const limit = z.coerce.number().int().min(1).max(100).default(20).parse(req.query.limit);
  const filter: Record<string, unknown> = {};
  if (req.query.websiteId) filter.websiteId = id.parse(req.query.websiteId);
  if (req.query.clientId) filter.clientId = id.parse(req.query.clientId);
  if (req.query.status) filter.status = z.string().regex(/^[A-Z_]{2,30}$/).parse(req.query.status);
  if (req.query.search) {const search = z.string().max(100).parse(req.query.search); filter[path === "tickets" || path === "blogs" ? "title" : path === "maintenance" ? "description" : "name"] = {$regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i"};}
  const [data, total] = await Promise.all([model.find(filter).sort({createdAt: -1}).skip((page-1)*limit).limit(limit), model.countDocuments(filter)]);
  res.json({data: path === 'api-endpoints' ? await endpointHealth(data) : data, pagination: {page, limit, total}});
 });
 managementRouter.get(`/${path}/:id`, async (req, res) => {const data = await model.findById(id.parse(req.params.id)); res.status(data ? 200 : 404).json(data ? {data: path === 'api-endpoints' ? (await endpointHealth([data]))[0] : data} : {error: {code: "NOT_FOUND", message: "Record not found"}});});
 for (const method of ["post", "patch"] as const) managementRouter[method](`/${path}${method === "patch" ? "/:id" : ""}`, async (req, res) => {
  res.locals.saveStage = `${path}:validate`;
  const input = method === "post" ? schema.parse(req.body) : parsePatch(schema, req.body);
  res.locals.saveStage = `${path}:check-related-records`;
  const limit = path === 'websites' ? env.WORKSPACE_MAX_WEBSITES : path === 'api-endpoints' ? env.WORKSPACE_MAX_ENDPOINTS : env.WORKSPACE_MAX_RECORDS;
  if (method === 'post' && await model.countDocuments() >= limit) {res.status(409).json({error:{code:'WORKSPACE_LIMIT',message:`Your workspace has reached its ${path} limit (${limit}).`}});return;}
  const existing = method === "patch" ? await model.findById(id.parse((req.params as Record<string, string>).id)) : null;
  if (method === "patch" && !existing) {res.status(404).json({error: {code: "NOT_FOUND", message: "Record not found"}}); return;}
  if ("websiteId" in input && !await Website.exists({_id: input.websiteId})) {res.status(422).json({error: {code: "INVALID_WEBSITE", message: "Website does not exist"}}); return;}
  if ("clientId" in input && !await Client.exists({_id: input.clientId})) {res.status(422).json({error: {code: "INVALID_CLIENT", message: "Client does not exist"}}); return;}
  if (path === "tickets" || path === "blogs") {
   const websiteId = "websiteId" in input ? input.websiteId : existing?.get("websiteId");
   const clientId = "clientId" in input ? input.clientId : existing?.get("clientId");
   const website = await Website.findById(websiteId);
   if (!website || String(website.get("clientId")) !== String(clientId)) {res.status(422).json({error: {code: "INVALID_WEBSITE", message: "Website and client must match"}}); return;}
  }
  if (path === "blogs" && existing) await BlogRevision.create({blogId: existing._id, userId: res.locals.user._id, snapshot: existing.toObject()});
  res.locals.saveStage = `${path}:save-record`;
  const changes = path === 'blogs' && method === 'patch' && ['title','slug','content','excerpt'].some(key=>key in input) && (!('status' in input) || input.status !== 'ARCHIVED') ? {...input,status:'DRAFT'} : input;
  const data = method === "post" ? await model.create(input) : await model.findByIdAndUpdate(id.parse((req.params as Record<string, string>).id), {$set: changes}, {new: true, runValidators: true});
  if (!data) {res.status(404).json({error: {code: "NOT_FOUND", message: "Record not found"}}); return;}
  res.locals.saveStage = `${path}:sync-monitoring`;
  if (path === "websites") {await syncTargets(data._id); if (!data.get("monitoringEnabled")) await Website.updateOne({_id: data._id}, {$set: {status: "PAUSED"}});}
  if (path === "api-endpoints") await MonitoringTarget.updateOne({endpointId: data._id}, {$set: {endpointId: data._id, websiteId: data.get("websiteId"), type: "API", name: data.get("name"), url: data.get("url"), method: data.get("method"), expectedStatus: data.get("expectedStatus"), timeoutMs: data.get("timeoutMs"), intervalSeconds: data.get("intervalSeconds"), enabled: data.get("isActive"), nextCheckAt: new Date()}}, {upsert: true});
  res.locals.saveStage = `${path}:save-audit`;
  await AuditLog.create({userId: res.locals.user._id, action: method, entityType: path, entityId: String(data._id)});
  res.status(method === "post" ? 201 : 200).json({data});
 });
 managementRouter.delete(`/${path}/:id`, async (req, res) => {
  if (!["clients","websites","blogs","api-endpoints"].includes(path)) {res.status(405).json({error:{code:"METHOD_NOT_ALLOWED",message:"Archive is not supported for this resource"}});return;}
  const recordId = id.parse(req.params.id);
  const data = await model.findByIdAndUpdate(recordId, {$set: path === "websites" ? {monitoringEnabled: false, status: "PAUSED"} : path === "api-endpoints" ? {isActive: false} : {status: "ARCHIVED"}}, {new: true});
  if (!data) {res.status(404).json({error: {code: "NOT_FOUND", message: "Record not found"}}); return;}
  if (path === "api-endpoints") await MonitoringTarget.updateMany({endpointId: recordId}, {$set: {enabled: false}});
  if (path === "websites") await MonitoringTarget.updateMany({websiteId: recordId}, {$set: {enabled: false}});
  await AuditLog.create({userId: res.locals.user._id, action: "archive", entityType: path, entityId: recordId});
  res.json({data});
 });
}
managementRouter.post("/websites/:id/check-now", async (req, res) => {
 const websiteId = id.parse(req.params.id);
 const website = await Website.findById(websiteId);
 if (!website) {res.status(404).json({error:{code:"NOT_FOUND",message:"Website not found"}}); return;}
 if (!website.get("monitoringEnabled")) {res.status(409).json({error:{code:"PAUSED",message:"Enable website monitoring before checking"}});return;}
 await MonitoringTarget.updateMany({websiteId, enabled: true}, {$set: {nextCheckAt: new Date()}});
 res.status(202).json({data: {message: "Enabled targets marked due for the worker"}});
});
for (const [path, model] of [["incidents", Incident], ["notifications", Notification], ["audit-logs", AuditLog]] as const) managementRouter.get(`/${path}`, async (req, res) => {
 const filter: Record<string, unknown> = {};
 if(req.query.websiteId) filter.websiteId=id.parse(req.query.websiteId);
 if(req.query.status) filter.status=z.string().regex(/^[A-Z_]{2,30}$/).parse(req.query.status);
 if(req.query.search){const search=z.string().max(100).parse(req.query.search);filter[path==='audit-logs'?'action':'title']={$regex:search.split('').map(char=>String.fromCharCode(92)+'u'+char.charCodeAt(0).toString(16).padStart(4,'0')).join(''),$options:'i'};}
 res.json({data:await model.find(filter).sort({createdAt:-1}).limit(100)});
});
managementRouter.get("/monitoring/overview", async (_req, res) => res.json({data: await Website.find().sort({name: 1}).limit(100)}));
managementRouter.get("/monitoring/:websiteId/uptime", async (req, res) => {
 const websiteId = id.parse(req.params.websiteId);
 const days = z.coerce.number().int().min(1).max(30).default(1).parse(req.query.days);
 const [result] = await MonitoringCheck.aggregate([{$match: {websiteId: new mongoose.Types.ObjectId(websiteId), checkedAt: {$gte: new Date(Date.now()-days*86400000)}}}, {$group: {_id: null, total: {$sum: 1}, up: {$sum: {$cond: [{$eq: ["$status", "UP"]}, 1, 0]}}}}]);
 res.json({data: {checks: result?.total ?? 0, uptime: result ? result.up/result.total*100 : null, days}});
});
managementRouter.get("/blogs/:id/revisions", async (req, res) => res.json({data: await BlogRevision.find({blogId: id.parse(req.params.id)}).sort({createdAt: -1}).limit(50)}));
managementRouter.post("/tickets/:id/comments", async (req, res) => {
 const input = z.object({body: z.string().trim().min(1).max(5000)}).strict().parse(req.body);
 const data = await SupportTicket.findByIdAndUpdate(id.parse(req.params.id), {$push: {comments: {...input, userId: res.locals.user._id, createdAt: new Date()}}}, {new: true});
 if (!data) {res.status(404).json({error: {code: "NOT_FOUND", message: "Ticket not found"}}); return;}
 await AuditLog.create({userId: res.locals.user._id, action: "comment", entityType: "tickets", entityId: String(data._id)});
 res.status(201).json({data});
});
managementRouter.get("/monitoring/:websiteId/history", async (req, res) => res.json({data: await MonitoringCheck.find({websiteId: id.parse(req.params.websiteId)}).sort({checkedAt: -1}).limit(100)}));
managementRouter.get("/analytics/overview", async (_req, res) => {
 const [websites, clients, activeIncidents, checks] = await Promise.all([Website.countDocuments(), Client.countDocuments({status: "ACTIVE"}), Incident.countDocuments({status: "OPEN"}), MonitoringCheck.aggregate([{$match: {checkedAt: {$gte: new Date(Date.now()-86400000)}}}, {$group: {_id: null, total: {$sum: 1}, up: {$sum: {$cond: [{$eq: ["$status", "UP"]}, 1, 0]}}, averageResponseTime: {$avg: "$responseTime"}}}])]);
 const summary = checks[0]; res.json({data: {websites, clients, activeIncidents, averageResponseTime: summary?.averageResponseTime ?? null, uptime: summary ? summary.up / summary.total * 100 : null}});
});

managementRouter.post("/api-endpoints/:id/check-now", async (req, res) => {
 const endpoint = await ApiEndpoint.findById(id.parse(req.params.id));
 if (!endpoint) {res.status(404).json({error: {code: "NOT_FOUND", message: "Endpoint not found"}}); return;}
 if (!endpoint.get("isActive")) {res.status(409).json({error: {code: "PAUSED", message: "Enable the endpoint before checking"}}); return;}
 const website = await Website.findById(endpoint.get('websiteId'));
 if (!website?.get('monitoringEnabled')) {res.status(409).json({error:{code:'PAUSED',message:'Enable website monitoring before checking this endpoint'}});return;}
 await MonitoringTarget.updateOne({endpointId: endpoint._id}, {$set: {endpointId:endpoint._id,websiteId:endpoint.get('websiteId'),type:'API',name:endpoint.get('name'),url:endpoint.get('url'),method:endpoint.get('method'),expectedStatus:endpoint.get('expectedStatus'),timeoutMs:endpoint.get('timeoutMs'),intervalSeconds:endpoint.get('intervalSeconds'),enabled:true,nextCheckAt: new Date()}}, {upsert:true});
 res.status(202).json({data: {message: "Check scheduled"}});
});
managementRouter.get('/api-endpoints/:id/history',async(req,res)=>{
 const endpointId=id.parse(req.params.id);
 if(!await ApiEndpoint.exists({_id:endpointId})){res.status(404).json({error:{code:'NOT_FOUND',message:'Endpoint not found'}});return;}
 res.json({data:await ApiCheckResult.find({endpointId}).sort({checkedAt:-1,_id:-1}).limit(100)});
});
managementRouter.post('/api-endpoints/:id/test',rateLimit({windowMs:60000,limit:40,keyGenerator:(_req,res)=>String(res.locals.user._id)}),async(req,res)=>{
 const endpoint=await ApiEndpoint.findById(id.parse(req.params.id));
 if(!endpoint){res.status(404).json({error:{code:'NOT_FOUND',message:'Endpoint not found'}});return;}
 if(!await Website.exists({_id:endpoint.get('websiteId')})){res.status(422).json({error:{code:'INVALID_WEBSITE',message:'Website not found'}});return;}
 const result=await probeEndpoint({url:endpoint.get('url'),method:endpoint.get('method'),timeoutMs:endpoint.get('timeoutMs'),expectedStatus:endpoint.get('expectedStatus'),responseAssertions:endpoint.get('responseAssertions')});
 // Keep history for the configuration actually tested, even if edited mid-request.
 const current=await ApiEndpoint.exists({_id:endpoint._id,updatedAt:endpoint.get('updatedAt')});
 const data=current ? await ApiCheckResult.create({...result,endpointId:endpoint._id,websiteId:endpoint.get('websiteId')}) : result;
 res.json({data,configurationChanged:!current});
});
managementRouter.patch("/incidents/:id", async (req, res) => {
 const input = z.object({status: z.enum(["OPEN", "RESOLVED"]), resolutionNotes: z.string().max(5000).optional()}).strict().parse(req.body);
 const data = await Incident.findByIdAndUpdate(id.parse(req.params.id), {$set: {...input, resolvedAt: input.status === "RESOLVED" ? new Date() : null}}, {new: true});
 if (!data) {res.status(404).json({error: {code: "NOT_FOUND", message: "Incident not found"}}); return;}
 await AuditLog.create({userId: res.locals.user._id, action: "update", entityType: "incidents", entityId: String(data._id)});
 res.json({data});
});
managementRouter.patch("/notifications/:id", async (req, res) => {
 const input = z.object({status: z.literal("READ")}).strict().parse(req.body);
 const data = await Notification.findByIdAndUpdate(id.parse(req.params.id), {$set: input}, {new: true});
 res.status(data ? 200 : 404).json(data ? {data} : {error: {code: "NOT_FOUND", message: "Notification not found"}});
});
managementRouter.get("/analytics/performance", async (req, res) => {
 const days = z.coerce.number().int().min(1).max(30).default(7).parse(req.query.days);
 const data = await MonitoringCheck.aggregate([{$match: {checkedAt: {$gte: new Date(Date.now()-days*86400000)}}}, {$group: {_id: {$dateToString: {format: "%Y-%m-%d", date: "$checkedAt"}}, responseTime: {$avg: "$responseTime"}, checks: {$sum: 1}, successful: {$sum: {$cond: [{$eq: ["$status", "UP"]}, 1, 0]}}}}, {$sort: {_id: 1}}]);
 res.json({data: data.map(row => ({...row, uptime: row.successful / row.checks * 100}))});
});

managementRouter.get("/integrations", async (_req, res) => res.json({data: await Integration.find().sort({createdAt: -1}).limit(100)}));
managementRouter.post("/integrations/:websiteId/credentials", async (req, res) => {
 const websiteId = id.parse(req.params.websiteId);
 const input = z.object({endpointBaseUrl: z.url().refine(value => new URL(value).protocol === 'https:' && !new URL(value).username && !new URL(value).password), token: z.string().min(32).max(512)}).strict().parse(req.body);
 if (!await Website.exists({_id: websiteId})) {res.status(404).json({error: {code:'NOT_FOUND',message:'Website not found'}});return;}
 if (!env.INTEGRATION_ENCRYPTION_KEY) {res.status(503).json({error: {code:'NOT_CONFIGURED',message:'Configure INTEGRATION_ENCRYPTION_KEY on the API and worker first'}});return;}
 const data = await Integration.findOneAndUpdate({websiteId}, {$set: {endpointBaseUrl: (input.endpointBaseUrl.endsWith('/') ? input.endpointBaseUrl.slice(0,-1) : input.endpointBaseUrl), credentialReference: encryptSecret(input.token), permissions:['blogs:write'], isActive:true, integrationType:'EXPRESS_SDK'}}, {upsert:true,new:true});
 await CredentialRotation.create({integrationId:data!._id,rotatedBy:res.locals.user._id,revokedAt:new Date()});
 await AuditLog.create({userId:res.locals.user._id,action:'configure',entityType:'integrations',entityId:String(data!._id)});
 res.status(201).json({data:{_id:data!._id,websiteId,isActive:true}});
});
managementRouter.get("/integrations/:websiteId/status", async (req,res)=>res.json({data:await Integration.findOne({websiteId:id.parse(req.params.websiteId)})}));
managementRouter.post("/integrations/:websiteId/test", async (req,res)=>{
 const integration=await Integration.findOne({websiteId:id.parse(req.params.websiteId),isActive:true}).select('+credentialReference');
 if(!integration){res.status(404).json({error:{code:'NOT_FOUND',message:'Configure an integration first'}});return;}
 try{const result=await checkUrl(integration.get('endpointBaseUrl')+'/health',15000,'GET',{headers:{Authorization:'Bearer '+decryptSecret(integration.get('credentialReference'))}});
 if(result.httpStatus!==200)throw new Error('Integration returned HTTP '+result.httpStatus);
 await Integration.updateOne({_id:integration._id},{$set:{lastConnectedAt:new Date()}});res.json({data:{connected:true}});
 }catch{res.status(502).json({error:{code:'INTEGRATION_FAILED',message:'Connection failed. Check the destination and integration credentials.'}});}
});
managementRouter.post("/blogs/:id/publish", async(req,res)=>{
 const input=z.object({scheduledAt:z.coerce.date().optional()}).strict().parse(req.body ?? {});
 const blog=await BlogPost.findById(id.parse(req.params.id));
 if(!blog){res.status(404).json({error:{code:'NOT_FOUND',message:'Blog not found'}});return;}
 if(blog.get('status')==='ARCHIVED'){res.status(409).json({error:{code:'ARCHIVED',message:'Restore this post to a draft before publishing'}});return;}
 const idempotencyKey=hashToken(String(blog._id)+':'+new Date(blog.get('updatedAt')).toISOString()+':'+(input.scheduledAt?.toISOString() ?? 'now'));
 const existing=await PublishingJob.findOne({idempotencyKey});
 if(existing){res.status(202).json({data:existing});return;}
 if(await PublishingJob.countDocuments({status:{$in:['PENDING','RETRYING','PROCESSING']}})>=env.WORKSPACE_MAX_PENDING_JOBS){res.status(409).json({error:{code:'WORKSPACE_LIMIT',message:`Your workspace has reached its pending publishing job limit (${env.WORKSPACE_MAX_PENDING_JOBS}).`}});return;}
 if(!await Integration.exists({websiteId:blog.get('websiteId'),isActive:true,permissions:'blogs:write'})){res.status(409).json({error:{code:'INTEGRATION_REQUIRED',message:'Configure an authorized blog integration for this website first'}});return;}
 const job=await PublishingJob.findOneAndUpdate({idempotencyKey},{$setOnInsert:{websiteId:blog.get('websiteId'),blogId:blog._id,operation:'UPSERT',snapshot:blog.toObject(),scheduledAt:input.scheduledAt ?? new Date(),status:'PENDING',attempts:0}},{upsert:true,new:true});
 await AuditLog.create({userId:res.locals.user._id,action:'schedule-publish',entityType:'blogs',entityId:String(blog._id)});
 res.status(202).json({data:job});
});
managementRouter.get("/blogs/:id/publishing-history",async(req,res)=>res.json({data:await PublishingJob.find({blogId:id.parse(req.params.id)}).select('-snapshot').sort({createdAt:-1}).limit(50)}));
