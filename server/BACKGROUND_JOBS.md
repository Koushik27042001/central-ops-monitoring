# MongoDB background jobs

OrbitOps uses MongoDB for persistent monitoring schedules and publishing jobs. No Redis connection, BullMQ queue, or separate cache service is required. Sensitive API responses remain uncached; this change replaces Redis's queue role, not its protocol with an in-memory cache that would lose scheduled work on restart.

Run npm run dev for API, worker, and frontend, or npm run dev:local for the development launcher. Both the API and worker load server/.env (deployment environment variables take precedence). Keep MONGODB_URI and the existing INTEGRATION_ENCRYPTION_KEY consistent. The worker is a separate persistent Render background service.

The worker uses five monitoring lanes and two publishing lanes. Each lane atomically claims a due MongoDB record using a unique ownership token and a two-minute lease. It renews active leases every thirty seconds. Stopped workers leave leases that expire, allowing another worker to recover records. Database indexes cover enabled targets, due times, publishing status, and lease expiry.

Successful checks schedule their next configured interval. Infrastructure failures release the target for retry after five seconds. Check-now requests made during an active check are preserved. HTTP failures still produce DOWN results and use the regular monitoring interval.

Publishing attempts are recorded when claimed. Failures retry up to five attempts with exponential backoff beginning at five seconds. A crashed final attempt is marked FAILED after lease expiry. The existing idempotency key is reused on every attempt. Delivery is at least once: integrations must enforce that idempotency key, and monitoring results can be duplicated after crashes around writes. Single-record leases do not make multi-document result/incident writes transactional.

Shutdown stops new claims and lets active checks finish. If Render stops a process before its work finishes, its lease expires and can be recovered. Existing MongoDB schedules remain persistent. Previously queued Redis jobs are not imported; their MongoDB monitoring targets run when next due, and durable publishing records remain recoverable. Stop the old BullMQ worker before deploying this version to avoid running both implementations together.

The background-job tests use an isolated local MongoDB instance, never the configured Atlas database. They verify simultaneous claims, crash recovery, stale ownership, check-now requests, completed jobs, retry delays, and final-attempt exhaustion.
