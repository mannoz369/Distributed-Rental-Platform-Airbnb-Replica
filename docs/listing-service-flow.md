# Listing Service Extraction Flow

Phase 5 extracts listing ownership, CRUD, search, image metadata, and Mapbox geocoding into `services/listing-service`.

## Processes

Gateway / existing Express app:

- Run with `npm start`.
- Keeps EJS rendering, upload handling, flash messages, and redirects.
- Calls Listing Service over gRPC through `src/domains/listings/listing.grpc-client.js`.

Listing Service:

- Run with `npm run listing-service`.
- Implements `packages/proto/listing.proto`.
- Owns listing persistence, listing search, ownership checks for update/delete, soft delete, and geocoding.

Defaults:

- Gateway target: `LISTING_SERVICE_URL=localhost:50052`.
- Listing Service host: `LISTING_SERVICE_HOST=0.0.0.0`.
- Listing Service port: `LISTING_SERVICE_PORT=50052`.
- Listing database: `LISTING_DB_URL`, falling back to `ATLASDB_URL`.
- Mapbox token: `MAP_TOKEN`.

## Index/Search Flow

1. Browser requests `GET /listings`.
2. `src/domains/listings/listing.routes.js` calls `listing.controller.index`.
3. Controller calls `listing.service.findListings(searchQuery)`.
4. Gateway adapter calls `ListingService.SearchListings`.
5. `services/listing-service/src/grpc.js` receives `SearchListingsRequest`.
6. `services/listing-service/src/listing.service.js` builds a search filter and queries listing-owned data.
7. gRPC returns `SearchListingsResponse`.
8. Gateway maps gRPC listings into EJS-compatible listing objects and renders `views/listings/index.ejs`.

## Create Listing Flow

1. Browser submits `POST /listings` with form data and uploaded image.
2. Gateway route runs JWT auth, upload middleware, and Joi validation.
3. `listing.controller.createListing` passes listing input, owner id, and image metadata to the Gateway listing adapter.
4. Gateway calls `ListingService.CreateListing`.
5. Listing Service geocodes the location through Mapbox.
6. Listing Service saves the listing.
7. Gateway redirects to `/listings`.

## Update Listing Flow

1. Browser submits `PUT /listings/:id`.
2. Gateway `isOwner` middleware calls `listing.service.findListingById`.
3. Gateway adapter calls `ListingService.GetListing`.
4. Gateway compares the returned `owner_id` to `req.user._id`.
5. Controller calls `listing.service.updateListing`.
6. Gateway calls `ListingService.UpdateListing`.
7. Listing Service verifies owner id again, geocodes the new location, updates the listing, and returns `ListingResponse`.
8. Gateway redirects to the listing detail page.

## Delete Listing Flow

1. Browser submits `DELETE /listings/:id`.
2. Gateway verifies user and owner.
3. Controller calls `listing.service.deleteListing`.
4. Gateway calls `ListingService.DeleteListing`.
5. Listing Service verifies owner id and marks the listing as `deleted`.
6. Search and owner listing RPCs exclude deleted listings.

Phase 5 intentionally avoids the old model hook that directly deleted booking and review records. Later Kafka events should replace that behavior.

## Booking Validation Flow

1. Browser submits `POST /listings/:id/bookings`.
2. Gateway booking logic calls `listing.service.getListingForBooking`.
3. Gateway listing adapter calls `ListingService.GetListingForBooking`.
4. Listing Service returns only booking-safe fields:
   - listing id
   - title
   - owner id
   - nightly price
   - status
   - active flag
5. Booking logic rejects owner self-booking, inactive listings, invalid dates, and date overlap.

This removes Booking's direct Listing model read for booking creation.

## Review Compatibility Flow

The current monolith still stores review ids on listing documents. To remove direct Review-to-Listing model imports during Phase 5, Listing Service exposes temporary compatibility RPCs:

- `AddReviewReference`
- `RemoveReviewReference`

Flow:

1. Review route creates or deletes a review.
2. Gateway review service calls the Gateway listing adapter.
3. Gateway listing adapter calls the temporary Listing Service RPC.
4. Listing Service updates the listing `reviews` array.

Phase 7 should remove this write path when Review Service becomes the source of truth for reviews.

## Current Remaining Gateway Composition

Listing detail pages still require owner display data, review display data, and booked dates.

For now the Gateway composes:

- Listing data from Listing Service.
- Owner display data from Auth Service.
- Review cards from the current Review model.
- Booked dates from the current Booking model.

These are transitional joins. Phase 6 and Phase 7 should replace them with Booking Service and Review Service gRPC calls.
