const crypto = require("crypto");
const User = require("./user.model.js");
const tokenService = require("./token.service.js");

const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = "sha512";

const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST)
    .toString("hex");

  return { hash, salt };
};

const verifyPassword = (password, user) => {
  if (!user?.passwordHash || !user?.passwordSalt) {
    return false;
  }

  const { hash } = hashPassword(password, user.passwordSalt);
  const hashBuffer = Buffer.from(hash, "hex");
  const storedHashBuffer = Buffer.from(user.passwordHash, "hex");
  return (
    hashBuffer.length === storedHashBuffer.length &&
    crypto.timingSafeEqual(hashBuffer, storedHashBuffer)
  );
};

const verifyLegacyPassword = (password, user) => {
  if (!user?.hash || !user?.salt) {
    return false;
  }

  const legacyAttempts = [
    { iterations: 25000, keyLength: 512, digest: "sha256" },
    { iterations: 25000, keyLength: 512, digest: "sha1" },
  ];

  return legacyAttempts.some(({ iterations, keyLength, digest }) => {
    const hash = crypto
      .pbkdf2Sync(password, user.salt, iterations, keyLength, digest)
      .toString("hex");
    const hashBuffer = Buffer.from(hash, "hex");
    const storedHashBuffer = Buffer.from(user.hash, "hex");

    return (
      hashBuffer.length === storedHashBuffer.length &&
      crypto.timingSafeEqual(hashBuffer, storedHashBuffer)
    );
  });
};

const migrateLegacyPassword = async (user, password) => {
  const { hash, salt } = hashPassword(password);
  user.passwordHash = hash;
  user.passwordSalt = salt;
  user.hash = undefined;
  user.salt = undefined;
  await user.save();
};

const saveRefreshToken = async (user, refreshToken) => {
  const expiresAt = new Date(Date.now() + tokenService.REFRESH_TOKEN_TTL_SECONDS * 1000);
  user.refreshTokens = [
    ...(user.refreshTokens || []).filter((token) => token.expiresAt > new Date()),
    {
      tokenHash: tokenService.hashToken(refreshToken),
      expiresAt,
    },
  ];
  await user.save();
};

const removeRefreshToken = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  await User.updateOne(
    { "refreshTokens.tokenHash": tokenService.hashToken(refreshToken) },
    { $pull: { refreshTokens: { tokenHash: tokenService.hashToken(refreshToken) } } }
  );
};

const issueAndStoreTokens = async (user) => {
  const tokens = tokenService.issueTokenPair(user);
  await saveRefreshToken(user, tokens.refreshToken);
  return tokens;
};

const registerUser = async ({ username, email, password }) => {
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    const error = new Error("A user with the given username is already registered");
    error.code = "ALREADY_EXISTS";
    throw error;
  }

  const { hash, salt } = hashPassword(password);
  const user = new User({
    username,
    email,
    passwordHash: hash,
    passwordSalt: salt,
  });

  await user.save();
  const tokens = await issueAndStoreTokens(user);
  return { user, tokens };
};

const loginUser = async ({ username, password }) => {
  const user = await User.findOne({ username });
  const hasCurrentPassword = user?.passwordHash && user?.passwordSalt;
  const passwordMatches =
    (hasCurrentPassword && verifyPassword(password, user)) || verifyLegacyPassword(password, user);

  if (!user || !passwordMatches) {
    const error = new Error("Invalid username or password");
    error.code = "UNAUTHENTICATED";
    throw error;
  }

  if (!hasCurrentPassword) {
    await migrateLegacyPassword(user, password);
  }

  const tokens = await issueAndStoreTokens(user);
  return { user, tokens };
};

const refreshAuth = async (refreshToken) => {
  const payload = tokenService.verifyToken(refreshToken);
  if (!payload || payload.typ !== "refresh") {
    const error = new Error("Invalid refresh token");
    error.code = "UNAUTHENTICATED";
    throw error;
  }

  const tokenHash = tokenService.hashToken(refreshToken);
  const user = await User.findOne({
    _id: payload.sub,
    "refreshTokens.tokenHash": tokenHash,
    "refreshTokens.expiresAt": { $gt: new Date() },
  });

  if (!user) {
    const error = new Error("Invalid refresh token");
    error.code = "UNAUTHENTICATED";
    throw error;
  }

  user.refreshTokens = user.refreshTokens.filter((token) => token.tokenHash !== tokenHash);
  const tokens = await issueAndStoreTokens(user);
  return { user, tokens };
};

const validateAccessToken = async (accessToken) => {
  const payload = tokenService.verifyToken(accessToken);
  if (!payload) {
    return { valid: false };
  }

  const user = await User.findById(payload.sub);
  return { valid: Boolean(user), user };
};

const getUser = async (userId) => {
  return User.findById(userId);
};

module.exports = {
  getUser,
  loginUser,
  refreshAuth,
  registerUser,
  removeRefreshToken,
  validateAccessToken,
};
