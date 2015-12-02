
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

const MODNAME = path.parse(module.filename).name

/* filterFilesByExt
 * 
 * files: array of strings; filenames with or without an extension
 * exts: array of strings; filename extensions without leading '.'
 * 
 */
function filterFilesByExt(files, exts) {
  'use strict';
  console.log("%s: filterFilesByExt: exts = %j", MODNAME, exts)
  return files.filter(function(fn) {
    for (let ext of exts) {
      // test the file's extension name (minus the leading '.')
      if (path.extname(fn).substr(1) == ext) {
        return true
      }
      return false
    }
  })
}

module.exports = function readdir(req, res, next) {
  'use strict';

  console.log('req.originalUrl = ', req.originalUrl)
  
  var cfg = req.app.get('app config by name')

  console.log("%s: cfg = ", MODNAME, cfg)

  var root = req.query.root
  var root_fqdn = cfg['video roots'][root].fqdn
  var subdirs = u.clone(req.query.subdirs) || []
  var exts = cfg['acceptable extensions']
  console.log("%s: exts = %j", MODNAME, exts)

  // See routes/index.js for how I came up with this rx
  var rx = /(?:\/\.\.(?![^\/])|^\.\.(?![^\/])|^\.\.$)/;

  if (root.match(rx)) {
    console.error('%s: HACKING ATTEMPT root=%j matched %s', MODNAME
                 , root, rx.toString())
    res.status(403).end('FUCK OFF')
    return
  }

  for (let subdir of subdirs) {
    if (subdir.match(rx)) {
      console.error('%s: HACKING ATTEMPT subdir=%j matched %s', MODNAME
                   , subdir, rx.toString())
      res.status(403).end('FUCK OFF')
      return
    }
  }

  if (file.match(rx)) {
    console.error('%s: HACKING ATTEMPT file=%j matched %s', MODNAME
                 , file, rx.toString())
    res.status(403).end('FUCK OFF')
    return
  }

  // Stop any hacking attempt to '..' below '/'
  console.log('%s: subdirs = %j', MODNAME, subdirs)

  //subdirs.unshift('/')
  //var nmldir = path.join.apply(path, subdirs)
  //nmldir = nmldir.slice(1) // take off the /
  //subdirs.shift()
  //console.log('%s: nmldir = %s', MODNAME, nmldir)
  //var fqdn = path.join(root_fqdn, nmldir)

  var parts = [root_fqdn]
  parts = parts.concat(subdirs)
  parts.push(file)

  var fqdn = path.join.apply(path, parts)

  console.log("%s: fqdn = %j", MODNAME, fqdn)
  
  fs.readdirAsync(fqdn).map(function(fileName) {
    console.log("%s: fileName = %j", MODNAME, fileName)
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
      , dirs  = [] //list of directories found in fqdn
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
    
    var json = { root    : root
               , subdirs : subdirs
               , files   : files
               , dirs    : dirs
               }
      , json_str = JSON.stringify(json)
    
    console.log("%s: sending json:\n", MODNAME
               , util.inspect(json, {depth:null}))
    
    res.set("Content-type", "application/json")
    res.send(json_str)

    if (other.length)
      console.error("%s: NOT FILE OR DIRECTORY: %j", MODNAME, other)
  })
} //end: readdir()
