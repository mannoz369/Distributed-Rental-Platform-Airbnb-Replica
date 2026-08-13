# Review Service Extraction Flow

Phase 7 extracts review creation, deletion, listing review reads, and review summaries into `services/review-service`.

## Processes

Gateway / existing Express app:

- Run with `npm start`.
- Keeps EJS rendering, flash messages, redirects, auth cookies, and form validation.
- Calls Review Service over gRPC through `src/domains/reviews/review.grpc-client.js`.

Review Service:

- Run with `npm run review-service`.
- Implements `packages/proto/review.proto`.
- Owns review persistence, review author permission checks, listing review reads, and review summaries.
- Calls Listing Service to verify listing existence.
- Temporarily calls Listing Service review-reference RPCs while listing pages still carry transitional `review_ids`.

Defaults:

- Gateway target: `REVIEW_SERVICE_URL=localhost:50054`.
- Review Service host: `REVIEW_SERVICE_HOST=0.0.0.0`.
- Review Service port: `REVIEW_SERVICE_PORT=50054`.
- Review database: `REVIEW_DB_URL`, falling back to `ATLASDB_URL`.
- Listing Service target from Review Service: `LISTING_SERVICE_URL=localhost:50052`.

## Create Review Flow

1. Browser submits `POST /listings/:id/reviews`.
2. Gateway route runs JWT auth and Joi review validation.
3. `src/domains/reviews/review.controller.js` calls `review.service.createReview`.
4. Gateway adapter calls `ReviewService.CreateReview`.
5. `services/review-service/src/grpc.js` receives `CreateReviewRequest`.
6. Review Service calls `ListingService.GetListing` to verify listing existence.
7. Review Service saves review data with `listing`, `author`, `authorNameSnapshot`, `rating`, and `comment`.
8. Review Service calls temporary `ListingService.AddReviewReference`.
9. gRPC returns `ReviewResponse`.
10. Gateway redirects to the listing detail page.

## Listing Reviews Flow

1. Browser requests `GET /listings/:id`.
2. Gateway listing adapter calls `ListingService.GetListing`.
3. Gateway listing adapter calls `ReviewService.GetListingReviews`.
4. Review Service reads reviews by `listing`.
5. During migration, Review Service also supports legacy review ids returned by Listing Service `review_ids`.
6. Gateway hydrates review authors from Auth Service for EJS display.
7. Gateway renders `views/listings/show.ejs`.

## Delete Review Flow

1. Browser submits `DELETE /listings/:id/reviews/:reviewId`.
2. Gateway route requires login but no longer performs direct Review model author checks.
3. Gateway adapter calls `ReviewService.DeleteReview`.
4. Review Service loads the review and verifies `requester_id` matches the review author.
5. Review Service calls temporary `ListingService.RemoveReviewReference`.
6. Review Service deletes the review.
7. Gateway redirects to the listing detail page.

## Review Summary Flow

1. Gateway or future Listing Service read model calls `ReviewService.GetReviewSummary`.
2. Review Service computes average rating and count for the listing.
3. Later Kafka events can maintain these values as a Listing Service read model.

## Boundary

Review Service owns:

- Review documents.
- Review author permission checks.
- Listing review reads.
- Review summaries.

Review Service does not read Listing DB or Auth DB directly. It calls Listing Service over gRPC for listing existence and the Gateway hydrates author display data through Auth Service.

The temporary Listing Service review-reference RPCs should be removed from normal flows once listing pages stop depending on listing-owned `review_ids`.
