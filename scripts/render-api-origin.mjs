export function validateRenderApiOrigin(value){
 try{
  const url=new URL(value);
  if(typeof value!=='string'||url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||value!==url.origin)throw new Error();
  return url.origin;
 }catch{
  throw new Error('Set RENDER_API_ORIGIN in Vercel to your backend HTTPS origin, for example https://your-api.onrender.com. Do not include a trailing slash, /api/v1, or credentials.');
 }
}
