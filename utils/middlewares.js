
function userLogged(req, res, next) {
    if (req.user)
        return next();
    else
        return res.redirect('/');
}
exports.userLogged = userLogged;
