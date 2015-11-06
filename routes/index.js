/*global  */

/*
 * GET app page.
 */

var u = require('lodash')
var util = require('util')

module.exports = function(req, res){
  'use strict';
  var app_cfg = u.cloneDeep(req.app.get('app config'))
  var cfg = {}
  cfg['video directories'] = []

  for (let i=0; i<app_cfg.order.length; i+=1) {
    var name = app_cfg.order[i]
    var ent = u.cloneDeep(app_cfg['video directories'][name])
    delete ent.fqdn
    ent.name = name
    cfg['video directories'].push(ent)
  }

  console.log("index: HERE NOW")

  cfg['title'] = req.app.get('title')

  var str = util.inspect(cfg, {depth:null})
  console.log("index: cfg = %j", { cfg: cfg, str: str })
  
  res.render('index', { pretty: true, cfg: cfg, cfg_json_str: str })
};