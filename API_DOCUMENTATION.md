# REST API

Base: /api/v1. Success responses use {data}; lists also include pagination {page,limit,total}. Failures use {error:{code,message}}. Validation errors include details. Health responses preserve their direct status format.

Public: GET /health, /health/live, /health/ready; GET /auth/config returns the selected provider and publicRegistration flag. POST /auth/login accepts email/password only in local auth mode. Public Firebase signup/sign-in runs through the Firebase client SDK; After a fresh Firebase sign-in, POST /auth/session with {idToken} and an allowed Origin. This exchanges the ID token for a signed, HttpOnly centralops_firebase session cookie. Protected requests use that cookie, not Bearer ID tokens. Session lifetime is AUTH_SESSION_DAYS (default 2), without sliding renewal.
Authenticated: GET /auth/me; POST /auth/logout.

`GET /auth/session` checks the current browser session. Without a cookie it returns `200 {data:null}`, so loading the login page does not create an expected 401 console entry. With a cookie it performs normal signature, expiry, revocation, account and workspace checks. Invalid or expired cookies still return 401; protected data routes continue to require authentication.

Clients, websites, tickets, blogs support GET /resource, POST /resource, GET /resource/:id, PATCH /resource/:id, DELETE /resource/:id. DELETE archives records (websites pause monitoring). Do not delete tickets; use PATCH status RESOLVED. Blogs support DRAFT and ARCHIVED only; no remote publishing endpoint is implemented.

Lists accept page (default 1), limit (max 100), search, clientId, websiteId. Fields are defined by server/src/validators/index.ts. Identifiers must be MongoDB ObjectIds. Websites require a valid client. Tickets and blogs must reference a matching client and website.

POST /websites/:id/check-now marks enabled targets due, returning 202. GET /monitoring/:websiteId/history returns the last 100 checks. GET /analytics/overview returns website/client/active incident counts, 24-hour sample uptime and average response time; no samples produce null metrics.

GET /incidents, /notifications, /audit-logs return the latest 100 records. These are read-only currently. All mutations require Origin matching CLIENT_ORIGIN, including requests made with scripts. Login is limited to 10 requests per 15 minutes per IP; all routes have a global rate limit.

## Added management routes

All paths below use `/api/v1` and require a verified Firebase session JWT cookie (or the local session cookie in local mode). Mutations require the exact configured Origin header.

- `GET/POST /api-endpoints`, `GET/PATCH/DELETE /api-endpoints/:id`: API configuration. DELETE pauses it. Fields: websiteId, name, url, method (GET/HEAD), expectedStatus, responseAssertions (array of {path,value?}), timeoutMs, intervalSeconds, isActive.
- `POST /api-endpoints/:id/check-now`: schedule an enabled target, return 202.
- `POST /api-endpoints/:id/test`: immediately test the saved GET/HEAD configuration without a worker. Returns the measured UP/DOWN result, HTTP code, elapsed response time, assertion failures, and a response preview capped at 8,192 characters. Results are stored in private history for 30 days; failures to reach the destination are returned as measured DOWN results, not successful HTTP probes. If configuration changes during the request, the response sets `configurationChanged: true` and does not store that result. Manual tests can run while scheduled monitoring is paused and are limited to 40 per minute per workspace.
- `GET /api-endpoints/:id/history`: latest 100 measured results for this endpoint in the current workspace.
- `GET/POST /maintenance`, `GET/PATCH /maintenance/:id`: maintenance records.
- `GET /monitoring/overview`, `GET /monitoring/:websiteId/history`, `GET /monitoring/:websiteId/uptime?days=1`.
- `GET /analytics/performance?days=7`: daily average latency, count and uptime; days 130.
- `PATCH /incidents/:id`: status OPEN/RESOLVED and optional resolutionNotes.
- `PATCH /notifications/:id`: `{ "status": "READ" }`.
- `POST /tickets/:id/comments`: `{ "body": "Comment" }`.
- `GET /integrations`, `GET /integrations/:websiteId/status`.
- `POST /integrations/:websiteId/credentials`: endpointBaseUrl and token (32512 characters). Creates or replaces encrypted credentials; plaintext is never returned.
- `POST /integrations/:websiteId/test`: authenticated readiness test.
- `POST /blogs/:id/publish`: optional scheduledAt ISO datetime, return 202 with publishing job. Requires active blogs:write integration.
- `GET /blogs/:id/publishing-history`, `GET /blogs/:id/revisions`.

Editable collection lists accept page (default 1), limit (default 20, max 100), search, and applicable websiteId/clientId/status filters. Incident, notification, audit and integration feeds currently return the most recent 100 records. Uptime is the percentage of successful recorded samples, not a claim of continuous observation.

## Browser health report

The API monitoring dashboard supports immediate tests of individual endpoints or the current page (up to 20, with three requests in flight), website filtering, health counts for that page, and history with response inspection. Register URLs explicitly; this does not discover routes or perform a complete application test suite. Scheduled API checks also retain bounded response previews. Only authorized workspace members can inspect these responses.

API endpoint lists and detail responses include `status` and `lastCheck` (status, HTTP status, response time, error message, and check time). `isActive` only enables scheduling; it does not mean the endpoint is healthy. Status is `UNKNOWN` until the current configuration has been checked, `UP` when the expected HTTP status and assertions pass, `DOWN` on a mismatch or request failure, and `PAUSED` when the endpoint or parent website is paused. A result older than three configured intervals plus its timeout becomes `STALE`. The monitoring screen refreshes every ten seconds. Checks require the background worker; Check now queues work and does not itself report success.

Monitor the full endpoint URL, for example `https://your-service.onrender.com/api/ai`. A successful `/health` response does not prove another route works. Monitoring supports GET and HEAD; for APIs that only accept POST or require credentials, provide an authorized read-only health endpoint. An unexpected 401, 404, 405, or 500 is reported as DOWN with its HTTP status.

Open GET /api/health on the backend origin, or GET /api/v1/health/status. Both return formatted JSON without authentication or credentials. HTTP 200 means the API is responding and the MongoDB driver reports connected; HTTP 503 means MongoDB is disconnected or not configured. A separate feature map describes database-dependent capabilities. Scheduled monitoring and publishing remain NOT_VERIFIED unless their dependency is unavailable; this report does not probe the worker or external websites. It does not execute login, create records, or run a live database ping. The statusCodeReference explains API/proxy response codes and is not a list of simultaneous live results.

Existing GET /api/v1/health and /api/v1/health/live remain liveness endpoints; GET /api/v1/health/ready remains the deployment readiness endpoint. API health reports use Cache-Control: private, no-store. A completely stopped backend cannot serve any health response.

## Private workspaces

`GET /auth/limits` returns the authenticated installation's configured `websites`, `apiEndpoints`, `recordsPerResource`, and `pendingPublishingJobs` limits. Rejected creates return `409 WORKSPACE_LIMIT`. Counts are scoped to the requesting account. Stored resource counts include archived records; completed/failed publishing jobs do not occupy pending queue capacity. Retrying an identical publishing request returns its existing job even when the queue is full.

Every management record is scoped to the authenticated account. Clients cannot set ownerId. References to another account?s client or website are rejected, foreign records are hidden, and history/analytics never aggregate across owners. PUBLIC_REGISTRATION=true grants verified Firebase users a new private workspace; false requires FIREBASE_ADMIN_EMAILS membership. Existing inactive users are blocked. Workspace admission limits return 409 WORKSPACE_LIMIT. No API route grants platform-wide administrator data access.
