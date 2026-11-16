// Vercel project root must be the repository root, not client/ or server/.
// This variable contains a public backend origin, never database credentials.
const value = process.env.RENDER_API_ORIGIN;
let api;
try {
  api = new URL(value);
  if (api.protocol !== "https:" || api.username || api.password || api.search || api.hash || api.pathname !== "/") throw new Error();
} catch {
  throw new Error("Set RENDER_API_ORIGIN in Vercel to the API's HTTPS origin, e.g. https://your-api.onrender.com (without /api/v1).");
}
export const config = {
  framework: null,
  installCommand: "npm ci --include=dev",
  buildCommand: "npm run build:frontend",
  outputDirectory: "client/dist",
  rewrites: [
    {source: "/api/:path*", destination: `${api.origin}/api/:path*`},
    {source: "/((?!api(?:/|$)).*)", destination: "/index.html"},
  ],
  headers: [
    {source:"/api/:path*",headers:[{key:"Cache-Control",value:"private, no-store"}]},
    {source:"/:path*",headers:[{key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},{key:"X-Frame-Options",value:"DENY"}]},
  ],
};
