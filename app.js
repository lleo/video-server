'use strict';

let debuglog       = require('debug')
  , fs             = require('fs')
  , path           = require('path')
  , express        = require('express')
  , favicon        = require('serve-favicon')
  , logger         = require('morgan')
  , cookieParser   = require('cookie-parser')
  , bodyParser     = require('body-parser')
  , methodOverride = require('method-override')
  , session        = require('express-session')
//  , multer         = require('multer')
//  , errorHandler   = require('errorhandler')

let app = express()
  , debug = debuglog('debug')
  , u = require('lodash')

console.log("HELLO app.js")

/*
 * From: http://expressjs.com/guide/using-template-engines.html
 * Once the view engine is set, you don’t have to explicitly specify
 * the engine or load the template engine module in your app, Express
 * loads it internally as shown below, for the example
 * above.
 */
// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')

/* 
 *  Set the Application Title
 */
app.set('title',"Sean Egan's Video File Server")

/*
 *  Read and Parse the Config File
 */
let cfgfn = './video-server.json'
  , orig_cfg_json_str   = fs.readFileSync(cfgfn, 'utf8')
  , orig_cfg

try {
  orig_cfg = JSON.parse(orig_cfg_json_str)
} catch (x) {
  console.error("Faild to parse json data from %s", cfgfn)
  console.error(cfg_json_str)
  process.exit(1)
}

/*
 *  Save the Original Config Data in the Application as 'app config orig'
 */
app.set('app config orig', orig_cfg)

/*
 *  Restructure the Config Data from a list into a Hash lookup by Root name
 */
var cfg = {}
cfg['video roots'] = {}
cfg.order = []
for (let ent of orig_cfg['video roots']) {
  cfg['video roots'][ent.name] = { fqdn: ent.fqdn }
  cfg.order.push(ent.name)
}
cfg['acceptable extensions'] = u.clone(orig_cfg['acceptable extensions'])

/*
 *  Save By-Name Config Data in the Application as 'app config by name'
 */
app.set('app config by name', cfg)

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'static', 'img', 'favicon.ico')))
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'static')))

let index  = require('./routes/index')
  , stream = require('./routes/stream')
  , lookup = require('./routes/lookup')

debug("typeof lookup = ", typeof lookup)

app.get('/', index)
app.get('/lookup', lookup)
//app.get('/stream/:subdirs*/:file', stream)

//var stream_rx = /\/stream\/([^\/]+)((?:\/[^\/]+(?:\/[^\/]+)*)?)\/([^\/]+)$/;
var stream_rx = /\/stream\//;
app.get(stream_rx, stream)
//app.get(/^\/stream\//, stream)
//app.get('/stream', stream)

// error handlers

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err    = new Error('Not Found')
  err.status = 404
  next(err)
})

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500)
    res.render('error', {
      message: err.message,
      error: err
    })
  })
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500)
  res.render('error', {
    message: err.message,
    error: {}
  })
})


module.exports = app
