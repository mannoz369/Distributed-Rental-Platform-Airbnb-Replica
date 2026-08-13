# Microservices Migration Plan

## Goal

Convert the current Airbnb-style Express, MongoDB, Mongoose, Passport, and EJS monolith into a better structured microservice architecture with JWT authentication, gRPC communication, Kafka event streaming, Docker-based local development, and Kubernetes deployment support.

The migration should happen gradually. The current app is small enough to understand clearly, but it has strong coupling between authentication, listings, bookings, reviews, Mongoose refs, sessions, flash messages, and server-rendered pages. A full rewrite would create too much risk. The safest path is to first modularize the monolith, then extract services one at a time.

## Current Project Summary

The current project is a single Express app.

Main files and responsibilities:

- `app.js`: Express setup, MongoDB connection, session store, Passport config, flash messages, route mounting.
- `models/user.js`: User model using `passport-local-mongoose`.
- `models/listing.js`: Listing model with owner, reviews, image, location, geometry, and delete hooks.
- `models/booking.js`: Booking model with listing, guest, owner, date range, price totals, status, and owner notification state.
- `models/review.js`: Review model with rating, comment, author.
- `controllers/listings.js`: Listing CRUD, search, Mapbox geocoding, booked date calculation.
- `controllers/bookings.js`: Booking creation, overlap checks, cancellation, guest history, owner notifications.
- `controllers/users.js`: Signup, login, logout with Passport sessions.
- `controllers/reviews.js`: Create/delete reviews.
- `middleware.js`: Auth checks, owner checks, Joi validation.
- `routes/*`: Express route definitions.
- `views/*`: EJS server-rendered UI.

Current coupling points:

- Auth depends on Passport sessions and `req.user`.
- Booking directly imports `Listing`.
- Listing directly imports `Booking` and `Review`.
- Review directly imports `Listing`.
- Controllers use Mongoose `populate()` for cross-domain joins.
- UI depends on server-side flash messages and session state.
- MongoDB is shared by all domains.

## Target Architecture

Use these services:

1. API Gateway / Backend For Frontend
2. Auth Service
3. Listing Service
4. Booking Service
5. Review Service
6. Notification Service
7. Frontend

Recommended communication:

- External clients call the API Gateway over HTTP.
- Internal request/response communication uses gRPC.
- Cross-service asynchronous updates use Kafka.
- Each service owns its own database.

## Database Recommendation

Use multiple databases, one per service.

This is the better choice for real microservices because each service owns its own data model and can evolve independently. A shared database is easier at the start, but it keeps services coupled through tables or collections. That usually becomes a distributed monolith.

Recommended ownership:

- Auth Service owns users and credentials.
- Listing Service owns listings and listing search data.
- Booking Service owns bookings and availability rules.
- Review Service owns reviews and ratings.
- Notification Service owns notification records.

Important rule:

No service should read or write another service's database directly.

Instead:

- Use gRPC when fresh data is needed immediately.
- Use Kafka events to maintain local read models.
- Store snapshots when historical correctness matters.

Example:

When a booking is created, Booking Service should store:

- `listingId`
- `guestId`
- `ownerId`
- `listingTitleSnapshot`
- `nightlyPriceSnapshot`
- `guestEmailSnapshot`
- `checkIn`
- `checkOut`
- `nights`
- `totalPrice`

This keeps the booking historically correct even if the listing price or title changes later.

## Migration Order

Follow this order:

1. Modularize the monolith.
2. Replace session auth with JWT.
3. Add gRPC contracts.
4. Extract Auth Service.
5. Extract Listing Service.
6. Extract Booking Service.
7. Extract Review Service.
8. Add Kafka events.
9. Add Docker Compose.
10. Add Kubernetes.

Do not start with Kubernetes. Kubernetes should come after the service boundaries, Dockerfiles, environment config, and local service communication are working.

## Phase 1: Modularize The Monolith

### Objective

Restructure the existing app internally without changing runtime behavior. This creates clear domain boundaries before extracting services.

### Why

Right now, the project is organized by technical layer:

- `controllers`
- `routes`
- `models`
- `views`
- `utils`

For microservices, it should first be organized by business domain:

- auth
- listings
- bookings
- reviews
- notifications

### Proposed Structure

```text
src/
  app.js
  config/
    db.js
    env.js
    passport.js
  domains/
    auth/
      auth.routes.js
      auth.controller.js
      user.model.js
      auth.validation.js
      auth.middleware.js
    listings/
      listing.routes.js
      listing.controller.js
      listing.model.js
      listing.validation.js
      listing.service.js
    bookings/
      booking.routes.js
      booking.controller.js
      booking.model.js
      booking.validation.js
      booking.service.js
    reviews/
      review.routes.js
      review.controller.js
      review.model.js
      review.validation.js
      review.service.js
    notifications/
      notification.service.js
  shared/
    errors/
    middleware/
    utils/
    validation/
```

### Tasks

1. Move model/controller/route files into domain folders.
2. Keep existing Express route behavior unchanged.
3. Move Joi schemas closer to each domain.
4. Move shared utilities into `src/shared`.
5. Introduce service-layer functions inside each domain.
6. Reduce direct controller-to-model coupling.
7. Identify every cross-domain import.

### Cross-Domain Imports To Remove Later

Current examples:

- Booking controller imports Listing model.
- Listing controller imports Booking model.
- Listing model delete hook deletes Review and Booking records.
- Review controller imports Listing model.
- Middleware imports Listing and Review models for permission checks.

### Acceptance Criteria

- Existing pages still work.
- Existing routes still work.
- No new services yet.
- No database changes yet.
- The app can still run as one Express process.
- Cross-domain dependencies are documented.

### Phase 1 Implementation Notes

Implemented on 2026-08-11:

- Moved the Express app entry point to `src/app.js` and kept root `app.js` as a compatibility shim.
- Added config modules under `src/config` for environment loading, MongoDB connection, Passport setup, and Cloudinary storage.
- Moved auth, listing, booking, and review routes, controllers, models, validation, and service-layer files into `src/domains`.
- Added a notifications service placeholder for owner notification count lookup while the app still runs as one process.
- Moved shared error and async middleware utilities into `src/shared`.
- Split Joi validation into domain-local files:
  - `src/domains/listings/listing.validation.js`
  - `src/domains/bookings/booking.validation.js`
  - `src/domains/reviews/review.validation.js`
  - `src/domains/auth/auth.validation.js`
- Updated the seed script to import the listing model from the new domain path.

Remaining cross-domain imports after Phase 1:

- `src/domains/bookings/booking.service.js` imports `src/domains/listings/listing.model.js` to validate listing existence, owner, and price during booking creation.
- `src/domains/listings/listing.service.js` imports `src/domains/bookings/booking.model.js` to calculate booked dates for listing detail pages.
- `src/domains/listings/listing.model.js` imports `src/domains/reviews/review.model.js` and `src/domains/bookings/booking.model.js` in the listing delete hook.
- `src/domains/reviews/review.service.js` imports `src/domains/listings/listing.model.js` to attach and detach review IDs from listings.
- `src/domains/notifications/notification.service.js` imports `src/domains/bookings/booking.model.js` to count unseen owner booking updates.
- `src/shared/middleware/index.js` imports listing and review models for owner/author permission checks, and imports domain validation schemas for request validation.

These imports are intentionally retained for Phase 1 to preserve runtime behavior. Later phases should replace them with JWT-derived user context, gRPC calls, service-owned data, and events.

## Phase 2: Replace Session Auth With JWT

### Objective

Replace Passport session authentication with stateless JWT authentication.

### Why

Microservices should not depend on one shared Express session. JWT allows the Gateway and internal services to verify identity without reading a session store.

### Current Auth

The current app uses:

- `passport`
- `passport-local`
- `passport-local-mongoose`
- `express-session`
- `connect-mongo`
- `req.isAuthenticated()`
- `req.user`
- `req.login()`
- `req.logout()`

### Target Auth

Use:

- Password hashing with `bcrypt` or `argon2`.
- JWT access tokens.
- Refresh tokens.
- Auth middleware that reads `Authorization: Bearer <token>`.
- User context attached to `req.user`.

### Token Strategy

Access token:

- Short lived.
- Example expiry: 15 minutes.
- Sent on every authenticated API request.

Refresh token:

- Longer lived.
- Example expiry: 7 to 30 days.
- Stored securely.
- Used only to request a new access token.

JWT claims:

```json
{
  "sub": "user_id",
  "username": "username",
  "email": "user@example.com",
  "role": "guest",
  "iat": 1234567890,
  "exp": 1234569999
}
```

### Tasks

1. Add password hashing without `passport-local-mongoose`.
2. Add login endpoint that returns JWT tokens.
3. Add signup endpoint that creates user and returns tokens.
4. Add refresh endpoint.
5. Add logout endpoint that invalidates refresh token.
6. Replace `isLoggedin` middleware with JWT verification.
7. Replace `res.locals.currUser` session usage with token-derived user context.
8. Update protected listing, booking, and review flows.
9. Remove dependency on Mongo session store after the app is stable.

### Frontend Options

Short-term:

- Keep EJS.
- Store token in secure HTTP-only cookies.
- Gateway/server reads cookie and forwards user context.

Long-term:

- Move to React/Next.js or another frontend.
- Store access token in memory.
- Store refresh token in secure HTTP-only cookie.

### Acceptance Criteria

- Users can signup.
- Users can login.
- Protected routes reject missing/invalid tokens.
- Listing owner checks still work.
- Review author checks still work.
- Booking guest/owner checks still work.
- No route depends on Passport sessions.

### Phase 2 Implementation Notes

Implemented on 2026-08-11:

- Removed Passport runtime usage from the app:
  - Removed `passport.initialize()`.
  - Removed `passport.session()`.
  - Removed Passport local strategy setup.
  - Removed route-level `passport.authenticate()`.
- Removed unused auth/session packages from dependencies:
  - `passport`
  - `passport-local`
  - `passport-local-mongoose`
  - `connect-mongo`
- Replaced `passport-local-mongoose` with local password hashing in `src/domains/auth/auth.service.js`.
  - Uses Node `crypto.pbkdf2Sync`.
  - Stores `passwordHash` and `passwordSalt` on the user document.
  - Keeps legacy `hash` and `salt` fields readable so existing Passport-created users can be migrated on their next successful login.
- Added JWT access and refresh token support in `src/domains/auth/token.service.js`.
  - Access token cookie: `accessToken`.
  - Refresh token cookie: `refreshToken`.
  - Tokens are sent as HTTP-only cookies for the existing EJS frontend.
  - Bearer tokens are also accepted through the `Authorization` header.
- Added refresh-token persistence on the user document.
  - Refresh tokens are stored as SHA-256 hashes, not raw token values.
  - Login and signup issue token pairs.
  - Refresh rotates refresh tokens.
  - Logout invalidates the current refresh token and clears auth cookies.
- Added auth request middleware in `src/domains/auth/auth.middleware.js`.
  - Parses cookies without adding a new dependency.
  - Verifies access tokens.
  - Refreshes expired/missing access tokens when a valid refresh cookie exists.
  - Attaches token-derived user context to `req.user`.
- Updated `isLoggedin` to reject missing token-derived user context instead of calling `req.isAuthenticated()`.
- Updated EJS login redirect preservation to use a `redirectUrl` hidden form field instead of Passport session state.
- Added endpoints:
  - `POST /auth/refresh`
  - `GET /auth/me`
- Kept `express-session` only for existing `connect-flash` messages. No route uses Express session for authentication.

Remaining Phase 2 follow-ups:

- Add automated request-level tests around signup, login, refresh, logout, and protected redirects.
- Consider moving flash messages away from `express-session` before the Gateway/frontend split.
- Consider adding `JWT_SECRET` to `.env.example` once environment examples are introduced.

## Phase 3: Add gRPC Contracts

### Objective

Define service contracts before extracting services.

### Why

The contracts make service boundaries explicit. Even before services are physically split, the app can be refactored to use contract-like service functions.

### Proposed Structure

```text
packages/
  proto/
    auth.proto
    listing.proto
    booking.proto
    review.proto
    notification.proto
  common/
    errors/
    auth-context/
    logger/
```

### Auth Service Proto

RPCs:

- `Signup`
- `Login`
- `RefreshToken`
- `RevokeRefreshToken`
- `ValidateToken`
- `GetUser`

Core messages:

- `User`
- `AuthTokens`
- `SignupRequest`
- `LoginRequest`
- `ValidateTokenRequest`

### Listing Service Proto

RPCs:

- `CreateListing`
- `UpdateListing`
- `DeleteListing`
- `GetListing`
- `SearchListings`
- `GetOwnerListings`
- `GetListingForBooking`

`GetListingForBooking` should return only what Booking Service needs:

- listing ID
- title
- owner ID
- nightly price
- active status

### Booking Service Proto

RPCs:

- `CreateBooking`
- `CancelBooking`
- `GetBooking`
- `GetGuestBookings`
- `GetOwnerBookings`
- `GetBookedDates`
- `CheckAvailability`

### Review Service Proto

RPCs:

- `CreateReview`
- `DeleteReview`
- `GetListingReviews`
- `GetReviewSummary`

### Notification Service Proto

RPCs:

- `GetUserNotifications`
- `MarkNotificationSeen`
- `GetUnreadCount`

### gRPC Metadata

Internal calls should pass:

- `x-request-id`
- `x-user-id`
- `x-user-email`
- `x-user-role`
- `authorization`

### Acceptance Criteria

- Proto files exist.
- Message names are consistent.
- Each domain has clear request/response models.
- No service contract exposes internal MongoDB document structures directly.

### Phase 3 Implementation Notes

Implemented on 2026-08-12:

- Added gRPC protobuf contracts under `packages/proto`:
  - `auth.proto`
  - `listing.proto`
  - `booking.proto`
  - `review.proto`
  - `notification.proto`
- Added `packages/proto/README.md` with contract rules:
  - IDs are strings.
  - Timestamps are ISO-8601 strings for now.
  - Contracts expose domain DTOs, not Mongoose documents.
  - Authenticated user context should come from metadata.
- Added common contract guidance under `packages/common`:
  - `auth-context/README.md` documents `x-request-id`, `x-user-id`, `x-user-email`, `x-user-role`, and `authorization` metadata.
  - `errors/README.md` maps common business failures to gRPC status codes.
  - `logger/README.md` defines shared logging context fields for future service extraction.
- Added `docs/grpc-contract-flow.md` documenting current monolith function calls and future gRPC mappings for:
  - Signup
  - Login
  - Authenticated request handling
  - Create listing
  - Show listing details
  - Create booking
  - Cancel booking
  - Create review
  - Delete review
  - Owner notification count

Phase 3 intentionally does not add gRPC servers or clients yet. Runtime behavior remains the existing Express monolith. The next extraction phases should implement these contracts and replace local service calls one service at a time.

## Phase 4: Extract Auth Service

### Objective

Move users, credentials, JWT issuing, and token validation into a separate Auth Service.

### Why

Auth is the cleanest first extraction because other services depend on identity.

### Auth Service Responsibilities

- Signup.
- Login.
- Password hashing.
- Refresh token rotation.
- JWT signing.
- JWT validation.
- User profile lookup.

### Auth Service Database

Database: `auth-db`

Collections:

- `users`
- `refresh_tokens`

User fields:

- `id`
- `username`
- `email`
- `passwordHash`
- `role`
- `createdAt`
- `updatedAt`

### Gateway Changes

Gateway handles public HTTP:

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

Gateway calls Auth Service via gRPC.

### Migration Steps

1. Create `services/auth-service`.
2. Move user model and auth logic.
3. Add Auth gRPC server.
4. Add Auth gRPC client in Gateway/current app.
5. Replace local user model reads in auth flows.
6. Keep user IDs stable during migration.
7. Migrate existing users to Auth DB.
8. Stop using `passport-local-mongoose`.

### Acceptance Criteria

- Auth Service runs independently.
- Gateway can signup/login through Auth Service.
- Gateway can validate JWTs.
- Other services no longer need user credentials.

### Phase 4 Implementation Notes

Implemented on 2026-08-12:

- Added standalone Auth Service under `services/auth-service`.
  - `src/server.js` starts the gRPC server.
  - `src/grpc.js` implements `AuthService` from `packages/proto/auth.proto`.
  - `src/auth.service.js` owns signup, login, refresh, refresh-token revocation, token validation, and user lookup.
  - `src/user.model.js` owns user credentials and refresh-token hashes.
  - `src/token.service.js` owns JWT issuing and verification.
  - `src/config/db.js` and `src/config/env.js` isolate service configuration.
- Added `services/auth-service/.env.example`.
- Added npm scripts:
  - `npm run auth-service`
  - `npm start`
- Added Gateway gRPC client support:
  - `src/shared/grpc/loadProto.js`
  - `src/domains/auth/auth.grpc-client.js`
- Converted `src/domains/auth/auth.service.js` into a Gateway adapter that calls Auth Service over gRPC.
- Gateway auth flows now call Auth Service for:
  - Signup
  - Login
  - Refresh token rotation
  - Refresh-token revocation on logout
- Extended `auth.proto` with:
  - `RevokeRefreshToken`
  - `RevokeRefreshTokenRequest`
  - `RevokeRefreshTokenResponse`
- Kept Gateway-local access-token verification for page requests by sharing the JWT signing secret.
- Kept a lightweight local `User` model registered in the Gateway so existing Mongoose `populate("owner")` and `populate("author")` rendering still works during the transition.
- Added `docs/auth-service-flow.md` documenting the full Auth Service extraction flow.

How to run Phase 4 locally:

1. Start Auth Service with `npm run auth-service`.
2. In another terminal, start the Gateway with `npm start`.
3. Gateway calls `AUTH_SERVICE_URL`, defaulting to `localhost:50051`.

Remaining Phase 4 follow-ups:

- Move user display data out of Gateway-side Mongoose populate calls during Listing and Review extraction.
- Add request-level tests that start Auth Service and verify Gateway signup/login/refresh/logout through gRPC.
- Split `AUTH_DB_URL` from the monolith database once data migration is planned.

## Phase 5: Extract Listing Service

### Objective

Move listing ownership, listing CRUD, search, image metadata, and geocoding into Listing Service.

### Listing Service Responsibilities

- Create listing.
- Update listing.
- Delete listing.
- Get listing details.
- Search listings.
- Get listings by owner.
- Store image metadata.
- Store Mapbox geometry.
- Provide listing info needed by Booking Service.

### Listing Service Database

Database: `listing-db`

Collections:

- `listings`

Listing fields:

- `id`
- `title`
- `description`
- `image`
- `price`
- `location`
- `country`
- `ownerId`
- `geometry`
- `status`
- `createdAt`
- `updatedAt`

Do not store review IDs in the Listing Service as the source of truth. Reviews should belong to Review Service. Listing Service may eventually store `averageRating` and `reviewCount` as a read model from Kafka events.

### Migration Steps

1. Create `services/listing-service`.
2. Move listing model and listing service logic.
3. Add Listing gRPC server.
4. Add Gateway routes that call Listing Service.
5. Replace direct Listing model usage in booking/review code with gRPC calls.
6. Remove listing delete hook that directly deletes bookings/reviews.
7. Publish `listing.deleted` later so other services can react.

### Acceptance Criteria

- Gateway can list, create, update, and delete listings through Listing Service.
- Booking code no longer imports Listing model.
- Review code no longer imports Listing model.
- Listing Service owns listing database access.

### Phase 5 Implementation Notes

Implemented on 2026-08-12:

- Added standalone Listing Service under `services/listing-service`.
  - `src/server.js` starts the gRPC server.
  - `src/grpc.js` implements `ListingService` from `packages/proto/listing.proto`.
  - `src/listing.service.js` owns listing CRUD, search, ownership checks, soft delete, and Mapbox geocoding.
  - `src/listing.model.js` owns listing persistence.
  - `src/config/db.js` and `src/config/env.js` isolate service configuration.
- Added `services/listing-service/.env.example`.
- Added npm script:
  - `npm run listing-service`
- Added Gateway gRPC client support:
  - `src/domains/listings/listing.grpc-client.js`
- Converted `src/domains/listings/listing.service.js` into a Gateway adapter that calls Listing Service over gRPC.
- Gateway listing flows now call Listing Service for:
  - Search/index listings
  - Owner listings
  - Get listing
  - Create listing
  - Update listing
  - Delete listing
  - Get listing data for booking validation
- Booking creation no longer imports the Listing model. It calls `ListingService.GetListingForBooking` through the Gateway listing adapter.
- Review create/delete no longer import the Listing model. They call temporary Listing Service review-reference RPCs.
- Shared `isOwner` middleware no longer imports the Listing model. It calls the Gateway listing adapter.
- Removed the listing model delete hook that directly deleted review and booking records.
- Listing delete is now a soft delete by setting `status = "deleted"`.
- Extended `listing.proto` with temporary compatibility fields/RPCs:
  - `review_ids`
  - `AddReviewReference`
  - `RemoveReviewReference`
  - `ReviewReferenceRequest`
- Added `docs/listing-service-flow.md` documenting the full Listing Service extraction flow.

How to run Phase 5 locally:

1. Start Auth Service with `npm run auth-service`.
2. Start Listing Service with `npm run listing-service`.
3. In another terminal, start the Gateway with `npm start`.
4. Gateway calls `AUTH_SERVICE_URL`, defaulting to `localhost:50051`.
5. Gateway calls `LISTING_SERVICE_URL`, defaulting to `localhost:50052`.

Remaining Phase 5 follow-ups:

- Split `LISTING_DB_URL` from the monolith database once listing data migration is planned.
- Phase 6 should replace Gateway booked-date composition with `BookingService.GetBookedDates`.
- Phase 7 should replace Gateway review composition with `ReviewService.GetListingReviews` and remove temporary review-reference RPC usage.
- Later Kafka work should publish `listing.deleted` so Booking/Review/Notification services can react without delete hooks.

## Phase 6: Extract Booking Service

### Objective

Move booking creation, availability checks, booking history, cancellation, and owner booking views into Booking Service.

### Booking Service Responsibilities

- Create booking.
- Prevent owner from booking own listing.
- Prevent overlapping confirmed bookings.
- Calculate backend totals.
- Cancel booking.
- Get guest bookings.
- Get owner bookings.
- Get booked dates for listing.

### Booking Service Database

Database: `booking-db`

Collections:

- `bookings`

Booking fields:

- `id`
- `listingId`
- `guestId`
- `ownerId`
- `guestNameSnapshot`
- `guestEmailSnapshot`
- `listingTitleSnapshot`
- `nightlyPriceSnapshot`
- `checkIn`
- `checkOut`
- `nights`
- `subtotalPrice`
- `taxAmount`
- `totalPrice`
- `status`
- `createdAt`
- `updatedAt`

### Synchronous Calls

Booking Service should call Listing Service through gRPC when creating a booking:

- Verify listing exists.
- Verify listing is active.
- Get owner ID.
- Get nightly price.
- Get listing title.

### Migration Steps

1. Create `services/booking-service`.
2. Move booking model and booking logic.
3. Add Booking gRPC server.
4. Add Listing gRPC client inside Booking Service.
5. Move overlap check into Booking Service.
6. Change Gateway booking routes to call Booking Service.
7. Publish `booking.created` and `booking.cancelled` later through Kafka.

### Acceptance Criteria

- Gateway can create bookings through Booking Service.
- Booking overlap checks still work.
- Booking totals are calculated by Booking Service.
- Booking Service does not read Listing DB directly.
- Booking Service does not read Auth DB directly.

### Phase 6 Implementation Notes

Implemented on 2026-08-12:

- Added standalone Booking Service under `services/booking-service`.
  - `src/server.js` starts the gRPC server.
  - `src/grpc.js` implements `BookingService` from `packages/proto/booking.proto`.
  - `src/booking.service.js` owns booking creation, availability checks, totals, cancellation, owner seen state, guest/owner booking lists, and booked-date lookup.
  - `src/booking.model.js` owns booking persistence.
  - `src/listing.grpc-client.js` calls Listing Service for `GetListingForBooking`.
  - `src/config/db.js` and `src/config/env.js` isolate service configuration.
- Added `services/booking-service/.env.example`.
- Added npm script:
  - `npm run booking-service`
- Added Gateway gRPC client support:
  - `src/domains/bookings/booking.grpc-client.js`
- Converted `src/domains/bookings/booking.service.js` into a Gateway adapter that calls Booking Service over gRPC.
- Gateway booking flows now call Booking Service for:
  - Create booking
  - Cancel booking
  - Get booking details
  - Guest booking history
  - Owner booking list
  - Booked dates
  - Owner seen state
- Listing detail booked-date lookup now calls `BookingService.GetBookedDates` instead of reading the Booking model in the Gateway.
- Owner notification count now derives from `BookingService.GetOwnerBookings` instead of reading the Booking model in the Gateway.
- Booking Service calls Listing Service through gRPC for booking creation and does not read Listing DB directly.
- Extended `booking.proto` with:
  - `MarkOwnerSeen`
  - `MarkOwnerSeenRequest`
- Added `docs/booking-service-flow.md` documenting the full Booking Service extraction flow.

How to run Phase 6 locally:

1. Start Auth Service with `npm run auth-service`.
2. Start Listing Service with `npm run listing-service`.
3. Start Booking Service with `npm run booking-service`.
4. In another terminal, start the Gateway with `npm start`.
5. Gateway calls `BOOKING_SERVICE_URL`, defaulting to `localhost:50053`.
6. Booking Service calls `LISTING_SERVICE_URL`, defaulting to `localhost:50052`.

Remaining Phase 6 follow-ups:

- Split `BOOKING_DB_URL` from the monolith database once booking data migration is planned.
- Move notification count to Notification Service when Phase 8 introduces booking events.
- Replace booking listing/user display hydration with read models or Gateway composition once all services have independent databases.

## Phase 7: Extract Review Service

### Objective

Move review creation, deletion, and listing review reads into Review Service.

### Review Service Responsibilities

- Create review.
- Delete review.
- Get reviews for listing.
- Get review summary for listing.
- Enforce author permissions.

### Review Service Database

Database: `review-db`

Collections:

- `reviews`

Review fields:

- `id`
- `listingId`
- `authorId`
- `authorNameSnapshot`
- `rating`
- `comment`
- `createdAt`
- `updatedAt`

### Migration Steps

1. Create `services/review-service`.
2. Move review model and logic.
3. Add Review gRPC server.
4. Review Service calls Listing Service to verify listing existence.
5. Gateway calls Review Service for create/delete/listing reviews.
6. Remove listing-owned review array as source of truth.
7. Later publish review events to Kafka.

### Acceptance Criteria

- Reviews can be created through Review Service.
- Reviews can be deleted only by their author.
- Listing pages can display reviews.
- Listing Service does not own review documents.

### Phase 7 Implementation Notes

Implemented on 2026-08-12:

- Added standalone Review Service under `services/review-service`.
  - `src/server.js` starts the gRPC server.
  - `src/grpc.js` implements `ReviewService` from `packages/proto/review.proto`.
  - `src/review.service.js` owns review creation, deletion, listing review reads, author permission checks, and review summaries.
  - `src/review.model.js` owns review persistence.
  - `src/listing.grpc-client.js` calls Listing Service for listing existence and temporary review-reference updates.
  - `src/config/db.js` and `src/config/env.js` isolate service configuration.
- Added `services/review-service/.env.example`.
- Added npm script:
  - `npm run review-service`
- Added Gateway gRPC client support:
  - `src/domains/reviews/review.grpc-client.js`
- Converted `src/domains/reviews/review.service.js` into a Gateway adapter that calls Review Service over gRPC.
- Listing detail pages now call `ReviewService.GetListingReviews` instead of reading the Review model in the Gateway.
- Review create/delete now call Review Service.
- Review author checks now happen inside Review Service during `DeleteReview`.
- Removed Gateway `isReviewAuthor` direct Review model middleware from review routes.
- Review Service supports legacy review ids from Listing Service `review_ids` while existing data is still in the shared database.
- Added `docs/review-service-flow.md` documenting the full Review Service extraction flow.

How to run Phase 7 locally:

1. Start Auth Service with `npm run auth-service`.
2. Start Listing Service with `npm run listing-service`.
3. Start Booking Service with `npm run booking-service`.
4. Start Review Service with `npm run review-service`.
5. In another terminal, start the Gateway with `npm start`.
6. Gateway calls `REVIEW_SERVICE_URL`, defaulting to `localhost:50054`.
7. Review Service calls `LISTING_SERVICE_URL`, defaulting to `localhost:50052`.

Remaining Phase 7 follow-ups:

- Split `REVIEW_DB_URL` from the monolith database once review data migration is planned.
- Remove listing-owned `review_ids` and temporary Listing Service review-reference RPC usage once reviews are fully review-owned.
- Later Kafka work should publish `review.created` and `review.deleted` for listing rating read models.

## Phase 8: Add Kafka Events

### Objective

Introduce asynchronous event-driven communication for cross-service updates that do not need immediate responses.

### Why

Kafka is useful for notifications, read models, audit logs, search indexing, and eventual consistency. It should not replace gRPC for immediate validation flows.

### Topics

Start with these topics:

- `user.events`
- `listing.events`
- `booking.events`
- `review.events`
- `notification.events`

Event types:

- `user.created`
- `listing.created`
- `listing.updated`
- `listing.deleted`
- `booking.created`
- `booking.cancelled`
- `review.created`
- `review.deleted`
- `notification.created`
- `notification.seen`

### Event Envelope

Use a consistent event envelope:

```json
{
  "eventId": "uuid",
  "eventType": "booking.created",
  "eventVersion": 1,
  "occurredAt": "2026-08-11T00:00:00.000Z",
  "producer": "booking-service",
  "correlationId": "request-id",
  "payload": {}
}
```

### First Kafka Use Case

Start with booking notifications:

1. Booking Service creates a booking.
2. Booking Service publishes `booking.created`.
3. Notification Service consumes `booking.created`.
4. Notification Service creates owner notification.
5. Gateway asks Notification Service for unread notification count.

### Reliability Rules

- Use idempotent consumers.
- Store processed `eventId`s if needed.
- Add retry topics.
- Add dead-letter topics.
- Log event processing failures.
- Never assume Kafka delivery means business transaction success unless using an outbox pattern.

### Outbox Pattern

For important events like bookings:

1. Save booking and outbox event in the same database transaction when possible.
2. A background worker publishes pending outbox events to Kafka.
3. Mark event as published after successful Kafka publish.

### Acceptance Criteria

- Kafka runs locally.
- Booking Service publishes booking events.
- Notification Service consumes booking events.
- Duplicate events do not create duplicate notifications.
- Failed events can be retried.

## Phase 9: Add Docker Compose

### Objective

Make the full system runnable locally with one command.

### Services In Docker Compose

Include:

- `gateway`
- `auth-service`
- `listing-service`
- `booking-service`
- `review-service`
- `notification-service`
- `kafka`

Optional:

- `kafka-ui`

Database deployment choice:

- Use MongoDB Atlas for all service-owned databases.
- Do not run MongoDB containers in Docker Compose for this project.
- Each service must receive an explicit Atlas URL with its own database name:
  - `AUTH_DB_URL`
  - `LISTING_DB_URL`
  - `BOOKING_DB_URL`
  - `REVIEW_DB_URL`
  - `NOTIFICATION_DB_URL`
- In production or Docker, services must fail fast if their service-specific DB URL is missing. They should not silently fall back to the monolith `ATLASDB_URL`.
- The current monolith database remains untouched until a separate, backup-first migration step is planned.

### Per-Service Requirements

Each service should have:

- `Dockerfile`
- `.env.example`
- Health endpoint
- gRPC port
- Structured logging
- Graceful shutdown

### Suggested Ports

- Gateway HTTP: `8080`
- Auth gRPC: `50051`
- Listing gRPC: `50052`
- Booking gRPC: `50053`
- Review gRPC: `50054`
- Notification gRPC: `50055`
- Kafka: `9092`

### Acceptance Criteria

- `docker compose up` starts the local platform.
- Gateway can reach all services.
- Services can reach Kafka.
- Each service connects only to its own Atlas database.
- Health checks pass.

### Phase 9 Implementation Notes

Implemented on 2026-08-13:

- Added Dockerfiles for the Gateway and the five extracted services.
- Updated Docker Compose to run Gateway, Auth, Listing, Booking, Review, Notification, Redpanda Kafka, and Kafka UI.
- Chose MongoDB Atlas databases instead of local MongoDB containers.
- Added service-specific Atlas DB URLs to `.env.example`; local service-specific `.env` files are supported but ignored by git.
- Added a shared Mongo URL resolver so services require their own `*_DB_URL` and cannot accidentally write to the generic monolith `ATLASDB_URL`.
- Added TCP-based container health checks for the Gateway and gRPC services.
- Added a copy-only Atlas migration script that preserves `_id` values and upserts existing collections into service-owned databases.

## Phase 10: Add Kubernetes

### Objective

Prepare the system for production-style deployment.

### Kubernetes Resources

For each application service:

- `Deployment`
- `Service`
- `ConfigMap`
- `Secret`
- `HorizontalPodAutoscaler`
- `PodDisruptionBudget`

For Gateway:

- `Ingress`
- TLS configuration
- Public HTTP routing

For health:

- Readiness probes
- Liveness probes

### Kubernetes Structure

```text
infra/
  k8s/
    base/
      gateway/
      auth-service/
      listing-service/
      booking-service/
      review-service/
      notification-service/
    overlays/
      dev/
      staging/
      production/
```

### Secrets

Store these as Kubernetes Secrets:

- JWT private/public keys or signing secret
- MongoDB URLs
- Cloudinary credentials
- Mapbox token
- Kafka credentials if using managed Kafka

### Production Recommendation

For production, prefer managed infrastructure:

- Managed MongoDB such as MongoDB Atlas.
- Managed Kafka such as Confluent Cloud, AWS MSK, or Redpanda Cloud.
- Kubernetes only for stateless app services.

Do not run production databases inside the same Kubernetes cluster unless there is a strong reason and proper operational experience.

### Acceptance Criteria

- Gateway is the only public service.
- Internal services are cluster-private.
- All services have readiness and liveness checks.
- Config is environment-specific.
- Secrets are not committed.
- Services can scale independently.

## Final Target Request Flow

### Login

1. Client sends login request to Gateway.
2. Gateway calls Auth Service through gRPC.
3. Auth Service validates credentials.
4. Auth Service returns access and refresh tokens.
5. Gateway returns tokens/cookies to client.

### Create Listing

1. Client sends listing request to Gateway with JWT.
2. Gateway verifies JWT.
3. Gateway calls Listing Service through gRPC.
4. Listing Service geocodes location and stores listing.
5. Listing Service publishes `listing.created`.

### Create Booking

1. Client sends booking request to Gateway with JWT.
2. Gateway verifies JWT.
3. Gateway calls Booking Service through gRPC.
4. Booking Service calls Listing Service to get listing price and owner.
5. Booking Service checks date overlap.
6. Booking Service saves booking.
7. Booking Service publishes `booking.created`.
8. Notification Service consumes event and creates owner notification.

### Show Listing Details

1. Client asks Gateway for listing details.
2. Gateway calls Listing Service for listing data.
3. Gateway calls Review Service for reviews.
4. Gateway calls Booking Service for booked dates.
5. Gateway combines response for frontend.

## Implementation Priorities

Highest priority:

1. JWT auth.
2. Clear service boundaries.
3. Booking correctness.
4. Database ownership.
5. gRPC contracts.

Medium priority:

1. Kafka notifications.
2. Review summary read models.
3. Docker Compose.

Later priority:

1. Kubernetes.
2. Autoscaling.
3. Observability stack.
4. CI/CD deployment pipeline.

## Risks

### Distributed Data Consistency

Bookings depend on listing data. Solve this with synchronous gRPC validation plus booking snapshots.

### Authentication Complexity

JWT introduces refresh token handling and token invalidation concerns. Keep access tokens short-lived and rotate refresh tokens.

### Overusing Kafka

Kafka should not be used for flows that need immediate answers. Use gRPC for validation and Kafka for events.

### Too Many Services Too Early

Extract services one at a time. Keep the system working after every phase.

### EJS Frontend Coupling

The current EJS pages depend on server-side state. Either keep the Gateway as a server-rendered BFF temporarily or later move to a dedicated frontend.

## Definition Of Done

The migration is complete when:

- Auth uses JWT, not Passport sessions.
- Gateway is the only public entry point.
- Auth, Listing, Booking, Review, and Notification run as separate services.
- Services communicate synchronously through gRPC.
- Kafka handles asynchronous domain events.
- Each service owns its own database.
- The system runs locally with Docker Compose.
- Kubernetes manifests exist for deployment.
- No service directly imports another service's model.
- No service directly reads another service's database.
- Booking, listing, review, and auth workflows still work end to end.
