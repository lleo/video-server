
/*
 * GET directory lookup returns JSON
 */

module.exports = function (req, res) {
  var cfg = req.app.get('config')

  console.log("lookup: cfg = ", cfg)
  
}