# gRPC Error Conventions

Use gRPC status codes consistently so the Gateway can translate service failures into stable HTTP responses and EJS flash messages.

- `INVALID_ARGUMENT`: Request fields are missing or invalid.
- `UNAUTHENTICATED`: Missing or invalid authentication context.
- `PERMISSION_DENIED`: Authenticated user cannot perform the action.
- `NOT_FOUND`: Requested resource does not exist.
- `ALREADY_EXISTS`: Signup username or other unique resource conflict.
- `FAILED_PRECONDITION`: Business rule failure, such as booking your own listing.
- `ABORTED`: Booking availability conflict or concurrent write conflict.
- `INTERNAL`: Unexpected server error.

Contracts should return domain data on success and rely on gRPC status details on failure. Do not add MongoDB errors or raw stack traces to protobuf messages.
