const grpc = require("@grpc/grpc-js");
const env = require("../../config/env.js");
const loadProto = require("../../shared/grpc/loadProto.js");

const reviewProto = loadProto("review.proto").wanderlust.review.v1;
const target = env.REVIEW_SERVICE_URL || "localhost:50054";
const client = new reviewProto.ReviewService(target, grpc.credentials.createInsecure());

const unary = (methodName, request) => {
  return new Promise((resolve, reject) => {
    client[methodName](request, (err, response) => {
      if (err) {
        return reject(err);
      }

      resolve(response);
    });
  });
};

module.exports = {
  createReview: (request) => unary("CreateReview", request),
  deleteReview: (request) => unary("DeleteReview", request),
  getListingReviews: (request) => unary("GetListingReviews", request),
  getReviewSummary: (request) => unary("GetReviewSummary", request),
};
