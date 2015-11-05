
/*
 * GET app page.
 */

var u = require('lodash')
var util = require('util')

module.exports = function(req, res){
  var cfg = u.cloneDeep(req.app.get('app config'))

  delete cfg['acceptable extentions']

  cfg['title'] = req.app.get('title')

  cfg['video directories'].forEach(function(e,i,a) { delete e.fqdn })
  
  var str = util.inspect(cfg, {depth:null})
  console.log("cfg = %j", { cfg: cfg, str: str })
  
  res.render('index', { pretty: true, cfg: cfg, cfg_json_str: str })
};