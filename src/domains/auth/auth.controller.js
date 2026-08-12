const authService = require("./auth.service.js");
const tokenService = require("./token.service.js");

const getSafeRedirectUrl = (redirectUrl) => {
    if (typeof redirectUrl !== "string" || !redirectUrl.startsWith("/") || redirectUrl.startsWith("//")) {
        return "/listings";
    }

    return redirectUrl;
};

const getAuthErrorMessage = (err) => {
    if (!err?.message) {
        return "Authentication service is unavailable.";
    }

    return err.message.replace(/^\d+\s+[A-Z_]+:\s*/, "");
};


module.exports.renderSignupForm = (req,res)=>{
    res.render("users/signup.ejs");
};


module.exports.signup = async(req,res)=>{
    try{
        let {username, email, password} = req.body;
        const { tokens } = await authService.registerUser({ username, email, password });
        tokenService.setAuthCookies(res, tokens);
        req.flash("success","Welcome to Wanderlust!");
        res.redirect("/listings");
        
    } catch(e){
        req.flash("error", getAuthErrorMessage(e));
        res.redirect("/signup");
    }
};


module.exports.renderLoginForm = (req,res)=>{
    res.render("users/login.ejs", { redirectUrl: req.query.redirectUrl || "" });
};


module.exports.login = async(req,res)=>{
    try {
        const { username, password, redirectUrl } = req.body;
        const { tokens } = await authService.loginUser({ username, password });
        tokenService.setAuthCookies(res, tokens);
        req.flash("success","Welcome to Wanderlust! You are logged in.");
        res.redirect(getSafeRedirectUrl(redirectUrl));
    } catch(e) {
        req.flash("error", getAuthErrorMessage(e));
        res.redirect("/login");
    }
};

module.exports.refresh = async (req, res) => {
    try {
        const refreshToken = req.cookies[tokenService.REFRESH_TOKEN_COOKIE];
        const { tokens, user } = await authService.refreshAuth(refreshToken);
        tokenService.setAuthCookies(res, tokens);
        res.json({ user: { id: user._id, username: user.username, email: user.email, role: user.role } });
    } catch(e) {
        tokenService.clearAuthCookies(res);
        res.status(401).json({ message: getAuthErrorMessage(e) });
    }
};

module.exports.me = (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
    }

    res.json({
        user: {
            id: req.user._id.toString(),
            username: req.user.username,
            email: req.user.email,
            role: req.user.role,
        },
    });
};

module.exports.logout = async ( req, res) => {
    await authService.removeRefreshToken(req.cookies[tokenService.REFRESH_TOKEN_COOKIE]).catch(() => undefined);
    tokenService.clearAuthCookies(res);
    req.flash("success", "You are Logged out!");
    res.redirect("/listings")
};
