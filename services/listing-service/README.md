# Listing Service

Standalone gRPC service for listing ownership, CRUD, search, image metadata, and Mapbox geocoding.

## Run Locally

From the repository root:

```powershell
npm run listing-service
```

Defaults:

- gRPC address: `0.0.0.0:50052`
- Database URL: `LISTING_DB_URL`, falling back to `ATLASDB_URL`
- Mapbox token: `MAP_TOKEN`

## Implemented RPCs

- `CreateListing`
- `UpdateListing`
- `DeleteListing`
- `GetListing`
- `SearchListings`
- `GetOwnerListings`
- `GetListingForBooking`
- `AddReviewReference` temporary compatibility RPC
- `RemoveReviewReference` temporary compatibility RPC

`AddReviewReference` and `RemoveReviewReference` exist only while reviews are still coupled through the listing `reviews` array. Phase 7 should remove them from normal write paths.
