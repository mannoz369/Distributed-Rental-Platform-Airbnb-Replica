const bookingService = require("../bookings/booking.service.js");

const countUnreadOwnerNotifications = async (ownerId) => {
  try {
    const bookings = await bookingService.findOwnerBookings(ownerId);
    return bookings.filter((booking) => !booking.ownerSeen).length;
  } catch (err) {
    return 0;
  }
};

module.exports = {
  countUnreadOwnerNotifications,
};
