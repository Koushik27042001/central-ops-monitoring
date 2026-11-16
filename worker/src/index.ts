import { setTimeout as sleep } from "node:timers/promises";
import type { Document } from "mongoose";
import { connectDatabase, disconnectDatabase } from "../../server/dist/config/database.js";
import { env } from "../../server/dist/config/env.js";
import { logger as baseLogger } from "../../server/dist/utils/logger.js";
import { MonitoringTarget, PublishingJob } from "../../server/dist/models/index.js";
import { claimMonitoringTarget, claimPublishingJob, releaseMonitoringTarget, renewJobLease } from "../../server/dist/services/background-jobs.js";
import { monitorTarget, publishRecord } from "./processors.js";

const logger=baseLogger.child({area:'Background work'});
const stopping=new AbortController();
async function runLane(kind:'monitoring'|'publishing'):Promise<void> {
 while(!stopping.signal.aborted) {
  let record:Document|null=null;
  let succeeded=false;
  let heartbeat:ReturnType<typeof setInterval>|undefined;
  try {
   record=kind==='monitoring'?await claimMonitoringTarget():await claimPublishingJob();
   if(!record){await sleep(2000,undefined,{signal:stopping.signal});continue;}
   const claimed=record;
   let renewing=false;
   heartbeat=setInterval(()=>{
    if(renewing)return;renewing=true;
    void renewJobLease(kind,claimed).then(owned=>{if(!owned)logger.warn({kind},'This task is being handled by another worker.');}).catch(()=>logger.warn({kind},'Could not confirm a task is still assigned to this worker. It will be retried safely.')).finally(()=>{renewing=false;});
   },30000);
   if(kind==='monitoring')await monitorTarget(record);else await publishRecord(record);
   succeeded=true;
  } catch {
   if(!stopping.signal.aborted)logger.error({kind},'A scheduled task could not finish. It remains saved for another attempt.');
  } finally {
   clearInterval(heartbeat);
   if(record&&kind==='monitoring')await releaseMonitoringTarget(record,succeeded).catch(()=>logger.warn('A monitoring task will become available again automatically.'));
  }
  if(!succeeded&&!stopping.signal.aborted)await sleep(2000,undefined,{signal:stopping.signal}).catch(()=>{});
 }
}

async function start(){
 if(!env.MONGODB_URI)throw new Error('Add MONGODB_URI in server/.env to enable scheduled work.');
 await connectDatabase();
 // Build the scheduling indexes without dropping existing data/indexes.
 await Promise.all([MonitoringTarget.createIndexes(),PublishingJob.createIndexes()]);
 const shutdown=()=>{if(stopping.signal.aborted)return;stopping.abort();const deadline=setTimeout(()=>process.exit(0),25000);deadline.unref();};
 process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
 logger.info('Ready to run scheduled website checks and publishing tasks.');
 await Promise.all([...Array.from({length:5},()=>runLane('monitoring')),...Array.from({length:2},()=>runLane('publishing'))]);
 await disconnectDatabase();
}
start().catch(async(error)=>{logger.fatal({hint:error instanceof Error && error.message.startsWith('MongoDB connection failed.')?error.message:'Run npm run check:config and check your database settings.'},'Scheduled work could not start.');await disconnectDatabase();process.exitCode=1;});
