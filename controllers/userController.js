const bcryptjs = require("bcryptjs");
const { body, validationResult, Result } = require("express-validator");
const prisma = require("../models/prisma.js");
const path = require('path');
const fs = require('fs');
const upload = require("../middlewares/multer.js");
const cloudinary = require("../middlewares/cloudinary.js");
const { error } = require("console");

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// GET

async function getUserData(req,res) {
  // Check to see if user is logged in.
  if(!req.user || !req.user.id) {
    return res.status(401).json({
      error: "Not Authenticated",
      message: "User is not logged in."
    })
  }

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
      followingId: user.id
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
      _count: { select: { likes: true, comments: true } },
      likes: {
        where: { userId: userId },
        select: { id: true }
      }
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

async function getSuggested(req, res) {
  const userId = req.user.id;

  // Get IDs of people the user already follows
  const following = await prisma.follows.findMany({
    where: { followerId: userId },
    select: { followingId: true }
  });

  const followingIds = following.map(f => f.followingId);

  // Suggested users
  const suggestions = await prisma.user.findMany({
    where: {
      id: {
        notIn: [...followingIds, userId] // exclude yourself + people you follow
      }
    },
    include: {
      profile: true,
      _count: {
        select: { followers: true }
      }
    },
    orderBy: {
      followers: {
        _count: "desc"
      }
    },
    take: 10
  });

  res.json(suggestions);
}

async function getUserPost(req, res) {
  const userId = req.user.id;

  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      user: { include: { profile: true} },
      comments: { include: { user: { include: { profile: true } } } },
      _count: { select: { likes: true, comments: true } },
      likes: {
        where: { userId: userId },
        select: { id: true }
      }
    }
  })

  res.json(post);
}

async function getPostComments(req, res) {
  const postId = Number(req.params.id);

  const comments = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        include: { profile: true}
      }
    }
  });

  res.json(comments);
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
      post: {
        include: {
          user: { include: { profile: true }}
        }
      },
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

async function uploadPostFile(req, res) {
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

async function uploadPostCloud(req, res) {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Upload to Cloudinary using upload_stream
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "posts",
          resource_type: "auto" // auto-detect image or video
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      stream.end(req.file.buffer);
    });

    // Cloudinary gives us:
    // uploadResult.secure_url
    // uploadResult.resource_type ("image" or "video")

    const post = await prisma.post.create({
      data: {
        userId,
        mediaUrl: uploadResult.secure_url,
        mediaType: uploadResult.resource_type.toUpperCase(), // "IMAGE" or "VIDEO"
        caption: req.body.caption || ""
      }
    });

    res.json({ success: true, post });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Post upload failed" });
  }
}

async function likeUserPost(req, res) {
  const userId = req.user.id;
  const postId = Number(req.params.id);

  try {
    await prisma.like.create({
      data: { userId, postId }
    });

    res.json({ success: true });
  } catch (err) {
    // If liked, ignore request.
    res.json({ success: false, message: "Already liked" });
  }
}

async function sendPostComment(req, res) {
  const postId = Number(req.params.id);
  const userId = req.user.id;
  const { text } = req.body;

  const comment = await prisma.comment.create({
    data: {
      postId,
      userId,
      text
    },
    include: {
      user: { include: { profile: true }}
    }
  });

  res.json(comment);
}

async function uploadAvatarFile(req, res) {
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

async function uploadAvatarCloud(req, res) {
  try {
    const userId = req.user.id;

    if(!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Upload to Cloudinary using upload_stream
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
          folder: "avatars",
          public_id: `avatar_${userId}`, // overwrite old avatar auto
          overwrite: true,
          resource_type: "image"
        },
        (error, result) => {
          if(error) reject(error);
          else resolve(result);
        }
      );

      stream.end(req.file.buffer);
    });

    //Save Cloudinary URL in Database.
    const updated = await prisma.profile.update({
      where: { userId},
      data: { avatar: uploadResult.secure_url }
    });

    res.json({
      message: "Avatar updated succesfully",
      avatar: uploadResult.secure_url
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({error: "Avatar upload failed"});
  }
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

async function sendUserMessage(req,res) {
  const conversationId = Number(req.params.id);
  const senderId = req.user.id;
  const { text } = req.body;
  
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

async function sendUserPost(req,res) {
  const conversationId = Number(req.params.id);
  const senderId = req.user.id;
  const { postId } = req.body;

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      postId
    },
    include: {
      post: {
        include: {
          user: { include: {profile: true}}
        }
      }
    }
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

async function unlikeUserPost(req, res) {
  const userId = req.user.id;
  const postId = Number(req.params.id);

  await prisma.like.deleteMany({
    where: { userId, postId }
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
  sendUserMessage,
  sendUserPost,

  updateProfile,
  updateAccount,
  uploadAvatarFile,
  uploadAvatarCloud,
  deleteAccount,

  uploadPostFile,
  uploadPostCloud,
  getUserPost,
  getPostComments,
  sendPostComment,
  getUserFeed,
  getSuggested,
  likeUserPost,
  unlikeUserPost
}