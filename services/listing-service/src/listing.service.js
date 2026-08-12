const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const Listing = require("./listing.model.js");
const env = require("./config/env.js");

const geocodingClient = mbxGeocoding({ accessToken: env.MAP_TOKEN });

const buildListingFilter = (searchQuery) => {
  const filter = { status: { $ne: "deleted" } };

  if (!searchQuery) {
    return filter;
  }

  const escapedSearch = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const searchRegex = new RegExp(escapedSearch, "i");
  return {
    ...filter,
    $or: [{ location: searchRegex }, { country: searchRegex }],
  };
};

const geocodeLocation = async (location) => {
  const response = await geocodingClient
    .forwardGeocode({
      query: location,
      limit: 1,
    })
    .send();

  if (!response.body.features.length) {
    const error = new Error("Could not geocode listing location");
    error.code = "INVALID_ARGUMENT";
    throw error;
  }

  return response.body.features[0].geometry;
};

const findListings = async ({ searchQuery = "", page = 1, pageSize = 100 } = {}) => {
  const filter = buildListingFilter(searchQuery);
  const skip = Math.max(Number(page) - 1, 0) * Number(pageSize);
  const [listings, totalCount] = await Promise.all([
    Listing.find(filter).skip(skip).limit(Number(pageSize)),
    Listing.countDocuments(filter),
  ]);

  return { listings, page: Number(page), pageSize: Number(pageSize), totalCount };
};

const findListingsByOwner = async ({ ownerId, page = 1, pageSize = 100 }) => {
  const filter = { owner: ownerId, status: { $ne: "deleted" } };
  const skip = Math.max(Number(page) - 1, 0) * Number(pageSize);
  const [listings, totalCount] = await Promise.all([
    Listing.find(filter).skip(skip).limit(Number(pageSize)),
    Listing.countDocuments(filter),
  ]);

  return { listings, page: Number(page), pageSize: Number(pageSize), totalCount };
};

const findListingById = (id) => {
  return Listing.findOne({ _id: id, status: { $ne: "deleted" } });
};

const createListing = async ({ listingInput, ownerId }) => {
  const newListing = new Listing({
    ...listingInput,
    owner: ownerId,
    image: listingInput.image,
    geometry: await geocodeLocation(listingInput.location),
  });

  return newListing.save();
};

const updateListing = async ({ id, listingInput, ownerId }) => {
  const listing = await findListingById(id);
  if (!listing) {
    const error = new Error("Listing not found");
    error.code = "NOT_FOUND";
    throw error;
  }

  if (!listing.owner.equals(ownerId)) {
    const error = new Error("You do not have permission to update this listing");
    error.code = "PERMISSION_DENIED";
    throw error;
  }

  listing.title = listingInput.title;
  listing.description = listingInput.description;
  listing.price = listingInput.price;
  listing.location = listingInput.location;
  listing.country = listingInput.country;
  listing.geometry = await geocodeLocation(listingInput.location);

  if (listingInput.image?.url) {
    listing.image = listingInput.image;
  }

  return listing.save();
};

const deleteListing = async ({ id, ownerId }) => {
  const listing = await findListingById(id);
  if (!listing) {
    const error = new Error("Listing not found");
    error.code = "NOT_FOUND";
    throw error;
  }

  if (!listing.owner.equals(ownerId)) {
    const error = new Error("You do not have permission to delete this listing");
    error.code = "PERMISSION_DENIED";
    throw error;
  }

  listing.status = "deleted";
  await listing.save();
  return listing;
};

const addReviewReference = async ({ listingId, reviewId }) => {
  const listing = await Listing.findByIdAndUpdate(
    listingId,
    { $addToSet: { reviews: reviewId } },
    { new: true }
  );

  if (!listing) {
    const error = new Error("Listing not found");
    error.code = "NOT_FOUND";
    throw error;
  }

  return listing;
};

const removeReviewReference = async ({ listingId, reviewId }) => {
  const listing = await Listing.findByIdAndUpdate(
    listingId,
    { $pull: { reviews: reviewId } },
    { new: true }
  );

  if (!listing) {
    const error = new Error("Listing not found");
    error.code = "NOT_FOUND";
    throw error;
  }

  return listing;
};

module.exports = {
  addReviewReference,
  createListing,
  deleteListing,
  findListingById,
  findListings,
  findListingsByOwner,
  removeReviewReference,
  updateListing,
};
