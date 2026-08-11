const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync.js");
const {
  isLoggedin,
  validateBooking,
  validateCancelBooking,
} = require("../middleware.js");
const bookingController = require("../controllers/bookings.js");

router.post(
  "/listings/:id/bookings",
  isLoggedin,
  validateBooking,
  wrapAsync(bookingController.createBooking)
);

router.get(
  "/bookings/my",
  isLoggedin,
  wrapAsync(bookingController.myBookings)
);

router.get(
  "/bookings/:bookingId/confirmation",
  isLoggedin,
  wrapAsync(bookingController.renderConfirmation)
);

router
  .route("/bookings/:bookingId/cancel")
  .get(isLoggedin, wrapAsync(bookingController.renderCancelForm))
  .patch(isLoggedin, validateCancelBooking, wrapAsync(bookingController.cancelBooking));

router.get(
  "/owner/bookings",
  isLoggedin,
  wrapAsync(bookingController.ownerNotifications)
);

router.get(
  "/owner/bookings/:bookingId",
  isLoggedin,
  wrapAsync(bookingController.ownerBookingDetails)
);

module.exports = router;
