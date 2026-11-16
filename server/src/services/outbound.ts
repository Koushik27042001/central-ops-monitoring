import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import https from "node:https";
const blocked = new BlockList();
for (const [address, prefix] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.168.0.0",16],["192.0.0.0",24],["192.0.2.0",24],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]] as const) blocked.addSubnet(address,prefix);
export function isPublicIPv4(address: string) {return isIP(address) === 4 && !blocked.check(address);}
export async function checkUrl(value: string, timeout = 15000, method = "GET", options: {headers?: Record<string, string>; body?: string} = {}): Promise<{httpStatus: number; responseTime: number; body: string}> {
 const url = new URL(value);
 if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("Monitoring requires HTTPS on port 443 without URL credentials");
 const addresses = await lookup(url.hostname, {all: true, family: 4});
 if (!addresses.length || addresses.some(a => !isPublicIPv4(a.address))) throw new Error("Destination blocked by outbound policy");
 const address = addresses[0]!.address;
 const start = performance.now();
 return new Promise((resolve, reject) => {
  const timer = setTimeout(() => req.destroy(new Error("Request timed out")), timeout);
  const req = https.request(url, {method, lookup: (_host, _options, cb) => cb(null, address, 4), headers: {"User-Agent": "CentralOps/1.0", ...options.headers}}, res => {
   let size = 0; const chunks: Buffer[] = [];
   res.on("data", (chunk: Buffer) => {size += chunk.length; if (size <= 1048576) chunks.push(chunk); if (size > 1048576) req.destroy(new Error("Response exceeds 1 MiB"));});
   res.on("error", reject);
   res.on("end", () => {clearTimeout(timer); resolve({body: Buffer.concat(chunks).toString("utf8"), httpStatus: res.statusCode ?? 0, responseTime: Math.round(performance.now()-start)});});
  });
  req.on("error", error => {clearTimeout(timer); reject(error);}); req.end(options.body);
 });
}
