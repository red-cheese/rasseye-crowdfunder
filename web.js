var express = require('express');
var fs = require('fs');


// Configuration

var app = express();
app.use(express.bodyParser());
app.use(express.methodOverride());
// Render html pages
app.set('view options', { layout: false });
app.set('view engine', 'ejs');
app.set('views', __dirname + '/');
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


// Port

var port = process.env.PORT || 8080;
app.listen(port, function() {
	console.log("Listening on " + port);
});