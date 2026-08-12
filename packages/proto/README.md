# Wanderlust gRPC Contracts

These `.proto` files define the service boundaries for the microservices migration.

Rules:

- IDs are strings, even when the current monolith stores MongoDB ObjectIds.
- Timestamps are ISO-8601 strings for now to keep contracts simple across runtimes.
- Contracts expose domain DTOs, not Mongoose document structures.
- Requester identity should come from gRPC metadata, not only request bodies.
- Request bodies may include explicit ids when useful for service-local checks or Gateway compatibility.

Services:

- `auth.proto`: identity, token lifecycle, and refresh-token revocation.
- `listing.proto`: listing CRUD/search, booking-safe listing lookup, and temporary review-reference compatibility RPCs.
- `booking.proto`: booking lifecycle, availability, booked dates, and owner seen state.
- `review.proto`: review lifecycle, listing review reads, author checks, and summary.
- `notification.proto`: notification reads and seen state.
