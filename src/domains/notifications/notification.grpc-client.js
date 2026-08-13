const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const env = require("../../config/env.js");

const protoPath = path.join(__dirname, "../../../packages/proto/notification.proto");

const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const notificationProto = grpc.loadPackageDefinition(packageDefinition).wanderlust.notification.v1;
const address = env.NOTIFICATION_SERVICE_URL || "localhost:50055";
const client = new notificationProto.NotificationService(address, grpc.credentials.createInsecure());

const unary = (method, payload) =>
  new Promise((resolve, reject) => {
    client[method](payload, (err, response) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(response);
    });
  });

const getUnreadCount = ({ user_id }) => {
  return unary("GetUnreadCount", { user_id });
};

const getUserNotifications = ({ user_id, unseen_only = false, page = 1, page_size = 100 }) => {
  return unary("GetUserNotifications", {
    user_id,
    unseen_only,
    page,
    page_size,
  });
};

const markNotificationSeen = ({ notification_id, user_id }) => {
  return unary("MarkNotificationSeen", {
    notification_id,
    user_id,
  });
};

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markNotificationSeen,
};
