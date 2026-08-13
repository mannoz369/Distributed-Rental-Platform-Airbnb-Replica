const grpc = require("@grpc/grpc-js");
const env = require("./config/env.js");
const connectDB = require("./config/db.js");
const { createServer } = require("./grpc.js");
const { startNotificationConsumer, stopNotificationConsumer } = require("./kafka.consumer.js");

const host = env.NOTIFICATION_SERVICE_HOST || "0.0.0.0";
const port = env.NOTIFICATION_SERVICE_PORT || "50055";
const mongoUrl = env.NOTIFICATION_DB_URL || env.ATLASDB_URL;
const address = `${host}:${port}`;

const start = async () => {
  await connectDB(mongoUrl);
  await startNotificationConsumer().catch((err) => {
    console.error("Notification Service Kafka consumer unavailable:", err.message);
  });

  const server = createServer();

  server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    server.start();
    console.log(`Notification Service gRPC server listening on ${host}:${boundPort}`);
  });

  const shutdown = () => {
    server.tryShutdown(async (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }

      await stopNotificationConsumer().catch((disconnectErr) => {
        console.error(disconnectErr);
      });
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
