# Integration guide

Basic availability monitoring needs no client SDK. Register public HTTPS frontend/backend, health and readiness URLs. Health reports process liveness; readiness should return a failure status when dependencies are unavailable. Individual GET/HEAD endpoints can add nested JSON assertions, for example `[{"path":"database.ready","value":true}]`.

## Authorized CMS integration

The optional `packages/client-sdk` exports `createIntegrationRouter`. Mount it at `/api/integrations` after Express JSON parsing with a 100 KiB limit. Provide a unique token of at least 32 characters, a readiness callback, and a persistent `upsertBlog(blog, idempotencyKey)` adapter. The adapter must store idempotency keys together with its writes, enforce its own synchronization policy, and only modify content owned by this integration. Basic monitoring does not need this SDK or token.

See `examples/client-integration.mjs` for a runnable MongoDB example. It writes a separate ExampleIntegrationBlog collection and never touches existing website collections.

```powershell
# Set MONGODB_URI and a unique CLIENT_INTEGRATION_TOKEN in your shell first.
node --env-file=.env examples/client-integration.mjs
```

Use a public HTTPS staging deployment to test CentralOps outbound checks. The worker intentionally blocks localhost/private network URLs. The SDK offers authenticated `GET /health` and `POST /blogs`. It accepts only explicit blog fields and requires an Idempotency-Key header. It never executes arbitrary commands or exposes database access.

On the CentralOps API and worker, set the same 64-hex-character INTEGRATION_ENCRYPTION_KEY. In Integrations select the target website, enter its base URL ending in `/api/integrations`, and enter the client's configured token. The token is transmitted over the authenticated management request, encrypted at rest with AES-256-GCM and never returned by management reads. Use HTTPS for both sites. Test the connection before publishing.

To rotate a token, update the client configuration and replace the credential in CentralOps by editing the integration. There is no automatic deployment of credentials to client websites. The rotation record is an audit record; token validity is enforced by the client.

## Publishing

Save a blog, then select Publish. Confirm the target and optionally schedule in your local time. The server stores an immutable snapshot and a unique publishing key. The separate worker sends that snapshot using MongoDB-backed job leases, retries up to five times with exponential backoff, and records completion/failure. Repeating the same request for an unchanged saved version reuses its publishing job. Publishing an edited version creates a new job.

On the Blogs screen, use **Publishing / revisions** to see integration configuration, the last successful connection test, delivery jobs, and previous saved content. Open **Configure website integration** to connect the registered client website. Editing published content marks the saved version as DRAFT while retaining its last publication time; **Push update** delivers the new saved version with the same external post identifier. Archived posts cannot be published until restored to a draft. These operations require a working client-side adapter and the publishing worker; registering a website alone does not grant access to its CMS.

The frontend exposes publishing history. Revision history is available through `GET /blogs/:id/revisions`. Updates to integration-owned posts are permitted by the sample adapter. Remote deletion, uploads, bidirectional synchronization and manual-edit conflict resolution are outside the current integration contract. A downstream website must render content as text or sanitize it before rendering HTML.
