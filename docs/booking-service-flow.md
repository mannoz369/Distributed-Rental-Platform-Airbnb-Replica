# Booking Service Extraction Flow

Phase 6 extracts booking creation, availability checks, booking history, cancellation, owner booking views, and booked-date lookup into `services/booking-service`.

## Processes

Gateway / existing Express app:

- Run with `npm start`.
- Keeps EJS rendering, flash messages, redirects, auth cookies, and form validation.
- Calls Booking Service over gRPC through `src/domains/bookings/booking.grpc-client.js`.

Booking Service:

- Run with `npm run booking-service`.
- Implements `packages/proto/booking.proto`.
- Owns booking persistence, overlap checks, backend totals, cancellation, owner seen state, and booked-date calculation.
- Calls Listing Service through gRPC when creating a booking.

Defaults:

- Gateway target: `BOOKING_SERVICE_URL=localhost:50053`.
- Booking Service host: `BOOKING_SERVICE_HOST=0.0.0.0`.
- Booking Service port: `BOOKING_SERVICE_PORT=50053`.
- Booking database: `BOOKING_DB_URL`, falling back to `ATLASDB_URL`.
- Listing Service target from Booking Service: `LISTING_SERVICE_URL=localhost:50052`.

## Create Booking Flow

1. Browser submits `POST /listings/:id/bookings`.
2. Gateway route runs JWT auth and Joi booking validation.
3. `src/domains/bookings/booking.controller.js` calls `booking.service.createBooking`.
4. Gateway adapter calls `BookingService.CreateBooking`.
5. `services/booking-service/src/grpc.js` receives `CreateBookingRequest`.
6. `services/booking-service/src/booking.service.js` calls `ListingService.GetListingForBooking`.
7. Booking Service rejects missing/inactive listings and owner self-booking.
8. Booking Service validates date range and checks confirmed booking overlap.
9. Booking Service calculates subtotal, GST, and total.
10. Booking Service stores booking owner/guest/listing snapshots.
11. gRPC returns `BookingResponse`.
12. Gateway redirects to `/bookings/:bookingId/confirmation`.

## Confirmation Flow

1. Browser requests `GET /bookings/:bookingId/confirmation`.
2. Gateway calls `BookingService.GetBooking` with requester id.
3. Booking Service returns the booking only if requester is guest or owner.
4. Gateway composes display data from:
   - Booking Service booking DTO.
   - Listing Service listing details.
   - Auth Service guest/owner display users.
5. Gateway renders `views/bookings/confirmation.ejs`.

## My Bookings Flow

1. Browser requests `GET /bookings/my`.
2. Gateway calls `BookingService.GetGuestBookings`.
3. Booking Service returns bookings owned by the guest.
4. Gateway hydrates listing display data from Listing Service.
5. Gateway renders `views/bookings/my-bookings.ejs`.

## Cancel Booking Flow

1. Browser opens `GET /bookings/:bookingId/cancel`.
2. Gateway calls `BookingService.GetBooking`.
3. Browser submits `PATCH /bookings/:bookingId/cancel`.
4. Gateway calls `BookingService.CancelBooking`.
5. Booking Service verifies requester is the guest.
6. Booking Service marks status `cancelled` and `ownerSeen = false`.
7. Gateway redirects to `/bookings/my`.

## Owner Booking Flow

1. Browser requests `GET /owner/bookings`.
2. Gateway calls `BookingService.GetOwnerBookings`.
3. Booking Service returns bookings for that owner.
4. Gateway renders `views/bookings/owner-notifications.ejs`.
5. Browser opens `GET /owner/bookings/:bookingId`.
6. Gateway calls `BookingService.GetBooking`.
7. Gateway calls `BookingService.MarkOwnerSeen`.
8. Gateway renders `views/bookings/owner-show.ejs`.

## Booked Dates Flow

1. Browser requests `GET /listings/:id`.
2. Listing Gateway adapter gets listing data from Listing Service.
3. Listing Gateway adapter calls `BookingService.GetBookedDates` through `booking.grpc-client.js`.
4. Booking Service returns confirmed booked dates.
5. Gateway renders the booking calendar with unavailable dates.

## Notification Count Flow

1. Every Gateway request reaches the app locals middleware in `src/app.js`.
2. If `req.user` exists, Notification Gateway service calls `booking.service.findOwnerBookings`.
3. Gateway booking adapter calls `BookingService.GetOwnerBookings`.
4. Gateway counts bookings where `ownerSeen` is false.
5. Navbar renders the count.

This remains a transitional read until Notification Service owns notification records in a later phase.

## Boundary

Booking Service owns:

- Booking creation.
- Owner self-booking prevention.
- Availability overlap checks.
- Price totals.
- Booking status.
- Owner seen state.
- Booked-date calculation.

Booking Service does not read Listing DB or Auth DB directly. It calls Listing Service over gRPC and receives user context from the Gateway request.
