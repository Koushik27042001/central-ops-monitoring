import { heading, status, setting } from './terminal.mjs';
﻿import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { config } from 'dotenv';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
config({path:resolve(root,'server/.env')});
const uri=process.env.MONGODB_URI;
const localUri='mongodb://127.0.0.1:27017/centralops_demo';
const useLocalDatabase=uri===localUri;

const children=new Set();let mongo;let stopping=false;
const portFree=port=>new Promise((resolvePort,reject)=>{const server=createServer();server.once('error',reject);server.listen(port,'127.0.0.1',()=>server.close(()=>resolvePort(true)));});
function run(args,cwd){const child=spawn(process.execPath,args,{cwd:resolve(root,cwd),stdio:'inherit',env:{...process.env,NODE_ENV:'development',MONGODB_URI:uri}});children.add(child);child.once('exit',()=>children.delete(child));return child;}
function wait(child){return new Promise((done,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?done():reject(new Error('Preparation did not finish. Check the message above and try again.')));});}
async function shutdown(code=0){if(stopping)return;stopping=true;status('STOPPING','Closing the workspace safely. Saved data will be kept.');for(const child of children)child.kill();if(mongo)await mongo.stop({doCleanup:false});process.exitCode=code;}
process.once('SIGINT',()=>void shutdown());process.once('SIGTERM',()=>void shutdown());
heading('OrbitOps | Starting your workspace');
try{
 if(process.env.NODE_ENV!=='development' || !uri)throw new Error('Open server/.env and set NODE_ENV=development and MONGODB_URI before starting.');
 await portFree(4000);if(useLocalDatabase) await portFree(27017);
 let reuseFrontend=false;
 try{await portFree(5173);}catch(error){
  if(error.code!=='EADDRINUSE')throw error;
  const response=await fetch('http://127.0.0.1:5173',{signal:AbortSignal.timeout(5000)});
  if(!response.ok || !(await response.text()).includes('OrbitOps'))throw new Error('Port 5173 is occupied by a different application');
  reuseFrontend=true;status('OK','The website is already open on port 5173.');
 }
 if(useLocalDatabase) {
 const dataPath=resolve(root,'.local-data/mongodb');const downloadDir=resolve(root,'.local-tools/mongodb');
 await mkdir(dataPath,{recursive:true});await mkdir(downloadDir,{recursive:true});
 status('STARTING','Preparing your local database. The first start may take longer.');
 mongo=await MongoMemoryServer.create({instance:{ip:'127.0.0.1',port:27017,portGeneration:false,dbName:'centralops_demo',dbPath:dataPath,storageEngine:'wiredTiger'},binary:{downloadDir}});
 status('OK','Local database is ready. Your data is saved between restarts.');
 } else {status('SETTINGS','Using your configured database; the service will check the connection.');}
 // Compile the API so the launcher does not depend on a TypeScript watch subprocess.
 status('PREPARING','Getting the website service ready...');
 await wait(run([resolve(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json'],'server'));
 const api=run(['--watch','--watch-preserve-output','dist/index.js'],'server');
 const worker=run(['--import','tsx','--watch','--watch-preserve-output','src/index.ts'],'worker');
 const frontend=reuseFrontend?null:run([resolve(root,'node_modules/vite/bin/vite.js'),'--host','localhost'],'client');
 for(const child of [api,worker,frontend].filter(Boolean)){child.once('error',error=>{status('ERROR','A service could not start. Check the message above and try again.');void shutdown(1);});child.once('exit',code=>{if(!stopping){status('STOPPED','A service stopped unexpectedly. The workspace is stopping safely.');void shutdown(code || 1);}});}
 heading('Your workspace links');
 setting('Open in your browser','http://localhost:5173');
 setting('Website service','http://127.0.0.1:4000');
 setting('To stop','Press Ctrl+C in this terminal.');
 console.log('\n  Services are starting. Wait for their ready messages below.');
 console.log('  Then open the website and sign in or create your account.\n');
}catch(error){status('ERROR','Your workspace could not start.');if(error.code==='EADDRINUSE')status('NEXT STEP','A required port is already in use. Stop the other running copy and try again.');else status('NEXT STEP',error.message);await shutdown(1);}
