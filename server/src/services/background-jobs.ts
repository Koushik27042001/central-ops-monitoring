import { randomUUID } from "node:crypto";
import type { Document } from "mongoose";
import { MonitoringTarget, PublishingJob } from "../models/index.js";

export const JOB_LEASE_MS = 120000;
export const PUBLISH_MAX_ATTEMPTS = 5;
const available = (now: Date) => ({$not: {$gt: now}});

export async function claimMonitoringTarget(now = new Date()) {
 return MonitoringTarget.findOneAndUpdate({enabled:true,nextCheckAt:{$lte:now},leaseUntil:available(now)},
  {$set:{leaseToken:randomUUID(),leaseUntil:new Date(now.getTime()+JOB_LEASE_MS)}},
  {new:true,sort:{nextCheckAt:1}}).select('+leaseToken');
}
export async function releaseMonitoringTarget(target: Document, succeeded: boolean, now = new Date()) {
 const ownership={_id:target._id,leaseToken:target.get('leaseToken')};
 const delay=succeeded ? Math.max(30,Number(target.get('intervalSeconds') || 60))*1000 : 5000;
 // Preserve a check-now request made while this check was running.
 await MonitoringTarget.updateOne({...ownership,nextCheckAt:target.get('nextCheckAt')},{$set:{nextCheckAt:new Date(now.getTime()+delay)}});
 await MonitoringTarget.updateOne(ownership,{$unset:{leaseToken:1,leaseUntil:1}});
}
export async function claimPublishingJob(now = new Date()) {
 // A crashed final attempt must eventually leave PROCESSING as well.
 await PublishingJob.updateMany({status:'PROCESSING',attempts:{$gte:PUBLISH_MAX_ATTEMPTS},leaseUntil:available(now)},
  {$set:{status:'FAILED',lastError:'Worker lease expired after the final attempt'},$unset:{leaseToken:1,leaseUntil:1}});
 return PublishingJob.findOneAndUpdate({status:{$in:['PENDING','RETRYING','PROCESSING']},scheduledAt:{$lte:now},nextAttemptAt:available(now),leaseUntil:available(now),$or:[{attempts:{$lt:PUBLISH_MAX_ATTEMPTS}},{attempts:{$exists:false}}]},
  {$set:{status:'PROCESSING',leaseToken:randomUUID(),leaseUntil:new Date(now.getTime()+JOB_LEASE_MS)},$inc:{attempts:1}},
  {new:true,sort:{scheduledAt:1}}).select('+leaseToken');
}
export async function renewJobLease(kind:'monitoring'|'publishing', record:Document) {
 const model=kind==='monitoring'?MonitoringTarget:PublishingJob;
 const now=new Date();
 const result=await model.updateOne({_id:record._id,leaseToken:record.get('leaseToken'),leaseUntil:{$gt:now}},{$set:{leaseUntil:new Date(now.getTime()+JOB_LEASE_MS)}});
 return result.modifiedCount===1;
}
export async function finishPublishingJob(record:Document) {
 return PublishingJob.updateOne({_id:record._id,leaseToken:record.get('leaseToken')},{$set:{status:'COMPLETED',completedAt:new Date(),lastError:null},$unset:{leaseToken:1,leaseUntil:1,nextAttemptAt:1}});
}
export async function retryPublishingJob(record:Document, now = new Date()) {
 const exhausted=Number(record.get('attempts'))>=PUBLISH_MAX_ATTEMPTS;
 const result=await PublishingJob.updateOne({_id:record._id,leaseToken:record.get('leaseToken')},
  {$set:{status:exhausted?'FAILED':'RETRYING',lastError:'Publishing failed; check integration connectivity and credentials',nextAttemptAt:new Date(now.getTime()+5000*2**Math.max(0,Number(record.get('attempts'))-1))},$unset:{leaseToken:1,leaseUntil:1}});
 return exhausted && result.modifiedCount===1;
}

export async function assertJobLease(kind:'monitoring'|'publishing', record:Document, now = new Date()) {
 const model=kind==='monitoring'?MonitoringTarget:PublishingJob;
 const owned=await model.exists({_id:record._id,leaseToken:record.get('leaseToken'),leaseUntil:{$gt:now}});
 if(!owned) throw new Error('Job lease expired or belongs to another worker');
}
