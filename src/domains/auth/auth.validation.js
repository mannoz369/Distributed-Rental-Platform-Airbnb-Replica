const Joi = require("joi");

const signupSchema = Joi.object({
  username: Joi.string().trim().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const loginSchema = Joi.object({
  username: Joi.string().trim().required(),
  password: Joi.string().required(),
  redirectUrl: Joi.string().allow("", null),
});

module.exports = {
  loginSchema,
  signupSchema,
};
