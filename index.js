//THE MAIN SERVER

var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var server = require('http').createServer(app);
var session = require('express-session');
var authentification = require('./utils/passport.js');
var middlewares = require('./utils/middlewares.js');
var mongoUtils = require('./utils/mongoDB.js');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth-2').Strategy;

//CONFIG
var DB_URL = 'mongodb://localhost:27017';
var PORT = process.env.PORT || 9998;

//DATABASE FOR SESSION MANAGEMENT
var mongo = require('mongodb');
var MongoStore = require('connect-mongo')(session);
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var DATA_COLLECTION = 'DATA';


/////DATABASE CONNECT AND SERVER START\\\\\

MongoClient.connect(DB_URL, function (err, database) {
  if(err) throw err;
  console.log(database)
  initWebServer(database);
  console.log("Connected correctly to server");
  server.listen(PORT, "0.0.0.0");
  console.log("Listening on port ",PORT);
});

function initWebServer(db){
    app.use(session({
      store: new MongoStore({
        url: DB_URL
        , })
      , secret: 'dont put that on github'
    }));
    app.use(bodyParser.json()); // to support JSON-encoded bodies
    app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
      extended: true
    }));
    app.set('views', __dirname + '/html');
    app.use('/static', express.static(__dirname + '/static'));
    app.engine('html', require('ejs').renderFile);
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(require('connect-flash')())
    authentification.googleStrategy(passport, GoogleStrategy,db);
    authentification.serializeUser(passport);
    authentification.deserializeUser(passport,db);
    authentification.getAuthGogle(app, passport);
    authentification.getAuthGogleCback(app, passport);
    authentification.getAuthGogleCback(app, passport);
    authentification.signOut(app, passport);
    //HANDLEBARS HELPERS

    app.get('/index', middlewares.userLogged, function (req, res, next) {
        //console.log(req.user);
        res.render("index.html");
    });
    app.get('/' ,function (req, res, next) {
        res.render("home.html");
    });

    app.get('/userData' ,function (req, res, next) {
        res.json(req.user);
    });


    app.get('/deletePlaylist' ,function (req, res, next) {
        var collection = db.collection('USER');
        collection.update({
            "Mail": req.user.Mail
        }, {
            $set: {playlist: null}
        })
        res.redirect('/index');
    });


    app.post('/myPlaylist', function (req, res, next) {
        console.log(req.body.playlist);
        var collection = db.collection('USER');
        collection.update({
            "Mail": req.user.Mail
        }, {
            $set: {playlist: req.body.playlist}
        })
        res.end("ok");
    });
}
