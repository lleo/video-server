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
  cfg['video volumes'] = u.clone(app_cfg.order)

  console.log('index: cfg["video volumes"] =', cfg['video volumes'])
  console.log("index: HERE NOW")

  cfg['title'] = req.app.get('title')

  console.log("index: cfg = %j", { cfg: cfg })
  
  res.render('index', { pretty: true, cfg: cfg })
};