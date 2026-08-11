const Joi = require('joi');
module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        location: Joi.string().required(),
        country: Joi.string().required(),
        price: Joi.number().required().min(0),
        image: Joi.string().allow("",null)
     }
    ).required()
});
module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().required(),
     }).required(),
});

module.exports.bookingSchema = Joi.object({
    booking: Joi.object({
        checkIn: Joi.date().iso().required(),
        checkOut: Joi.date().iso().greater(Joi.ref("checkIn")).required(),
    }).required(),
});

module.exports.cancelBookingSchema = Joi.object({
    cancel: Joi.object({
        confirmation: Joi.string().trim().lowercase().valid("confirm").required(),
    }).required(),
});
