Database configuration
======================

The API and worker load server/.env in development and compiled builds. Deployment environment variables take precedence. Root and worker .env files are not used by these services. Do not put database credentials in client environment variables.

MONGODB_URI selects the database explicitly (centralops for the configured Atlas connection). SRV connections enforce TLS and certificate verification. INTEGRATION_ENCRYPTION_KEY is a private 32-byte hex key used for AES-256-GCM integration credentials. Preserve this key: replacing it makes existing integration credentials unreadable. Passwords use salted scrypt; session tokens are stored as hashes.

.env files are plaintext secrets, not encrypted storage, and are excluded by .gitignore. Restrict filesystem access and use a deployment secret manager for production. Atlas supplies storage encryption; application configuration cannot enable or verify account-level Atlas settings. Restrict Atlas network access to application egress addresses and the database user's permissions to this database. Rotate credentials exposed in chat.

Run npm run dev:api to start the API, or npm run dev:local for API and frontend with the configured database. The worker additionally needs REDIS_URL in its process environment or server/.env and a running Redis service. Build the server before running the compiled worker.

Existing local database records are not automatically migrated to Atlas. Use an intentional export/import if needed. To create a fresh administrator, set ADMIN_EMAIL and a unique ADMIN_PASSWORD (14?256 characters) in server/.env and run npm run seed --workspace=@centralops/server. The seed command refuses to replace an existing account. Remove ADMIN_PASSWORD after seeding.

Atlas IP access setup
---------------------

MONGODB_ATLAS_ALLOWED_IP in server/.env records the observed backend outbound IP as a /32 CIDR for reference. It is not a driver setting and does not configure Atlas or assign a static IP. In Atlas, open Security > Network Access > Add IP Address, enter that CIDR, and confirm. Keep the SRV hostname in MONGODB_URI for TLS verification and cluster discovery. If your ISP, VPN, router, or deployment changes the outbound IP, update the Atlas allowlist and the reference value. A permanent address requires static outbound networking from your ISP or hosting provider.
