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
    .isLength({ min: 4, max: 20 }).withMessage(`Password ${passwordErr}`),
  body("code")
    .trim()
    .equals('1234')
    .isLength({ min: 4, max: 20 }).withMessage(`Code ${codeErr}`)
];

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

  const isFollowing = await prisma.follows.findFirst({
    where: {
      followerId: req.user.id,
      followingId: profile.userId
    }
  })

  res.json({profile, isFollowing: Boolean(isFollowing)});
  
  if(!profile) {
    return res.status(404).json({ error: "Profile not found"});
  }
};

async function getUserSearch(req,res) {
  const query = req.query.query;
  const userId = req.user.id;

  if (!query || query.trim() === "") {
    return res.json([]);
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      profile: {
        username: {
          contains: query,
          mode: "insensitive"
        }
      }
    },
    include: {
      profile: true
    },
    take: 20
  });

  res.json(users);
}

async function getAllConversations(req,res) {
  const userId = req.user.id;

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: {
        some: { userId}
      }
    },
    include: {
      participants: {
        include: {
          user: {
            include: { profile: true }
          }
        }
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  res.json(conversations);
}

async function getConversation(req,res) {
  const conversationId = Number(req.params.id);

  const conversation = await prisma.conversation.findUnique({
    where: {id: conversationId},
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              profile:{
                select:{
                  username: true
                }
              }
            }
          }
        }
      }
    }
  })
  res.json(conversation);
}

async function getConversationMessages(req,res) {
  const conversationId = Number(req.params.id);

  const messages = await prisma.message.findMany({
    where: { 
      conversationId 
    },
    orderBy: { 
      createdAt: "asc" 
    },
    include: {
      sender: {
        select: { 
          profile: {
            select: {
              username: true
            }
          } 
        }
      }
    }
  });

  res.json(messages);
}

// POST

async function verifyPassword(req, res) {
  const userId = req.user.id;
  const { password } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  const valid = await bcryptjs.compare(password, user.password);

  res.json({ valid });
}

async function uploadAvatar(req, res) {
  const userId = req.user.id;

  if(!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = `/uploads/avatars/${req.file.filename}`;

  await prisma.profile.update({
    where: { id: userId },
    data: { avatar: filePath }
  });

  res.json({ success: true, avatar: filePath });
}

async function createConversation(req,res) {
  const userId = req.user.id;
  const otherUserId = req.body.userId;

  // Check if conversation already exists
  const existing = await prisma.conversation.findFirst({
    where: {
      participants: {
        every: {
          userId: { in: [userId, otherUserId] }
        }
      }
    }
  });

  if (existing) return res.json(existing);

  // Create new conversation
  const conversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId },
          { userId: otherUserId }
        ]
      }
    }
  });

  res.json(conversation);
}

async function postNewMessage(req,res) {
  const { conversationId, text } = req.body;
  const senderId = req.user.id;

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      text
    }
  });

  // Update conversation timestamp
  await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
  });

  res.json(message);
}

async function followUser(req, res) {
  try {
    const followerId = req.user.id;
    const { username } = req.params;

    const targetProfile = await prisma.profile.findUnique({
      where: { username },
      select: { userId: true }
    });

    if(!targetProfile) {
      return res.status(404).json({ error: "User not found" });
    }

    const followingId = targetProfile.userId;

    await prisma.follows.create({
      data: {
        followerId,
        followingId
      }
    });

    res.json({ success: true, message: "Followed successfully" });
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ error: "Server error"});
  }
  
}

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

// PUT

async function updateProfile(req, res) {
  const userId = req.user.id;
  const { firstname, lastname, username, bio, avatar } = req.body;

  const updated = await prisma.profile.update({
    where: { userId },
    data: { 
      firstname,
      lastname,
      username,
      bio,
      avatar
    }
  });

  res.json(updated);
}

async function updateAccount(req, res) {
  const userId = req.user.id;
  const { email, password } = req.body;

  //console.log("EMAIL:", email);
  //console.log("PASS:", password);
  
  const data = { email };

  if(password) {
    data.password = await bcryptjs.hash(password, 10);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data
  });

  res.json({success: true });
}

// DELETES

async function unfollowUser(req, res) {
  try {
    const followerId = req.user.id;
    const { username } = req.params;

    const targetProfile = await prisma.profile.findUnique({
      where: { username },
      select: { userId: true }
    });

    if(!targetProfile) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.follows.deleteMany({
      where: {
        followerId,
        followingId: targetProfile.userId
      }
    });

    res.json({ success: true, message: "Unfollowed successfully" });

  } catch (err) {
    console.error("Unfollow error:", err);
    res.status(500).json({ error: "server error"});
  }
}

async function deleteAccount(req, res) {
  const userId = req.user.id;

  await prisma.user.delete({
    where: { id: userId }
  });

  res.json({ success: true });
}

module.exports = {
  verifyAuth,
  userBasic,
  getUserProfile,
  getUserSearch,
  logoutPost,
  signUpFormPost,
  followUser,
  unfollowUser,
  getAllConversations,
  getConversation,
  getConversationMessages,
  createConversation,
  postNewMessage,
  updateProfile,
  updateAccount,
  uploadAvatar,
  deleteAccount,
  verifyPassword,
  validateUser
}