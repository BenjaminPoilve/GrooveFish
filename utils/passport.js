
var uuid= require('uuid');
var assert = require('assert');
var mongoUtils = require('./mongoDB.js');


function googleStrategy(passport, GoogleStrategy, db) {
    passport.use(new GoogleStrategy({
            'clientID': 'nope'
            , 'clientSecret': 'nope'
            , 'callbackURL': '/auth/google/callback'
            , passReqToCallback: true
        }, function (req, token, refreshToken, profile, done) {
            process.nextTick(function () {
                console.log("profile", profile._json.image.url);
                console.log('email', profile.emails[0].value)
                var collection = db.collection('USER');
                collection.findOne({
                    "Mail": profile.emails[0].value
                }, function (err, item) {
                    if (item == null) {
                        var data = {
                            "Surname": profile.name.givenName
                            , "Name": profile.name.familyName
                            ,"Mail": profile.emails[0].value
                            , "picture":  profile._json.image.url
                            , "playlist": []}
                        mongoUtils.saveData(data, 'USER',db)
                        console.log("creating");
                        return done(null, data);
                    } else {
                        console.log("existing");
                        console.log(item);
                        return done(null, item);

                    }
                });
            });
        }
    ));
}
exports.googleStrategy = googleStrategy;

function serializeUser(passport){
    passport.serializeUser(function (user, done) {
        console.log("serializing", user);
        done(null, user.Mail);
    });
}
exports.serializeUser = serializeUser;

function deserializeUser(passport,db){
    passport.deserializeUser(function (Mail, done) {
        var collection = db.collection('USER');
        collection.findOne({
            "Mail": Mail
        }, function (err, user) {
            done(err, user);
        });
    });
}
exports.deserializeUser = deserializeUser;

function getAuthGogle(app, passport){
    app.get('/auth/google'
        , passport.authenticate('google', {
            scope: ['profile', 'email'],
            authType: 'rerequest'
        })
        , function (req, res) {

        });
}
exports.getAuthGogle = getAuthGogle;

function getAuthGogleCback(app, passport){
    app.get('/auth/google/callback'
        , passport.authenticate('google', {
            failureRedirect: '/'
        })
        , function (req, res) {
              res.redirect('/index');
        });
}
exports.getAuthGogleCback = getAuthGogleCback;



function signOut(app, passport){
    app.get('/signOut' ,function (req, res, next) {
        req.logout();
        res.redirect('/');
    });
}
exports.signOut = signOut;
