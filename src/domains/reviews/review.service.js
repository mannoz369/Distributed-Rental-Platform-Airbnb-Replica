const mongoose = require("mongoose");
const authService = require("../auth/auth.service.js");
const reviewGrpcClient = require("./review.grpc-client.js");

const objectId = (id) => new mongoose.Types.ObjectId(id);

const getReviewErrorMessage = (err) => {
  return (err?.message || "Review request failed.").replace(/^\d+\s+[A-Z_]+:\s*/, "");
};

const toGatewayUser = (user, fallbackId, fallbackName = "Unknown user") => {
  if (user?._id) {
    return user;
  }

  return {
    _id: objectId(user?.id || fallbackId),
    id: user?.id || fallbackId,
    username: user?.username || fallbackName,
    email: user?.email || "",
    role: user?.role || "guest",
  };
};

const toGatewayReview = (review) => {
  if (!review?.id) {
    return null;
  }

  return {
    _id: objectId(review.id),
    id: review.id,
    listing: review.listing_id ? objectId(review.listing_id) : undefined,
    author: objectId(review.author_id),
    authorNameSnapshot: review.author_name_snapshot,
    rating: Number(review.rating || 0),
    comment: review.comment,
    createdAt: review.created_at ? new Date(review.created_at) : undefined,
    updatedAt: review.updated_at ? new Date(review.updated_at) : undefined,
  };
};

const hydrateReviewForDisplay = async (review) => {
  if (!review) {
    return review;
  }

  const author = await authService.getUser(review.author.toString()).catch(() => null);
  review.author = toGatewayUser(author, review.author.toString(), review.authorNameSnapshot);
  return review;
};

const createReview = async ({ listingId, reviewInput, authorId, authorName }) => {
  try {
    const response = await reviewGrpcClient.createReview({
      listing_id: listingId.toString(),
      author_id: authorId.toString(),
      author_name: authorName || "",
      rating: Number(reviewInput.rating),
      comment: reviewInput.comment,
    });

    return { review: await hydrateReviewForDisplay(toGatewayReview(response.review)) };
  } catch (err) {
    return { error: getReviewErrorMessage(err) };
  }
};

const deleteReview = async ({ listingId, reviewId, requesterId }) => {
  try {
    await reviewGrpcClient.deleteReview({
      listing_id: listingId.toString(),
      review_id: reviewId.toString(),
      requester_id: requesterId.toString(),
    });

    return { deleted: true };
  } catch (err) {
    return { error: getReviewErrorMessage(err) };
  }
};

const getListingReviews = async (listingId) => {
  const response = await reviewGrpcClient.getListingReviews({
    listing_id: listingId.toString(),
    page: 1,
    page_size: 100,
  });

  return Promise.all(response.reviews.map((review) => hydrateReviewForDisplay(toGatewayReview(review))));
};

const getReviewSummary = async (listingId) => {
  return reviewGrpcClient.getReviewSummary({ listing_id: listingId.toString() });
};

module.exports = {
  createReview,
  deleteReview,
  getListingReviews,
  getReviewSummary,
};
