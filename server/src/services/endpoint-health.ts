import { ApiCheckResult as RawApiCheckResult, Website as RawWebsite } from '../models/index.js';
import { workspaceModel } from './workspace.js';
import type { Document } from 'mongoose';

const ApiCheckResult = workspaceModel(RawApiCheckResult);
const Website = workspaceModel(RawWebsite);

export async function endpointHealth(endpoints: Document[]) {
 const websiteIds = endpoints.map(endpoint=>endpoint.get('websiteId'));
 const websites = await Website.find({_id:{$in:websiteIds}}).select('monitoringEnabled');
 const enabledWebsites = new Set(websites.filter(site=>site.get('monitoringEnabled')).map(site=>String(site._id)));
 const latest = endpoints.length ? await ApiCheckResult.aggregate([
  {$match:{endpointId:{$in:endpoints.map(endpoint=>endpoint._id)}}},
  {$sort:{checkedAt:-1,_id:-1}},
  {$group:{_id:'$endpointId',check:{$first:'$$ROOT'}}},
 ]) : [];
 const checks = new Map(latest.map(row=>[String(row._id),row.check]));
 return endpoints.map(endpoint=>{
  const check = checks.get(String(endpoint._id));
  const enabled = endpoint.get('isActive') && enabledWebsites.has(String(endpoint.get('websiteId')));
  const current = check && new Date(check.checkedAt).getTime() >= new Date(endpoint.get('updatedAt')).getTime();
  const staleAfterMs = (3*(endpoint.get('intervalSeconds') || 60)*1000)+(endpoint.get('timeoutMs') || 15000);
  const status = !enabled ? 'PAUSED' : !current ? 'UNKNOWN' : Date.now()-new Date(check.checkedAt).getTime()>staleAfterMs ? 'STALE' : check.status;
  return {...endpoint.toObject(),status,lastCheck:check ? {status:check.status,httpStatus:check.httpStatus,responseTime:check.responseTime,errorMessage:check.errorMessage,checkedAt:check.checkedAt} : null};
 });
}
