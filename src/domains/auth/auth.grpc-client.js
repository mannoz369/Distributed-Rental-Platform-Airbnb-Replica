const grpc = require("@grpc/grpc-js");
const env = require("../../config/env.js");
const loadProto = require("../../shared/grpc/loadProto.js");

const authProto = loadProto("auth.proto").wanderlust.auth.v1;
const target = env.AUTH_SERVICE_URL || "localhost:50051";
const client = new authProto.AuthService(target, grpc.credentials.createInsecure());

const unary = (methodName, request) => {
  return new Promise((resolve, reject) => {
    client[methodName](request, (err, response) => {
      if (err) {
        return reject(err);
      }

      resolve(response);
    });
  });
};

module.exports = {
  getUser: (request) => unary("GetUser", request),
  login: (request) => unary("Login", request),
  refreshToken: (request) => unary("RefreshToken", request),
  revokeRefreshToken: (request) => unary("RevokeRefreshToken", request),
  signup: (request) => unary("Signup", request),
  validateToken: (request) => unary("ValidateToken", request),
};
