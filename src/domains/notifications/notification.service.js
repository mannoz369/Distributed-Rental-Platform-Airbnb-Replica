const notificationGrpcClient = require("./notification.grpc-client.js");

const countUnreadOwnerNotifications = async (ownerId) => {
  try {
    const response = await notificationGrpcClient.getUnreadCount({
      user_id: ownerId.toString(),
    });

    return Number(response.unread_count || 0);
  } catch (err) {
    return 0;
  }
};

const markBookingNotificationsSeen = async ({ ownerId, bookingId }) => {
  try {
    const response = await notificationGrpcClient.getUserNotifications({
      user_id: ownerId.toString(),
      unseen_only: true,
      page: 1,
      page_size: 100,
    });

    const matchingNotifications = (response.notifications || []).filter((notification) => {
      return notification.resource_type === "booking" && notification.resource_id === bookingId.toString();
    });

    await Promise.all(
      matchingNotifications.map((notification) =>
        notificationGrpcClient.markNotificationSeen({
          notification_id: notification.id,
          user_id: ownerId.toString(),
        })
      )
    );
  } catch (err) {
    return;
  }
};

module.exports = {
  countUnreadOwnerNotifications,
  markBookingNotificationsSeen,
};
