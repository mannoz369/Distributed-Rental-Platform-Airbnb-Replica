# Logging Context

Every future service should log with the same high-level fields:

- `requestId`
- `service`
- `rpc`
- `userId`
- `resourceId`
- `status`
- `durationMs`

The current monolith does not have structured logging yet. These fields are documented now so the extracted services can add logging without changing the protobuf contracts.
