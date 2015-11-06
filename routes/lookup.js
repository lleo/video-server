
/*
 * GET directory lookup returns JSON
 */

var util = require('util')
var fs = require('fs')
var path = require('path')
var Promise = require('bluebird')
var join = Promise.join
var u = require('lodash')

Promise.promisifyAll(fs)

/* filterFilesByExt
 * 
 * files: array of strings; filenames with or without an extension
 * exts: array of strings; filename extensions without leading '.'
 * 
 */
function filterFilesByExt(files, exts) {
  'use strict';
  return files.filter(function(fn) {
    for (let ext of exts)
      if (path.extname(fn).substr(1) == ext)
        return true
  })
}

module.exports = function (req, res) {
  'use strict';
  
  var cfg = req.app.get('app config')

  console.log("lookup: cfg = ", cfg)

  var top = req.query.top
  var top_fqdn = cfg['video directories'][top].fqdn
  var dirs = u.cloneDeep(req.query.dirs) || []
  var exts = cfg['acceptable extentions']
  
  dirs.unshift(top_fqdn)

  console.log("lookup: dirs = %j", dirs)
  
  var fqdn = path.join.apply(path, dirs)

  console.log("lookup: fqdn = %j", fqdn)
  
  fs.readdirAsync(fqdn).map(function(fileName) {
    console.log("lookup: fileName = %j", fileName)
    var fqfn = path.join(fqdn, fileName)
    var stat = fs.statAsync(fqfn);

    return join(stat, function(stat) {
      return {
        stat: stat,
        file: fileName
      }
    })
  }).then(function(results) {
    var files = []
      , dirs  = []
      , other = []

    results.forEach(function(result){
      if (result.stat.isDirectory())
        dirs.push(result.file)
      else if (result.stat.isFile)
        files.push(result.file)
      else
        other.push(result.file)
    })

    files = filterFilesByExt(files, exts)
    
    var json = {
      files: files,
      dirs : dirs
    }
      , json_str = JSON.stringify(json)
    
    console.log("lookup: sending json:\n"
               , util.inspect(json, {depth:null}))
    
    res.set("Content-type", "application/json")
    res.send(json_str)

    if (other.length)
      console.error("NOT FILE OR DIRECTORY: %j", other)
  })
}