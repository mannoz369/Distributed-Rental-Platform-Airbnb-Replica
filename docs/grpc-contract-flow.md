# gRPC Contract Flow

Phase 3 adds service contracts only. The app still runs as one Express process, but the files in `packages/proto` now define the API that future extracted services must implement.

## Contract Files

- `packages/proto/auth.proto`: signup, login, token refresh, refresh-token revocation, token validation, and user lookup.
- `packages/proto/listing.proto`: listing CRUD, search, owner listings, and booking-safe listing lookup.
- `packages/proto/booking.proto`: booking creation, cancellation, history, owner views, booked dates, and availability checks.
- `packages/proto/review.proto`: review creation, deletion, listing reviews, and review summary.
- `packages/proto/notification.proto`: user notifications, mark seen, and unread counts.

## Metadata

Internal gRPC calls should pass:

- `x-request-id`
- `x-user-id`
- `x-user-email`
- `x-user-role`
- `authorization`

Gateway validates JWTs first, then forwards trusted identity context to downstream services.

## Current Monolith Flow

### Signup

Current call chain:

1. `POST /signup`
2. `src/domains/auth/auth.routes.js`
3. `auth.controller.signup(req, res)`
4. Gateway adapter `auth.service.registerUser({ username, email, password })`
5. `auth.grpc-client.signup(SignupRequest)`
6. Auth Service creates the user and issues tokens.
7. `token.service.setAuthCookies(res, tokens)`
8. Redirect to `/listings`

Future gRPC mapping:

1. Gateway receives `POST /signup`.
2. Gateway calls `AuthService.Signup(SignupRequest)`.
3. Auth Service creates the user and returns `AuthResponse`.
4. Gateway sets cookies and redirects or returns JSON.

### Login

Current call chain:

1. `POST /login`
2. `auth.routes.js`
3. `auth.controller.login(req, res)`
4. Gateway adapter `auth.service.loginUser({ username, password })`
5. `auth.grpc-client.login(LoginRequest)`
6. Auth Service validates credentials and issues tokens.
7. `token.service.setAuthCookies(res, tokens)`
8. Redirect to the safe `redirectUrl` or `/listings`

Future gRPC mapping:

1. Gateway calls `AuthService.Login(LoginRequest)`.
2. Auth Service validates credentials.
3. Gateway stores returned tokens in HTTP-only cookies.

### Logout

Current call chain:

1. `GET /logout`
2. `auth.controller.logout(req, res)`
3. Gateway adapter `auth.service.removeRefreshToken(refreshToken)`
4. `auth.grpc-client.revokeRefreshToken(RevokeRefreshTokenRequest)`
5. Auth Service removes the stored refresh-token hash.
6. Gateway clears auth cookies.
7. Redirect to `/listings`

### Authenticated Request

Current call chain:

1. Express receives request.
2. `auth.middleware.parseCookies(req, res, next)`
3. `auth.middleware.attachUserFromToken(req, res, next)`
4. `token.service.verifyToken(accessToken)`
5. On valid token, attach `req.user`.
6. On expired/missing access token with valid refresh token, call `auth.service.refreshAuth(refreshToken)` and rotate cookies.
7. `shared/middleware.isLoggedin(req, res, next)` checks `req.user`.

Future gRPC mapping:

1. Gateway verifies external JWT by local signature verification or `AuthService.ValidateToken`.
2. Gateway forwards `x-user-id`, `x-user-email`, `x-user-role`, `x-request-id`, and `authorization` metadata to internal services.

### Create Listing

Current call chain:

1. `POST /listings`
2. `listing.routes.js`
3. `isLoggedin`
4. `validateListing`
5. `listing.controller.createListing(req, res)`
6. `listing.service.createListing({ listingInput, ownerId, image })`
7. Gateway adapter calls `ListingService.CreateListing(CreateListingRequest)`.
8. Listing Service geocodes and saves the listing.
9. Redirect to `/listings`

Future gRPC mapping:

1. Gateway validates JWT and upload payload.
2. Gateway calls `ListingService.CreateListing(CreateListingRequest)` with `owner_id` from metadata/JWT.
3. Listing Service geocodes and saves the listing.
4. Gateway redirects or returns the listing response.

### Show Listing Details

Current call chain:

1. `GET /listings/:id`
2. `listing.controller.showListing(req, res)`
3. `listing.service.findListingDetails(id)`
4. `listing.service.getBookedDatesForListing(id)`
5. Render `views/listings/show.ejs`

Future gRPC mapping:

1. Gateway calls `ListingService.GetListing(GetListingRequest)`.
2. Gateway currently composes review display data from the monolith Review model until Phase 7.
3. Gateway currently composes booked dates from the monolith Booking model until Phase 6.
4. Later Gateway will call `ReviewService.GetListingReviews` and `BookingService.GetBookedDates`.

### Create Booking

Current call chain:

1. `POST /listings/:id/bookings`
2. `booking.routes.js`
3. `isLoggedin`
4. `validateBooking`
5. `booking.controller.createBooking(req, res)`
6. `booking.service.createBooking({ listingId, user, bookingInput })`
7. Booking logic calls `ListingService.GetListingForBooking` through the Gateway listing adapter.
8. `booking.service.findOverlappingBooking(listingId, checkIn, checkOut)`
9. `Booking.save()`
10. Redirect to booking confirmation

Future gRPC mapping:

1. Gateway validates JWT.
2. Gateway booking logic currently creates the booking inside the monolith until Phase 6.
3. Gateway booking logic calls `ListingService.GetListingForBooking(GetListingForBookingRequest)`.
4. Booking logic rejects owner self-booking or inactive/missing listings.
5. Booking logic checks date overlap.
6. Booking logic saves the booking.
7. Gateway redirects to confirmation.

This is a synchronous gRPC flow because the user needs an immediate booking confirmation or rejection.

### Cancel Booking

Current call chain:

1. `PATCH /bookings/:bookingId/cancel`
2. `booking.controller.cancelBooking(req, res)`
3. `booking.service.findBookingForGuest(bookingId)`
4. `booking.service.cancelBooking(booking)`
5. Redirect to `/bookings/my`

Future gRPC mapping:

1. Gateway calls `BookingService.CancelBooking(CancelBookingRequest)`.
2. Booking Service uses authenticated metadata to verify the requester owns the booking as guest.
3. Booking Service updates status and returns `BookingResponse`.

### Create Review

Current call chain:

1. `POST /listings/:id/reviews`
2. `review.routes.js`
3. `isLoggedin`
4. `validateReview`
5. `review.controller.createReview(req, res)`
6. `review.service.createReview({ listingId, reviewInput, authorId })`
7. `Review.save()`
8. Gateway calls temporary `ListingService.AddReviewReference`.
9. Redirect to listing detail

Future gRPC mapping:

1. Gateway review logic still saves the review in the monolith until Phase 7.
2. Gateway review logic calls `ListingService.GetListing(GetListingRequest)` to verify the listing exists.
3. Gateway review logic calls temporary `ListingService.AddReviewReference`.
4. Phase 7 will replace this with `ReviewService.CreateReview`.

### Delete Review

Current call chain:

1. `DELETE /listings/:id/reviews/:reviewId`
2. `isReviewAuthor`
3. `review.controller.destroyReview(req, res)`
4. `review.service.deleteReview({ listingId, reviewId })`
5. Gateway calls temporary `ListingService.RemoveReviewReference`, then deletes the review

Future gRPC mapping:

1. Gateway verifies requester ownership using the current Review model.
2. Gateway calls temporary `ListingService.RemoveReviewReference`.
3. Gateway deletes the review.
4. Phase 7 will replace this with `ReviewService.DeleteReview`.

### Owner Notification Count

Current call chain:

1. Every request reaches the app locals middleware in `src/app.js`.
2. If `req.user` exists, call `notification.service.countUnreadOwnerNotifications(req.user._id)`.
3. Notification service currently counts unseen owner bookings from Booking model.
4. Navbar renders `ownerNotificationCount`.

Future gRPC mapping:

1. Gateway calls `NotificationService.GetUnreadCount(GetUnreadCountRequest)`.
2. Notification Service owns notification data.
3. Later Kafka `booking.created` and `booking.cancelled` events create notification records asynchronously.

## Extraction Order After Contracts

1. Auth Service implements `auth.proto`.
2. Gateway replaces local auth service calls with an Auth gRPC client.
3. Listing Service implements `listing.proto`.
4. Booking Service replaces direct Listing model reads with `ListingService.GetListingForBooking`.
5. Review Service replaces direct Listing model writes with Listing lookup and review-owned data.
6. Notification Service replaces booking-count reads with notification-owned records.
