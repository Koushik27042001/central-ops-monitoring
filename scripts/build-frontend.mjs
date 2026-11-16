import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
// Keep browser API requests on the Vercel origin so secure session cookies are first-party.
const result = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "-b", "client/tsconfig.json"], {cwd:root,stdio:"inherit"});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
const vite = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)), "build"], {cwd:fileURLToPath(new URL("../client/", import.meta.url)),stdio:"inherit",env:{...process.env,VITE_API_BASE_URL:"/api/v1"}});
if (vite.error) throw vite.error;
process.exit(vite.status || (vite.error ? 1 : 0));
