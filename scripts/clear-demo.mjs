import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { config } from 'dotenv';
config({path:'server/.env'});
if(process.env.NODE_ENV!=='development' || !/^mongodb:\/\/(127\.0\.0\.1|localhost):27017\/centralops_demo(?:\?|$)/.test(process.env.MONGODB_URI || ''))throw new Error('Cleanup is restricted to the existing local development database');
const oid=name=>new mongoose.Types.ObjectId(createHash('sha256').update('centralops-local-demo:'+name).digest('hex').slice(0,24));
const ids=prefix=>[0,1,2].map(i=>oid(prefix+'-'+i));
const websites=ids('website'),clients=ids('client'),blogs=ids('blog'),integrations=ids('integration');
const checks=[];for(let i=0;i<3;i++)for(let d=0;d<7;d++)for(let sample=0;sample<4;sample++)checks.push(oid(`check-${i}-${d}-${sample}`));
const plans=[
 ['monitoringchecks',{$or:[{_id:{$in:checks}},{websiteId:{$in:websites}}]}],
 ['apicheckresults',{$or:[{_id:{$in:ids('api-result')}},{websiteId:{$in:websites}}]}],
 ['blogrevisions',{$or:[{_id:{$in:ids('revision')}},{blogId:{$in:blogs}}]}],
 ['publishingjobs',{$or:[{_id:{$in:ids('publishing')}},{websiteId:{$in:websites}}]}],
 ['credentialrotations',{integrationId:{$in:integrations}}],
 ['notifications',{$or:[{_id:{$in:ids('notification')}},{websiteId:{$in:websites}}]}],
 ['incidents',{$or:[{_id:oid('incident')},{websiteId:{$in:websites}}]}],
 ['maintenancerecords',{$or:[{_id:{$in:ids('maintenance')}},{websiteId:{$in:websites}}]}],
 ['supporttickets',{$or:[{_id:{$in:ids('ticket')}},{websiteId:{$in:websites}}]}],
 ['blogposts',{$or:[{_id:{$in:blogs}},{websiteId:{$in:websites}}]}],
 ['integrations',{$or:[{_id:{$in:integrations}},{websiteId:{$in:websites}}]}],
 ['apiendpoints',{$or:[{_id:{$in:ids('endpoint')}},{websiteId:{$in:websites}}]}],
 ['monitoringtargets',{$or:[{_id:{$in:[...ids('target'),...ids('api-target')]}},{websiteId:{$in:websites}}]}],
 ['websites',{_id:{$in:websites}}],['clients',{_id:{$in:clients}}],
 ['auditlogs',{$or:[{_id:oid('audit')},{entityId:{$in:[...clients,...websites,...blogs,...integrations,...ids('endpoint'),...ids('ticket'),...ids('maintenance'),oid('incident')].map(String)}}]}]
];
await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
try{
 const db=mongoose.connection;
 // Protect independent records linked to a seeded client before deleting client roots.
 const independent=await db.collection('websites').countDocuments({clientId:{$in:clients},_id:{$nin:websites}});
 if(independent)throw new Error('A non-seeded website references a demo client; cleanup stopped to preserve it.');
 for(const [name,filter] of plans){const count=await db.collection(name).countDocuments(filter);if(process.argv.includes('--apply')){const result=await db.collection(name).deleteMany(filter);console.log(name+': removed '+result.deletedCount);}else console.log(name+': would remove '+count);}
 if(process.argv.includes('--apply')){
  await db.collection('users').updateMany({name:'Demo Administrator',email:process.env.ADMIN_EMAIL},{$set:{name:'Administrator',updatedAt:new Date()}});
  for(const [name,filter] of plans)if(await db.collection(name).countDocuments(filter))throw new Error('Cleanup verification failed: '+name);
  console.log('Verified: seeded demo records removed. Administrator login and unrelated records preserved.');
 }
}finally{await mongoose.disconnect();}
