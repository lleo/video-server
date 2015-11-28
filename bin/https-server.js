#!/usr/bin/env node

/**
 * Module dependencies.
 */

var fs = require('fs');
var app = require('../app');
var debug = require('debug')('debug');
var https = require('https');

// Generated VIA:
// openssl genrsa -out private-key-for-self-signed-cert.pem 1024
var key = fs.readFileSync('private-key-for-self-signed-cert.pem')

// Generated VIA:
// openssl req -new -key private-key-for-self-signed-cert.pem \
//             -out cert-req-for-self-signed-cert.csr
// openssl x509 -req -in cert-req-for-self-signed-cert.csr \
//              -signkey private-key-for-self-signed-cert.pem \
//              -out     self-signed-cert.pem
var cert = fs.readFileSync('self-signed-cert.pem')

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3443');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = https.createServer({ key: key, cert: cert }, app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
