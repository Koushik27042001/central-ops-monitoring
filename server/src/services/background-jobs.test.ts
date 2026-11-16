import { existsSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MonitoringTarget, PublishingJob } from "../models/index.js";
import { claimMonitoringTarget, releaseMonitoringTarget, claimPublishingJob, finishPublishingJob, retryPublishingJob, assertJobLease, JOB_LEASE_MS } from "./background-jobs.js";

let mongo: MongoMemoryServer;
const now = new Date('2026-01-01T00:00:00Z');
const oid=()=>new mongoose.Types.ObjectId();
const target=()=>MonitoringTarget.create({websiteId:oid(),type:'FRONTEND',enabled:true,nextCheckAt:now,intervalSeconds:60});
const publishing=()=>PublishingJob.create({websiteId:oid(),blogId:oid(),status:'PENDING',scheduledAt:now,idempotencyKey:String(oid()),attempts:0});
beforeAll(async()=>{
 const cached=resolve(process.cwd(),'../.local-tools/mongodb/mongod-x64-win32-8.2.6.exe');
 mongo=await MongoMemoryServer.create({binary:process.platform==='win32'&&existsSync(cached)?{systemBinary:cached}:undefined});
 await mongoose.connect(mongo.getUri(),{dbName:'orbitops_jobs_test'});
 await Promise.all([MonitoringTarget.init(),PublishingJob.init()]);
},60000);
beforeEach(async()=>{expect(mongoose.connection.name).toBe('orbitops_jobs_test');await MonitoringTarget.deleteMany({});await PublishingJob.deleteMany({});});
afterAll(async()=>{await mongoose.disconnect();await mongo?.stop();});

describe('persistent MongoDB background jobs',()=>{
 it('allows exactly one concurrent worker to claim a due monitoring target',async()=>{
  await target();const claims=await Promise.all([claimMonitoringTarget(now),claimMonitoringTarget(now)]);
  expect(claims.filter(Boolean)).toHaveLength(1);
 });
 it('recovers an expired monitoring lease and fences stale releases',async()=>{
  await target();const original=(await claimMonitoringTarget(now))!;
  const later=new Date(now.getTime()+JOB_LEASE_MS+1);const recovered=(await claimMonitoringTarget(later))!;
  expect(recovered.get('leaseToken')).not.toBe(original.get('leaseToken'));
  await expect(assertJobLease('monitoring',original,later)).rejects.toThrow('Job lease expired');
  await expect(assertJobLease('monitoring',recovered,later)).resolves.toBeUndefined();
  await releaseMonitoringTarget(original,true,later);
  expect((await MonitoringTarget.findById(recovered._id).select('+leaseToken'))!.get('leaseToken')).toBe(recovered.get('leaseToken'));
 });
 it('preserves check-now requests submitted while a check is running',async()=>{
  await target();const claimed=(await claimMonitoringTarget(now))!;const requested=new Date(now.getTime()+1000);
  await MonitoringTarget.updateOne({_id:claimed._id},{$set:{nextCheckAt:requested}});
  await releaseMonitoringTarget(claimed,true,new Date(now.getTime()+2000));
  expect((await MonitoringTarget.findById(claimed._id))!.get('nextCheckAt')).toEqual(requested);
 });
 it('schedules the next regular check after completion',async()=>{
  await target();const claimed=(await claimMonitoringTarget(now))!;await releaseMonitoringTarget(claimed,true,now);
  expect(await claimMonitoringTarget(now)).toBeNull();expect(await claimMonitoringTarget(new Date(now.getTime()+60000))).not.toBeNull();
 });
 it('reclaims publishing jobs after worker crashes with the same idempotency key',async()=>{
  await publishing();const first=(await claimPublishingJob(now))!;
  expect(await claimPublishingJob(now)).toBeNull();
  const second=(await claimPublishingJob(new Date(now.getTime()+JOB_LEASE_MS+1)))!;
  expect(second.get('idempotencyKey')).toBe(first.get('idempotencyKey'));expect(second.get('attempts')).toBe(2);
 });
 it('persists retry backoff instead of immediately re-running failed delivery',async()=>{
  await publishing();const claimed=(await claimPublishingJob(now))!;expect(await retryPublishingJob(claimed,now)).toBe(false);
  expect(await claimPublishingJob(now)).toBeNull();expect((await claimPublishingJob(new Date(now.getTime()+5000)))!.get('attempts')).toBe(2);
 });
 it('does not reclaim completed jobs',async()=>{
  await publishing();const claimed=(await claimPublishingJob(now))!;await finishPublishingJob(claimed);
  expect(await claimPublishingJob(new Date(now.getTime()+JOB_LEASE_MS+1))).toBeNull();
 });
 it('marks a crashed fifth attempt failed after lease expiry',async()=>{
  const job=await publishing();await PublishingJob.updateOne({_id:job._id},{$set:{attempts:4}});
  const last=(await claimPublishingJob(now))!;expect(last.get('attempts')).toBe(5);
  expect(await claimPublishingJob(new Date(now.getTime()+JOB_LEASE_MS+1))).toBeNull();
  expect((await PublishingJob.findById(job._id))!.get('status')).toBe('FAILED');
 });
});
