const bcryptjs = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const prisma = require("../models/prisma.js");
const passport = require("passport");

const alphaErr = "must only contain letters.";
const lengthErr = "must be between 1 and 16 characters.";
const usernameErr = "must be 4–20 characters, and contain only letters, numbers, or underscores.";
const passwordErr = "8–20 chars, must include 1 uppercase, 1 lowercase, and a number.";
const emailErr = "must be a valid email address.";
const codeErr = "must be valid and 4–20 characters long.";

const validateUser = [
  // First name
  body("firstname")
    .trim()
    .isAlpha().withMessage(`First name ${alphaErr}`)
    .isLength({ min: 1, max: 16 }).withMessage(`First name ${lengthErr}`),

  // Last name
  body("lastname")
    .trim()
    .isAlpha().withMessage(`Last name ${alphaErr}`)
    .isLength({ min: 1, max: 16 }).withMessage(`Last name ${lengthErr}`),
  // Email
  body("email")
    .trim()
    .normalizeEmail()
    .isEmail().withMessage(`Email ${emailErr}`),
  // Username: alphanumeric with underscore, 4–20 chars
  body("username")
    .trim()
    .toLowerCase()
    .matches(/^[a-zA-Z0-9_]+$/).withMessage(`Username ${usernameErr}`)
    .isLength({ min: 4, max: 20 }).withMessage(`Username ${usernameErr}`),

  // Password: at least 8 chars
  body("password")
    .trim()
    .isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1})
    .isLength({ min: 8, max: 20 }).withMessage(`Password ${passwordErr}`),
  body("code")
    .trim()
    .equals('1234')
    .isLength({ min: 4, max: 20 }).withMessage(`Code ${codeErr}`)
];

//GET
async function verifyAuth(req,res) {
  if(!req.isAuthenticated()) {
    return res.status(401).json({message:"Not logged in"})
  }
  res.json({ authenticated: true  });
};

//POST

async function loginUser(req,res) {
  passport.authenticate("local", (err, user, info) => {
    if(err) return res.status(500).json({error: "server error" });
    if(!user) return res.status(401).json({ error: info.message || "Invalid Credentials"});

    req.logIn(user, { keepSessionInfo: true }, (err) => {
      if(err) return res.status(500).json({error: "Login failed" });
      
      req.session.save((err) => {
        if(err) return res.status(500).json({ error: "Session save failed"});
        return res.json({ success: true });
      });
    });
  })(req,res);
}

async function logoutUser(req,res,next) {
  req.session.destroy(err => {
    if(err) return res.status(500).json({ message: 'Logout failed'});
    res.clearCookie('connect.sid');
    res.status(200).json({ message: 'Logged out' });
  });
}

async function signupUser(req,res, next) {
  // 1. Check for validation errors
  console.log('Received Body:', req.body);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array(),
      oldInput: req.body,
    });
  }

  const content = { ...req.body }; // clone to avoid mutating req.body
  content.password = await bcryptjs.hash(req.body.password, 10);
  const is_member = content.code == '1234';
  const is_admin = content.code == '1234';

  const existingEmail = await prisma.user.findUnique({ where: { email: content.email } });
  if(existingEmail) return res.status(400).json({ error: "Email already in use" });
  const existingUsername = await prisma.profile.findUnique({ where: { username: content.username }});
  if(existingUsername) return res.status(400).json({ error: "Username already taken"});

  const user = await prisma.user.create({
    data: {
      email: content.email,
      password: content.password,
      is_member: is_member,
      is_admin: is_admin,
      profile: {
        create: {
          username: content.username ,
          firstname: content.firstname ,
          lastname: content.lastname ,
          dateofbirth: content.dateofbirth
        }
      }
    },
    include: { profile: true }
  });
  res.status(201).json({success: true, message: "Server Sign Up Success!"});
}

async function verifyPassword(req, res) {
  const userId = req.user.id;
  const { password } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  const valid = await bcryptjs.compare(password, user.password);

  res.json({ valid });
}
//PUTS



//DELETE



module.exports = {
    verifyAuth,
    loginUser,
    logoutUser,
    signupUser,
    verifyPassword,
    validateUser
}