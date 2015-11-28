
/*
 * Find one and only one vtt file that matches root,subdirs,file
 */

var util = require('util')
var fs = require('fs')
var path = require('path')
var u = require('lodash')

module.exports = function findtrack(req, res, next) {
  'use strict';
  console.log('findtrack: req.originalUrl = %j', req.originalUrl)

  var cfg = req.app.get('app config by name')

  console.log("findtrack: cfg = ", cfg)
  
}