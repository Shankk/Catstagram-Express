const bcryptjs = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const prisma = require("../models/prisma.js");
const path = require('path');
const fs = require('fs');
const upload = require("../middlewares/multer.js");

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

// PUT

// GET

async function verifyAuth(req,res) {
  if(!req.isAuthenticated()) return res.status(401).json({message:"Not logged in"})
  res.json({ authenticated: true  });
};

async function userBasic(req,res) {
  if(!req.isAuthenticated()) return res.status(401).json({message:"Not logged in"})
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      profile: {
        include: {
          posts: true
        }
      },
      followers: true,
      following: true
    }
  })
  res.json({ user: user  });
};

async function getUserProfile(req,res) {
  if(!req.isAuthenticated()) return res.status(401).json({message:"Not logged in"})
  
  const { username } = req.params;
  
  const profile = await prisma.profile.findUnique({
    where: { username },
    include: {
      posts: true,
      user: {
        select: {
          _count: {
            select: {
              followers: true,
              following: true
            }
          }
        }
      }
    }
  })
  res.json(profile);
  if(!profile) {
    return res.status(404).json({ error: "Profile not found"});
  }
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
  } catch(err) {
    if(err.code == 'P2002' && err.meta?.target?.includes('username')) {
      // Prisma Unique constraint
      return res.status(409).json({
        success: false, message: 'Username already exists. Please choose another.'
      });
    }
    return next(err);
  }
}

module.exports = {
  verifyAuth,
  userBasic,
  getUserProfile,
  logoutPost,
  signUpFormPost,
  validateUser
}