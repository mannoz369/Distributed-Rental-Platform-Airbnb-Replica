const mongoose = require("mongoose");
const Review = require("./review.model.js");
const listingGrpcClient = require("./listing.grpc-client.js");

const objectIds = (ids = []) => ids.filter(Boolean).map((id) => new mongoose.Types.ObjectId(id));

const getListingOrThrow = async (listingId) => {
  try {
    const response = await listingGrpcClient.getListing({ listing_id: listingId });
    return response.listing;
  } catch (err) {
    if (err?.code !== 5) {
      throw err;
    }

    const error = new Error("Listing not found");
    error.code = "NOT_FOUND";
    throw error;
  }
};

const createReview = async ({ listingId, authorId, authorName, rating, comment }) => {
  await getListingOrThrow(listingId);

  const review = new Review({
    listing: listingId,
    author: authorId,
    authorNameSnapshot: authorName,
    rating,
    comment,
  });

  await review.save();
  await listingGrpcClient.addReviewReference({
    listing_id: listingId,
    review_id: review._id.toString(),
  });

  return review;
};

const getListingReviews = async ({ listingId, page = 1, pageSize = 100 }) => {
  const listing = await getListingOrThrow(listingId);
  const reviewIds = objectIds(listing.review_ids || []);
  const query =
    reviewIds.length > 0
      ? { $or: [{ listing: listingId }, { _id: { $in: reviewIds } }] }
      : { listing: listingId };
  const skip = Math.max(Number(page) - 1, 0) * Number(pageSize);

  const [reviews, totalCount] = await Promise.all([
    Review.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(pageSize)),
    Review.countDocuments(query),
  ]);

  return { reviews, page: Number(page), pageSize: Number(pageSize), totalCount };
};

const deleteReview = async ({ listingId, reviewId, requesterId }) => {
  const review = await Review.findById(reviewId);
  if (!review) {
    const error = new Error("Review not found");
    error.code = "NOT_FOUND";
    throw error;
  }

  if (!review.author.equals(requesterId)) {
    const error = new Error("You can't delete this review");
    error.code = "PERMISSION_DENIED";
    throw error;
  }

  await listingGrpcClient.removeReviewReference({
    listing_id: listingId,
    review_id: reviewId,
  });
  await Review.findByIdAndDelete(reviewId);

  return true;
};

const getReviewSummary = async (listingId) => {
  const { reviews } = await getListingReviews({ listingId, page: 1, pageSize: 1000 });
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount === 0
      ? 0
      : reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewCount;

  return {
    listingId,
    averageRating,
    reviewCount,
  };
};

module.exports = {
  createReview,
  deleteReview,
  getListingReviews,
  getReviewSummary,
};
