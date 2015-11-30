
var fs = require('fs')
  , path = require('path')
  , util = require('util')

module.exports = streamVideo
//module.exports = streamTest

var ext2mimeType = {
  "webm": "video/webm"
, "mp4" : "video/mp4"
, "ogg" : "video/ogg"
, "ogv" : "video/ogg"
}

function streamTest(req, res, next) {
  console.log('HERE 1')

  var app = req.app

  console.log('HERE 2')

  console.log('stream: req.path = %j', req.path)

  console.log('HERE 3')

  var p = decodeURI(req.path).split('/')

  console.log('p = %j', p)

  
//  res.status(404).send("Sorry can't find that.")
}

function streamVideo(req, res, next) {
  'use strict';
  var app = res.app

  var p = decodeURI(req.path).split('/')
  var root = p[2]
  var subdirs = p.slice(3,p.length-1)
  var file = p[p.length-1]
  //console.log('stream: root = %j', root)
  //console.log('stream: subdirs = %j', subdirs)
  //console.log('stream: file = %j', file)

  // See routes/index.js for how I came up with this rx
  var rx = /(?:\/\.\.(?![^\/])|^\.\.(?![^\/])|^\.\.$)/;

  if (root.match(rx)) {
    console.error('stream: HACKING ATTEMPT root=%j matched %s'
                 , root, rx.toString())
    res.status(404).end('FUCK OFF')
    return
  }

  for (let subdir of subdirs) {
    if (subdir.match(rx)) {
      console.error('stream: HACKING ATTEMPT subdir=%j matched %s'
                   , subdir, rx.toString())
      res.status(404).end('FUCK OFF')
      return
    }
  }

  if (file.match(rx)) {
    console.error('stream: HACKING ATTEMPT file=%j matched %s'
                 , file, rx.toString())
    res.status(404).end('FUCK OFF')
    return
  }

  //var root = req.params[0]
  //var subdirsStr = req.params[1]
  //subdirsStr = subdirsStr.slice(1)
  //var subdirs = subdirsStr == '' ? [] : subdirsStr.split('/')
  //var file = req.params[2]

  subdirs.unshift('/')
  var nmldir = path.resolve.apply(path, subdirs)
  nmldir = nmldir.slice(1) // take the / off

  var app_cfg = app.get('app config by name')
  var root_fqdn = app_cfg['video roots'][root].fqdn

  var vid_path = [root_fqdn, nmldir]
  vid_path.push(file)
  //console.log('stream: vid_path = %j', vid_path)

  var video_fqfn = path.join.apply(path, vid_path)
  //console.log("stream: video_fqfn=%s", video_fqfn)

  var ext = path.extname(video_fqfn).toLowerCase().replace(/^\./, '')
  var vidstat, total
  var mimetype

  try {
    vidstat = fs.statSync(video_fqfn)
    total = vidstat.size
  } catch (x) {
    console.error("streamVideo: ", x)
    next()
    return
  }

  console.log("stream: %s %s", req.method, req.url)
  console.log("stream: headers =", util.inspect(req.headers))

  mimetype = ext2mimeType[ext]
  //console.log("stream: !!! ext=%s; mimetype=%s;", ext, mimetype)

  if ( req.headers['range'] ) {
    var range = req.headers.range
      , parts = range.replace('bytes=', "").split("-")
      , partialstart = parts[0]
      , partialend = parts[1]
      , start = parseInt(partialstart, 10)
      , end = partialend ? parseInt(partialend, 10) : total-1
      , chunksize = (end-start)+1

    console.log('stream: RANGE: ' + start + ' - ' + end + ' = ' + chunksize)

    var file_rstream
    try {
      file_rstream = fs.createReadStream(video_fqfn, {start: start, end: end})
    } catch (x) {
      console.error('stream: Caught Exception; x = %j', x)
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
    console.log('stream: ALL: ' + total)
    res.status(200)
    res.set({'Content-Length': total
            , 'Content-Type': mimetype
            })

    var file_stream
    try {
      file_stream = fs.createReadStream(video_fqfn)
    } catch (x) {
      console.error('stream: Caught Exception x = %j', x)
      return
    }
    file_stream.pipe(res)
  }
}
