const prisma = require("../models/prisma.js");
const passport = require("passport");
const LocalStrategy = require('passport-local').Strategy;
const bcryptjs = require("bcryptjs");

// LOCAL STRATEGY

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { name: username },
      });

      if (!user) {
        return done(null, false, { message: "Incorrect username" });
      }

      const match = await bcryptjs.compare(password, user.password);
      
      if (!match ) {
        return done(null, false, { message: "Incorrect password" });
      }
      return done(null, user);
    } catch(err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
        where: { id },
    });

    done(null, user);
  } catch(err) {
    done(err);
  }
});