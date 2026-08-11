const Review = require("./review.model.js");
const Listing = require("../listings/listing.model.js");

const createReview = async ({ listingId, reviewInput, authorId }) => {
  const listing = await Listing.findById(listingId);
  const newReview = await Review(reviewInput);
  newReview.author = authorId;
  listing.reviews.push(newReview);
  await newReview.save();
  await listing.save();
  return { listing, review: newReview };
};

const deleteReview = async ({ listingId, reviewId }) => {
  await Listing.findByIdAndUpdate(listingId, { $pull: { reviews: reviewId } });
  return Review.findByIdAndDelete(reviewId);
};

module.exports = {
  createReview,
  deleteReview,
};
