const mongoose = require("mongoose");
const Booking = require("../bookings/booking.model.js");
const Review = require("../reviews/review.model.js");
const authService = require("../auth/auth.service.js");
const listingGrpcClient = require("./listing.grpc-client.js");

const formatDateKey = (date) => {
  const localDate = new Date(date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const objectId = (id) => new mongoose.Types.ObjectId(id);

const isNotFoundError = (err) => {
  return err?.code === 5 || /NOT_FOUND/i.test(err?.message || "");
};

const toGatewayUser = (user) => ({
  _id: objectId(user.id),
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role || "guest",
});

const toGatewayListing = (listing) => {
  if (!listing?.id) {
    return null;
  }

  const ownerId = listing.owner_id ? objectId(listing.owner_id) : undefined;
  return {
    _id: objectId(listing.id),
    id: listing.id,
    title: listing.title,
    description: listing.description,
    image: listing.image,
    price: Number(listing.price || 0),
    location: listing.location,
    country: listing.country,
    owner: ownerId,
    geometry: listing.geometry,
    status: listing.status || "active",
    createdAt: listing.created_at,
    updatedAt: listing.updated_at,
    reviews: (listing.review_ids || []).map(objectId),
  };
};

const toGrpcListingInput = ({ listingInput, image }) => ({
  title: listingInput.title,
  description: listingInput.description,
  price: Number(listingInput.price),
  location: listingInput.location,
  country: listingInput.country,
  image: image || listingInput.image || {},
});

const findListings = async (searchQuery = "") => {
  const response = await listingGrpcClient.searchListings({
    search_query: searchQuery,
    page: 1,
    page_size: 100,
  });

  return response.listings.map(toGatewayListing);
};

const findListingsByOwner = async (ownerId) => {
  const response = await listingGrpcClient.getOwnerListings({
    owner_id: ownerId.toString(),
    page: 1,
    page_size: 100,
  });

  return response.listings.map(toGatewayListing);
};

const findListingById = async (id) => {
  try {
    const response = await listingGrpcClient.getListing({ listing_id: id.toString() });
    return toGatewayListing(response.listing);
  } catch (err) {
    if (isNotFoundError(err)) {
      return null;
    }

    throw err;
  }
};

const findListingDetails = async (id) => {
  const listing = await findListingById(id);
  if (!listing) {
    return null;
  }

  const [owner, reviews] = await Promise.all([
    authService.getUser(listing.owner.toString()).catch(() => null),
    Review.find({ _id: { $in: listing.reviews || [] } }).populate("author"),
  ]);

  listing.owner = owner || { _id: listing.owner, username: "Unknown host", email: "" };
  listing.reviews = reviews;
  return listing;
};

const getBookedDatesForListing = async (listingId) => {
  const bookings = await Booking.find({
    listing: listingId,
    status: "confirmed",
  }).select("checkIn checkOut");

  return bookings.flatMap((booking) => {
    const dates = [];
    const cursor = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);

    while (cursor <= checkOut) {
      dates.push(formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  });
};

const createListing = async ({ listingInput, ownerId, image }) => {
  const response = await listingGrpcClient.createListing({
    owner_id: ownerId.toString(),
    listing: toGrpcListingInput({ listingInput, image }),
  });

  return toGatewayListing(response.listing);
};

const updateListing = async ({ id, ownerId, listingInput, image }) => {
  const currentListing = await findListingById(id);
  const response = await listingGrpcClient.updateListing({
    listing_id: id.toString(),
    owner_id: ownerId.toString(),
    listing: toGrpcListingInput({
      listingInput,
      image: image || currentListing?.image,
    }),
  });

  return toGatewayListing(response.listing);
};

const deleteListing = ({ id, ownerId }) => {
  return listingGrpcClient.deleteListing({
    listing_id: id.toString(),
    owner_id: ownerId.toString(),
  });
};

const getListingForBooking = async (listingId) => {
  return listingGrpcClient.getListingForBooking({ listing_id: listingId.toString() });
};

const addReviewReference = async ({ listingId, reviewId }) => {
  const response = await listingGrpcClient.addReviewReference({
    listing_id: listingId.toString(),
    review_id: reviewId.toString(),
  });

  return toGatewayListing(response.listing);
};

const removeReviewReference = async ({ listingId, reviewId }) => {
  const response = await listingGrpcClient.removeReviewReference({
    listing_id: listingId.toString(),
    review_id: reviewId.toString(),
  });

  return toGatewayListing(response.listing);
};

module.exports = {
  addReviewReference,
  createListing,
  deleteListing,
  findListingById,
  findListingDetails,
  findListings,
  findListingsByOwner,
  getListingForBooking,
  getBookedDatesForListing,
  removeReviewReference,
  updateListing,
};
