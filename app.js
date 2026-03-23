require('dotenv').config();
const express = require("express");
const app = express();
const path = require("node:path");
const cors = require('cors');
const methodOverride = require('method-override');
const session = require("express-session");
const prisma = require("./models/prisma");
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const passport = require("passport");
const indexRouter = require("./routes/index");

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
//app.use(passport.initialize());
app.use(passport.session());

// 5. View engine and static files
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use('/uploads', express.static('uploads'));

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// 6. ROUTER LAST

app.use("/", indexRouter);


app.use((err, req, res, next) => {
  if(err.message == 'File must have an extension') {
    return res.redirect('/file-new?error=missingExtension');
  }
  next(err);
})

app.listen(3000, () => console.log("app listening on port 3000!"));