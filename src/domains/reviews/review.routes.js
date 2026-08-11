const express = require("express");
const router = express.Router({mergeParams: true});
const wrapAsync = require("../../shared/utils/wrapAsync.js")
const {validateReview,isLoggedin,isReviewAuthor} = require("../../shared/middleware");
const reviewController = require("./review.controller.js");


//reviews
//post reivew route
router.post("/", isLoggedin,validateReview, wrapAsync(reviewController.createReview));  
  
  //delete review route
  router.delete("/:reviewId", isLoggedin,isReviewAuthor, wrapAsync(reviewController.destroyReview)
  );


  module.exports = router;
