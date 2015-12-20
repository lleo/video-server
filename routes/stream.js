
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

  var app_cfg = app.get('app config by name')
  var root_fqdn = app_cfg['video roots'][root].fqdn

  var video_parts = [root_fqdn]
  video_parts = video_parts.concat(subdirs)
  video_parts.push(file)
  
  var video_fqfn = path.join.apply(path, video_parts)
  //console.log("%s: video_fqfn=%s", MODNAME, video_fqfn)

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

  //console.log("%s: %s %s", MODNAME, req.method, req.url)
  //console.log("%s: headers =", MODNAME, util.inspect(req.headers))

  mimetype = ext2mimeType[ext]
  //console.log("%s: !!! ext=%s; mimetype=%s;", MODNAME, ext, mimetype)

  if ( req.headers['range'] ) {
    var range = req.headers.range
      , range_parts = range.replace('bytes=', "").split("-")
      , range_start = range_parts[0]
      , range_end = range_parts[1]
      , start = parseInt(range_start, 10)
      , end = range_end ? parseInt(range_end, 10) : total-1
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
