const express = require("express");
const router = express.Router();
const wrapAsync = require("../../shared/utils/wrapAsync.js");
const {isLoggedin , isOwner ,validateListing} = require("../../shared/middleware");
const listingController = require("./listing.controller.js");
const multer  = require('multer')
const {storage} = require("../../config/cloudinary.js");
const upload = multer({ storage });

router
.route("/")
.get(wrapAsync(listingController.index))
.post(isLoggedin,upload.single("listing[image]"),validateListing,wrapAsync(listingController.createListing));


//New Route
router.get("/new", isLoggedin, listingController.renderNewForm);

router.get("/my-properties", isLoggedin, wrapAsync(listingController.myProperties));

router
.route("/:id")
.get(wrapAsync(listingController.showListing))
.put(isLoggedin,isOwner,upload.single("listing[image]"),validateListing, wrapAsync(listingController.updateListing))
.delete(isLoggedin,isOwner, wrapAsync(listingController.destroyListing));


//Edit Route
router.get("/:id/edit", isLoggedin,isOwner,wrapAsync(listingController.renderEditForm));



// //index route
// router.get("/", wrapAsync(listingController.index));

// //Show Route
// router.get("/:id", wrapAsync(listingController.showListing));

// //Create Route
// router.post("/",isLoggedin,validateListing,wrapAsync(listingController.createListing));

// //Update Route
// router.put("/:id",isLoggedin,isOwner,validateListing, wrapAsync(listingController.updateListing));

// //Delete Route
// router.delete("/:id",isLoggedin,isOwner, wrapAsync(listingController.destroyListing));

module.exports = router;
