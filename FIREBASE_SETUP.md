# Firebase authentication

1. Create a Firebase project and register a Web app in Project settings. Copy its configuration into `client/.env`: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`.
2. Enable **Authentication → Sign-in method → Email/Password**. Add your frontend domain under Authentication settings → Authorized domains (include localhost for local development).
   Enable the **Google** provider too, choose a project support email, and save. Both **Sign in with Google** and **Sign up with Google** use the Google account picker; Firebase creates the account on its first use. With public registration enabled, any verified Google account can open its own workspace; inactive local accounts remain blocked. No additional Google secret is needed in the frontend environment.
3. With `PUBLIC_REGISTRATION=true`, freelancers can create accounts directly on the login panel. Email accounts receive a verification link; verify before signing in. Google accounts use the Google provider. Each approved identity receives its own private workspace.
4. In Project settings → Service accounts, generate a private key. In `server/.env`, set `FIREBASE_PROJECT_ID` to `project_id`, `FIREBASE_CLIENT_EMAIL` to `client_email`, and `FIREBASE_PRIVATE_KEY` to `private_key`. Keep the key in double quotes with literal `\n` escapes. Never put the service account or private key in the frontend.
5. Set `PUBLIC_REGISTRATION=true` for public freelancer workspaces. To restrict the installation instead, set it to `false` and configure `FIREBASE_ADMIN_EMAILS`. MongoDB account records are created automatically for verified users permitted by this setting; inactive accounts stay blocked. MongoDB is still required for application data.
6. Both environment files already select Firebase. Restart the API and frontend after filling them in. For hosting, set the same variables in the frontend/backend hosting environments and rebuild the frontend.

After a fresh email/password or Google sign-in, the browser sends its Firebase ID token to /auth/session. The API creates a signed Firebase session JWT stored in an HttpOnly cookie for AUTH_SESSION_DAYS=2 (48 hours). The API checks the session signature, expiry, and revocation on every protected request. Firebase ID token refresh does not extend the fixed application session; sign in again after expiry. Logout revokes refresh tokens for that Firebase user across devices. Local password login is disabled while `AUTH_PROVIDER=firebase`; seeded local passwords are not migrated to Firebase. Public registration is available when enabled by the operator. Account signup never grants access to another freelancer?s records.

Run `npm test` for the test suite. Its configuration selects local authentication for existing tests; Firebase-specific tests select Firebase and mock token verification without requiring credentials.

References: [Firebase password authentication](https://firebase.google.com/docs/auth/web/password-auth), [Admin token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

## Check the full configuration

Run `npm run check:config`. This checks Firebase field presence, project alignment, private-key parsing, encryption-key format, and a read-only MongoDB connection/ping. It does not print passwords or private keys and does not prove Firebase credentials are accepted remotely.

If startup reports `Atlas rejected the TLS handshake before authentication`, open MongoDB Atlas → Security → Network Access → Add IP Address → Add Current IP Address, confirm the entry, and wait until it is active. Use the public outbound IP of the API host when deployed. Confirm the cluster is running and the network/VPN/firewall permits MongoDB traffic. Keep TLS certificate verification enabled. This error occurs before database password validation; changing Firebase credentials will not resolve it.

After correcting Atlas access, rerun `npm run check:config`, then restart `npm run dev`. If TLS still fails, test from another network or with the VPN disconnected to distinguish a network-path problem from Atlas access restrictions.

Reference: [Atlas connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/).

Session cookies follow the [Firebase Admin session-cookie flow](https://firebase.google.com/docs/auth/admin/manage-cookies). No custom JWT secret is needed: Firebase signs and verifies the session JWT. Use the same-origin API proxy documented in DEPLOYMENT_GUIDE.md. Existing browser sessions must sign in again after this authentication update.
