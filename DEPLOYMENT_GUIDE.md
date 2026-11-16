# Deploy OrbitOps: Vercel frontend + Render API/worker

Redis is no longer required. MongoDB stores both application data and persistent background-job schedules. Keep local .env files for development; enter production values in the hosting dashboards. Deployment has not been performed.

## Render

Import the repository through New > Blueprint and select the root render.yaml. The Blueprint creates a Node web API and an independent Node background worker, both on paid Starter plans; review costs before applying it. Leave service Root Directory blank so npm workspaces resolve from the repository root.

Supply these API environment variables when prompted:

| Variable | Value |
| --- | --- |
| AUTH_PROVIDER | firebase |
| TRUST_PROXY_HOPS | 1 for the configured Render API; keep 0 for direct local development |
| PUBLIC_REGISTRATION | true for public freelancer signup |
| FIREBASE_PROJECT_ID | Your Firebase project ID |
| FIREBASE_CLIENT_EMAIL | Firebase Admin service account email |
| FIREBASE_PRIVATE_KEY | Firebase Admin private key, server only |
| CLIENT_ORIGIN | Your exact Vercel HTTPS origin, without a path or trailing slash |
| MONGODB_URI | Existing Atlas connection URL, including centralops as the database |
| INTEGRATION_ENCRYPTION_KEY | Your existing private 64-character hex key; preserve it |
| WORKSPACE_MAX_WEBSITES | 25 stored websites per workspace by default |
| WORKSPACE_MAX_ENDPOINTS | 100 API endpoints per workspace by default |
| WORKSPACE_MAX_RECORDS | 1000 records per other managed resource by default |
| WORKSPACE_MAX_PENDING_JOBS | 25 PENDING, RETRYING, or PROCESSING publishing jobs per workspace by default |

The worker references these settings from the API service. Render supplies PORT; the API binds to it on 0.0.0.0. The Blueprint sets NODE_ENV=production, Node 22, and TRUST_PROXY_HOPS=1 on the API. Production refuses missing database/encryption settings or a non-HTTPS frontend origin.

Manual service setup, with the repository root as the build root:

| Service | Build command | Start command |
| --- | --- | --- |
| Node Web Service | npm ci --include=dev && npm run build:api | npm run start --workspace=@centralops/server |
| Background Worker | npm ci --include=dev && npm run build:worker | npm run start --workspace=@centralops/worker |

Set the same MongoDB URI, encryption key, CLIENT_ORIGIN, and NODE_ENV=production on both services. Add TRUST_PROXY_HOPS=1 on the API. API health check: /api/v1/health/ready. The worker does not serve HTTP. Remove obsolete REDIS_URL/REDIS_* environment settings from existing hosted services; no Redis Cloud subscription is needed by OrbitOps.

In MongoDB Atlas > Network Access, allow the outbound addresses/ranges shown in Render's connection details for BOTH services. The IP recorded in local server/.env only describes the local computer, not Render servers. Do not replace the Atlas hostname with a fixed IP.

## Vercel

Import the same repository and choose the REPOSITORY ROOT, not client/ or server/, as Root Directory. The root vercel.json provides the framework, install, build, and output settings.

Add the following Vercel environment variable, then redeploy:

RENDER_API_ORIGIN=https://YOUR-ACTUAL-API.onrender.com

Use the Render web service origin, without /api/v1 or a dashboard path. The frontend build stops with a clear setup message if this value is missing or invalid. Enter the HTTPS origin without a trailing slash. The static routing configuration resolves RENDER_API_ORIGIN from the deployment environment. Vercel rewrites /api/* to Render before the SPA fallback, so browser requests remain on the frontend origin. The frontend build forces VITE_API_BASE_URL=/api/v1. Login cookies stay HttpOnly, Secure in production, SameSite=Strict, and scoped to /api/v1. API responses are private and not cached.

Add VITE_AUTH_PROVIDER=firebase and your public VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID to Vercel. Enable Email/Password and Google in Firebase Authentication and authorize the Vercel/custom domain. Do not add MongoDB credentials, integration encryption keys, or admin passwords to Vercel or VITE_ variables. CLIENT_ORIGIN must match the production Vercel URL; changing it or your custom domain requires updating Render. Keep previews isolated from production accounts and data.

## Verification

1. Render API /api/v1/health/ready: HTTP 200 with MongoDB connected.
2. Vercel homepage, /features, and /login load and survive refresh.
3. Vercel /api/v1/health/ready returns JSON and HTTP 200.
4. Register two verified freelancer accounts. Each account must see only its own clients/websites/analytics. Login survives refresh and logout invalidates authentication.
5. Demo enquiries save once and display backend failures honestly.
6. Start the worker and verify real monitoring results appear. API readiness does not prove worker execution.
7. Check hosting rate-limit behavior and forwarded addresses before scaling. Do not blindly raise TRUST_PROXY_HOPS: direct API traffic and proxied frontend traffic can have different hop counts.

No automatic seeding or account reset runs during deployment. Public Firebase users register through the login page and need no local seed. Private local-auth installs can seed an administrator. Legacy unowned records remain hidden until explicitly migrated with migrate:workspace; see README. Old local and Atlas records remain unchanged by this code change. Old Redis data is no longer consumed and is not deleted automatically. MongoDB publishing records in PENDING, RETRYING, or expired PROCESSING states are recoverable by the new worker.

See server/BACKGROUND_JOBS.md for leases, retries, and crash-recovery behavior. Use npm run test, npm run build:worker, and npm run build:frontend before deployment.

References: https://vercel.com/docs/project-configuration/vercel-ts and https://render.com/docs/blueprint-spec.
