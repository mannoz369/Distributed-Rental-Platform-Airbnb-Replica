const mongoose = require("mongoose");
const authGrpcClient = require("./auth.grpc-client.js");

const toGatewayUser = (user) => {
  if (!user?.id) {
    return null;
  }

  return {
    _id: new mongoose.Types.ObjectId(user.id),
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role || "guest",
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
};

const toGatewayTokens = (tokens) => ({
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresInSeconds: tokens.expires_in_seconds,
});

const toGatewayAuthResponse = (response) => ({
  user: toGatewayUser(response.user),
  tokens: toGatewayTokens(response.tokens),
});

const registerUser = async ({ username, email, password }) => {
  const response = await authGrpcClient.signup({ username, email, password });
  return toGatewayAuthResponse(response);
};

const loginUser = async ({ username, password }) => {
  const response = await authGrpcClient.login({ username, password });
  return toGatewayAuthResponse(response);
};

const refreshAuth = async (refreshToken) => {
  const response = await authGrpcClient.refreshToken({ refresh_token: refreshToken });
  return toGatewayAuthResponse(response);
};

const validateAccessToken = async (accessToken) => {
  const response = await authGrpcClient.validateToken({ access_token: accessToken });
  return {
    valid: response.valid,
    user: toGatewayUser(response.user),
  };
};

const getUser = async (userId) => {
  const response = await authGrpcClient.getUser({ user_id: userId });
  return toGatewayUser(response.user);
};

const removeRefreshToken = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  await authGrpcClient.revokeRefreshToken({ refresh_token: refreshToken });
};

module.exports = {
  getUser,
  loginUser,
  refreshAuth,
  registerUser,
  removeRefreshToken,
  validateAccessToken,
};
