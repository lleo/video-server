
var fs = require('fs')
  , path = require('path')
  , util = require('util')

const MODNAME = path.parse(module.filename).name

module.exports = streamVideo
//module.exports = streamTest

var ext2mimeType = {
  "webm": "video/webm"
, "mp4" : "video/mp4"
, "ogg" : "video/ogg"
, "ogv" : "video/ogg"
}

function streamVideo(req, res, next) {
  'use strict';
  var app = res.app

  var p = decodeURI(req.path).split('/')
  var root = p[2]
  var subdirs = p.slice(3,p.length-1)
  var file = p[p.length-1]
  //console.log('%s: root = %j', MODNAME, root)
  //console.log('%s: subdirs = %j', MODNAME, subdirs)
  //console.log('%s: file = %j', MODNAME, file)

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

  //var root = req.params[0]
  //var subdirsStr = req.params[1]
  //subdirsStr = subdirsStr.slice(1)
  //var subdirs = subdirsStr == '' ? [] : subdirsStr.split('/')
  //var file = req.params[2]

  var app_cfg = app.get('app config by name')
  var root_fqdn = app_cfg['video roots'][root].fqdn

  //subdirs.unshift('/')
  //var nmldir = path.resolve.apply(path, subdirs)
  //nmldir = nmldir.slice(1) // take the / off
  //subdirs.shift() // remove the '/' entry from subdirs
  //var root_fqdn = app_cfg['video roots'][root].fqdn
  //var vid_path = [root_fqdn, nmldir]
  //vid_path.push(file)
  //console.log('%s: vid_path = %j', MODNAME, vid_path)

  var parts = [root_fqdn]
  parts = parts.concat(subdirs)
  parts.push(file)
  
  var video_fqfn = path.join.apply(path, parts)
  console.log("%s: video_fqfn=%s", MODNAME, video_fqfn)

  var ext = path.extname(video_fqfn).toLowerCase().replace(/^\./, '')
  var vidstat, total
  var mimetype

  try {
    vidstat = fs.statSync(video_fqfn)
    total = vidstat.size
  } catch (x) {
    console.error("%s: caught exception %j", MODNAME, x)
    next()
    return
  }

  console.log("%s: %s %s", MODNAME, req.method, req.url)
  console.log("%s: headers =", MODNAME, util.inspect(req.headers))

  mimetype = ext2mimeType[ext]
  //console.log("%s: !!! ext=%s; mimetype=%s;", MODNAME, ext, mimetype)

  if ( req.headers['range'] ) {
    var range = req.headers.range
      , parts = range.replace('bytes=', "").split("-")
      , partialstart = parts[0]
      , partialend = parts[1]
      , start = parseInt(partialstart, 10)
      , end = partialend ? parseInt(partialend, 10) : total-1
      , chunksize = (end-start)+1

    console.log('%s: RANGE: %d - %d = %d', MODNAME, end, start, chunksize)

    var file_rstream
    try {
      file_rstream = fs.createReadStream(video_fqfn, {start: start, end: end})
    } catch (x) {
      console.error('%s: Caught Exception; x = %j', MODNAME, x)
      return
    }

    res.status(206)
    res.set({ 'Content-Range' : 'bytes ' + start + '-' + end + '/' + total
            , 'Accept-Ranges' : 'bytes'
            , 'Content-Length': chunksize
            , 'Content-Type'  : mimetype
            })
//    res.writeHead(206
//                 , { 'Content-Range' : 'bytes ' + start + '-' + end + '/' + total
//                   , 'Accept-Ranges' : 'bytes'
//                   , 'Content-Length': chunksize
//                   , 'Content-Type'  : mimetype
//                   })
    file_rstream.pipe(res)
  }
  else {
    console.log('%s: ALL: %d', MODNAME, total)
    res.status(200)
    res.set({'Content-Length': total
            , 'Content-Type': mimetype
            })

    var file_stream
    try {
      file_stream = fs.createReadStream(video_fqfn)
    } catch (x) {
      console.error('%s: Caught Exception x = %j', MODNAME, x)
      return
    }
    file_stream.pipe(res)
  }
}
