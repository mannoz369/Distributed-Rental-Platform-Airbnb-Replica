const bookingService = require("./booking.service.js");

module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  const { booking, error } = await bookingService.createBooking({
    listingId: id,
    user: req.user,
    bookingInput: req.body.booking,
  });

  if (error) {
    req.flash("error", error);
    return res.redirect(error === "Listing requested not found!" ? "/listings" : `/listings/${id}`);
  }

  req.flash("success", "Booking confirmed!");
  res.redirect(`/bookings/${booking._id}/confirmation`);
};

module.exports.renderConfirmation = async (req, res) => {
  const booking = await bookingService.findBookingDetails(req.params.bookingId, req.user._id);

  if (!booking || !booking.guest._id.equals(req.user._id)) {
    req.flash("error", "Booking not found.");
    return res.redirect("/bookings/my");
  }

  await bookingService.ensureBookingTotals(booking);
  res.render("bookings/confirmation.ejs", {
    booking,
    totals: bookingService.getBookingDisplayTotals(booking),
  });
};

module.exports.myBookings = async (req, res) => {
  const bookings = await bookingService.findGuestBookings(req.user._id);

  await Promise.all(bookings.map((booking) => bookingService.ensureBookingTotals(booking)));

  const bookingTotals = new Map(
    bookings.map((booking) => [booking._id.toString(), bookingService.getBookingDisplayTotals(booking)])
  );

  res.render("bookings/my-bookings.ejs", { bookings, bookingTotals });
};

module.exports.renderCancelForm = async (req, res) => {
  const booking = await bookingService.findBookingForGuest(req.params.bookingId, req.user._id);

  if (!booking || !booking.guest._id.equals(req.user._id)) {
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
  const booking = await bookingService.findBookingForGuest(req.params.bookingId, req.user._id);

  if (!booking || !booking.guest._id.equals(req.user._id)) {
    req.flash("error", "Booking not found.");
    return res.redirect("/bookings/my");
  }

  if (booking.status === "cancelled") {
    req.flash("error", "This booking is already cancelled.");
    return res.redirect("/bookings/my");
  }

  await bookingService.cancelBooking({
    bookingId: req.params.bookingId,
    requesterId: req.user._id,
  });

  req.flash("success", "Booking cancelled. The owner can see the update.");
  res.redirect("/bookings/my");
};

module.exports.ownerNotifications = async (req, res) => {
  const bookings = await bookingService.findOwnerBookings(req.user._id);

  res.render("bookings/owner-notifications.ejs", { bookings });
};

module.exports.ownerBookingDetails = async (req, res) => {
  const booking = await bookingService.findBookingDetails(req.params.bookingId, req.user._id);

  if (!booking || !booking.owner._id.equals(req.user._id)) {
    req.flash("error", "Booking not found.");
    return res.redirect("/owner/bookings");
  }

  const seenBooking = await bookingService.markBookingSeen({
    bookingId: req.params.bookingId,
    requesterId: req.user._id,
  });
  await bookingService.ensureBookingTotals(seenBooking || booking);

  res.render("bookings/owner-show.ejs", {
    booking: seenBooking || booking,
    totals: bookingService.getBookingDisplayTotals(seenBooking || booking),
  });
};
