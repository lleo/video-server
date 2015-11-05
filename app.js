'use strict';

let fs             = require('fs')
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
  , cfg   = fs.readFileSync(cfgfn)
app.set('config', cfg)

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'static', 'img', 'favicon.ico')))
//console.log("HERE 1")
app.use(logger('dev'))
//console.log("HERE 2")
app.use(bodyParser.json())
//console.log("HERE 3")
app.use(bodyParser.urlencoded({ extended: false }))
//console.log("HERE 4")
app.use(cookieParser())
//console.log("HERE 5")
app.use(express.static(path.join(__dirname, 'static')))
//console.log("HERE 6")

let index  = require('./routes/index')
  , stream = require('./routes/stream')
  , lookup = require('./routes/lookup')

app.get('/', index)
app.get('/stream/:video', stream)
app.post('/lookup', lookup)

// error handlers

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err    = new Error('Not Found')
  err.status = 404
  next(err)
})

//console.log("HERE 7")
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

//console.log("HERE 8")
// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500)
  res.render('error', {
    message: err.message,
    error: {}
  })
})

//console.log("HERE 9")

module.exports = app
