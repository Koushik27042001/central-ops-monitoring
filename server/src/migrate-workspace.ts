import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { User } from './models/index.js';

const args=process.argv.slice(2);
const email=args.find(value=>!value.startsWith('--'))?.toLowerCase();
if(!email || !email.includes('@')) throw new Error('Usage: npm run migrate:workspace --workspace=@centralops/server -- owner@example.com [--apply]');
await connectDatabase();
try {
 const user=await User.findOne({email});
 if(!user) throw new Error('Owner must sign in once before migration. No data was changed.');
 const models=Object.values(mongoose.models).filter(model=>!!model.schema.path('ownerId'));
 const counts=await Promise.all(models.map(async model=>({model,count:await model.countDocuments({ownerId:{$exists:false}})})));
 console.log('Unassigned records by collection:');
 for(const {model,count} of counts) console.log(model.modelName+': '+count);
 if(!args.includes('--apply')) console.log('Dry run only. Back up the database, confirm every unassigned record belongs to this owner, then repeat with --apply.');
 else {
  for(const {model} of counts) await model.updateMany({ownerId:{$exists:false}},{$set:{ownerId:user._id}});
  console.log('Unassigned legacy records assigned to the selected owner. Existing ownership was not changed.');
 }
} finally {await disconnectDatabase();}
