import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const owners = vi.hoisted(() => ({a:'111111111111111111111111',b:'222222222222222222222222'}));
const workerCheck=vi.hoisted(()=>vi.fn(async()=>({httpStatus:500,responseTime:10,body:'{}'})));
vi.mock('./services/auth.js', async importOriginal => ({...await importOriginal<object>(),authenticate:(req:any,res:any,next:any)=>{res.locals.user={_id:req.headers['x-test-owner'] || owners.a};next();}}));
vi.mock('../dist/models/index.js',()=>import('./models/index.js'));
vi.mock('../dist/services/outbound.js',()=>({checkUrl:workerCheck}));
vi.mock('../dist/services/background-jobs.js',()=>({assertJobLease:vi.fn(),finishPublishingJob:vi.fn(),retryPublishingJob:vi.fn(async()=>true)}));
import { app } from './app.js';
import { User, Client, Website, MonitoringTarget, MonitoringCheck, BlogPost, Integration, Incident, Notification, AuditLog, ApiEndpoint, ApiCheckResult, SupportTicket, MaintenanceRecord, BlogRevision, PublishingJob } from './models/index.js';
import { inWorkspace, workspaceModel } from './services/workspace.js';
import { env } from './config/env.js';

let mongo:MongoMemoryServer;
let foreignClient:mongoose.Document, foreignSite:mongoose.Document, foreignBlog:mongoose.Document;
beforeAll(async()=>{
 const binary=resolve(process.cwd(),'../.local-tools/mongodb/mongod-x64-win32-8.2.6.exe');
 mongo=await MongoMemoryServer.create({binary:process.platform==='win32'&&existsSync(binary)?{systemBinary:binary}:undefined,instance:{launchTimeout:60000}});
 await mongoose.connect(mongo.getUri(),{dbName:'orbitops_isolation_test'});
},90000);
beforeEach(async()=>{
 expect(mongoose.connection.name).toBe('orbitops_isolation_test');
 await Promise.all(Object.values(mongoose.models).map(model=>model.deleteMany({})));
 foreignClient=await Client.create({ownerId:owners.b,name:'Private B'});
 foreignSite=await Website.create({ownerId:owners.b,clientId:foreignClient._id,name:'B site',frontendUrl:'https://example.com'});
 foreignBlog=await BlogPost.create({ownerId:owners.b,clientId:foreignClient._id,websiteId:foreignSite._id,title:'Secret B',slug:'secret'});
 await MonitoringCheck.create({ownerId:owners.b,websiteId:foreignSite._id,targetId:new mongoose.Types.ObjectId(),status:'UP',responseTime:100});
 await Integration.create({ownerId:owners.b,websiteId:foreignSite._id,isActive:true});
 const incident=await Incident.create({ownerId:owners.b,websiteId:foreignSite._id,targetId:new mongoose.Types.ObjectId(),title:'B incident'});
 await Notification.create({ownerId:owners.b,websiteId:foreignSite._id,incidentId:incident._id,title:'B notification'});
 await AuditLog.create({ownerId:owners.b,userId:owners.b,action:'private'});
 await SupportTicket.create({ownerId:owners.b,websiteId:foreignSite._id,clientId:foreignClient._id,title:'Private ticket'});
 await MaintenanceRecord.create({ownerId:owners.b,websiteId:foreignSite._id,description:'Private maintenance'});
 await ApiEndpoint.create({ownerId:owners.b,websiteId:foreignSite._id,name:'Private endpoint',isActive:true});
 await BlogRevision.create({ownerId:owners.b,blogId:foreignBlog._id,userId:owners.b,snapshot:{content:'Secret revision'}});
 await PublishingJob.create({ownerId:owners.b,websiteId:foreignSite._id,blogId:foreignBlog._id,idempotencyKey:'private-job',snapshot:{content:'Secret publishing snapshot'}});
});
afterAll(async()=>{await mongoose.disconnect();await mongo?.stop();});
describe('private freelancer workspaces',()=>{
 it('reports configured limits only through an authenticated route',async()=>{
  const response=await request(app).get('/api/v1/auth/limits');
  expect(response.status).toBe(200);
  expect(response.body.data).toEqual({websites:env.WORKSPACE_MAX_WEBSITES,apiEndpoints:env.WORKSPACE_MAX_ENDPOINTS,recordsPerResource:env.WORKSPACE_MAX_RECORDS,pendingPublishingJobs:env.WORKSPACE_MAX_PENDING_JOBS});
 });
 it('enforces the website limit without counting another workspace',async()=>{
  const previous=env.WORKSPACE_MAX_WEBSITES;env.WORKSPACE_MAX_WEBSITES=1;
  try{
   const client=await Client.create({ownerId:owners.a,name:'Own client'});
   const body={clientId:String(client._id),name:'Own site',frontendUrl:'https://example.com'};
   expect((await request(app).post('/api/v1/websites').set('Origin','http://localhost:5173').send(body)).status).toBe(201);
   const rejected=await request(app).post('/api/v1/websites').set('Origin','http://localhost:5173').send({...body,name:'Over limit'});
   expect(rejected.status).toBe(409);expect(rejected.body.error.code).toBe('WORKSPACE_LIMIT');
   expect(await Website.countDocuments({ownerId:owners.a})).toBe(1);
  }finally{env.WORKSPACE_MAX_WEBSITES=previous;}
 });
 it('enforces the API endpoint limit separately for each owner',async()=>{
  const previous=env.WORKSPACE_MAX_ENDPOINTS;env.WORKSPACE_MAX_ENDPOINTS=1;
  try{
   const client=await Client.create({ownerId:owners.a,name:'Own client'});
   const site=await Website.create({ownerId:owners.a,clientId:client._id,name:'Own site'});
   const body={websiteId:String(site._id),name:'Own API',url:'https://example.com/api'};
   expect((await request(app).post('/api/v1/api-endpoints').set('Origin','http://localhost:5173').send(body)).status).toBe(201);
   const rejected=await request(app).post('/api/v1/api-endpoints').set('Origin','http://localhost:5173').send({...body,name:'Over limit'});
   expect(rejected.status).toBe(409);expect(rejected.body.error.code).toBe('WORKSPACE_LIMIT');
  }finally{env.WORKSPACE_MAX_ENDPOINTS=previous;}
 });
 it('applies the record limit per resource rather than combining unrelated resources or users',async()=>{
  const previous=env.WORKSPACE_MAX_RECORDS;env.WORKSPACE_MAX_RECORDS=1;
  try{
   const client=await request(app).post('/api/v1/clients').set('Origin','http://localhost:5173').send({name:'Own client'});
   expect(client.status).toBe(201);
   expect((await request(app).post('/api/v1/clients').set('Origin','http://localhost:5173').send({name:'Over limit'})).body.error.code).toBe('WORKSPACE_LIMIT');
   const site=await Website.create({ownerId:owners.a,clientId:client.body.data._id,name:'Own site'});
   const ticket={clientId:client.body.data._id,websiteId:String(site._id),title:'Own ticket',description:'Work to do'};
   expect((await request(app).post('/api/v1/tickets').set('Origin','http://localhost:5173').send(ticket)).status).toBe(201);
   expect((await request(app).post('/api/v1/tickets').set('Origin','http://localhost:5173').send(ticket)).body.error.code).toBe('WORKSPACE_LIMIT');
  }finally{env.WORKSPACE_MAX_RECORDS=previous;}
 });
 it('caps pending publishing jobs, permits idempotent retries, and frees capacity after completion',async()=>{
  const previous=env.WORKSPACE_MAX_PENDING_JOBS;env.WORKSPACE_MAX_PENDING_JOBS=1;
  try{
   const client=await Client.create({ownerId:owners.a,name:'Own client'});
   const site=await Website.create({ownerId:owners.a,clientId:client._id,name:'Own site'});
   await Integration.create({ownerId:owners.a,websiteId:site._id,isActive:true,permissions:['blogs:write']});
   const first=await BlogPost.create({ownerId:owners.a,clientId:client._id,websiteId:site._id,title:'First',slug:'first'});
   const second=await BlogPost.create({ownerId:owners.a,clientId:client._id,websiteId:site._id,title:'Second',slug:'second'});
   const publish=(id:unknown)=>request(app).post('/api/v1/blogs/'+id+'/publish').set('Origin','http://localhost:5173').send({});
   const initial=await publish(first._id);expect(initial.status).toBe(202);
   const repeated=await publish(first._id);expect(repeated.status).toBe(202);expect(repeated.body.data._id).toBe(initial.body.data._id);
   const rejected=await publish(second._id);expect(rejected.status).toBe(409);expect(rejected.body.error.code).toBe('WORKSPACE_LIMIT');
   expect(await PublishingJob.countDocuments({ownerId:owners.a})).toBe(1);
   await PublishingJob.updateOne({_id:initial.body.data._id},{$set:{status:'COMPLETED'}});
   expect((await publish(second._id)).status).toBe(202);
  }finally{env.WORKSPACE_MAX_PENDING_JOBS=previous;}
 });
 it('saves tour completion only for the authenticated account',async()=>{
  await User.create({_id:owners.a,email:'a@example.com',onboardingStatus:'PENDING'});
  await User.create({_id:owners.b,email:'b@example.com',onboardingStatus:'PENDING'});
  const response=await request(app).patch('/api/v1/auth/onboarding').set('Origin','http://localhost:5173').send({status:'COMPLETED'});
  expect(response.status).toBe(200);expect(response.body.data.onboardingStatus).toBe('COMPLETED');
  expect((await User.findById(owners.a))?.get('onboardingStatus')).toBe('COMPLETED');
  expect((await User.findById(owners.b))?.get('onboardingStatus')).toBe('PENDING');
  expect((await request(app).patch('/api/v1/auth/onboarding').set('Origin','http://localhost:5173').send({status:'SKIPPED',userId:owners.b})).status).toBe(400);
  expect((await request(app).patch('/api/v1/auth/onboarding').set('Origin','http://localhost:5173').send({status:'PENDING'})).status).toBe(400);
  expect((await request(app).patch('/api/v1/auth/onboarding').set('Origin','http://localhost:5173').send({status:'SKIPPED'})).status).toBe(200);
  expect((await User.findById(owners.a))?.get('onboardingStatus')).toBe('SKIPPED');
 });
 it.each(['clients','websites','blogs','tickets','maintenance','api-endpoints','incidents','notifications','audit-logs','integrations','monitoring/overview'])('does not list other owners in %s',async path=>{
  const response=await request(app).get('/api/v1/'+path);
  expect(response.status).toBe(200);expect(response.body.data).toEqual([]);
 });
 it('hides unassigned legacy data',async()=>{
  await Client.create({name:'Legacy'});
  expect((await request(app).get('/api/v1/clients')).body.data).toEqual([]);
 });
 it('creates clients and website monitoring targets with authenticated ownership',async()=>{
  const client=await request(app).post('/api/v1/clients').set('Origin','http://localhost:5173').send({name:'A client'});
  expect(client.status).toBe(201);expect(client.body.data.ownerId).toBe(owners.a);
  const site=await request(app).post('/api/v1/websites').set('Origin','http://localhost:5173').send({name:'A site',clientId:client.body.data._id,frontendUrl:'https://example.com'});
  expect(site.status).toBe(201);
  expect(String((await MonitoringTarget.findOne({websiteId:site.body.data._id}))?.get('ownerId'))).toBe(owners.a);
  expect((await request(app).get('/api/v1/clients').set('x-test-owner',owners.b)).body.data.map((x:any)=>x.name)).toEqual(['Private B']);
 });
 it('rejects owner spoofing',async()=>{
  expect((await request(app).post('/api/v1/clients').set('Origin','http://localhost:5173').send({name:'Spoof',ownerId:owners.b})).status).toBe(400);
 });
 it('blocks foreign record reads, edits and archives',async()=>{
  const url='/api/v1/clients/'+foreignClient._id;
  expect((await request(app).get(url)).status).toBe(404);
  expect((await request(app).patch(url).set('Origin','http://localhost:5173').send({name:'Stolen'})).status).toBe(404);
  expect((await request(app).delete(url).set('Origin','http://localhost:5173')).status).toBe(404);
  expect((await Client.findById(foreignClient._id))?.get('name')).toBe('Private B');
 });
 it('rejects cross-workspace related records',async()=>{
  expect((await request(app).post('/api/v1/websites').set('Origin','http://localhost:5173').send({name:'Invalid',clientId:String(foreignClient._id),frontendUrl:'https://example.com'})).status).toBe(422);
 });
 it('isolates analytics and monitoring history',async()=>{
  const overview=await request(app).get('/api/v1/analytics/overview');
  expect(overview.status).toBe(200);expect(overview.body.data).toMatchObject({websites:0,clients:0,activeIncidents:0,uptime:null});
  expect((await request(app).get('/api/v1/analytics/performance')).body.data).toEqual([]);
  expect((await request(app).get('/api/v1/monitoring/'+foreignSite._id+'/history')).body.data).toEqual([]);
 });
 it('blocks foreign publishing, check scheduling and integration writes',async()=>{
  for(const path of ['blogs/'+foreignBlog._id+'/publish','websites/'+foreignSite._id+'/check-now','integrations/'+foreignSite._id+'/credentials']){
   const body=path.endsWith('credentials')?{endpointBaseUrl:'https://example.com/api/integrations',token:'x'.repeat(40)}:{};
   expect((await request(app).post('/api/v1/'+path).set('Origin','http://localhost:5173').send(body)).status).toBe(404);
  }
 });
 it('fails closed outside a workspace context',()=>expect(()=>workspaceModel(Client).find()).toThrow('Workspace context is required'));
 it('blocks ownership mutation and aggregation escapes in the repository',()=>{
  inWorkspace(owners.a,()=>{
   const clients=workspaceModel(Client);
   expect(()=>clients.updateOne({},{$set:{ownerId:owners.b}})).toThrow('ownership cannot be changed');
   expect(()=>clients.updateOne({},{$rename:{name:'ownerId'}})).toThrow('Unsupported workspace update');
   expect(()=>clients.updateOne({},[{$set:{ownerId:owners.b}}])).toThrow('Unsupported workspace update');
   expect(()=>clients.aggregate([{$unionWith:'clients'}])).toThrow('Unsupported workspace aggregation');
   expect(()=>clients.aggregate([{$lookup:{from:'clients',localField:'_id',foreignField:'_id',as:'other'}}])).toThrow('Unsupported workspace aggregation');
  });
 });
 it('blocks child histories and foreign list filters',async()=>{
  for(const path of ['blogs/'+foreignBlog._id+'/revisions','blogs/'+foreignBlog._id+'/publishing-history','clients?ownerId='+owners.b,'websites?clientId='+foreignClient._id,'tickets?websiteId='+foreignSite._id]){
   const response=await request(app).get('/api/v1/'+path);
   expect(response.status).toBe(200);expect(response.body.data).toEqual([]);
   if(response.body.pagination)expect(response.body.pagination.total).toBe(0);
  }
  const uptime=await request(app).get('/api/v1/monitoring/'+foreignSite._id+'/uptime');
  expect(uptime.body.data).toMatchObject({checks:0,uptime:null});
  expect((await request(app).get('/api/v1/integrations/'+foreignSite._id+'/status')).body.data).toBeNull();
 });
 it('blocks foreign ticket comments, incident updates, notifications and API checks',async()=>{
  const ticket=await SupportTicket.findOne({ownerId:owners.b}),incident=await Incident.findOne({ownerId:owners.b}),notification=await Notification.findOne({ownerId:owners.b}),endpoint=await ApiEndpoint.findOne({ownerId:owners.b});
  expect((await request(app).post('/api/v1/tickets/'+ticket!._id+'/comments').set('Origin','http://localhost:5173').send({body:'Intrusion'})).status).toBe(404);
  expect((await request(app).patch('/api/v1/incidents/'+incident!._id).set('Origin','http://localhost:5173').send({status:'RESOLVED'})).status).toBe(404);
  expect((await request(app).patch('/api/v1/notifications/'+notification!._id).set('Origin','http://localhost:5173').send({status:'READ'})).status).toBe(404);
  expect((await request(app).post('/api/v1/api-endpoints/'+endpoint!._id+'/check-now').set('Origin','http://localhost:5173')).status).toBe(404);
  expect((await request(app).post('/api/v1/integrations/'+foreignSite._id+'/test').set('Origin','http://localhost:5173')).status).toBe(404);
 });
 it('rejects moving own records into another workspace',async()=>{
  const ownClient=await Client.create({ownerId:owners.a,name:'Own'});
  const ownWebsite=await Website.create({ownerId:owners.a,clientId:ownClient._id,name:'Own site',frontendUrl:'https://example.com'});
  expect((await request(app).patch('/api/v1/websites/'+ownWebsite._id).set('Origin','http://localhost:5173').send({clientId:String(foreignClient._id)})).status).toBe(422);
  const ownEndpoint=await ApiEndpoint.create({ownerId:owners.a,websiteId:ownWebsite._id,name:'Own endpoint'});
  expect((await request(app).patch('/api/v1/api-endpoints/'+ownEndpoint._id).set('Origin','http://localhost:5173').send({websiteId:String(foreignSite._id)})).status).toBe(422);
 });
 it('rejects monitoring jobs with cross-owner endpoint references',async()=>{
  const ownClient=await Client.create({ownerId:owners.a,name:'Own'});
  const ownWebsite=await Website.create({ownerId:owners.a,clientId:ownClient._id,name:'Own site',frontendUrl:'https://example.com'});
  const foreignEndpoint=await ApiEndpoint.findOne({ownerId:owners.b});
  const target=await MonitoringTarget.create({ownerId:owners.a,websiteId:ownWebsite._id,endpointId:foreignEndpoint!._id,type:'API',url:'https://example.com'});
  const workerPath=resolve(process.cwd(),'../worker/src/processors.ts');
  const {monitorTarget}=await import(workerPath);
  await expect(monitorTarget(target)).rejects.toThrow('Invalid workspace monitoring reference');
  expect(await MonitoringCheck.countDocuments({targetId:target._id})).toBe(0);
 });
 it('does not deliver a publishing snapshot belonging to another owner',async()=>{
  workerCheck.mockClear();
  const record=await PublishingJob.create({ownerId:owners.a,websiteId:foreignSite._id,blogId:foreignBlog._id,idempotencyKey:'mismatched-job',snapshot:foreignBlog.toObject()});
  const workerPath=resolve(process.cwd(),'../worker/src/processors.ts');
  const {publishRecord}=await import(workerPath);
  await publishRecord(record);
  expect(workerCheck).not.toHaveBeenCalled();
  expect((await BlogPost.findById(foreignBlog._id))?.get('status')).toBe('DRAFT');
 });
 it('keeps concurrent request contexts separate',async()=>{
  await Client.create({ownerId:owners.a,name:'Private A'});
  const responses=await Promise.all([owners.a,owners.b,owners.a,owners.b].map(owner=>request(app).get('/api/v1/clients').set('x-test-owner',owner)));
  for(let i=0;i<responses.length;i++)expect(responses[i]!.body.data.map((row:any)=>row.name)).toEqual([i%2===0?'Private A':'Private B']);
 });
 it('preserves ownership in worker checks, incidents and notifications',async()=>{
  const endpoint=await ApiEndpoint.create({ownerId:owners.b,websiteId:foreignSite._id,name:'API'});
  const target=await MonitoringTarget.create({ownerId:owners.b,websiteId:foreignSite._id,endpointId:endpoint._id,type:'API',name:'B API',url:'https://example.com'});
  for(let i=0;i<2;i++) await MonitoringCheck.create({ownerId:owners.b,websiteId:foreignSite._id,targetId:target._id,status:'DOWN'});
  const workerPath=resolve(process.cwd(),'../worker/src/processors.ts');
  const {monitorTarget}=await import(workerPath);
  await monitorTarget(target);
  for(const model of [ApiCheckResult,Incident,Notification]){
   const rows=await model.find({websiteId:foreignSite._id});
   expect(rows.length).toBeGreaterThan(0);expect(rows.every(row=>String(row.get('ownerId'))===owners.b)).toBe(true);
  }
  expect((await request(app).get('/api/v1/incidents')).body.data).toEqual([]);
 });
});
