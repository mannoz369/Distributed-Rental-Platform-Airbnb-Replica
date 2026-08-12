const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const listingService = require("./listing.service.js");

const protoPath = path.join(__dirname, "../../../packages/proto/listing.proto");

const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const listingProto = grpc.loadPackageDefinition(packageDefinition).wanderlust.listing.v1;

const toGrpcImage = (image) => ({
  url: image?.url || "",
  filename: image?.filename || "",
});

const toGrpcGeometry = (geometry) => ({
  type: geometry?.type || "Point",
  coordinates: geometry?.coordinates || [],
});

const toGrpcListing = (listing) => {
  if (!listing) {
    return null;
  }

  return {
    id: listing._id.toString(),
    title: listing.title || "",
    description: listing.description || "",
    image: toGrpcImage(listing.image),
    price: Number(listing.price || 0),
    location: listing.location || "",
    country: listing.country || "",
    owner_id: listing.owner?.toString() || "",
    geometry: toGrpcGeometry(listing.geometry),
    status: listing.status || "active",
    created_at: listing.createdAt ? listing.createdAt.toISOString() : "",
    updated_at: listing.updatedAt ? listing.updatedAt.toISOString() : "",
    review_ids: (listing.reviews || []).map((reviewId) => reviewId.toString()),
  };
};

const toServiceListingInput = (listing) => ({
  title: listing.title,
  description: listing.description,
  price: listing.price,
  location: listing.location,
  country: listing.country,
  image: toGrpcImage(listing.image),
});

const toGrpcError = (err) => {
  const statusByCode = {
    INVALID_ARGUMENT: grpc.status.INVALID_ARGUMENT,
    NOT_FOUND: grpc.status.NOT_FOUND,
    PERMISSION_DENIED: grpc.status.PERMISSION_DENIED,
  };

  return {
    code: statusByCode[err.code] || grpc.status.INTERNAL,
    message: err.message || "Unexpected listing service error",
  };
};

const wrapUnary = (handler) => async (call, callback) => {
  try {
    callback(null, await handler(call));
  } catch (err) {
    callback(toGrpcError(err));
  }
};

const implementation = {
  CreateListing: wrapUnary(async (call) => {
    const listing = await listingService.createListing({
      ownerId: call.request.owner_id,
      listingInput: toServiceListingInput(call.request.listing),
    });

    return { listing: toGrpcListing(listing) };
  }),

  UpdateListing: wrapUnary(async (call) => {
    const listing = await listingService.updateListing({
      id: call.request.listing_id,
      ownerId: call.request.owner_id,
      listingInput: toServiceListingInput(call.request.listing),
    });

    return { listing: toGrpcListing(listing) };
  }),

  DeleteListing: wrapUnary(async (call) => {
    await listingService.deleteListing({
      id: call.request.listing_id,
      ownerId: call.request.owner_id,
    });

    return { deleted: true, listing_id: call.request.listing_id };
  }),

  GetListing: wrapUnary(async (call) => {
    const listing = await listingService.findListingById(call.request.listing_id);
    if (!listing) {
      const error = new Error("Listing not found");
      error.code = "NOT_FOUND";
      throw error;
    }

    return { listing: toGrpcListing(listing) };
  }),

  SearchListings: wrapUnary(async (call) => {
    const result = await listingService.findListings({
      searchQuery: call.request.search_query,
      page: call.request.page || 1,
      pageSize: call.request.page_size || 100,
    });

    return {
      listings: result.listings.map(toGrpcListing),
      page: result.page,
      page_size: result.pageSize,
      total_count: result.totalCount,
    };
  }),

  GetOwnerListings: wrapUnary(async (call) => {
    const result = await listingService.findListingsByOwner({
      ownerId: call.request.owner_id,
      page: call.request.page || 1,
      pageSize: call.request.page_size || 100,
    });

    return {
      listings: result.listings.map(toGrpcListing),
      page: result.page,
      page_size: result.pageSize,
      total_count: result.totalCount,
    };
  }),

  GetListingForBooking: wrapUnary(async (call) => {
    const listing = await listingService.findListingById(call.request.listing_id);
    if (!listing) {
      const error = new Error("Listing not found");
      error.code = "NOT_FOUND";
      throw error;
    }

    return {
      listing_id: listing._id.toString(),
      title: listing.title || "",
      owner_id: listing.owner?.toString() || "",
      nightly_price: Number(listing.price || 0),
      status: listing.status || "active",
      active: (listing.status || "active") === "active",
    };
  }),

  AddReviewReference: wrapUnary(async (call) => {
    const listing = await listingService.addReviewReference({
      listingId: call.request.listing_id,
      reviewId: call.request.review_id,
    });

    return { listing: toGrpcListing(listing) };
  }),

  RemoveReviewReference: wrapUnary(async (call) => {
    const listing = await listingService.removeReviewReference({
      listingId: call.request.listing_id,
      reviewId: call.request.review_id,
    });

    return { listing: toGrpcListing(listing) };
  }),
};

const createServer = () => {
  const server = new grpc.Server();
  server.addService(listingProto.ListingService.service, implementation);
  return server;
};

module.exports = {
  createServer,
};
