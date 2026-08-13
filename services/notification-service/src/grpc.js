const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const notificationService = require("./notification.service.js");

const protoPath = path.join(__dirname, "../../../packages/proto/notification.proto");

const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const notificationProto = grpc.loadPackageDefinition(packageDefinition).wanderlust.notification.v1;

const toIsoDate = (date) => (date ? new Date(date).toISOString() : "");

const toGrpcNotification = (notification) => ({
  id: notification._id.toString(),
  user_id: notification.user.toString(),
  type: notification.type,
  title: notification.title,
  message: notification.message,
  resource_type: notification.resourceType,
  resource_id: notification.resourceId.toString(),
  seen: Boolean(notification.seen),
  created_at: toIsoDate(notification.createdAt),
  updated_at: toIsoDate(notification.updatedAt),
});

const toGrpcError = (err) => ({
  code: err.code === "NOT_FOUND" ? grpc.status.NOT_FOUND : grpc.status.INTERNAL,
  message: err.message || "Unexpected notification service error",
});

const wrapUnary = (handler) => async (call, callback) => {
  try {
    callback(null, await handler(call));
  } catch (err) {
    callback(toGrpcError(err));
  }
};

const implementation = {
  GetUserNotifications: wrapUnary(async (call) => {
    const result = await notificationService.getUserNotifications({
      userId: call.request.user_id,
      unseenOnly: call.request.unseen_only,
      page: call.request.page || 1,
      pageSize: call.request.page_size || 20,
    });

    return {
      notifications: result.notifications.map(toGrpcNotification),
      page: result.page,
      page_size: result.pageSize,
      total_count: result.totalCount,
    };
  }),

  MarkNotificationSeen: wrapUnary(async (call) => {
    const notification = await notificationService.markNotificationSeen({
      notificationId: call.request.notification_id,
      userId: call.request.user_id,
    });

    return { notification: toGrpcNotification(notification) };
  }),

  GetUnreadCount: wrapUnary(async (call) => {
    return {
      unread_count: await notificationService.getUnreadCount(call.request.user_id),
    };
  }),
};

const createServer = () => {
  const server = new grpc.Server();
  server.addService(notificationProto.NotificationService.service, implementation);
  return server;
};

module.exports = {
  createServer,
};
