const express = require("express");
const app = express();
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressErrors = require("./shared/errors/ExpressErros.js");
const session = require("express-session");
const flash = require("connect-flash");
const env = require("./config/env.js");
const connectDB = require("./config/db.js");
const authMiddleware = require("./domains/auth/auth.middleware.js");
const notificationService = require("./domains/notifications/notification.service.js");

const listingRoute = require("./domains/listings/listing.routes.js");
const reviewRoute = require("./domains/reviews/review.routes.js");
const userRoute = require("./domains/auth/auth.routes.js");
const bookingRoute = require("./domains/bookings/booking.routes.js");

// const mongo_url = "mongodb://localhost:27017/wanderlust";
const dbURL = env.ATLASDB_URL;



connectDB(dbURL).then(()=>{
    console.log("Connected to DB");
}).catch((err)=>{
    console.log(err);
});
//middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine('ejs',ejsMate);
app.use(express.static(path.join(__dirname,"../public")));

const sessionOptions={
    secret: env.SCRETE,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    },
};

// app.get("/",(req,res)=>{
//     res.send("HI, I AM ROOT ");
// });

app.get("/",(req,res)=>{
    res.redirect("/listings");
});



app.use(session(sessionOptions));
app.use(flash());
app.use(authMiddleware.parseCookies);
app.use(authMiddleware.attachUserFromToken);

app.use(async (req, res,next)=>{
    try {
        res.locals.success = req.flash("success");
        res.locals.error= req.flash("error");
        res.locals.currUser = req.user;
        res.locals.ownerNotificationCount = 0;
        if(req.user){
            res.locals.ownerNotificationCount =
              await notificationService.countUnreadOwnerNotifications(req.user._id);
        }
        
        next();
    } catch(err) {
        next(err);
    }
});

// app.get("/demouser", async(req,res)=>{
//     let fakeUser = new User({
//         email: "student@gmail.com",
//         username: "test1"
//     });

//     let registeredUser = await User.register(fakeUser,"hello123");
//     res.send(registeredUser);

// });


app.use("/listings",listingRoute);
app.use("/listings/:id/reviews",reviewRoute);
app.use("/",bookingRoute);
app.use("/",userRoute);


app.all("*",(req,res,next)=>{
  next(new ExpressErrors(404,"Page not Found!!"));
});
app.use((err,req,res,next)=>{
  let {statusCode=500,message="Something went wrong"} = err;
  res.status(statusCode).render("listings/error.ejs", {message});
  // res.status(statusCode).send(message);
});
app.listen(8080,()=>{
    console.log("server is listing");
});
