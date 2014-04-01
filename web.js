var express = require('express');
var fs = require('fs');
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var habitat = require('habitat');

// Configuration

var env = habitat.load();

var FACEBOOK_APP_ID = "425687127544418";
var FACEBOOK_APP_SECRET = env.get('RASSEYE_FACEBOOK_APP_SECRET');

passport.serializeUser(function(user, done) {
	done(null, user);
    });

passport.deserializeUser(function(obj, done) {
	done(null, obj);
    });

passport.use(new FacebookStrategy({ clientID: FACEBOOK_APP_ID, clientSecret: FACEBOOK_APP_SECRET, callbackURL: "http://localhost:8080/auth/facebook/callback" },
				  function(accessToken, refreshToken, profile, done) {
				      process.nextTick(function() {
					      return done(null, profile);
					  });
				  }));

var app = express();
// Favicon
app.use(express.favicon(__dirname + '/favicon.ico'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.methodOverride());
// Render html pages
app.set('view options', { layout: false });
app.set('view engine', 'ejs');
app.set('views', __dirname + '/');
// Authenticate users via Facebook
app.use(express.session({ secret: env.get('RASSEYE_EXPRESS_SESSION_SECRET') }));
app.use(passport.initialize());
app.use(passport.session());
// Serve static files like images
app.use(express.static(__dirname + '/public'));


// Routes

app.get('/', function(req, res) {
	res.render('index.ejs');
});

app.get('/us', function(req, res) {
	res.render('us.ejs');
});

app.get('/blog', function(req, res) {
	res.render('blog.ejs');
});

app.get('/fame', function(req, res) {
	res.send("Our future wall of fame, your name can be here!".toString('utf-8'));
});

app.get('/btc', function(req, res) {
	res.render('btc.ejs');
});

app.get('/logic', ensureAuthenticated, function(req, res) {
	//res.render('logic.ejs');
	res.send(req.user);
});

app.get('/auth/facebook', passport.authenticate('facebook'));

app.get('/auth/facebook/callback',
	passport.authenticate('facebook', { failureRedirect: '/not_auth' }),
	function(req, res) {
	    res.redirect('/logic');
	});

app.get('/logout', function(req, res) {
	req.logout();
    });

app.get('/not_auth', function(req, res) {
	res.send("Authentication failed");
    });

// Port

var port = process.env.PORT || 8080;
app.listen(port, function() {
	console.log("Listening on " + port);
});


// Authentication

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.redirect('/auth/facebook');
}