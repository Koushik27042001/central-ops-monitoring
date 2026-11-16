# Contributing

Install Node.js 22.12 or newer and run `npm ci`. Configure your own Firebase project and MongoDB database using [README.md](README.md). Never commit environment files, service accounts, database dumps, or production data.

Keep changes focused. Before submitting a pull request, run `npm run typecheck`, `npm test`, and `npm run build`. MongoDB-backed tests use isolated temporary databases; they do not connect to the application database. A cached MongoDB executable or permission to download one is required.

For changes to API access, add tests with two different workspace owners. Include reads, updates, related record identifiers, history, aggregation, and background processing where affected. Workspace ownership comes from the authenticated account, never request input. Use `workspaceModel` in management routes and propagate `ownerId` when creating worker records.

Report security issues privately to the installation operator rather than posting credentials or exploitable production details in public issues. Operators should publish their own security contact before public launch.
