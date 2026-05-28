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

// GET

async function getUserData(req,res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      profile: true,
      posts: true,
      followers: true,
      following: true,
      _count: {
        select: {
          followers: true,
          following: true
        }
      }
    }
  })

  res.json({ user: user  });
};

async function getUserProfile(req,res) {
  const { username } = req.params;
  
  const user = await prisma.user.findFirst({
    where: { profile: { username: username} },
    select: {
      id: true,
      profile: true,
      posts: true,
      followers: true,
      following: true,
      _count: {
        select: {
          followers: true,
          following: true
        }
      }
    }
  })

  const isFollowing = await prisma.follows.findFirst({
    where: {
      followerId: req.user.id,
      followingId: user.userId
    }
  })

  res.json({user, isFollowing: Boolean(isFollowing)});
  
  if(!user) {
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

async function getUserFeed(req, res) {
  const userId = req.user.id;

  // Who the user follows
  const following = await prisma.follows.findMany({
    where: { followerId: userId },
    select: { followingId: true }
  });

  const followingIds = following.map(f => f.followingId);

  // Posts from people you follow
  const followingPosts = await prisma.post.findMany({
    where: {
      userId: {
        in: followingIds.length > 0 ? followingIds : [0]
      }
    },
    include: {
      user: { include: { profile: true } },
      _count: { select: { likes: true, comments: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  // Discovery posts
  const discoveryPosts = await prisma.post.findMany({
    where: {
      userId: {
        notIn: [...followingIds, userId]
      }
    },
    include: {
      user: { include: { profile: true } },
      _count: { select: { likes: true, comments: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  // Merge + shuffle
  const feed = [...followingPosts, ...discoveryPosts].sort(
    () => Math.random() - 0.5
  );

  res.json(feed);
}

async function getUserPost(req, res) {

  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      user: { include: { profile: true} },
      comments: { include: { user: { include: { profile: true } } } },
      likes: true
    }
  })

  res.json(post);
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
                  username: true,
                  avatar: true
                  
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
              username: true,
              avatar: true
            }
          } 
        }
      }
    }
  });

  res.json(messages);
}

// POST


async function createPost(req, res) {
  const userId = req.user.id;

  if(!req.file) {
    return res.status(400).json({ error: "No image uploaded"})
  }

  const filePath = `/uploads/posts/${req.file.filename}`;
  const file = req.file;

  const isVideo = file.mimetype.startsWith("video/");
  const isImage = file.mimetype.startsWith("image/");

  const post = await prisma.post.create({
    data: {
      userId,
      mediaUrl: filePath,
      mediaType: isVideo ? "VIDEO" : "IMAGE",
      caption: req.body.caption || ""
    }
  });

  res.json({ success: true, post });
}

async function uploadAvatar(req, res) {
  const userId = req.user.id;

  if(!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = `/uploads/avatars/${req.file.filename}`;

  // 1. Get old avatar
  const profile = await prisma.profile.findUnique({
    where: { userId }
  });
  const oldAvatar = profile?.avatar;
  // 2. Delete old avatar
  if (oldAvatar) {
    const fullPath = path.join(process.cwd(), oldAvatar);
    fs.unlink(fullPath, (err) => {
      if(err){ console.log("Failed to delete old avatar:", err)};
    });
  }
  // 3. Update new avatar
  await prisma.profile.update({
    where: { userId },
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
  getUserData,
  getUserProfile,
  
  getUserSearch,
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

  createPost,
  getUserPost,
  getUserFeed
}