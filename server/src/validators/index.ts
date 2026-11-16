import { z } from "zod";
export const maintenanceSchema = z.object({websiteId: z.string().regex(/^[a-f0-9]{24}$/i), maintenanceType: z.string().min(1).max(100), description: z.string().min(1).max(5000), date: z.coerce.date(), developer: z.string().max(150), status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]), notes: z.string().max(5000).optional()}).strict();
export const id = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid identifier");
export const url = z.string().url().refine(value => ["http:", "https:"].includes(new URL(value).protocol) && !new URL(value).username && !new URL(value).password, "Use HTTP(S) without credentials");
const optionalUrl = z.union([url, z.literal("")]).optional();
export const clientSchema = z.object({name: z.string().trim().min(1).max(150), company: z.string().max(150).optional(), email: z.union([z.email(), z.literal("")]).optional(), phone: z.string().max(40).optional(), maintenancePlan: z.string().max(100).optional(), status: z.enum(["ACTIVE", "ARCHIVED"]).optional(), notes: z.string().max(5000).optional()}).strict();
export const websiteSchema = z.object({clientId: id, name: z.string().trim().min(1).max(150), description: z.string().max(5000).optional(), frontendUrl: url, backendUrl: optionalUrl, adminUrl: optionalUrl, healthUrl: optionalUrl, readinessUrl: optionalUrl, frontendTechnology: z.string().max(100).optional(), backendTechnology: z.string().max(100).optional(), databaseTechnology: z.string().max(100).optional(), hostingProvider: z.string().max(100).optional(), environment: z.enum(["production", "staging", "development"]).default("production"), monitoringEnabled: z.boolean().default(true), monitoringInterval: z.number().int().min(30).max(86400).default(60)}).strict();
export const ticketSchema = z.object({clientId: id, websiteId: id, title: z.string().min(1).max(200), description: z.string().min(1).max(10000), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(), status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional()}).strict();
export const blogSchema = z.object({clientId: id, websiteId: id, title: z.string().min(1).max(200), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), content: z.string().max(90000), excerpt: z.string().max(1000).optional(), status: z.enum(["DRAFT", "ARCHIVED"]).default("DRAFT")}).strict();

export const endpointSchema = z.object({websiteId: id, name: z.string().trim().min(1).max(150), url, method: z.enum(["GET", "HEAD"]).default("GET"), expectedStatus: z.number().int().min(100).max(599).default(200), responseAssertions: z.array(z.object({path: z.string().min(1).max(200), value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional()})).max(30).default([]), timeoutMs: z.number().int().min(1000).max(60000).default(15000), intervalSeconds: z.number().int().min(30).max(86400).default(60), isActive: z.boolean().default(true)}).strict();

export function parsePatch(schema: z.ZodObject, input: unknown) {
 const parsed = schema.partial().parse(input);
 const keys = new Set(Object.keys(input as object));
 return Object.fromEntries(Object.entries(parsed).filter(([key]) => keys.has(key)));
}
