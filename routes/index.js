const { Router } = require("express");
const userController = require('../controllers/userController.js');
const catRouter = Router();
const passport = require("passport");
const ensureAuth = require("../middlewares/ensureAuth.js");
const upload = require("../middlewares/multer.js");

const uploadMiddleware = upload.fields([
  { name: 'myFile', maxCount: 1},
  { name: 'folder', maxCount: 1}
])

// ROUTE-GETS
catRouter.get("/verify", userController.verifyAuth);
catRouter.get("/userbasic", userController.userBasic);
catRouter.get("/profile/:username", userController.getUserProfile);

// ROUTE-POSTS
catRouter.post("/log-in", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if(err) return res.status(500).json({error: "server error" });
    if(!user) return res.status(401).json({ error: info.message || "Invalid Credentials"});

    req.logIn(user, (err) => {
      if(err) return res.status(500).json({error: "Login failed" });
      return res.json({ success: true });
    })
  })(req,res,next);
});

catRouter.post("/follow/:username", ensureAuth, userController.followUser);

catRouter.post('/log-out', userController.logoutPost);

catRouter.post("/sign-up", userController.validateUser, userController.signUpFormPost);

// ROUTE-PUTS

// ROUTER-DELETES
catRouter.delete('/follow/:username', ensureAuth, userController.unfollowUser);


module.exports = catRouter;