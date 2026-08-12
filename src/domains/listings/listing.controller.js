const listingService = require("./listing.service.js");


module.exports.index = async(req,res) =>{
    const searchQuery = (req.query.search || "").trim();
    const allListings = await listingService.findListings(searchQuery);

    if (searchQuery && allListings.length === 0) {
      req.flash("error", `No properties in "${searchQuery}" yet.`);
      return res.redirect("/listings");
    }

    res.render("listings/index.ejs",{
      allListings,
      searchQuery,
      pageTitle: "Explore stays",
      emptyMessage: "No properties are available yet.",
    });
};

module.exports.myProperties = async(req,res) =>{
    const allListings = await listingService.findListingsByOwner(req.user._id);
    res.render("listings/index.ejs",{
      allListings,
      searchQuery: "",
      pageTitle: "My Properties",
      emptyMessage: "You have not listed any properties yet.",
    });
};

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
    let { id } = req.params;
    const listing = await listingService.findListingDetails(id);
    if(!listing){
      req.flash("error", "Listing Requested not found!");
      return res.redirect("/listings");
    }
    const bookedDates = await listingService.getBookedDatesForListing(id);
    
    res.render("listings/show.ejs", { listing, bookedDates });
  };

module.exports.createListing = async (req, res,next) => {
    let url = req.file.path;
    let filename = req.file.filename;
    await listingService.createListing({
      listingInput: req.body.listing,
      ownerId: req.user._id,
      image: { url, filename },
    });
    // console.log(savedListing);
    req.flash("success", "New Listing added!");
    res.redirect("/listings");
 };

module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;
    const listing = await listingService.findListingById(id);
    if(!listing){
      req.flash("error", "Listing Requested not found!");
      res.redirect("/listings");
    }
    let originalListingUrl = listing.image.url;
    originalListingUrl = originalListingUrl.replace("/upload","/upload/w_250");
    res.render("listings/edit.ejs", { listing, originalListingUrl });
};

module.exports.updateListing = async (req, res) => {
    let { id } = req.params;
    let image;
    if(typeof req.file !== "undefined"){
      let url = req.file.path;
      let filename = req.file.filename;
      image = {url,filename};
    }
    await listingService.updateListing({
      id,
      ownerId: req.user._id,
      listingInput: req.body.listing,
      image,
    });
    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
  };
module.exports.destroyListing = async (req, res) => {
    let { id } = req.params;
    let deletedListing = await listingService.deleteListing({ id, ownerId: req.user._id });
    console.log(deletedListing);
    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
  };
