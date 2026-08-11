const reviewService = require("./review.service.js");

module.exports.createReview =  async (req,res)=>{
    const { listing } = await reviewService.createReview({
        listingId: req.params.id,
        reviewInput: req.body.review,
        authorId: req.user._id,
    });
    req.flash("success", "New Review added!");
    res.redirect(`/listings/${listing._id}`);
  
};

module.exports.destroyReview = async(req,res)=>{
    let { id ,reviewId } = req.params;
    await reviewService.deleteReview({ listingId: id, reviewId });
    req.flash("success", "Review Deleted!");
    res.redirect(`/listings/${id}`);
};
