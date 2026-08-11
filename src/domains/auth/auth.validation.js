const Joi = require("joi");

const signupSchema = Joi.object({
  username: Joi.string().trim().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

module.exports = {
  signupSchema,
};
