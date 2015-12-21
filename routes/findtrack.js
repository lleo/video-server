
/*
 * Find one and only one vtt file that matches root,subdirs,file
 */

var util = require('util')
var fs = require('fs')
var path = require('path')
var u = require('lodash')
var qs = require('qs')

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
  //console.log("%s: filterFilesByExt: exts = %j", MODNAME, exts)
  return files.filter(function(fn) {
    for (let ext of exts) {
      // test the file's extension name (minus the leading '.')
      if (path.extname(fn).substr(1) == ext) {
        return true
      }
    }
    return false
  })
}

function trackParse(trackfn) {
  var trackParts = trackfn.split('.')
  if (trackParts.length < 3) {
    //badly formated trackfn
    return
  }
  var ext = trackParts[trackParts.length-1]
  var langPart = trackParts[trackParts.length-2]
  var m = langPart.match(/^[a-z]{2}/)
  if (!m) {
    //bad langPart
    return
  }
  var lang = m[0]

  var desc = lang
  if (lang == 'en') {
    desc = "English"
  }

  if ( langPart.match(/foreign parts/) ) {
    desc += " Foreign Parts Only"
  }

  return { name: trackfn
         , base: trackParts.slice(0,trackParts.length-2).join('.')
         , lang: lang
         , desc: desc
         }
}

function videoParse(videofn) {
  //console.log('%s: videoParse: videofn=%j', MODNAME, videofn)
  if ( videofn.match(/\//) ) {
    console.log('%s: videoParse: videofn %j contained a "/"', MODNAME, videofn)
    return
  }

  var videoParts = videofn.split('.')
  if (videoParts.length < 2 || videoParts[0] == '') {
    //badly formed videofn
    console.log('%s: videoParse: badly formed videofn=%j', MODNAME, videofn)
    return
  }
  return { name: videofn
         , ext : videoParts[videoParts.length-1]
         , base: videoParts.slice(0,videoParts.length-1).join('.')
         }
}

function sortFn(a,b) {
  var aExt = path.extname(a.url).slice(1)
  var bExt = path.extname(b.url).slice(1)
  if (aExt == 'vtt' && bExt == 'srt') return -1
  if (aExt == 'srt' && bExt == 'vtt') return 1
  return 0
}

module.exports = function findtrack(req, res, next) {
  'use strict';
  //console.log('%s: req.originalUrl = %j', MODNAME, req.originalUrl)

  var cfg = req.app.get('app config by name')

  //console.log("%s: cfg = ", MODNAME, cfg)

  var root = req.query.root
  var subdirs = req.query.subdirs
  var videofn = req.query.file
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

  if (videofn.match(rx)) {
    console.error('%s: HACKING ATTEMPT videofn=%j matched %s', MODNAME
                 , videofn, rx.toString())
    res.status(403).end('FUCK OFF')
    return
  }

  var vid = videoParse(videofn)
  if (!vid) {
    console.error('%s: findtrack: badly formed videofn=%j', MODNAME, videofn)
    res.status(404).end('badly formed video filename')
    return
  }
  
  var root_fqdn = cfg['video roots'][root].fqdn

  //console.log('%s: root_fqdn = %j', MODNAME, root_fqdn)

  var video_dir_parts = [root_fqdn]
  video_dir_parts = video_dir_parts.concat(subdirs)
  
  var fqdn = path.join.apply(path, video_dir_parts)

  //console.log('%s: fqdn = %j', MODNAME, fqdn)

  fs.readdirAsync(fqdn).map(function(fileName) {
    //console.log('%s: fileName = %j', MODNAME, fileName)
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

    //console.log('%s: before filter: files = %j', MODNAME, files)
    files = filterFilesByExt(files, ['vtt', 'srt'])
    //console.log('%s: after filter: files = %j', MODNAME, files)

    // files array now only contains '*.vtt' and/or '*.srt' file names
    
    var tracks = []
    files.forEach(function(trackfn) {
      //console.log('%s: trackfn = %j', MODNAME, trackfn)
      //console.log('%s: videofn = %j', MODNAME, videofn)
      var trk = trackParse(trackfn)
      if (!trk) {
        console.log('%s: badly formed trackfn=%j', MODNAME, trackfn)
        return //skip this trackfn
      }
      
      if ( vid.base == trk.base ) {
        //console.log('%s: the files matched', MODNAME)
        console.log('%s: trk = %j', MODNAME, trk)

        //var track_url_parts = ['/track', root]
        //track_url_parts = track_url_parts.concat(subdirs)
        //track_url_parts.push(trackfn)
        //var url = path.join.apply(path, track_url_parts)

        var qstr = qs.stringify({ root    : root
                                , subdirs : subdirs
                                , file    : trackfn
                                })
        var url = '/track?'+qstr
        tracks.push({ url: url, label: trk.desc, lang: trk.lang })
      }
      //else
      //  console.log('%s: the files DID NOT match', MODNAME)
    })

    //console.log('%s: before sort tracks =\n%s', MODNAME, util.inspect(tracks, {depth:null,colors:true}))
    var foreign_tracks = []
    var nonforeign_tracks = []

    if (tracks.length > 1) {
      tracks.forEach(function(track) {
        if (track.label.match(/Only/))
          foreign_tracks.push(track)
        else
          nonforeign_tracks.push(track)
      })
      foreign_tracks.sort(sortFn)
      nonforeign_tracks.sort(sortFn)
      tracks = foreign_tracks.concat(nonforeign_tracks)
    }

    //console.log('%s: after sort tracks =\n%s', MODNAME, util.inspect(tracks, {depth:null,colors:true}))
    
    var json = { tracks : tracks }
    var json_str = JSON.stringify(json)

    console.log('%s: sending json\n%s', MODNAME
               , util.inspect(json, {depth:null}))

    res.set('Content-type', 'application/json')
    res.send(json_str)
  })
} //end: findtrack()