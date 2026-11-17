# Contributing

Install Node.js 22.12 or newer and run `npm ci`. Configure your own Firebase project and MongoDB database using [README.md](README.md). Never commit environment files, service accounts, database dumps, or production data.

Contributor templates are tracked as `.example.env` in the root, `client`, `server`, and `worker` directories. They contain key names with empty values only. The existing `.env.example` filenames are retained with the same contents for compatibility. Real `.env` files remain ignored.

Copy `server/.example.env` to `server/.env` and `client/.example.env` to `client/.env`. Fill in your own settings before starting the app. Remove unused optional lines instead of leaving them blank: empty values can override application defaults and fail validation. The API and worker both load `server/.env`; `worker/.example.env` is a reference for separately injected worker settings. The root template is a configuration reference, including hosting and diagnostic keys; it is not automatically loaded by the API.

For local development, set `NODE_ENV` to `development`, `API_PORT` to `4000`, `CLIENT_ORIGIN` to `http://localhost:5173`, and `MONGODB_URI` to your database connection string. Use `AUTH_PROVIDER=firebase` with your Firebase Admin credentials and matching public `VITE_FIREBASE_*` settings in the client, or select `local` in both auth-provider settings and configure the `ADMIN_*` keys for the seed command. Firebase private keys and database credentials belong only in server settings. Use the same private 64-character hexadecimal `INTEGRATION_ENCRYPTION_KEY` for the API and worker.

Client settings beginning with `VITE_` are public browser configuration. `VITE_API_BASE_URL` is the API path, `VITE_API_PROXY_TARGET` is the local backend address, and `VITE_DEV_PORT` is the frontend port. For Vercel hosting, configure `RENDER_API_ORIGIN` as the backend HTTPS origin. Render supplies `PORT` automatically. `CHECK_DNS_SERVER` optionally selects the DNS server used by the configuration diagnostic script. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for production setup.

Keep changes focused. Before submitting a pull request, run `npm run typecheck`, `npm test`, and `npm run build`. MongoDB-backed tests use isolated temporary databases; they do not connect to the application database. A cached MongoDB executable or permission to download one is required.

For changes to API access, add tests with two different workspace owners. Include reads, updates, related record identifiers, history, aggregation, and background processing where affected. Workspace ownership comes from the authenticated account, never request input. Use `workspaceModel` in management routes and propagate `ownerId` when creating worker records.

Report security issues privately to the installation operator rather than posting credentials or exploitable production details in public issues. Operators should publish their own security contact before public launch.
