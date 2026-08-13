const reviewService = require("./review.service.js");

module.exports.createReview =  async (req,res)=>{
    const { error } = await reviewService.createReview({
        listingId: req.params.id,
        reviewInput: req.body.review,
        authorId: req.user._id,
        authorName: req.user.username,
    });
    if (error) {
        req.flash("error", error);
        return res.redirect(`/listings/${req.params.id}`);
    }
    req.flash("success", "New Review added!");
    res.redirect(`/listings/${req.params.id}`);
  
};

module.exports.destroyReview = async(req,res)=>{
    let { id ,reviewId } = req.params;
    const { error } = await reviewService.deleteReview({
        listingId: id,
        reviewId,
        requesterId: req.user._id,
    });
    if (error) {
        req.flash("error", error);
        return res.redirect(`/listings/${id}`);
    }
    req.flash("success", "Review Deleted!");
    res.redirect(`/listings/${id}`);
};
