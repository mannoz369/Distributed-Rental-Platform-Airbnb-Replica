const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");

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

const getBookedDates = (booking) => {
  const dates = [];
  const cursor = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);

  while (cursor <= checkOut) {
    dates.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const findOverlappingBooking = (listingId, checkIn, checkOut) => {
  return Booking.findOne({
    listing: listingId,
    status: "confirmed",
    checkIn: { $lte: checkOut },
    checkOut: { $gte: checkIn },
  });
};

module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id).populate("owner");

  if (!listing) {
    req.flash("error", "Listing requested not found!");
    return res.redirect("/listings");
  }

  if (listing.owner._id.equals(req.user._id)) {
    req.flash("error", "Owners can't book their own listing.");
    return res.redirect(`/listings/${id}`);
  }

  const checkIn = toDateOnly(req.body.booking.checkIn);
  const checkOut = toDateOnly(req.body.booking.checkOut);
  const today = toDateOnly(new Date());

  if (checkIn < today || checkOut <= checkIn) {
    req.flash("error", "Please choose valid future check-in and check-out dates.");
    return res.redirect(`/listings/${id}`);
  }

  const overlappingBooking = await findOverlappingBooking(id, checkIn, checkOut);
  if (overlappingBooking) {
    req.flash("error", "This property is already booked for those dates.");
    return res.redirect(`/listings/${id}`);
  }

  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  const { subtotalPrice, gstAmount, totalPrice } = calculateBookingTotals(
    Number(listing.price),
    nights
  );

  const booking = new Booking({
    listing: listing._id,
    guest: req.user._id,
    owner: listing.owner._id,
    guestName: req.user.username,
    guestEmail: req.user.email,
    checkIn,
    checkOut,
    nights,
    subtotalPrice,
    gstAmount,
    totalPrice,
  });

  await booking.save();
  req.flash("success", "Booking confirmed!");
  res.redirect(`/bookings/${booking._id}/confirmation`);
};

module.exports.renderConfirmation = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId)
    .populate("listing")
    .populate("guest")
    .populate("owner");

  if (!booking || !booking.guest._id.equals(req.user._id)) {
    req.flash("error", "Booking not found.");
    return res.redirect("/bookings/my");
  }

  await ensureBookingTotals(booking);
  res.render("bookings/confirmation.ejs", {
    booking,
    totals: getBookingDisplayTotals(booking),
  });
};

module.exports.myBookings = async (req, res) => {
  const bookings = await Booking.find({ guest: req.user._id })
    .populate("listing")
    .sort({ createdAt: -1 });

  await Promise.all(bookings.map((booking) => ensureBookingTotals(booking)));

  const bookingTotals = new Map(
    bookings.map((booking) => [booking._id.toString(), getBookingDisplayTotals(booking)])
  );

  res.render("bookings/my-bookings.ejs", { bookings, bookingTotals });
};

module.exports.renderCancelForm = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId).populate("listing");

  if (!booking || !booking.guest.equals(req.user._id)) {
    req.flash("error", "Booking not found.");
    return res.redirect("/bookings/my");
  }

  if (booking.status === "cancelled") {
    req.flash("error", "This booking is already cancelled.");
    return res.redirect("/bookings/my");
  }

  res.render("bookings/cancel.ejs", { booking });
};

module.exports.cancelBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId).populate("listing");

  if (!booking || !booking.guest.equals(req.user._id)) {
    req.flash("error", "Booking not found.");
    return res.redirect("/bookings/my");
  }

  if (booking.status === "cancelled") {
    req.flash("error", "This booking is already cancelled.");
    return res.redirect("/bookings/my");
  }

  booking.status = "cancelled";
  booking.ownerSeen = false;
  await booking.save();

  req.flash("success", "Booking cancelled. The owner can see the update.");
  res.redirect("/bookings/my");
};

module.exports.ownerNotifications = async (req, res) => {
  const bookings = await Booking.find({ owner: req.user._id })
    .populate("listing")
    .populate("guest")
    .sort({ createdAt: -1 });

  res.render("bookings/owner-notifications.ejs", { bookings });
};

module.exports.ownerBookingDetails = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId)
    .populate("listing")
    .populate("guest")
    .populate("owner");

  if (!booking || !booking.owner._id.equals(req.user._id)) {
    req.flash("error", "Booking not found.");
    return res.redirect("/owner/bookings");
  }

  booking.ownerSeen = true;
  await ensureBookingTotals(booking);
  await booking.save();

  res.render("bookings/owner-show.ejs", {
    booking,
    totals: getBookingDisplayTotals(booking),
  });
};

module.exports.findOverlappingBooking = findOverlappingBooking;
module.exports.getBookedDates = getBookedDates;
