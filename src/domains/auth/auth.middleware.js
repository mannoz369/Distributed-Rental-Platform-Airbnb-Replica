const mongoose = require("mongoose");
const authService = require("./auth.service.js");
const tokenService = require("./token.service.js");

const parseCookies = (req, res, next) => {
  const cookieHeader = req.headers.cookie || "";
  req.cookies = cookieHeader.split(";").reduce((cookies, cookie) => {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (!rawName) {
      return cookies;
    }

    cookies[rawName] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
  next();
};

const getBearerToken = (req) => {
  const authHeader = req.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length);
};

const buildUserContext = (payload) => ({
  _id: new mongoose.Types.ObjectId(payload.sub),
  username: payload.username,
  email: payload.email,
  role: payload.role || "guest",
});

const attachUserFromToken = async (req, res, next) => {
  try {
    const accessToken = getBearerToken(req) || req.cookies[tokenService.ACCESS_TOKEN_COOKIE];
    const payload = tokenService.verifyToken(accessToken);

    if (payload) {
      req.user = buildUserContext(payload);
      return next();
    }

    const refreshToken = req.cookies[tokenService.REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      return next();
    }

    const { tokens, user } = await authService.refreshAuth(refreshToken);
    tokenService.setAuthCookies(res, tokens);
    req.user = buildUserContext({
      sub: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    });

    next();
  } catch (err) {
    tokenService.clearAuthCookies(res);
    next();
  }
};

module.exports = {
  attachUserFromToken,
  parseCookies,
};
