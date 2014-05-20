var express = require('express');
var fs = require('fs');
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var habitat = require('habitat');
var mongodb = require('mongodb');
var LastfmAPI = require('lastfmapi');


// Configuration

var MongoClient = require('mongodb').MongoClient, Server = require('mongodb').Server;
var mongoClient = new MongoClient(new Server('localhost', 27017));

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
var io = require('socket.io').listen(app.listen(8080));

var lfm = new LastfmAPI({
    'api_key' : env.get('RASSEYE_LASTFM_API_KEY'),
    'secret' : env.get('RASSEYE_LASTFM_API_SECRET')
});


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

app.get('/logic', function(req, res) {
    mongoClient.open(function(err, mongoClient) {
	var db = mongoClient.db("rasseye");
	var coll = db.collection("ConcertRequest");
	coll.find().toArray(function(err, items) {
	    mongoClient.close();
	    res.render('logic.ejs', { locals: { data: JSON.stringify(items) } });
	});
    });
});

app.get('/show/:showid([0-9a-z]{24})', function(req, res) {
    var showId = req.params.showid;
    mongoClient.open(function(err, mongoClient) {
	var db = mongoClient.db("rasseye");
	var coll = db.collection("ConcertRequest");
	coll.find({ _id: new mongodb.ObjectID(showId) }).toArray(function(err, items) {
	    if (items.length != 1) {
		mongoClient.close(); // This all needs an urgent fix: db should be a singleton
		res.send("Show not found");
	    } else {
		votesColl = db.collection("Vote");
		votesColl.find({ concert_id: items[0]["_id"] }).toArray(function(err, votes) {
		    mongoClient.close();
		    res.render('show.ejs', { locals: { show: JSON.stringify(items[0]), votes: votes.length, user: req.session.userId } });
		});
	    }
	});
    });
});

app.post('/set/:showid([0-9a-z]{24})', ensureAuthenticated, function(req, res) {
    var showId = new mongodb.ObjectID(req.params.showid);
    mongoClient.open(function(err, mongoClient) {
	var db = mongoClient.db("rasseye");
	var coll = db.collection("ConcertRequest");
	coll.find({ _id: showId }).toArray(function(err, items) {
	    if (items.length != 1) {
		mongoClient.close(); // This all needs an urgent fix: db should be a singleton
		res.send("Show not found");
	    } else {
		var user = req.user.id; // To fix: we should check the user here as well

		coll.update({ _id: showId }, { $set: { is_approved: req.body.status, comment: req.body.comment } }, function(err, cnt) {
		    mongoClient.close();
		    res.redirect('/show/' + req.params.showid);
		});
	    }
	});
    });
});

app.post('/show/:showid([0-9a-z]{24})', ensureAuthenticated, function(req, res) {
    var showId = req.params.showid;
    mongoClient.open(function(err, mongoClient) {
	var db = mongoClient.db("rasseye");
	var coll = db.collection("ConcertRequest");
	coll.find({ _id: new mongodb.ObjectID(showId) }).toArray(function(err, items) {
	    if (items.length != 1) {
		mongoClient.close(); // This all needs an urgent fix: db should be a singleton
		res.send("Show not found");
	    } else {
		var user = req.user.id;
		votesColl = db.collection("Vote");
		votesColl.find({ concert_id: items[0]["_id"], user_id: user }).toArray(function(err, votes) {
		    if (votes.length > 0) {
			mongoClient.close();
			res.render('oops.ejs', { locals: { message: "You have already voted for this show. You can't vote more than once!" } });
		    } else {
			var vote = { concert_id: items[0]["_id"], user_id: user, price: req.body.price };
			votesColl.insert(vote, function(err, records) {
			    mongoClient.close();
			    res.render('oops.ejs', { locals: { message: "You voted, thank you!" } });
			})
		    }
		});
	    }
	});
    });
});

app.get('/new', ensureAuthenticated, function(req, res) {
    res.render('new.ejs');
});

app.post('/new', ensureAuthenticated, function(req, res) {
    var mbid = req.body.artistId;
    var where = req.body.where;
    mongoClient.open(function(err, mongoClient) {
	var db = mongoClient.db("rasseye");
	var coll = db.collection("ConcertRequest");
	var now = new Date();
	var item = {
	    author_id: req.user.id,
	    artist_id: mbid,
	    place: where,
	    creation_time: now.getDate() + "/" + (now.getMonth() + 1) + "/" + now.getFullYear(),
	    is_approved: "in progress",
	    is_done: 0,
	    artist_name: req.body.artistRealName
	};
	coll.insert(item, function(err, inserted) {
	    mongoClient.close();
	    res.redirect('/show/' + inserted[0]._id);
	});
    });
});

app.get('/auth/facebook', passport.authenticate('facebook'));

app.get('/auth/facebook/callback',
	passport.authenticate('facebook', { failureRedirect: '/not_auth' }),
	function(req, res) {
	    var redirect_to = req.session.redirect_to || '/';
	    req.session.userId = req.user.id; // Not sure about its correctness
	    res.redirect(redirect_to);
	});

app.get('/logout', function(req, res) {
	req.session.userId = undefined;
	req.logout();
	res.redirect('/');
    });

app.get('/not_auth', function(req, res) {
	res.send("Authentication failed");
    });


io.sockets.on('connection', function (socket) {
    socket.on('get artist info', function (data) {
	lfm.artist.search({ 'artist': data.name },
			  function (err, found) {
			      if (found) {
				  var artistList = found.artistmatches.artist;
				  var artist = artistList[0];
				  var artistImg = artist.image[3]["#text"]; // Medium size image
				  if (artist.mbid) {
				      lfm.artist.getInfo({ mbid: artist.mbid },
							 function(err, info) {
							     socket.emit('artist info', {
								     artistId: artist.mbid,
								     name: artist.name,
								     description: info.bio.summary,
								     picUrl: artistImg });
							 });
				  } // else { alert("Artist not found"); } // TODO handle alerts
			      } // TODO alert here as well
			  });
    });
});


// Authentication

function ensureAuthenticated(req, res, next) {
    req.session.redirect_to = req.path;
    if (req.isAuthenticated()) { return next(); }
    res.redirect('/auth/facebook');
}