const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const reviewService = require("./review.service.js");

const protoPath = path.join(__dirname, "../../../packages/proto/review.proto");

const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const reviewProto = grpc.loadPackageDefinition(packageDefinition).wanderlust.review.v1;

const toIsoDate = (date) => (date ? new Date(date).toISOString() : "");

const toGrpcReview = (review) => {
  if (!review) {
    return null;
  }

  return {
    id: review._id.toString(),
    listing_id: review.listing?.toString() || "",
    author_id: review.author?.toString() || "",
    author_name_snapshot: review.authorNameSnapshot || "",
    rating: Number(review.rating || 0),
    comment: review.comment || "",
    created_at: toIsoDate(review.createdAt),
    updated_at: toIsoDate(review.updatedAt),
  };
};

const toGrpcError = (err) => {
  const statusByCode = {
    INVALID_ARGUMENT: grpc.status.INVALID_ARGUMENT,
    NOT_FOUND: grpc.status.NOT_FOUND,
    PERMISSION_DENIED: grpc.status.PERMISSION_DENIED,
  };

  return {
    code: statusByCode[err.code] || grpc.status.INTERNAL,
    message: err.message || "Unexpected review service error",
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
  CreateReview: wrapUnary(async (call) => {
    const review = await reviewService.createReview({
      listingId: call.request.listing_id,
      authorId: call.request.author_id,
      authorName: call.request.author_name,
      rating: call.request.rating,
      comment: call.request.comment,
    });
    return { review: toGrpcReview(review) };
  }),

  DeleteReview: wrapUnary(async (call) => {
    await reviewService.deleteReview({
      listingId: call.request.listing_id,
      reviewId: call.request.review_id,
      requesterId: call.request.requester_id,
    });
    return {
      deleted: true,
      review_id: call.request.review_id,
    };
  }),

  GetListingReviews: wrapUnary(async (call) => {
    const result = await reviewService.getListingReviews({
      listingId: call.request.listing_id,
      page: call.request.page || 1,
      pageSize: call.request.page_size || 100,
    });

    return {
      reviews: result.reviews.map(toGrpcReview),
      page: result.page,
      page_size: result.pageSize,
      total_count: result.totalCount,
    };
  }),

  GetReviewSummary: wrapUnary(async (call) => {
    const summary = await reviewService.getReviewSummary(call.request.listing_id);
    return {
      listing_id: summary.listingId,
      average_rating: summary.averageRating,
      review_count: summary.reviewCount,
    };
  }),
};

const createServer = () => {
  const server = new grpc.Server();
  server.addService(reviewProto.ReviewService.service, implementation);
  return server;
};

module.exports = {
  createServer,
};
