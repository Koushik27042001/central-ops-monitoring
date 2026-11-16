import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import mongoose from 'mongoose';
import { createPrivateKey } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { heading, status } from './terminal.mjs';

const root=new URL('../',import.meta.url);
const details=process.argv.includes('--details');
let passed=0,failed=0;
const fixes=[];
heading('OrbitOps | Checking your settings');
function check(name,ok,fix){status(ok?'OK':'FIX',name);if(ok)passed++;else{failed++;if(fix)fixes.push(fix);}}
function readSettings(file){try{return parse(readFileSync(new URL(file,root)));}catch{check(file+' is available',false,'Create '+file+' from its .env.example file and fill in your settings.');return {};}}
const server=readSettings('server/.env'),client=readSettings('client/.env');
if(server.AUTH_PROVIDER==='firebase'){
 check('Website and server use the same sign-in project',!!server.FIREBASE_PROJECT_ID&&server.FIREBASE_PROJECT_ID===client.VITE_FIREBASE_PROJECT_ID,'Use the same Firebase project ID in server/.env and client/.env.');
 check('Firebase sign-in is enabled',client.VITE_AUTH_PROVIDER==='firebase','Set VITE_AUTH_PROVIDER=firebase in client/.env.');
 check('Website sign-in settings are filled in',['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID'].every(key=>!!client[key]),'Copy the web app settings from Firebase Project settings into client/.env.');
 check('Account registration settings are configured',server.PUBLIC_REGISTRATION==='true'||!!server.FIREBASE_ADMIN_EMAILS?.trim(),'Set PUBLIC_REGISTRATION=true, or list approved emails in FIREBASE_ADMIN_EMAILS in server/.env.');
 check('Server sign-in account is configured',!!server.FIREBASE_CLIENT_EMAIL?.endsWith('.iam.gserviceaccount.com'),'Copy client_email from your Firebase service-account file into FIREBASE_CLIENT_EMAIL.');
 try{createPrivateKey(server.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n')||'');check('Server sign-in key can be read',true);}catch{check('Server sign-in key can be read',false,'Copy private_key from the Firebase service-account file into FIREBASE_PRIVATE_KEY in server/.env.');}
}else check('Local sign-in is configured',server.AUTH_PROVIDER==='local'&&client.VITE_AUTH_PROVIDER==='local','Choose the same AUTH_PROVIDER and VITE_AUTH_PROVIDER in the server and client settings.');
check('Stored integration credentials can be protected',/^[a-f0-9]{64}$/i.test(server.INTEGRATION_ENCRYPTION_KEY||''),'Set INTEGRATION_ENCRYPTION_KEY in server/.env to a 64-character hexadecimal key. Keep an existing working key unchanged.');
for(const [key,label,fallback,maximum] of [['WORKSPACE_MAX_WEBSITES','Websites per workspace',25,10000],['WORKSPACE_MAX_ENDPOINTS','API checks per workspace',100,10000],['WORKSPACE_MAX_RECORDS','Records per section',1000,100000],['WORKSPACE_MAX_PENDING_JOBS','Queued publishing tasks',25,10000]]){
 const value=Number(server[key]??fallback);
 check(label+' ('+value+')',Number.isInteger(value)&&value>=1&&value<=maximum,'Set '+key+' in server/.env to a whole number between 1 and '+maximum+'.');
}
const days=Number(server.AUTH_SESSION_DAYS??2);
check('Sign-in duration ('+days+' days)',Number.isInteger(days)&&days>=1&&days<=14,'Set AUTH_SESSION_DAYS in server/.env to a whole number between 1 and 14.');
status('CHECKING','Connecting to your database. Please wait...');
try{
 const uri=process.env.MONGODB_URI||server.MONGODB_URI;
 const url=new URL(uri);
 if(url.protocol==='mongodb+srv:'){
  const resolver=new Resolver({timeout:4000,tries:1});
  if(process.env.CHECK_DNS_SERVER)resolver.setServers([process.env.CHECK_DNS_SERVER]);
  try{const records=await resolver.resolveSrv('_mongodb._tcp.'+url.hostname);check('Database address can be found',records.length>0,'Check your Atlas cluster address and internet connection.');}
  catch(error){check('Database address can be found',false,'Check your internet connection and Atlas cluster address.');if(details)status('DETAIL','Address lookup code: '+error.code);}
 }
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000,connectTimeoutMS:10000,...(url.protocol==='mongodb+srv:'?{tls:true,tlsInsecure:false}:{})});
 await mongoose.connection.db.admin().ping();check('Database accepts connections and responds',true);
}catch(error){
 const codes=error.reason?.servers?[...error.reason.servers.values()].map(server=>server.error?.cause?.code||server.error?.code).filter(Boolean):[];
 const diagnostic=String(error.message)+' '+codes.join(' ');
 const fix=/auth|bad credentials/i.test(diagnostic)?'Check the database username and password in MONGODB_URI.':/SSL|TLS|certificate/i.test(diagnostic)?'In MongoDB Atlas Network Access, allow this computer or hosting service. Also check your VPN or firewall.':!server.MONGODB_URI&&!process.env.MONGODB_URI?'Add your database connection address to MONGODB_URI in server/.env.':'Check MONGODB_URI, your internet connection, and MongoDB Atlas Network Access.';
 check('Database accepts connections and responds',false,fix);
 if(details){status('DETAIL','Database error: '+error.name+'; code: '+(error.code||'not supplied'));if(codes.length)status('DETAIL','Connection codes: '+[...new Set(codes)].join(', '));}
}finally{await mongoose.disconnect();}
heading(failed?'Some settings need attention':'Settings check complete');
status('RESULT',passed+' checks passed; '+failed+' need attention.');
for(const fix of new Set(fixes))status('NEXT STEP',fix);
if(!failed)status('NEXT STEP','Start the workspace with npm run dev:local, then open the website.');
if(!details)status('HELP','For technical error codes, run npm run check:config -- --details.');
process.exitCode=failed?1:0;
