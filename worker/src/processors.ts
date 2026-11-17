import type { Document } from "mongoose";
import { Integration, BlogPost, ApiEndpoint, ApiCheckResult, Incident, Notification, MonitoringTarget, MonitoringCheck, Website } from "../../server/dist/models/index.js";
import { checkUrl } from "../../server/dist/services/outbound.js";
import { validateResponse } from "../../server/dist/services/assertions.js";
import { decryptSecret } from "../../server/dist/services/secrets.js";
import { assertJobLease, finishPublishingJob, retryPublishingJob } from "../../server/dist/services/background-jobs.js";

export async function monitorTarget(target: Document): Promise<void> {
 await assertJobLease("monitoring",target);
 const ownerId = target.get('ownerId');
 if (!ownerId) return;
 const website = await Website.findOne({_id:target.get("websiteId"),ownerId});
 if (!website?.get("monitoringEnabled")) return;
 if (!website.get("ownerId") || String(website.get("ownerId")) !== String(target.get("ownerId"))) return;
 const endpoint = target.get('endpointId') ? await ApiEndpoint.findOne({_id:target.get('endpointId'),websiteId:website._id,ownerId}) : null;
 if(target.get('endpointId') && !endpoint) throw new Error('Invalid workspace monitoring reference');
 if(endpoint && endpoint.get('isActive') === false) return;
 const expectedStatus = endpoint?.get('expectedStatus') ?? target.get('expectedStatus') ?? 200;
 let status = "DOWN"; let httpStatus: number | undefined; let responseTime: number | undefined; let errorMessage: string | undefined;
 try {const result = await checkUrl(endpoint?.get('url') ?? target.get("url"), endpoint?.get('timeoutMs') ?? target.get("timeoutMs"), endpoint?.get('method') ?? target.get("method") ?? "GET");
 if (target.get("expectedResponse") && !result.body.includes(target.get("expectedResponse"))) errorMessage = "Response does not contain expected content";
 const failures = validateResponse(result.body, endpoint?.get("responseAssertions") ?? []);
 if (failures.length) errorMessage = failures.join("; "); httpStatus = result.httpStatus; responseTime = result.responseTime;
 if(httpStatus !== expectedStatus) errorMessage = `Expected HTTP ${expectedStatus}, received ${httpStatus}${errorMessage ? '; '+errorMessage : ''}`;
 status = !errorMessage ? "UP" : "DOWN";} catch(e) {errorMessage = (e as Error).message;}
 await assertJobLease("monitoring",target);
 // Discard responses for a configuration changed or paused during the request.
 if(endpoint && !await ApiEndpoint.exists({_id:endpoint._id,ownerId,updatedAt:endpoint.get('updatedAt'),isActive:{$ne:false}})) return;
 await MonitoringCheck.create({ownerId:website.get("ownerId"), websiteId: website._id, targetId: target._id, status, httpStatus, responseTime, errorMessage});
 if (target.get("endpointId")) await ApiCheckResult.create({endpointId: target.get("endpointId"), ownerId:website.get("ownerId"), websiteId: website._id, status, httpStatus, responseTime, errorMessage, checkedAt: new Date()});
 if (status === "DOWN") {
  const recent = await MonitoringCheck.find({targetId: target._id,ownerId}).sort({checkedAt: -1}).limit(3);
  if (recent.length === 3 && recent.every(c => c.get("status") === "DOWN")) {
   const incident = await Incident.findOneAndUpdate({targetId: target._id, ownerId, status: "OPEN"}, {$set: {lastFailureAt: new Date()}, $inc: {failureCount: 1}, $setOnInsert: {websiteId: website._id, title: `${target.get("name")} unavailable`, firstDetectedAt: new Date()}}, {upsert: true, new: false});
   if (!incident) await Notification.create({ownerId:website.get("ownerId"), websiteId: website._id, title: "Monitoring failure", message: `${target.get("name")} failed three consecutive checks`});
  }
 } else {
  const incident = await Incident.findOneAndUpdate({targetId: target._id, ownerId, status: "OPEN"}, {$set: {status: "RESOLVED", resolvedAt: new Date()}}, {new: true});
  if (incident) await Notification.create({ownerId:website.get("ownerId"), websiteId: website._id, incidentId: incident._id, title: "Service recovered", message: `${target.get("name")} is responding again`});
 }
 const targets = await MonitoringTarget.find({ownerId:website.get("ownerId"), websiteId: website._id, enabled: true});
 const latest = await Promise.all(targets.map(t => MonitoringCheck.findOne({targetId: t._id,ownerId}).sort({checkedAt: -1})));
 const overall = latest.some(c => c?.get("status") === "DOWN") ? "DOWN" : latest.some(c => !c) ? "UNKNOWN" : "UP";
 await Website.updateOne({_id: website._id,ownerId}, {$set: {status: overall}});

}

export async function publishRecord(record: Document): Promise<void> {
 let workspaceValidated=false;
 try {
  await assertJobLease("publishing",record);
  if(!record.get('ownerId')) throw new Error('Unassigned publishing job');
  const ownerId=record.get('ownerId');
  const blog=await BlogPost.findOne({_id:record.get('blogId'),websiteId:record.get('websiteId'),ownerId});
  const website=await Website.exists({_id:record.get('websiteId'),ownerId});
  const snapshot=record.get('snapshot');
  if(!blog || !website || !snapshot || String(snapshot._id)!==String(blog._id) || String(snapshot.websiteId)!==String(record.get('websiteId')) || String(snapshot.ownerId)!==String(ownerId)) throw new Error('Invalid workspace publishing reference');
  workspaceValidated=true;
  const integration = await Integration.findOne({ownerId:record.get('ownerId'),websiteId: record.get('websiteId'), isActive:true, permissions:'blogs:write'}).select('+credentialReference');
  if (!integration) throw new Error('No active authorized integration');
  await assertJobLease("publishing",record);
  const result = await checkUrl(integration.get('endpointBaseUrl')+'/blogs', 30000, 'POST', {headers:{'Content-Type':'application/json',Authorization:'Bearer '+decryptSecret(integration.get('credentialReference')),'Idempotency-Key':record.get('idempotencyKey')},body:JSON.stringify(record.get('snapshot'))});
  if (result.httpStatus < 200 || result.httpStatus >= 300) throw new Error('Remote publishing failed');
  // Keep the idempotency key stable when retrying delivery after a crash.
  await assertJobLease("publishing",record);
  await BlogPost.updateOne({_id:record.get('blogId'),ownerId:record.get('ownerId'),updatedAt:record.get('snapshot').updatedAt},{$set:{status:'PUBLISHED',publishedAt:new Date()}});
  await finishPublishingJob(record);
 } catch {
  const exhausted=await retryPublishingJob(record);
  if(exhausted && workspaceValidated) await Notification.create({ownerId:record.get('ownerId'),websiteId:record.get('websiteId'),title:'Blog publishing failed',message:'Review integration connectivity and publishing history.'});
 }
}
