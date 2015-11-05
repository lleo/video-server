
/*
 * GET app page.
 */

module.exports = function(req, res){
  var cfg = req.app.get('config')
  cfg['title'] = req.app.get('title')
  res.render('index', cfg)
};