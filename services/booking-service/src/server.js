const grpc = require("@grpc/grpc-js");
const env = require("./config/env.js");
const connectDB = require("./config/db.js");
const { createServer } = require("./grpc.js");
const { connectBookingEventProducer, disconnectBookingEventProducer } = require("./booking.events.js");
const resolveMongoUrl = require("../../shared/resolveMongoUrl.js");

const host = env.BOOKING_SERVICE_HOST || "0.0.0.0";
const port = env.BOOKING_SERVICE_PORT || "50053";
const mongoUrl = resolveMongoUrl({
  env,
  serviceName: "Booking Service",
  serviceEnvKey: "BOOKING_DB_URL",
});
const address = `${host}:${port}`;

const start = async () => {
  await connectDB(mongoUrl);
  await connectBookingEventProducer().catch((err) => {
    console.error("Booking Service Kafka producer unavailable:", err.message);
  });
  const server = createServer();

  server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    server.start();
    console.log(`Booking Service gRPC server listening on ${host}:${boundPort}`);
  });

  const shutdown = () => {
    server.tryShutdown(async (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }

      await disconnectBookingEventProducer().catch((disconnectErr) => {
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
