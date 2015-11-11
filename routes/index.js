/*global  */

/*
 * GET app page.
 */

var util = require('util')

module.exports = function(req, res){
  'use strict';
  var app_cfg = req.app.get('app config by name')

  console.log("app_cfg =", util.inspect(app_cfg, {depth:null}))
  
  var cfg = {}
  cfg['video directories'] = []
  for (let name of app_cfg.order) {
    let ent = {}
    ent.name = name
    ent.id   = app_cfg['video directories'][name].id
    cfg['video directories'].push(ent)
  }

  console.log("index: HERE NOW")

  cfg['title'] = req.app.get('title')

  var str = util.inspect(cfg, {depth:null})
  console.log("index: cfg = %j", { cfg: cfg, str: str })
  
  res.render('index', { pretty: true, cfg: cfg, cfg_json_str: str })
};