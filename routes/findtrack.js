
/*
 * Find one and only one vtt file that matches root,subdirs,file
 */

var util = require('util')
var fs = require('fs')
var path = require('path')
var u = require('lodash')

var Promise = require('bluebird')
var join = Promise.join

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

function trackMatchesVideo(trackFile, videoFile) {
  return false
}

function describeTrack(trackFile) {
  return 'nothing'
}

function langFromTrack(trackFile) {
  return 'en'
}

module.exports = function findtrack(req, res, next) {
  'use strict';
  console.log('%s: req.originalUrl = %j', MODNAME, req.originalUrl)

  var cfg = req.app.get('app config by name')

  console.log("%s: cfg = ", MODNAME, cfg)

  var root = req.query.root
  var subdirs = req.query.subdirs
  var videoFile = req.query.file
  
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

  if (videoFile.match(rx)) {
    console.error('%s: HACKING ATTEMPT videoFile=%j matched %s', MODNAME
                 , videoFile, rx.toString())
    res.status(403).end('FUCK OFF')
    return
  }

  var root_fqdn = cfg['video roots'][root].fqdn

  //subdirs.unshift('/')
  //var nmldir = path.join.apply(path, subdirs)
  //nmldir = nmldir.slice(1) // take off the '/' from nmldir
  //subdirs.shift() // remove the '/' entry from subdirs
  //console.log('%s: nmldir = %s', MODNAME, nmldir)
  //var fqdn = path.join(root_fqdn, nmldir)

  var parts = [root_fqdn]
  parts = parts.concat(subdirs)
  
  var fqdn = path.join.apply(path, parts)

  console.log('%s: fqdn = %j', MODNAME, fqdn)

  fs.readdirAsync(fqdn).map(function(fileName) {
    console.log('%s: fileName = %j', MODNAME, fileName)
    var fqfn = path.join(fqdn, fileName)
    var stat = fs.statAsync(fqfn)

    return join(stat, function(stat) {
      return { stat: stat, file: fileName }
    })
  })
  .then(function(results) {
    var files = []
    results.forEach(function(result) {
      if (result.stat.isFile) {
        files.push(result.file)
      }
    })

    console.log('%s: before filter: files = %j', MODNAME, files)
    files = filterFilesByExt(files, ['vtt'])
    console.log('%s: after filter: files = %j', MODNAME, files)

    // files array now only contains '*.vtt' file names
    
    var tracks = []
    files.forEach(function(trackFile) {
      var parts, uri, label, lang
      if ( trackMatchesVideo(trackFile, videoFile) ) {
        parts = ['/track', root]
        parts = parts.concat(subdirs)
        parts.push(trackFile)

        uri = path.join.apply(path, parts)

        label = describeTrack(trackFile)

        lang = langFromTrack(trackFile)

        tracks.push({ uri: uri, label: label, lang: lang })
      }
    })

    // NOTE: for testing we send no tracks
    var json = { tracks : [] }
    var json_str = JSON.stringify(json)

    console.log('%s: sending json\n', MODNAME
               , util.inspect(json, {depth:null}))

    res.set('Content-type', 'application/json')
    res.send(json_str)
  })
} //end: findtrack()