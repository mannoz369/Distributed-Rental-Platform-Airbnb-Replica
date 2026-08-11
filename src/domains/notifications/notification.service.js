const Booking = require("../bookings/booking.model.js");

const countUnreadOwnerNotifications = (ownerId) => {
  return Booking.countDocuments({
    owner: ownerId,
    ownerSeen: false,
  });
};

module.exports = {
  countUnreadOwnerNotifications,
};
