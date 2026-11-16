import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
/** Mount at /api/integrations. The adapter must persist idempotency keys with writes. */
export function createIntegrationRouter({token, upsertBlog, ready = async () => true}) {
 if(typeof token !== 'string' || token.length < 32) throw new Error('Use a unique integration token of at least 32 characters');
 if(typeof upsertBlog !== 'function') throw new Error('Provide a persistent upsertBlog adapter');
 const router=Router();
 const digest=value=>createHash('sha256').update(value).digest();
 router.use((req,res,next)=>{
  const supplied=req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  if(!timingSafeEqual(digest(supplied),digest(token))) return res.status(401).json({error:'Unauthorized'});
  next();
 });
 router.get('/health',async(_req,res)=>{try{const available=await ready();res.status(available?200:503).json({status:available?'ready':'not_ready'});}catch{res.status(503).json({status:'not_ready'});}});
 router.post('/blogs',async(req,res)=>{
  const key=req.get('Idempotency-Key');
  const body=req.body;
  if(!key || !/^[a-f0-9]{64}$/.test(key) || !body || typeof body._id !== 'string' || !/^[a-f0-9]{24}$/i.test(body._id) || typeof body.title !== 'string' || !body.title.trim() || body.title.length>200 || typeof body.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) || typeof body.content !== 'string' || body.content.length>90000) return res.status(400).json({error:'Invalid publishing payload or idempotency key'});
  // Only accept explicit content fields; never forward arbitrary MongoDB operators.
  const post={externalId:body._id,title:body.title,slug:body.slug,content:body.content,excerpt:typeof body.excerpt==='string'?body.excerpt:''};
  try{const result=await upsertBlog(post,key);res.json({data:result});}catch{res.status(502).json({error:'Publishing adapter failed'});}
 });
 return router;
}
