import { z } from "zod";

export type PlaygroundInput = { baseUrl: string; route: string; method: string; timeout: string; interval: string; assertions: string; expectedStatus: string };
const assertionSchema = z.array(z.object({path:z.string().trim().min(1).max(200),value:z.union([z.string(),z.number(),z.boolean(),z.null()]).optional()}).strict()).max(30);
export function buildMonitoringConfig(input: PlaygroundInput) {
 const errors: string[] = [];
 let base: URL | undefined;
 try {
  base = new URL(input.baseUrl.trim());
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || (base.pathname !== "/" && base.pathname !== "")) throw Error();
  if (!base.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(base.hostname) || base.hostname.endsWith(".local") || base.hostname.endsWith(".localhost") || /^172\.(1[6-9]|2\d|3[01])\./.test(base.hostname)) throw Error();
 } catch { errors.push("Backend URL: use a public HTTPS origin, such as https://your-service.onrender.com, without a path, credentials, or query string."); }
 const route=input.route.trim();
 if (!/^\/(?!\/)[a-zA-Z0-9/_~.%-]*$/.test(route) || /[:*{}]/.test(route) || /%(?![a-f\d]{2})/i.test(route) || route.split('/').includes('..')) errors.push("Express route: enter a concrete path beginning with one slash, such as /api/health. Do not include route parameters or a full URL.");
 if (!["GET","HEAD"].includes(input.method)) errors.push("Method: use GET or HEAD for monitoring.");
 const timeout=Number(input.timeout), interval=Number(input.interval), status=Number(input.expectedStatus);
 if (!input.timeout.trim() || !Number.isInteger(timeout) || timeout<1000 || timeout>60000) errors.push("Timeout must be a whole number from 1,000 to 60,000 milliseconds.");
 if (!input.interval.trim() || !Number.isInteger(interval) || interval<30 || interval>86400) errors.push("Interval must be a whole number from 30 to 86,400 seconds.");
 if (!input.expectedStatus.trim() || !Number.isInteger(status) || status<100 || status>599) errors.push("Expected HTTP status must be a whole number from 100 to 599.");
 let assertions: z.infer<typeof assertionSchema> = [];
 try { const parsed=assertionSchema.safeParse(JSON.parse(input.assertions)); if (!parsed.success) throw Error(); assertions=parsed.data; }
 catch { errors.push('JSON assertions: use an array of up to 30 objects with a path and optional string, number, boolean, or null value. Example: [{"path":"status","value":"ok"}]'); }
 if (input.method === "HEAD" && assertions.length) errors.push("HEAD responses have no body. Choose GET for JSON assertions, or set assertions to [].");
 const config = errors.length || !base ? null : {name:"Backend health check", url: new URL(route,base.origin).href,method:input.method as "GET"|"HEAD",expectedStatus:status,timeoutMs:timeout,intervalSeconds:interval,responseAssertions:assertions,isActive:true};
 return {errors,config};
}
