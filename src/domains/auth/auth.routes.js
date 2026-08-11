const express = require("express");
const router = express.Router();
const wrapAsync = require("../../shared/utils/wrapAsync");
const {isLoggedin} = require("../../shared/middleware")
const userController = require("./auth.controller.js");

router.route("/signup")
.get(userController.renderSignupForm)
.post(wrapAsync(userController.signup));

router.route("/login")
.get(userController.renderLoginForm)
.post(wrapAsync(userController.login));

router.post("/auth/refresh", wrapAsync(userController.refresh));
router.get("/auth/me", isLoggedin, userController.me);
router.get("/logout",wrapAsync(userController.logout))
module.exports = router;
