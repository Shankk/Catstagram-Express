const multer = require('multer');
const { Router } = require("express");
const authController = require('../controllers/authController.js');
const userController = require('../controllers/userController.js');
const catRouter = Router();
const ensureAuth = require("../middlewares/ensureAuth.js");
const { uploadAvatar, uploadPost, fileManagerStorage }= require("../middlewares/multer.js");

/* const uploadMiddleware = uploadFile.fields([
  { name: 'myFile', maxCount: 1},
  { name: 'folder', maxCount: 1}
]) */

// ROUTE-GETS
catRouter.get("/verify", authController.verifyAuth);
catRouter.get("/user", userController.getUserData);
catRouter.get("/profile/:username", userController.getUserProfile);
catRouter.get("/search-users", userController.getUserSearch);

catRouter.get("/posts/:id", userController.getUserPost);
catRouter.get("/posts/:id/comments", userController.getPostComments);
catRouter.get("/feed", userController.getUserFeed);
catRouter.get("/suggested", userController.getSuggested);

//CONVERSATIONS
catRouter.get('/conversations', userController.getAllConversations);
catRouter.get('/conversations/:id', userController.getConversation);
catRouter.get('/conversations/:id/messages', userController.getConversationMessages);

catRouter.post('/conversations', userController.createConversation);
catRouter.post('/conversations/:id/send-message', userController.sendUserMessage);
catRouter.post('/conversations/:id/send-post', userController.sendUserPost);

// ROUTE-POSTS
catRouter.post("/account/verify-password", ensureAuth, authController.verifyPassword);
catRouter.post("/log-in", authController.loginUser);
catRouter.post('/log-out', authController.logoutUser);
catRouter.post("/sign-up", authController.validateUser, authController.signupUser);
catRouter.post("/profile/avatar", uploadAvatar.single("avatar"), userController.uploadAvatarCloud);
catRouter.post("/profile/post", uploadPost.single("post"), userController.uploadPostCloud);
catRouter.post("/follow/:username", ensureAuth, userController.followUser);
catRouter.post("/posts/:id/like", ensureAuth, userController.likeUserPost);
catRouter.post("/posts/:id/comments", userController.sendPostComment);


// ROUTE-PUTS
catRouter.put("/profile", ensureAuth, userController.updateProfile);
catRouter.put("/account", ensureAuth, userController.updateAccount);


// ROUTER-DELETES
catRouter.delete('/follow/:username', ensureAuth, userController.unfollowUser);
catRouter.delete('/account/delete', ensureAuth, userController.deleteAccount);
catRouter.delete('/posts/:id/like', ensureAuth, userController.unlikeUserPost);

module.exports = catRouter;