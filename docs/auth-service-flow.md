# Auth Service Extraction Flow

Phase 4 extracts identity, credentials, token issuing, refresh-token rotation, token validation, and user lookup into `services/auth-service`.

## Processes

Gateway / existing Express app:

- Run with `npm start`.
- Keeps EJS rendering, flash messages, redirects, auth cookies, and route protection.
- Calls Auth Service over gRPC through `src/domains/auth/auth.grpc-client.js`.

Auth Service:

- Run with `npm run auth-service`.
- Implements `packages/proto/auth.proto`.
- Owns user credentials, refresh-token hashes, token issuing, token validation, and user lookup.

Defaults:

- Gateway target: `AUTH_SERVICE_URL=localhost:50051`.
- Auth Service host: `AUTH_SERVICE_HOST=0.0.0.0`.
- Auth Service port: `AUTH_SERVICE_PORT=50051`.
- Auth database: `AUTH_DB_URL`, falling back to `ATLASDB_URL`.
- JWT secret: `JWT_SECRET`, falling back to `SCRETE` for migration compatibility.

## Signup Flow

1. Browser submits `POST /signup`.
2. `src/domains/auth/auth.routes.js` calls `auth.controller.signup`.
3. `auth.controller.signup` reads `username`, `email`, and `password`.
4. Gateway adapter `src/domains/auth/auth.service.js` calls `auth.grpc-client.signup`.
5. `auth.grpc-client.signup` calls `AuthService.Signup`.
6. `services/auth-service/src/grpc.js` receives `SignupRequest`.
7. `services/auth-service/src/auth.service.js` hashes the password and creates the user.
8. Auth Service issues access and refresh tokens.
9. gRPC returns `AuthResponse`.
10. Gateway sets HTTP-only cookies through `src/domains/auth/token.service.js`.
11. Browser redirects to `/listings`.

## Login Flow

1. Browser submits `POST /login`.
2. `auth.controller.login` calls Gateway adapter `loginUser`.
3. Gateway adapter calls `AuthService.Login`.
4. Auth Service finds the user by username.
5. Auth Service verifies the password hash.
6. If the account still has legacy Passport fields, Auth Service verifies and migrates them to `passwordHash` and `passwordSalt`.
7. Auth Service issues and stores a hashed refresh token.
8. Gateway receives `AuthResponse`, sets cookies, and redirects to the safe internal redirect URL.

## Refresh Flow

1. Browser or Gateway calls `POST /auth/refresh`, or auth middleware sees a missing/expired access token with a refresh cookie.
2. Gateway adapter calls `AuthService.RefreshToken`.
3. Auth Service verifies the refresh JWT.
4. Auth Service checks that the refresh-token hash is stored and unexpired.
5. Auth Service removes the old refresh token, issues a new token pair, and stores the new refresh-token hash.
6. Gateway sets new HTTP-only cookies.

## Logout Flow

1. Browser requests `GET /logout`.
2. `auth.controller.logout` calls Gateway adapter `removeRefreshToken`.
3. Gateway adapter calls `AuthService.RevokeRefreshToken`.
4. Auth Service removes the matching refresh-token hash.
5. Gateway clears local auth cookies and redirects to `/listings`.

The Gateway clears cookies even if Auth Service is unavailable, so the browser still logs out locally.

## Authenticated Request Flow

1. Express receives a request.
2. `auth.middleware.parseCookies` populates `req.cookies`.
3. `auth.middleware.attachUserFromToken` verifies the access token locally using the shared JWT secret.
4. If valid, the Gateway attaches token-derived context to `req.user`.
5. If missing or expired, the middleware calls `AuthService.RefreshToken` through the Gateway adapter when a refresh cookie exists.
6. `shared/middleware.isLoggedin` checks `req.user`.

Gateway-local access-token verification keeps normal page requests fast. Refresh-token validation and rotation stay owned by Auth Service.

## Boundary

Auth Service owns:

- Password hashes.
- Legacy Passport credential migration.
- Refresh-token hashes.
- Token issuing.
- Refresh-token rotation and revocation.
- User lookup.

Gateway owns:

- HTTP-only cookie setting and clearing.
- EJS redirects and flash messages.
- Request user context derived from validated JWTs.
- Calling Auth Service over gRPC.

The Gateway still registers a lightweight `User` Mongoose model so current listing/review pages using `populate("owner")` and `populate("author")` can render. Auth workflows no longer use that local model directly.
