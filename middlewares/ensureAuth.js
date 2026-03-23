function ensureAuth(req, res, next) {
    if(req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }
    res.redirect('/log-in');
}

module.exports = ensureAuth;