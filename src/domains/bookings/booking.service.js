const mongoose = require("mongoose");
const authService = require("../auth/auth.service.js");
const listingService = require("../listings/listing.service.js");
const bookingGrpcClient = require("./booking.grpc-client.js");

const objectId = (id) => new mongoose.Types.ObjectId(id);

const isNotFoundOrPermissionError = (err) => {
  return err?.code === 5 || err?.code === 7 || /NOT_FOUND|PERMISSION_DENIED/i.test(err?.message || "");
};

const getBookingErrorMessage = (err) => {
  return (err?.message || "Booking request failed.").replace(/^\d+\s+[A-Z_]+:\s*/, "");
};

const calculateBookingTotals = (nightlyPrice, nights) => {
  const subtotalPrice = nights * nightlyPrice;
  const gstAmount = Math.round(subtotalPrice * 0.18);
  return {
    subtotalPrice,
    gstAmount,
    totalPrice: subtotalPrice + gstAmount,
  };
};

const toGatewayUser = (user, fallbackId) => {
  if (user?._id) {
    return user;
  }

  return {
    _id: objectId(user?.id || fallbackId),
    id: user?.id || fallbackId,
    username: user?.username || "Unknown user",
    email: user?.email || "",
    role: user?.role || "guest",
  };
};

const toSnapshotListing = (booking) => ({
  _id: objectId(booking.listing_id),
  id: booking.listing_id,
  title: booking.listing_title_snapshot || "Deleted listing",
  price: Number(booking.nightly_price_snapshot || 0),
  location: "",
  country: "",
});

const toGatewayBooking = (booking) => {
  if (!booking?.id) {
    return null;
  }

  return {
    _id: objectId(booking.id),
    id: booking.id,
    listing: toSnapshotListing(booking),
    guest: objectId(booking.guest_id),
    owner: objectId(booking.owner_id),
    guestName: booking.guest_name_snapshot,
    guestEmail: booking.guest_email_snapshot,
    listingTitleSnapshot: booking.listing_title_snapshot,
    nightlyPriceSnapshot: Number(booking.nightly_price_snapshot || 0),
    checkIn: new Date(booking.check_in),
    checkOut: new Date(booking.check_out),
    nights: Number(booking.nights || 0),
    subtotalPrice: Number(booking.subtotal_price || 0),
    gstAmount: Number(booking.tax_amount || 0),
    totalPrice: Number(booking.total_price || 0),
    status: booking.status,
    ownerSeen: Boolean(booking.owner_seen),
    createdAt: booking.created_at,
    updatedAt: booking.updated_at,
  };
};

const hydrateBookingForDisplay = async (booking) => {
  if (!booking) {
    return booking;
  }

  const [listing, guest, owner] = await Promise.all([
    listingService.findListingById(booking.listing._id).catch(() => null),
    authService.getUser(booking.guest.toString()).catch(() => null),
    authService.getUser(booking.owner.toString()).catch(() => null),
  ]);

  booking.listing = listing || booking.listing;
  booking.guest = toGatewayUser(guest, booking.guest.toString());
  booking.owner = toGatewayUser(owner, booking.owner.toString());
  return booking;
};

const createBooking = async ({ listingId, user, bookingInput }) => {
  try {
    const response = await bookingGrpcClient.createBooking({
      listing_id: listingId.toString(),
      guest_id: user._id.toString(),
      guest_name: user.username,
      guest_email: user.email,
      check_in: bookingInput.checkIn,
      check_out: bookingInput.checkOut,
    });

    return { booking: toGatewayBooking(response.booking) };
  } catch (err) {
    return { error: getBookingErrorMessage(err) };
  }
};

const findBookingDetails = async (bookingId, requesterId) => {
  try {
    const response = await bookingGrpcClient.getBooking({
      booking_id: bookingId.toString(),
      requester_id: requesterId.toString(),
    });

    return hydrateBookingForDisplay(toGatewayBooking(response.booking));
  } catch (err) {
    if (isNotFoundOrPermissionError(err)) {
      return null;
    }

    throw err;
  }
};

const findGuestBookings = async (guestId) => {
  const response = await bookingGrpcClient.getGuestBookings({
    guest_id: guestId.toString(),
    page: 1,
    page_size: 100,
  });

  return Promise.all(response.bookings.map((booking) => hydrateBookingForDisplay(toGatewayBooking(booking))));
};

const findOwnerBookings = async (ownerId) => {
  const response = await bookingGrpcClient.getOwnerBookings({
    owner_id: ownerId.toString(),
    page: 1,
    page_size: 100,
  });

  return Promise.all(response.bookings.map((booking) => hydrateBookingForDisplay(toGatewayBooking(booking))));
};

const findBookingForGuest = async (bookingId, guestId) => {
  const booking = await findBookingDetails(bookingId, guestId);
  if (!booking || !booking.guest._id.equals(guestId)) {
    return null;
  }

  return booking;
};

const cancelBooking = async ({ bookingId, requesterId }) => {
  const response = await bookingGrpcClient.cancelBooking({
    booking_id: bookingId.toString(),
    requester_id: requesterId.toString(),
  });

  return hydrateBookingForDisplay(toGatewayBooking(response.booking));
};

const markBookingSeen = async ({ bookingId, requesterId }) => {
  const response = await bookingGrpcClient.markOwnerSeen({
    booking_id: bookingId.toString(),
    owner_id: requesterId.toString(),
  });

  return hydrateBookingForDisplay(toGatewayBooking(response.booking));
};

const getBookedDatesForListing = async (listingId) => {
  const response = await bookingGrpcClient.getBookedDates({
    listing_id: listingId.toString(),
  });

  return response.booked_dates;
};

const getBookingDisplayTotals = (booking) => {
  if (booking?.subtotalPrice || booking?.gstAmount || booking?.totalPrice) {
    return {
      subtotalPrice: Number(booking.subtotalPrice || 0),
      gstAmount: Number(booking.gstAmount || 0),
      totalPrice: Number(booking.totalPrice || 0),
    };
  }

  return calculateBookingTotals(Number(booking?.listing?.price || booking?.nightlyPriceSnapshot || 0), booking?.nights || 0);
};

const ensureBookingTotals = async (booking) => booking;

module.exports = {
  cancelBooking,
  createBooking,
  ensureBookingTotals,
  findBookingDetails,
  findBookingForGuest,
  findGuestBookings,
  findOwnerBookings,
  getBookedDatesForListing,
  getBookingDisplayTotals,
  markBookingSeen,
};
