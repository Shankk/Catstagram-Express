require('dotenv').config();
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const path = require("node:path");
const cors = require('cors');
const methodOverride = require('method-override');
const session = require("express-session");
const prisma = require("./models/prisma.js");
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const passport = require("passport");
const indexRouter = require("./routes/index.js");

// 1. Body parser FIRST (so req.body is available to middlewares like Multer)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 2. Method override (for PUT/DELETE via forms)
app.use(methodOverride('_method'));

// 3. Session Middleware
require('./middlewares/passport.js');
app.use(session({
  store: new PrismaSessionStore(prisma, {
    checkPeriod: 2 * 60 * 1000,          
    dbRecordIdIsSessionId: true, 
  }),
  secret: 'cat',     
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    secure: false,                  // true if you're using HTTPS
    httpOnly: true,
  }
}));

// 4. Passport Setup
app.use(passport.session());

// 5. View engine and static files
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use('/uploads', express.static('uploads'));

// 6. CORS
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// 7. ROUTER LAST
app.use("/", indexRouter);

// 8 Error Handler
app.use((err, req, res, next) => {
  if(err.message == 'File must have an extension') {
    return res.redirect('/file-new?error=missingExtension');
  }
  next(err);
})

// SOCKET.IO SETUP
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true
  } 
});

io.on("connection", socket => {
  console.log("Socket connected:", socket.id);

  socket.on("join_conversation", conversationId => {
    socket.join(`conversation_${conversationId}`);
  });

  socket.on("send_message", async data => {
    const message = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        text: data.text
      }
    });

    io.to(`converstaion_${data.conversationId}`).emit("new_message", message);
  });
});

// START SERVER
server.listen(3000, () => console.log("Server + Socket.io listening on port 3000!"));