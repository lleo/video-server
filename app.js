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
app.set('title',"Sean Egan's Video File Server")
let cfgfn = './video-server.json'
  , cfg_json_str   = fs.readFileSync(cfgfn, 'utf8')
  , cfg

try {
  cfg = JSON.parse(cfg_json_str)
} catch (x) {
  console.error("Faild to parse json data from %s", cfgfn)
  console.error(cfg_json_str)
  process.exit(1)
}

app.set('app config', cfg)

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
app.get('/stream/:video', stream)
app.get('/lookup', lookup)

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
