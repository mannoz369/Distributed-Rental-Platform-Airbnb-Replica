const Notification = require("./notification.model.js");

const createBookingCreatedNotification = async (event) => {
  const booking = event.payload;

  await Notification.updateOne(
    { eventId: event.eventId },
    {
      $setOnInsert: {
        user: booking.ownerId,
        type: event.eventType,
        title: "New booking request",
        message: `${booking.guestName} booked ${booking.listingTitleSnapshot}.`,
        resourceType: "booking",
        resourceId: booking.bookingId,
        eventId: event.eventId,
        seen: false,
      },
    },
    { upsert: true }
  );
};

const createBookingCancelledNotification = async (event) => {
  const booking = event.payload;

  await Notification.updateOne(
    { eventId: event.eventId },
    {
      $setOnInsert: {
        user: booking.ownerId,
        type: event.eventType,
        title: "Booking cancelled",
        message: `${booking.guestName} cancelled ${booking.listingTitleSnapshot}.`,
        resourceType: "booking",
        resourceId: booking.bookingId,
        eventId: event.eventId,
        seen: false,
      },
    },
    { upsert: true }
  );
};

const getUserNotifications = async ({ userId, unseenOnly = false, page = 1, pageSize = 20 }) => {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedPageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  const filter = { user: userId };

  if (unseenOnly) {
    filter.seen = false;
  }

  const [notifications, totalCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((normalizedPage - 1) * normalizedPageSize)
      .limit(normalizedPageSize),
    Notification.countDocuments(filter),
  ]);

  return {
    notifications,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalCount,
  };
};

const markNotificationSeen = async ({ notificationId, userId }) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { seen: true },
    { new: true }
  );

  if (!notification) {
    const error = new Error("Notification not found.");
    error.code = "NOT_FOUND";
    throw error;
  }

  return notification;
};

const getUnreadCount = (userId) => {
  return Notification.countDocuments({ user: userId, seen: false });
};

module.exports = {
  createBookingCancelledNotification,
  createBookingCreatedNotification,
  getUnreadCount,
  getUserNotifications,
  markNotificationSeen,
};
