const Booking = require("./booking.model.js");
const listingService = require("../listings/listing.service.js");

const calculateBookingTotals = (nightlyPrice, nights) => {
  const subtotalPrice = nights * nightlyPrice;
  const gstAmount = Math.round(subtotalPrice * 0.18);
  return {
    subtotalPrice,
    gstAmount,
    totalPrice: subtotalPrice + gstAmount,
  };
};

const getBookingDisplayTotals = (booking) => {
  if (booking?.listing?.price && booking?.nights) {
    return calculateBookingTotals(Number(booking.listing.price), booking.nights);
  }

  const subtotalPrice = Number(booking?.subtotalPrice || booking?.totalPrice || 0);
  const gstAmount = Number(booking?.gstAmount || Math.round(subtotalPrice * 0.18));
  return {
    subtotalPrice,
    gstAmount,
    totalPrice: subtotalPrice + gstAmount,
  };
};

const ensureBookingTotals = async (booking) => {
  if (!booking) {
    return booking;
  }

  const totals = getBookingDisplayTotals(booking);
  const hasStaleTotals =
    booking.subtotalPrice !== totals.subtotalPrice ||
    booking.gstAmount !== totals.gstAmount ||
    booking.totalPrice !== totals.totalPrice;

  if (hasStaleTotals) {
    booking.subtotalPrice = totals.subtotalPrice;
    booking.gstAmount = totals.gstAmount;
    booking.totalPrice = totals.totalPrice;
    await booking.save({ validateBeforeSave: false });
  }

  return booking;
};

const toDateOnly = (value) => {
  if (typeof value === "string" && value.includes("-")) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const findOverlappingBooking = (listingId, checkIn, checkOut) => {
  return Booking.findOne({
    listing: listingId,
    status: "confirmed",
    checkIn: { $lte: checkOut },
    checkOut: { $gte: checkIn },
  });
};

const createBooking = async ({ listingId, user, bookingInput }) => {
  let listing;
  try {
    listing = await listingService.getListingForBooking(listingId);
  } catch (err) {
    listing = null;
  }

  if (!listing) {
    return { error: "Listing requested not found!" };
  }

  if (listing.owner_id === user._id.toString()) {
    return { error: "Owners can't book their own listing." };
  }

  if (!listing.active) {
    return { error: "This listing is not available for booking." };
  }

  const checkIn = toDateOnly(bookingInput.checkIn);
  const checkOut = toDateOnly(bookingInput.checkOut);
  const today = toDateOnly(new Date());

  if (checkIn < today || checkOut <= checkIn) {
    return { error: "Please choose valid future check-in and check-out dates." };
  }

  const overlappingBooking = await findOverlappingBooking(listingId, checkIn, checkOut);
  if (overlappingBooking) {
    return { error: "This property is already booked for those dates." };
  }

  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  const { subtotalPrice, gstAmount, totalPrice } = calculateBookingTotals(
    Number(listing.nightly_price),
    nights
  );

  const booking = new Booking({
    listing: listing.listing_id,
    guest: user._id,
    owner: listing.owner_id,
    guestName: user.username,
    guestEmail: user.email,
    checkIn,
    checkOut,
    nights,
    subtotalPrice,
    gstAmount,
    totalPrice,
  });

  await booking.save();
  return { booking };
};

const findBookingDetails = (bookingId) => {
  return Booking.findById(bookingId).populate("listing").populate("guest").populate("owner");
};

const findGuestBookings = (guestId) => {
  return Booking.find({ guest: guestId }).populate("listing").sort({ createdAt: -1 });
};

const findBookingForGuest = (bookingId) => {
  return Booking.findById(bookingId).populate("listing");
};

const cancelBooking = async (booking) => {
  booking.status = "cancelled";
  booking.ownerSeen = false;
  return booking.save();
};

const findOwnerBookings = (ownerId) => {
  return Booking.find({ owner: ownerId })
    .populate("listing")
    .populate("guest")
    .sort({ createdAt: -1 });
};

const markBookingSeen = async (booking) => {
  booking.ownerSeen = true;
  return booking.save();
};

module.exports = {
  cancelBooking,
  createBooking,
  ensureBookingTotals,
  findBookingDetails,
  findBookingForGuest,
  findGuestBookings,
  findOwnerBookings,
  getBookingDisplayTotals,
  markBookingSeen,
};
