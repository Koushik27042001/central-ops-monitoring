import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose, { type Model, type PipelineStage } from 'mongoose';

const context = new AsyncLocalStorage<mongoose.Types.ObjectId>();
export function inWorkspace<T>(userId: unknown, callback: () => T): T {
 return context.run(new mongoose.Types.ObjectId(String(userId)), callback);
}
export function workspaceOwner() {
 const ownerId = context.getStore();
 if (!ownerId) throw new Error('Workspace context is required');
 return ownerId;
}

// Used only by HTTP management routes. Workers use the underlying models and
// propagate ownership from the jobs they claim. No HTTP query can omit its owner.
export function workspaceModel<T extends Model<any>>(model: T): T {
 const filterMethods = new Set(['find','findOne','exists','countDocuments','updateOne','updateMany','findOneAndUpdate','deleteOne','deleteMany']);
 const proxy = new Proxy(model, {get(target, property) {
  if (typeof property !== 'string') return Reflect.get(target, property);
  if (property === 'create') return (input: Record<string, unknown>) => target.create({...input, ownerId:workspaceOwner()});
  if (property === 'aggregate') return (pipeline: PipelineStage[] = []) => {
   // Only allow stages used by workspace summaries. A lookup/union/output stage
   // could otherwise cross collections or bypass the initial ownership match.
   const allowed=new Set(['$match','$group','$sort','$project','$limit','$skip','$count','$addFields','$set','$unset']);
   if(pipeline.some(stage=>Object.keys(stage).length!==1 || !allowed.has(Object.keys(stage)[0]!))) throw new Error('Unsupported workspace aggregation stage');
   return target.aggregate([{$match:{ownerId:workspaceOwner()}}, ...pipeline]);
  };
  if (property === 'findById' || property === 'findByIdAndUpdate') return (id: unknown, ...args: any[]) => {
   const method = property === 'findById' ? 'findOne' : 'findOneAndUpdate';
   return (proxy[method] as Function)({_id:id}, ...args);
  };
  if (filterMethods.has(property)) return (filter: object = {}, ...args: any[]) => {
   const ownerId = workspaceOwner();
   if (['updateOne','updateMany','findOneAndUpdate'].includes(property)) {
    const update = args[0] || {};
    if(Array.isArray(update) || Object.keys(update).some(key=>!['$set','$setOnInsert','$unset','$inc','$push'].includes(key))) throw new Error('Unsupported workspace update');
    if (Object.values(update).some(value => value && typeof value === 'object' && Object.keys(value).some(key=>key==='ownerId'||key.startsWith('ownerId.')))) throw new Error('Workspace ownership cannot be changed');
    if (args[1]?.upsert) args[0] = {...update, $setOnInsert:{...update.$setOnInsert, ownerId}};
   }
   return (target[property as keyof T] as Function).call(target, {$and:[{ownerId}, filter]}, ...args);
  };
  throw new Error('Unsupported workspace operation: '+property);
 }});
 return proxy;
}
