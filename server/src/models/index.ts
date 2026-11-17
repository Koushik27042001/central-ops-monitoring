import mongoose, { Schema, type SchemaDefinition } from "mongoose";
const ref = (name: string, required = true) => ({ type: Schema.Types.ObjectId, ref: name, required });
function model(name: string, fields: SchemaDefinition) {
  const scoped = !['User','Session','DemoEnquiry'].includes(name);
  const schema = new Schema({...fields, ...(scoped ? {ownerId:{...ref('User', false), index:true}} : {})}, {timestamps:true, strict:true});
  if(scoped) schema.index({ownerId:1, createdAt:-1});
  return mongoose.model(name, schema);
}
export const User = model("User", { firebaseUid: {type:String, unique:true, sparse:true}, name: String, email: {type: String, unique: true, required: true}, passwordHash: {type: String, select: false}, role: {type: String, default: "SUPER_ADMIN"}, isActive: {type: Boolean, default: true}, lastLogin: Date, onboardingStatus:{type:String,enum:["PENDING","COMPLETED","SKIPPED"]} });
export const Session = model("Session", {userId: ref("User"), tokenHash: {type: String, unique: true}, expiresAt: {type: Date, expires: 0}});
export const Client = model("Client", {name: {type: String, required: true}, company: String, email: String, phone: String, maintenancePlan: String, contractStart: Date, contractEnd: Date, status: {type: String, default: "ACTIVE"}, notes: String});
export const Website = model("Website", {clientId: {...ref("Client"), index: true}, name: {type: String, required: true}, description: String, frontendUrl: String, backendUrl: String, adminUrl: String, healthUrl: String, readinessUrl: String, frontendTechnology: String, backendTechnology: String, databaseTechnology: String, hostingProvider: String, environment: {type: String, default: "production"}, monitoringEnabled: {type: Boolean, default: true}, monitoringInterval: {type: Number, default: 60}, status: {type: String, default: "UNKNOWN"}});
export const MonitoringTarget = model("MonitoringTarget", {websiteId: {...ref("Website"), index: true}, endpointId: ref("ApiEndpoint", false), name: String, type: String, url: String, method: {type: String, default: "GET"}, expectedStatus: {type: Number, default: 200}, expectedResponse: String, timeoutMs: {type: Number, default: 15000}, intervalSeconds: {type: Number, default: 60}, enabled: {type: Boolean, default: true}, nextCheckAt: {type: Date, default: Date.now, index: true}, leaseToken: {type: String, select: false}, leaseUntil: Date});
export const MonitoringCheck = model("MonitoringCheck", {websiteId: {...ref("Website"), index: true}, targetId: ref("MonitoringTarget"), status: String, httpStatus: Number, responseTime: Number, errorMessage: String, checkedAt: {type: Date, default: Date.now, expires: 2592000}});
export const ApiEndpoint = model("ApiEndpoint", {websiteId: ref("Website"), name: String, url: String, method: String, encryptedAuthenticationConfig: {type: String, select: false}, headersConfig: Object, requestBodyConfig: Object, expectedStatus: Number, responseAssertions: [Object], timeoutMs: Number, intervalSeconds: Number, isActive: Boolean});
export const ApiCheckResult = model("ApiCheckResult", {endpointId: ref("ApiEndpoint"), websiteId: ref("Website"), status: String, httpStatus: Number, responseTime: Number, assertionResults: [Object], errorMessage: String, checkedAt: {type: Date, expires: 2592000}});
export const Incident = model("Incident", {websiteId: ref("Website"), targetId: ref("MonitoringTarget"), title: String, description: String, severity: {type: String, default: "HIGH"}, status: {type: String, default: "OPEN"}, firstDetectedAt: Date, lastFailureAt: Date, resolvedAt: Date, failureCount: {type: Number, default: 1}, resolutionNotes: String});
export const BlogPost = model("BlogPost", {clientId: ref("Client"), websiteId: ref("Website"), title: String, slug: String, excerpt: String, content: String, featuredImage: String, categories: [String], tags: [String], seoTitle: String, seoDescription: String, status: {type: String, default: "DRAFT"}, publishedAt: Date});
export const PublishingJob = model("PublishingJob", {websiteId: ref("Website"), blogId: ref("BlogPost"), operation: String, scheduledAt: {type: Date, default: Date.now}, snapshot: Object, idempotencyKey: {type: String, unique: true}, status: {type: String, default: "PENDING"}, attempts: {type: Number, default: 0}, lastError: String, completedAt: Date, nextAttemptAt: Date, leaseToken: {type: String, select: false}, leaseUntil: Date});
export const Integration = model("Integration", {websiteId: ref("Website"), integrationType: String, endpointBaseUrl: String, credentialReference: {type: String, select: false}, permissions: [String], isActive: Boolean, lastConnectedAt: Date});
export const SupportTicket = model("SupportTicket", {clientId: ref("Client"), websiteId: ref("Website"), title: String, description: String, priority: {type: String, default: "NORMAL"}, status: {type: String, default: "OPEN"}, assignedTo: ref("User", false), comments: [{body: String, userId: ref("User"), createdAt: Date}]});
export const Notification = model("Notification", {websiteId: ref("Website"), incidentId: ref("Incident", false), title: String, message: String, channel: {type: String, default: "IN_APP"}, status: {type: String, default: "UNREAD"}, sentAt: Date});
export const AuditLog = model("AuditLog", {userId: ref("User"), action: String, entityType: String, entityId: String, metadata: Object});
export const MaintenanceRecord = model("MaintenanceRecord", {websiteId: ref("Website"), maintenanceType: String, description: String, date: Date, developer: String, status: String, notes: String});
export const BlogRevision = model("BlogRevision", {blogId: ref("BlogPost"), userId: ref("User"), snapshot: Object});
export const CredentialRotation = model("CredentialRotation", {integrationId: ref("Integration"), rotatedBy: ref("User"), revokedAt: Date});
Incident.schema.index({targetId: 1}, {unique: true, partialFilterExpression: {status: "OPEN"}});
MonitoringTarget.schema.index({websiteId: 1, type: 1}, {unique: true, partialFilterExpression: {type: {$in: ["FRONTEND", "BACKEND", "HEALTH", "READINESS", "ADMIN_PAGE"]}}});
MonitoringTarget.schema.index({endpointId: 1}, {unique: true, partialFilterExpression: {type: "API"}});
BlogPost.schema.index({websiteId: 1, slug: 1}, {unique: true});
MonitoringCheck.schema.index({targetId: 1, checkedAt: -1});
ApiCheckResult.schema.index({ownerId:1, endpointId:1, checkedAt:-1});

Integration.schema.index({websiteId: 1}, {unique: true});
PublishingJob.schema.index({status: 1, scheduledAt: 1});

export const DemoEnquiry = model("DemoEnquiry", {name: {type: String, required: true}, email: {type: String, required: true}, company: String, website: String, interest: {type: String, required: true}, message: {type: String, required: true}, status: {type: String, default: "NEW", enum: ["NEW", "CONTACTED", "CLOSED"]}});

MonitoringTarget.schema.index({enabled: 1, nextCheckAt: 1, leaseUntil: 1});
PublishingJob.schema.index({status: 1, scheduledAt: 1, nextAttemptAt: 1, leaseUntil: 1});
