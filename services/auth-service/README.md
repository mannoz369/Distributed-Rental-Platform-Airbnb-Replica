# Auth Service

Standalone gRPC service for user credentials, JWT issuing, refresh-token rotation, token validation, and user lookup.

## Run Locally

From the repository root:

```powershell
npm run auth-service
```

Defaults:

- gRPC address: `0.0.0.0:50051`
- Database URL: `AUTH_DB_URL`, falling back to `ATLASDB_URL`
- JWT secret: `JWT_SECRET`, falling back to `SCRETE`

## Implemented RPCs

- `Signup`
- `Login`
- `RefreshToken`
- `RevokeRefreshToken`
- `ValidateToken`
- `GetUser`

The Gateway calls this service through `src/domains/auth/auth.grpc-client.js`.
