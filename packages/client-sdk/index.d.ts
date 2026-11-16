import type { Router } from 'express';
export interface IntegrationBlog {externalId:string;title:string;slug:string;content:string;excerpt:string}
export function createIntegrationRouter(options:{token:string;upsertBlog:(blog:IntegrationBlog,idempotencyKey:string)=>Promise<unknown>;ready?:()=>Promise<boolean>}):Router;
