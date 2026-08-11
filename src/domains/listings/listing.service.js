const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const Listing = require("./listing.model.js");
const Booking = require("../bookings/booking.model.js");
const env = require("../../config/env.js");

const geocodingClient = mbxGeocoding({ accessToken: env.MAP_TOKEN });

const formatDateKey = (date) => {
  const localDate = new Date(date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildListingFilter = (searchQuery) => {
  if (!searchQuery) {
    return {};
  }

  const escapedSearch = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const searchRegex = new RegExp(escapedSearch, "i");
  return {
    $or: [{ location: searchRegex }, { country: searchRegex }],
  };
};

const findListings = (searchQuery = "") => {
  return Listing.find(buildListingFilter(searchQuery));
};

const findListingsByOwner = (ownerId) => {
  return Listing.find({ owner: ownerId });
};

const findListingById = (id) => {
  return Listing.findById(id);
};

const findListingDetails = (id) => {
  return Listing.findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");
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

const geocodeLocation = async (location) => {
  const response = await geocodingClient
    .forwardGeocode({
      query: location,
      limit: 1,
    })
    .send();

  return response.body.features[0].geometry;
};

const createListing = async ({ listingInput, ownerId, image }) => {
  const newListing = new Listing(listingInput);
  newListing.owner = ownerId;
  newListing.image = image;
  newListing.geometry = await geocodeLocation(listingInput.location);
  return newListing.save();
};

const updateListing = async ({ id, listingInput, image }) => {
  const listing = await Listing.findByIdAndUpdate(id, { ...listingInput });
  listing.geometry = await geocodeLocation(listingInput.location);

  if (image) {
    listing.image = image;
  }

  return listing.save();
};

const deleteListing = (id) => {
  return Listing.findByIdAndDelete(id);
};

module.exports = {
  createListing,
  deleteListing,
  findListingById,
  findListingDetails,
  findListings,
  findListingsByOwner,
  getBookedDatesForListing,
  updateListing,
};
