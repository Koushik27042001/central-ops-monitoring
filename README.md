# OrbitOps

One Platform. Every Website. Total Control.

React and TypeScript operations workspace with an Express API, MongoDB storage, and an independent MongoDB-backed monitoring/publishing worker.

## Public freelancer workspaces

OrbitOps provides a separate private workspace for every freelancer. Users can create an email/password account, verify their email, or sign in with Google, then manage their own clients, websites, APIs, incidents, tickets, drafts, integrations and analytics. There are no shared teams or invitations in this version.

Login sessions use signed Firebase JWT cookies and expire after 48 hours (AUTH_SESSION_DAYS=2). Users sign in again after expiry; normal activity does not extend this deadline.

New accounts receive a guided feature tour on first sign-in. Next and Back navigate through the workspace, while Skip ends the tour. Completion and skip status are saved per account. Use Quick tour in the workspace header to replay it; existing accounts are not automatically enrolled.

1. Install Node.js 22.12 or newer and run `npm ci`.
2. Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`. Use your own MongoDB and Firebase projects; no project credentials are bundled.
3. Set `AUTH_PROVIDER=firebase`, `PUBLIC_REGISTRATION=true`, your MongoDB URI, and a random 32-byte hexadecimal `INTEGRATION_ENCRYPTION_KEY` in `server/.env`. Configure the Firebase Admin service-account fields there.
4. Set the public Firebase web app fields and `VITE_AUTH_PROVIDER=firebase` in `client/.env`. Enable Email/Password and Google in Firebase Authentication and authorize your frontend domain. See [FIREBASE_SETUP.md](FIREBASE_SETUP.md).
5. Run `npm run check:config`, then `npm run dev:local`. Register on the login page. Verify email accounts before signing in. Each new account starts with an empty private workspace.
6. For deployment, set `NODE_ENV=production`, the exact HTTPS `CLIENT_ORIGIN`, MongoDB Atlas network access for the API/worker hosts, and the environment variables on your host. Run `npm run build` and operate the API and worker as separate services. Keep the Firebase service-account key and database credentials server-side.

Existing unowned data is deliberately hidden. After backing up the database and signing into the intended owner's account, inspect `npm run migrate:workspace --workspace=@centralops/server -- owner@example.com`. Only if every listed unassigned record belongs to that owner, repeat with `--apply`. This script assigns all unassigned legacy records to that one owner; use a custom migration for previously shared datasets. It never reassigns already owned records.

Public limits default to 25 websites, 100 API endpoints, 1,000 records per other resource, and 25 pending publishing jobs per workspace. Configure `WORKSPACE_MAX_WEBSITES`, `WORKSPACE_MAX_ENDPOINTS`, `WORKSPACE_MAX_RECORDS`, and `WORKSPACE_MAX_PENDING_JOBS` to suit your hosting budget. Registration creates a Firebase account; the API grants a workspace only after email verification and according to `PUBLIC_REGISTRATION`.

The code is MIT licensed; see [LICENSE](LICENSE) and [CONTRIBUTING.md](CONTRIBUTING.md). This change does not publish a repository or deploy a public service. Use your own credentials and review included branding/assets before distributing your installation.

## Run the local workspace

Terminal messages use aligned status columns and plain-language instructions. Set `LOG_FORMAT=json` in the backend hosting environment for structured logs, or `LOG_HTTP_REQUESTS=true` to log individual requests. The default `LOG_FORMAT=text` and `LOG_HTTP_REQUESTS=false` keep everyday output readable. Run `npm run check:config` for a settings checklist; add `-- --details` when technical database error codes are needed.

```powershell
cd C:\central-ops-monitoring
npm.cmd ci
npm.cmd run dev:local
```

Open **http://localhost:5173** and sign in or create your freelancer account. Keep the terminal running. The launcher uses MongoDB configured in server/.env (or starts persistent local MongoDB when the local URI is selected), builds the backend, and starts the API/frontend and the MongoDB background worker. The MongoDB executable is downloaded only on the first run and cached in `.local-tools/mongodb`.

Startup does not insert sample business data, simulated monitoring history or example customers. Empty pages show their normal empty states until you add your own records. The existing local database name is retained so your administrator login and saved records remain accessible.

API and worker settings live in `server/.env`; client public settings live in `client/.env`. Root `.env` and `worker/.env` are not loaded by those services. Browser configuration uses public VITE_ values only. Local requests use `/api/v1` through Vite's proxy to port 4000. Restart processes after editing environment files.

The launcher starts the MongoDB worker. To start it separately when needed:

```powershell
npm.cmd run dev:worker
```

## Private installation with local authentication

For a private installation using local passwords, set `AUTH_PROVIDER=local`, `PUBLIC_REGISTRATION=false`, and `VITE_AUTH_PROVIDER=local`. Create the administrator once:

```powershell
$env:ADMIN_EMAIL = 'admin@example.com'
$env:ADMIN_NAME = 'Administrator'
$credential = Get-Credential -UserName $env:ADMIN_EMAIL -Message 'Choose a unique password of at least 14 characters'
$env:ADMIN_PASSWORD = $credential.GetNetworkCredential().Password
npm.cmd run seed --workspace=@centralops/server
Remove-Item Env:ADMIN_PASSWORD
```

Public email/password and Google registration use Firebase instead; see the public setup above. Do not recreate or reset accounts when restarting.

## External MongoDB

Use MongoDB Atlas or start the services from Docker Desktop:

```powershell
docker compose up -d
npm.cmd run build
npm.cmd run dev
```

Do not run the local database launcher and Docker MongoDB on the same port simultaneously. Set MONGODB_URI and CLIENT_ORIGIN appropriately. API readiness verifies MongoDB; background monitoring and publishing require a running worker.

## Workflows

- Dashboard metrics and response-time charts from MongoDB.
- Protected administrator sessions, client/website management and audit logs.
- GET/HEAD API monitoring with HTTP status and JSON response assertions.
- Monitoring history, failure-threshold incidents, recovery detection and in-app notifications.
- Blog drafts, revisions, authorized integrations, scheduled publishing and publishing history.
- Support tickets, comments and maintenance records.

Basic monitoring permits public IPv4 HTTPS destinations on port 443, blocks unsafe destinations and redirects, and retains monitoring samples for 30 days. Check-now requests schedule work for the worker. Adding an admin login URL does not grant CMS permissions.

For CMS integrations, configure identical INTEGRATION_ENCRYPTION_KEY values on API and worker. Generate a private key with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Verification

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
node scripts/verify-local.mjs
```

The last command requires running services and the administrator credentials configured in server/.env. It verifies login, authenticated dashboard reads, logout and session invalidation without printing credentials.

Development accepts localhost, 127.0.0.1 and [::1] origins on the configured frontend scheme and port. Production accepts only CLIENT_ORIGIN. CORS and mutation origin checks use the same policy.

Remaining scope includes email/Telegram delivery, SSL/domain-expiry checks, authenticated API configurations and POST monitoring bodies, rich text/media uploads, ticket attachments, additional analytics filters, full browser tests and concurrency hardening. Remote publishing, queue restart behavior and hosting deployment still require verification. Monitoring delivery is at least once, so duplicate samples after failures remain possible.

See ARCHITECTURE.md, API_DOCUMENTATION.md, INTEGRATION_GUIDE.md, DEPLOYMENT_GUIDE.md and SECURITY.md.

## Vercel frontend and Render backend

Follow [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). Import the repository root in Vercel, set RENDER_API_ORIGIN to the Render API origin, and use the root vercel.json configuration. The Render Blueprint deploys the API and a separate background worker. No hosting deployment has been performed from this workspace.
