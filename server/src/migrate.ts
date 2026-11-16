import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { MonitoringTarget } from "./models/index.js";
mongoose.set('autoIndex', false);
await connectDatabase();
try {
 if (mongoose.connection.readyState !== 1) throw new Error('Configure MONGODB_URI first');
 const indexes = await MonitoringTarget.collection.indexes();
 const legacy = indexes.find(index => index.name === 'websiteId_1_type_1' && index.unique && !index.partialFilterExpression);
 if (legacy) await MonitoringTarget.collection.dropIndex('websiteId_1_type_1');
 await MonitoringTarget.createIndexes();
 console.log('Monitoring target indexes updated.');
} finally {await disconnectDatabase();}
