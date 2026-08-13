const grpc = require("@grpc/grpc-js");
const env = require("./config/env.js");
const loadProto = require("./loadProto.js");

const listingProto = loadProto("listing.proto").wanderlust.listing.v1;
const target = env.LISTING_SERVICE_URL || "localhost:50052";
const client = new listingProto.ListingService(target, grpc.credentials.createInsecure());

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
  addReviewReference: (request) => unary("AddReviewReference", request),
  getListing: (request) => unary("GetListing", request),
  removeReviewReference: (request) => unary("RemoveReviewReference", request),
};
