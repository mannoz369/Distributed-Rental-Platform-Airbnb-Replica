const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const mbxGeocoding= require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken});

const formatDateKey = (date) => {
  const localDate = new Date(date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const day = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};


module.exports.index = async(req,res) =>{
    const searchQuery = (req.query.search || "").trim();
    let filter = {};

    if (searchQuery) {
      const escapedSearch = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");
      filter = {
        $or: [
          { location: searchRegex },
          { country: searchRegex },
        ],
      };
    }

    const allListings = await Listing.find(filter);

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
    const allListings = await Listing.find({ owner: req.user._id });
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
    const listing = await Listing.findById(id).populate({path: "reviews", populate: { path: "author",},}).populate("owner");
    if(!listing){
      req.flash("error", "Listing Requested not found!");
      return res.redirect("/listings");
    }
    const bookings = await Booking.find({
      listing: id,
      status: "confirmed",
    }).select("checkIn checkOut");
    const bookedDates = bookings.flatMap((booking) => {
      const dates = [];
      const cursor = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      while (cursor <= checkOut) {
        dates.push(formatDateKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return dates;
    });
    
    res.render("listings/show.ejs", { listing, bookedDates });
  };

module.exports.createListing = async (req, res,next) => {
      let response = await geocodingClient.forwardGeocode({
        query: req.body.listing.location,
        limit: 1,
      })
      .send();


      
    let url = req.file.path;
    let filename = req.file.filename;
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = {url,filename};
    newListing.geometry = response.body.features[0].geometry;
    let savedListing = await newListing.save();
    // console.log(savedListing);
    req.flash("success", "New Listing added!");
    res.redirect("/listings");
 };

module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if(!listing){
      req.flash("error", "Listing Requested not found!");
      res.redirect("/listings");
    }
    let originalListingUrl = listing.image.url;
    originalListingUrl = originalListingUrl.replace("/upload","/upload/w_250");
    res.render("listings/edit.ejs", { listing, originalListingUrl });
};

module.exports.updateListing = async (req, res) => {
  let response = await geocodingClient.forwardGeocode({
    query: req.body.listing.location,
    limit: 1,
  })
  .send();
    let { id } = req.params;
    let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    listing.geometry = response.body.features[0].geometry;
    let saveEditinfo =  await listing.save();
    // console.log(save);
    if(typeof req.file !== "undefined"){
      let url = req.file.path;
      let filename = req.file.filename;
      listing.image = {url,filename};
      let saveEditinfo =  await listing.save();
      
    }
    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
  };
module.exports.destroyListing = async (req, res) => {
    let { id } = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
  };
