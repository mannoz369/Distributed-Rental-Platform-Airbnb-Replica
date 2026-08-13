# Booking Service

Standalone gRPC service for booking creation, availability checks, booking history, cancellation, owner booking views, and booked-date lookup.

## Run Locally

From the repository root:

```powershell
npm run booking-service
```

Defaults:

- gRPC address: `0.0.0.0:50053`
- Database URL: `BOOKING_DB_URL`, falling back to `ATLASDB_URL`
- Listing Service target: `LISTING_SERVICE_URL`, defaulting to `localhost:50052`

## Implemented RPCs

- `CreateBooking`
- `CancelBooking`
- `GetBooking`
- `GetGuestBookings`
- `GetOwnerBookings`
- `GetBookedDates`
- `CheckAvailability`
- `MarkOwnerSeen`

Booking Service calls Listing Service through `GetListingForBooking` during booking creation. It does not read the Listing database directly.

`MarkOwnerSeen` preserves the current owner notification behavior until Notification Service owns notification records.
