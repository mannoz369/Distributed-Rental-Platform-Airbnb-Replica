const Joi = require("joi");

const bookingSchema = Joi.object({
  booking: Joi.object({
    checkIn: Joi.date().iso().required(),
    checkOut: Joi.date().iso().greater(Joi.ref("checkIn")).required(),
  }).required(),
});

const cancelBookingSchema = Joi.object({
  cancel: Joi.object({
    confirmation: Joi.string().trim().lowercase().valid("confirm").required(),
  }).required(),
});

module.exports = {
  bookingSchema,
  cancelBookingSchema,
};
