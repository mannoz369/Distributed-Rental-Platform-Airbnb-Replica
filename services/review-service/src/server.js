const grpc = require("@grpc/grpc-js");
const env = require("./config/env.js");
const connectDB = require("./config/db.js");
const { createServer } = require("./grpc.js");
const resolveMongoUrl = require("../../shared/resolveMongoUrl.js");

const host = env.REVIEW_SERVICE_HOST || "0.0.0.0";
const port = env.REVIEW_SERVICE_PORT || "50054";
const mongoUrl = resolveMongoUrl({
  env,
  serviceName: "Review Service",
  serviceEnvKey: "REVIEW_DB_URL",
});
const address = `${host}:${port}`;

const start = async () => {
  await connectDB(mongoUrl);
  const server = createServer();

  server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    server.start();
    console.log(`Review Service gRPC server listening on ${host}:${boundPort}`);
  });

  const shutdown = () => {
    server.tryShutdown((err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }

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
