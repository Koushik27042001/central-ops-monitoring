import { checkUrl } from './outbound.js';
import { validateResponse, type Assertion } from './assertions.js';

export async function probeEndpoint(input:{url:string;method?:string;timeoutMs?:number;expectedStatus?:number;responseAssertions?:Assertion[]}) {
 const checkedAt=new Date();
 const started=performance.now();
 try {
  const response=await checkUrl(input.url,input.timeoutMs ?? 15000,input.method ?? 'GET');
  const failures=validateResponse(response.body,input.responseAssertions ?? []);
  if(response.httpStatus !== (input.expectedStatus ?? 200)) failures.unshift(`Expected HTTP ${input.expectedStatus ?? 200}, received ${response.httpStatus}`);
  return {status:failures.length?'DOWN':'UP',httpStatus:response.httpStatus,responseTime:response.responseTime,errorMessage:failures.join('; ') || undefined,checkedAt,responsePreview:response.body.slice(0,8192),responseTruncated:response.body.length>8192};
 }catch(error){
  return {status:'DOWN',responseTime:Math.round(performance.now()-started),errorMessage:error instanceof Error ? error.message : 'Request failed',checkedAt,responsePreview:'',responseTruncated:false};
 }
}
