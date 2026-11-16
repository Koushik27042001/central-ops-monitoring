// Run from the repo root after configuring MONGODB_URI and CLIENT_INTEGRATION_TOKEN.
// This sample uses a separate collection and never overwrites existing website content.
import express from 'express';
import mongoose from 'mongoose';
import { createIntegrationRouter } from '../packages/client-sdk/index.js';
if(!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
await mongoose.connect(process.env.MONGODB_URI);
const Post=mongoose.model('ExampleIntegrationBlog',new mongoose.Schema({externalId:{type:String,unique:true},title:String,slug:String,content:String,excerpt:String,lastKey:String},{timestamps:true}));
const app=express();
app.use(express.json({limit:'100kb'}));
app.get('/api/health',(_req,res)=>res.json({status:'ok'}));
app.get('/api/ready',(_req,res)=>res.status(mongoose.connection.readyState===1?200:503).json({database:mongoose.connection.readyState===1}));
app.use('/api/integrations',createIntegrationRouter({token:process.env.CLIENT_INTEGRATION_TOKEN,ready:async()=>mongoose.connection.readyState===1,upsertBlog:async(blog,key)=>{
 const prior=await Post.findOne({externalId:blog.externalId,lastKey:key});
 if(prior)return {id:prior._id};
 const post=await Post.findOneAndUpdate({externalId:blog.externalId},{$set:{...blog,lastKey:key}},{upsert:true,new:true});
 return {id:post._id};
}}));
app.listen(4100,'127.0.0.1',()=>console.log('Example client API: http://127.0.0.1:4100 (use a public HTTPS test host for worker checks)'));
