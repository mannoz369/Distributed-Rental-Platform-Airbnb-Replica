const Booking = require("./booking.model.js");
const listingGrpcClient = require("./listing.grpc-client.js");
const bookingEvents = require("./booking.events.js");

const calculateBookingTotals = (nightlyPrice, nights) => {
  const subtotalPrice = nights * nightlyPrice;
  const taxAmount = Math.round(subtotalPrice * 0.18);
  return {
    subtotalPrice,
    taxAmount,
    totalPrice: subtotalPrice + taxAmount,
  };
};

const formatDateKey = (date) => {
  const localDate = new Date(date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

const checkAvailability = async ({ listingId, checkIn, checkOut }) => {
  const normalizedCheckIn = toDateOnly(checkIn);
  const normalizedCheckOut = toDateOnly(checkOut);
  const today = toDateOnly(new Date());

  if (normalizedCheckIn < today || normalizedCheckOut <= normalizedCheckIn) {
    return {
      available: false,
      reason: "Please choose valid future check-in and check-out dates.",
    };
  }

  const overlappingBooking = await findOverlappingBooking(
    listingId,
    normalizedCheckIn,
    normalizedCheckOut
  );

  if (overlappingBooking) {
    return {
      available: false,
      reason: "This property is already booked for those dates.",
    };
  }

  return { available: true, reason: "" };
};

const createBooking = async ({ listingId, guestId, guestName, guestEmail, checkIn, checkOut }) => {
  let listing;
  try {
    listing = await listingGrpcClient.getListingForBooking({ listing_id: listingId });
  } catch (err) {
    const error = new Error("Listing requested not found!");
    error.code = "NOT_FOUND";
    throw error;
  }

  if (listing.owner_id === guestId) {
    const error = new Error("Owners can't book their own listing.");
    error.code = "FAILED_PRECONDITION";
    throw error;
  }

  if (!listing.active) {
    const error = new Error("This listing is not available for booking.");
    error.code = "FAILED_PRECONDITION";
    throw error;
  }

  const availability = await checkAvailability({ listingId, checkIn, checkOut });
  if (!availability.available) {
    const error = new Error(availability.reason);
    error.code = availability.reason.includes("already booked") ? "ABORTED" : "INVALID_ARGUMENT";
    throw error;
  }

  const normalizedCheckIn = toDateOnly(checkIn);
  const normalizedCheckOut = toDateOnly(checkOut);
  const nights = Math.ceil((normalizedCheckOut - normalizedCheckIn) / (1000 * 60 * 60 * 24));
  const { subtotalPrice, taxAmount, totalPrice } = calculateBookingTotals(
    Number(listing.nightly_price),
    nights
  );

  const booking = new Booking({
    listing: listing.listing_id,
    guest: guestId,
    owner: listing.owner_id,
    guestName,
    guestEmail,
    listingTitleSnapshot: listing.title,
    nightlyPriceSnapshot: listing.nightly_price,
    checkIn: normalizedCheckIn,
    checkOut: normalizedCheckOut,
    nights,
    subtotalPrice,
    gstAmount: taxAmount,
    totalPrice,
  });

  await booking.save();
  await bookingEvents.publishBookingCreated(booking);
  return booking;
};

const findBookingById = (bookingId) => {
  return Booking.findById(bookingId);
};

const getBookingForRequester = async ({ bookingId, requesterId }) => {
  const booking = await findBookingById(bookingId);
  if (!booking) {
    const error = new Error("Booking not found.");
    error.code = "NOT_FOUND";
    throw error;
  }

  if (!booking.guest.equals(requesterId) && !booking.owner.equals(requesterId)) {
    const error = new Error("Booking not found.");
    error.code = "PERMISSION_DENIED";
    throw error;
  }

  return booking;
};

const getGuestBookings = async ({ guestId, page = 1, pageSize = 100 }) => {
  const skip = Math.max(Number(page) - 1, 0) * Number(pageSize);
  const [bookings, totalCount] = await Promise.all([
    Booking.find({ guest: guestId }).sort({ createdAt: -1 }).skip(skip).limit(Number(pageSize)),
    Booking.countDocuments({ guest: guestId }),
  ]);

  return { bookings, page: Number(page), pageSize: Number(pageSize), totalCount };
};

const getOwnerBookings = async ({ ownerId, page = 1, pageSize = 100 }) => {
  const skip = Math.max(Number(page) - 1, 0) * Number(pageSize);
  const [bookings, totalCount] = await Promise.all([
    Booking.find({ owner: ownerId }).sort({ createdAt: -1 }).skip(skip).limit(Number(pageSize)),
    Booking.countDocuments({ owner: ownerId }),
  ]);

  return { bookings, page: Number(page), pageSize: Number(pageSize), totalCount };
};

const cancelBooking = async ({ bookingId, requesterId }) => {
  const booking = await getBookingForRequester({ bookingId, requesterId });

  if (!booking.guest.equals(requesterId)) {
    const error = new Error("Booking not found.");
    error.code = "PERMISSION_DENIED";
    throw error;
  }

  if (booking.status === "cancelled") {
    const error = new Error("This booking is already cancelled.");
    error.code = "FAILED_PRECONDITION";
    throw error;
  }

  booking.status = "cancelled";
  booking.ownerSeen = false;
  await booking.save();
  await bookingEvents.publishBookingCancelled(booking);
  return booking;
};

const markBookingSeen = async ({ bookingId, requesterId }) => {
  const booking = await getBookingForRequester({ bookingId, requesterId });

  if (!booking.owner.equals(requesterId)) {
    const error = new Error("Booking not found.");
    error.code = "PERMISSION_DENIED";
    throw error;
  }

  booking.ownerSeen = true;
  await booking.save();
  return booking;
};

const getBookedDates = async (listingId) => {
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

module.exports = {
  cancelBooking,
  checkAvailability,
  createBooking,
  getBookedDates,
  getBookingForRequester,
  getGuestBookings,
  getOwnerBookings,
  markBookingSeen,
};
