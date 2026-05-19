const multer = require('multer');
const { Router } = require("express");
const userController = require('../controllers/userController.js');
const catRouter = Router();
const passport = require("passport");
const ensureAuth = require("../middlewares/ensureAuth.js");
const uploadFile = require("../middlewares/multer.js");

const upload = multer({
  dest: "uploads/avatars/"
})

const uploadMiddleware = uploadFile.fields([
  { name: 'myFile', maxCount: 1},
  { name: 'folder', maxCount: 1}
])

// ROUTE-GETS
catRouter.get("/verify", userController.verifyAuth);
catRouter.get("/userbasic", userController.userBasic);
catRouter.get("/profile/:username", userController.getUserProfile);
catRouter.get("/search-users", userController.getUserSearch);

//CONVERSATIONS
catRouter.get('/conversations', userController.getAllConversations);
catRouter.get('/conversations/:id', userController.getConversation);
catRouter.get('/conversations/:id/messages', userController.getConversationMessages);

catRouter.post('/conversations', userController.createConversation);
catRouter.post('/messages', userController.postNewMessage);


// ROUTE-POSTS
catRouter.post("/account/verify-password", ensureAuth, userController.verifyPassword);
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
catRouter.post('/log-out', userController.logoutPost);
catRouter.post("/sign-up", userController.validateUser, userController.signUpFormPost);
catRouter.post("/account/avatar", upload.single("avatar"), userController.uploadAvatar);
catRouter.post("/follow/:username", ensureAuth, userController.followUser);

// ROUTE-PUTS
catRouter.put("/profile", ensureAuth, userController.updateProfile);
catRouter.put("/account", ensureAuth, userController.updateAccount);


// ROUTER-DELETES
catRouter.delete('/follow/:username', ensureAuth, userController.unfollowUser);
catRouter.delete('/account/delete', ensureAuth, userController.deleteAccount)

module.exports = catRouter;