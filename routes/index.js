/*global  */

/*
 * GET app page.
 */

var util = require('util')
var u = require('lodash')

module.exports = function(req, res){
  'use strict';
  var app_cfg = req.app.get('app config by name')

  console.log("app_cfg =", util.inspect(app_cfg, {depth:null}))
  
  var cfg = {}
  cfg['video root names'] = u.clone(app_cfg.order)

  console.log('index: cfg["video root names"] =', cfg['video root names'])

  cfg['title'] = req.app.get('title')

  /* From video-app.js:21 or so
   * var levels    = ['info', 'warn', 'crit', 'none', 'error']
   * 'none' is a place holder for no logging except error
   * There is really only three optional levels info, warn, and crit.
   */
  cfg.debug = 'info' // or above will be logged
  
  console.log("index: cfg = %j", { cfg: cfg })
  
  res.render('index', { pretty: true, cfg: cfg })
};