const bcryptjs = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const prisma = require("../models/prisma");
const path = require('path');
const fs = require('fs');
const upload = require("../middlewares/multer");

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const alphaErr = "must only contain letters.";
const lengthErr = "must be between 1 and 16 characters.";
const usernameErr = "must be 4–20 characters, and contain only letters, numbers, or underscores.";
const passwordErr = "must be 4–20 characters long.";
const codeErr = "must be valid and 4–20 characters long.";

const validateUser = [
  // First name
  /* body("first_name")
    .trim()
    .escape()
    .isAlpha().withMessage(`First name ${alphaErr}`)
    .isLength({ min: 1, max: 16 }).withMessage(`First name ${lengthErr}`),

  // Last name
  body("last_name")
    .trim()
    .escape()
    .isAlpha().withMessage(`Last name ${alphaErr}`)
    .isLength({ min: 1, max: 16 }).withMessage(`Last name ${lengthErr}`), */

  // Username: alphanumeric with underscore, 4–20 chars
  body("username")
    .trim()
    .escape()
    .matches(/^[a-zA-Z0-9_]+$/)
    .isLength({ min: 4, max: 20 }).withMessage(`Username ${usernameErr}`),

  // Password: at least 8 chars
  body("password")
    .trim()
    .isLength({ min: 4, max: 20 }).withMessage(`Password ${passwordErr}`),
  body("code")
    .trim()
    .equals('1234')
    .isLength({ min: 4, max: 20 }).withMessage(`Code ${codeErr}`)
];

// DELETES

async function folderDelete(req,res) {
  const folderName = req.params.folderName;
  const folderPath = path.join(__dirname, '../uploads', folderName);

  fs.rm(folderPath, { recursive: true, force: true }, (err) => {
    if(err) return res.status(500).send('Failed to delete folder');
    res.redirect('/');
  });
}

async function fileDelete(req, res) {
  const filePath = path.join(__dirname, '../uploads', req.params.folderName,req.params.fileName);
  fs.unlink(filePath, (err) => {
    if(err) return res.status(500).send('Delete Failed');
    res.redirect("/");
  });
}

// PUT

async function folderRename(req, res) {
  const oldName = req.params.folderName;
  const newName = req.body.newName;
  const oldPath = path.join(__dirname, '../uploads', oldName);
  const newPath = path.join(__dirname, '../uploads', newName);

  fs.rename(oldPath, newPath, (err) =>{
    if(err) return res.status(500).send('Failed to rename folder');
    res.redirect('/');
  });
}

async function fileRename(req,res) {
  const oldFoldername = req.params.folderName;
  const oldFilename = req.params.fileName;
  const newFilename = req.body.newName;
  if(!newFilename) {
    return res.status(400).send('New filename is required');
  }

  const oldPath = path.join(__dirname, '../uploads', oldFoldername, oldFilename);
  const newPath = path.join(__dirname, '../uploads', oldFoldername, newFilename);

  fs.rename(oldPath,newPath, (err) => {
    if(err) {
      console.error('Rename error:', err);
      return res.status(500).send("Rename failed");
    }
    res.redirect("/");
  });
}



// GET

async function homePageGet(req,res) {
  const uploadsDir = path.join(__dirname, '../uploads');
  /* fs.readdir(uploadsDir, { withFileTypes: true}, (err, entries) => {
    if(err){
      console.error('Error reading uploads folder: ',err);
      return res.status(500).send('Unable to load folders.');
    }
    const folders = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
    
    res.render("home-page",{
      user: req.user,
      folders
    }); 
  }); */
  console.log('session check:', req.session);
  console.log('user check:', req.user);
  if(!req.isAuthenticated()) return res.status(401).json({message:"Not logged in"})
    res.json({ user: req.user });
};

async function logInFormGet(req,res) {
  res.render("log-in-form",{

  })
};

async function signUpFormGet(req,res) {
  res.render("sign-up-form",{

  })
};

async function logOutGet(req,res, next) {
  req.logout((err) => {
    if(err) {
      return next(err);
    }
    res.redirect("/");
  });
};

async function renderFolderCreate(req,res) {
  const name = req.params.name;
  res.render("create-folder-form",{
    folder: { foldername: name }
  })
}

async function viewFolderContents(req,res) {
  const folderName = req.params.folderName;
  const folderPath = path.join(__dirname, '../uploads', folderName);

  if(!fs.existsSync(folderPath)) {
    return res.status(404).send('Folder not found.');
  }

  const files = fs.readdirSync(folderPath).map(filename => {
    const filePath = path.join(folderPath, filename);
    const stats = fs.statSync(filePath);

    return {
      name: filename,
      size: (stats.size / 1024).toFixed(2), // KB
      uploadTime: stats.birthtime.toLocaleString()
    };
  });
  
  res.render('folder-view', {
    folderName,
    files,
  });
};

async function folderUpdate(req,res) {
  const folderName = req.params.folderName;
  res.render("update-folder-form",{
    folder: { folderName: folderName }
  })
}

async function renderUploadForm(req,res, next) {
  const uploadsDir = path.join(__dirname, '..','uploads');
  const folders = fs.readdirSync(uploadsDir).filter(name =>
    fs.statSync(path.join(uploadsDir, name)).isDirectory()
  );

  res.render("upload-file-form",{
    user: req.user,
    folders,
    req
  });
};

async function fileGet(req,res) {
  const folderName = req.params.folderName;
  const fileName = req.params.fileName;
  const filePath = path.join(__dirname, '../uploads', folderName, fileName);
  res.sendFile(filePath);
}

async function fileUpdate(req,res) {
  const folderName = req.params.folderName;
  const fileName = req.params.fileName;
  res.render("update-file-form",{
    folder: { folderName: folderName},
    file: { fileName: fileName }
  });
};

async function fileDownload(req,res) {
  const folderName = req.params.folderName;
  const fileName = req.params.fileName;
  const filePath = path.join(__dirname, '../uploads', folderName, fileName);

  res.download(filePath, fileName, (err) => {
    if(err) {
      console.error('Download Error: ', err);
      res.status(404).send('File not found or download failed');
    }
  });
};

// POST

async function logoutPost(req,res,next) {
  req.session.destroy(err => {
    if(err) return res.status(500).json({ message: 'Logout failed'});
    res.clearCookie('connect.sid');
    res.status(200).json({ message: 'Logged out' });
  });
}

async function signUpFormPost(req,res, next) {
  // 1. Check for validation errors
  console.log('Received Body:', req.body);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array(),
      oldInput: req.body,
    });
  }

  try {
    const content = { ...req.body }; // clone to avoid mutating req.body
    content.password = await bcryptjs.hash(req.body.password, 10);
    const is_member = content.code == '1234';
    const is_admin = content.code == '1234';
    await prisma.user.create({
      data: {
        name: content.username,
        password: content.password,
        is_member: is_member,
        is_admin: is_admin
      }
    });
    res.json({success: true, message: "Server Sign Up Success!"});
  } catch(err) {
    if(err.code == 'P2002' && err.meta?.target?.includes('name')) {
      // Prisma Unique constraint
      return res.status(409).json({
        success: false, message: 'Username already exists. Please choose another.'
      });
    }
    //return next(err);
  }
}

async function handleFolderCreate(req,res) {
  const folderName = req.body.name;
  const folderPath = path.join(__dirname, '../uploads', folderName);

  fs.mkdir(folderPath, { recursive: false }, (err) => {
    if(err) return res.status(500).send('Failed to create folder.');
    res.redirect('/');
  })
}

async function handleFileUpload(req, res) {
  if(!req.file) return res.status(400).send("No file uploaded.");
  res.redirect('/');
}

module.exports = {
  homePageGet,
  logInFormGet,
  signUpFormGet,
  logOutGet,
  logoutPost,
  signUpFormPost,
  renderUploadForm,
  handleFileUpload,
  renderFolderCreate,
  handleFolderCreate,
  viewFolderContents,
  folderUpdate,
  folderRename,
  folderDelete,
  fileGet,
  fileUpdate,
  fileDownload,
  fileRename,
  fileDelete,
  validateUser
}