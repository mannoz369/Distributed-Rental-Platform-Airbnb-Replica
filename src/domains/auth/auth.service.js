const User = require("./user.model.js");

const registerUser = (user, password) => {
  return User.register(user, password);
};

module.exports = {
  registerUser,
};
