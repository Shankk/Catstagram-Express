const { Router } = require("express");
const fileController = require("../controllers/fileController");
const fileRouter = Router();
const passport = require("passport");
const ensureAuth = require("../middlewares/ensureAuth");
const upload = require("../middlewares/multer");

const uploadMiddleware = upload.fields([
  { name: 'myFile', maxCount: 1},
  { name: 'folder', maxCount: 1}
])

// ROUTE-GETS
fileRouter.get("/", fileController.homePageGet);
fileRouter.get("/log-in", fileController.logInFormGet);
fileRouter.get("/sign-up", fileController.signUpFormGet);
fileRouter.get("/log-out", fileController.logOutGet);
// Folders
fileRouter.get("/folder-new", ensureAuth ,fileController.renderFolderCreate);
fileRouter.get("/folders/:folderName", ensureAuth, fileController.viewFolderContents);
fileRouter.get("/folders/:folderName/rename", ensureAuth, fileController.folderUpdate);
// Files
fileRouter.get("/file-new", ensureAuth ,fileController.renderUploadForm);
fileRouter.get("/files/:folderName/:fileName", ensureAuth, fileController.fileGet);
fileRouter.get("/files/:folderName/:fileName/rename", ensureAuth, fileController.fileUpdate);
fileRouter.get("/download/:folderName/:fileName", fileController.fileDownload);

// ROUTE-POSTS
fileRouter.post("/log-in", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if(err) return res.status(500).json({error: "server error" });
    if(!user) return res.status(401).json({ error: info.message || "Invalid Credentials"});

    req.logIn(user, (err) => {
      if(err) return res.status(500).json({error: "Login failed" });
      return res.json({ success: true, user: { id: user.id, username: user.name } });
    })
  })(req,res,next);
});

fileRouter.post('/log-out', fileController.logoutPost);

fileRouter.post("/sign-up", fileController.validateUser, fileController.signUpFormPost);

fileRouter.post('/folders', ensureAuth , fileController.handleFolderCreate);

fileRouter.post('/upload', ensureAuth, upload.single('myFile'), fileController.handleFileUpload);

// ROUTE-PUTS
fileRouter.put('/folders/:folderName', ensureAuth, fileController.folderRename);

fileRouter.put('/files/:folderName/:fileName/rename', ensureAuth, fileController.fileRename);

// ROUTER-DELETES
fileRouter.delete('/folders/:folderName/delete', ensureAuth, fileController.folderDelete);

fileRouter.delete('/files/:folderName/:fileName/delete', ensureAuth, fileController.fileDelete);

module.exports = fileRouter;