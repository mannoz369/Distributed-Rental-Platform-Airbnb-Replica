# Review Service

Standalone gRPC service for review creation, deletion, listing review reads, and review summaries.

## Run Locally

From the repository root:

```powershell
npm run review-service
```

Defaults:

- gRPC address: `0.0.0.0:50054`
- Database URL: `REVIEW_DB_URL`, falling back to `ATLASDB_URL`
- Listing Service target: `LISTING_SERVICE_URL`, defaulting to `localhost:50052`

## Implemented RPCs

- `CreateReview`
- `DeleteReview`
- `GetListingReviews`
- `GetReviewSummary`

Review Service calls Listing Service to verify listing existence and to maintain temporary listing review references during migration.
