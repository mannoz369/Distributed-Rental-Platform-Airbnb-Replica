const Listing = require("../../domains/listings/listing.model.js");
const Review = require("../../domains/reviews/review.model.js");
const ExpressErrors = require("../errors/ExpressErros.js");
const { listingSchema } = require("../../domains/listings/listing.validation.js");
const { reviewSchema } = require("../../domains/reviews/review.validation.js");
const {
  bookingSchema,
  cancelBookingSchema,
} = require("../../domains/bookings/booking.validation.js");


module.exports.isLoggedin = (req , res, next) => {
    if(!req.user){
        req.flash("error","You must login!");
        return res.redirect(`/login?redirectUrl=${encodeURIComponent(req.originalUrl)}`);
      }
      next();
};

module.exports.saveRedirectUrl = (req,res,next) =>{
  res.locals.redirectUrl = req.body.redirectUrl || req.query.redirectUrl || "";
  next();
};


module.exports.isOwner = async(req,res,next) =>{
  let { id } = req.params;
  let listing = await Listing.findById(id);
  if(!listing.owner._id.equals(res.locals.currUser._id)){
    req.flash("error","You Don't have permission to update");
    return res.redirect(`/listings/${id}`);
  }
  next();
};


module.exports.validateListing = (req,res,next)=>{
  let {error} = listingSchema.validate(req.body); 
  
  if (error) {
    let errMsg = error.details.map((el)=> el.message).join(",");
    throw new ExpressErrors(400,errMsg)
    
  }else{
    next();
  }
};

module.exports.validateReview = (req,res,next)=>{
  let {error} = reviewSchema.validate(req.body); 
  
  if (error) {
    let errMsg = error.details.map((el)=> el.message).join(",");
    throw new ExpressErrors(400, errMsg)
    
  }else{
    next();
  }
};

module.exports.validateBooking = (req,res,next)=>{
  let {error} = bookingSchema.validate(req.body); 
  
  if (error) {
    let errMsg = error.details.map((el)=> el.message).join(",");
    throw new ExpressErrors(400, errMsg)
    
  }else{
    next();
  }
};

module.exports.validateCancelBooking = (req,res,next)=>{
  let {error} = cancelBookingSchema.validate(req.body); 
  
  if (error) {
    req.flash("error", "Type confirm to cancel this booking.");
    return res.redirect(`/bookings/${req.params.bookingId}/cancel`);
    
  }else{
    next();
  }
};

module.exports.isReviewAuthor = async(req,res,next) =>{
  let { id , reviewId } = req.params;
  let review = await Review.findById(reviewId);
  if(!review.author.equals(res.locals.currUser._id)){
    req.flash("error","You can't delete this review");
    return res.redirect(`/listings/${id}`);
  }
  next();
};
