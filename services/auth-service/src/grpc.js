const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const authService = require("./auth.service.js");
const tokenService = require("./token.service.js");

const protoPath = path.join(__dirname, "../../../packages/proto/auth.proto");

const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const authProto = grpc.loadPackageDefinition(packageDefinition).wanderlust.auth.v1;

const toGrpcUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role || "guest",
    created_at: user.createdAt ? user.createdAt.toISOString() : "",
    updated_at: user.updatedAt ? user.updatedAt.toISOString() : "",
  };
};

const toGrpcTokens = (tokens) => ({
  access_token: tokens.accessToken,
  refresh_token: tokens.refreshToken,
  expires_in_seconds: tokenService.ACCESS_TOKEN_TTL_SECONDS,
});

const toGrpcAuthResponse = ({ user, tokens }) => ({
  user: toGrpcUser(user),
  tokens: toGrpcTokens(tokens),
});

const toGrpcError = (err) => {
  const statusByCode = {
    ALREADY_EXISTS: grpc.status.ALREADY_EXISTS,
    UNAUTHENTICATED: grpc.status.UNAUTHENTICATED,
    NOT_FOUND: grpc.status.NOT_FOUND,
    INVALID_ARGUMENT: grpc.status.INVALID_ARGUMENT,
  };

  return {
    code: statusByCode[err.code] || grpc.status.INTERNAL,
    message: err.message || "Unexpected auth service error",
  };
};

const wrapUnary = (handler) => async (call, callback) => {
  try {
    callback(null, await handler(call));
  } catch (err) {
    callback(toGrpcError(err));
  }
};

const implementation = {
  Signup: wrapUnary(async (call) => {
    return toGrpcAuthResponse(await authService.registerUser(call.request));
  }),

  Login: wrapUnary(async (call) => {
    return toGrpcAuthResponse(await authService.loginUser(call.request));
  }),

  RefreshToken: wrapUnary(async (call) => {
    return toGrpcAuthResponse(await authService.refreshAuth(call.request.refresh_token));
  }),

  RevokeRefreshToken: wrapUnary(async (call) => {
    await authService.removeRefreshToken(call.request.refresh_token);
    return { revoked: true };
  }),

  ValidateToken: wrapUnary(async (call) => {
    const { valid, user } = await authService.validateAccessToken(call.request.access_token);
    return {
      valid,
      user: toGrpcUser(user),
    };
  }),

  GetUser: wrapUnary(async (call) => {
    const user = await authService.getUser(call.request.user_id);
    if (!user) {
      const error = new Error("User not found");
      error.code = "NOT_FOUND";
      throw error;
    }

    return { user: toGrpcUser(user) };
  }),
};

const createServer = () => {
  const server = new grpc.Server();
  server.addService(authProto.AuthService.service, implementation);
  return server;
};

module.exports = {
  createServer,
};
