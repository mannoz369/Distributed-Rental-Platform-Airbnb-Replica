const crypto = require("crypto");
const env = require("../../config/env.js");

const ACCESS_TOKEN_COOKIE = "accessToken";
const REFRESH_TOKEN_COOKIE = "refreshToken";
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const jwtSecret = env.JWT_SECRET || env.SCRETE;

const base64UrlEncode = (value) => {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

const base64UrlDecode = (value) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
};

const sign = (input) => {
  return crypto.createHmac("sha256", jwtSecret).update(input).digest("base64url");
};

const createToken = (claims, expiresInSeconds) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    ...claims,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const verifyToken = (token, { ignoreExpiration = false } = {}) => {
  if (!token) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (err) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!ignoreExpiration && payload.exp <= now) {
    return null;
  }

  return payload;
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const buildClaims = (user) => ({
  sub: user._id.toString(),
  username: user.username,
  email: user.email,
  role: user.role || "guest",
});

const issueTokenPair = (user) => ({
  accessToken: createToken(buildClaims(user), ACCESS_TOKEN_TTL_SECONDS),
  refreshToken: createToken(
    {
      ...buildClaims(user),
      typ: "refresh",
      jti: crypto.randomBytes(24).toString("hex"),
    },
    REFRESH_TOKEN_TTL_SECONDS
  ),
});

const cookieOptions = (maxAgeSeconds) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  maxAge: maxAgeSeconds * 1000,
});

const setAuthCookies = (res, tokens) => {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, cookieOptions(ACCESS_TOKEN_TTL_SECONDS));
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions(REFRESH_TOKEN_TTL_SECONDS));
};

const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE);
  res.clearCookie(REFRESH_TOKEN_COOKIE);
};

module.exports = {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  clearAuthCookies,
  hashToken,
  issueTokenPair,
  setAuthCookies,
  verifyToken,
};
