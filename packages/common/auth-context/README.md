# Auth Context Metadata

Internal gRPC calls should carry authenticated request context through metadata. These values come from the Gateway after it validates the external JWT.

Required metadata:

- `x-request-id`: Correlates logs across Gateway and services.
- `x-user-id`: Authenticated user id from the JWT `sub` claim.
- `x-user-email`: Authenticated user email from the JWT.
- `x-user-role`: Authenticated user role.
- `authorization`: Original bearer token when downstream services need token validation or audit evidence.

Rules:

- Gateway is responsible for validating external credentials first.
- Services may trust metadata only from the private network or trusted Gateway.
- Services that enforce ownership should use `x-user-id`, not a user id supplied only in the request body.
- Request ids should be generated once at the edge and forwarded unchanged.
