const Review = require("./review.model.js");
const listingService = require("../listings/listing.service.js");

const createReview = async ({ listingId, reviewInput, authorId }) => {
  const listing = await listingService.findListingById(listingId);
  if (!listing) {
    const error = new Error("Listing not found");
    error.code = "NOT_FOUND";
    throw error;
  }

  const newReview = await Review(reviewInput);
  newReview.author = authorId;
  await newReview.save();
  await listingService.addReviewReference({ listingId, reviewId: newReview._id });
  return { listing, review: newReview };
};

const deleteReview = async ({ listingId, reviewId }) => {
  await listingService.removeReviewReference({ listingId, reviewId });
  return Review.findByIdAndDelete(reviewId);
};

module.exports = {
  createReview,
  deleteReview,
};
