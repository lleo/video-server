
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
  var app = res.app

  var p = decodeURI(req.path).split('/')
  var root = p[2]
  var subdirs = p.slice(3,p.length-1)
  var file = p[p.length-1]
  console.log('stream: root = %j', root)
  console.log('stream: subdirs = %j', subdirs)
  console.log('stream: file = %j', file)

  //var root = req.params[0]
  //var subdirsStr = req.params[1]
  //subdirsStr = subdirsStr.slice(1)
  //var subdirs = subdirsStr == '' ? [] : subdirsStr.split('/')
  //var file = req.params[2]
  
  var app_cfg = app.get('app config by name')
  var vid_fqdn = app_cfg['video roots'][root].fqdn

  var vid_path = [vid_fqdn]
  vid_path = vid_path.concat(subdirs)
  vid_path.push(file)
  console.log('stream: vid_path = %j', vid_path)


  var video_fqfn = path.resolve.apply(path, vid_path)
  console.log("stream: video_fqfn=%s", video_fqfn)

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
  console.log(util.inspect(req.headers))

  mimetype = ext2mimeType[ext]
  console.log("stream: !!! ext=%s; mimetype=%s;", ext, mimetype)

  if ( req.headers['range'] ) {
    var range = req.headers.range
      , parts = range.replace(/bytes=/, "").split("-")
      , partialstart = parts[0]
      , partialend = parts[1]
      , start = parseInt(partialstart, 10)
      , end = partialend ? parseInt(partialend, 10) : total-1
      , chunksize = (end-start)+1

    console.log('stream: RANGE: ' + start + ' - ' + end + ' = ' + chunksize)

    var file_rstream = fs.createReadStream(video_fqfn, {start: start, end: end})

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
    fs.createReadStream(video_fqfn).pipe(res)
  }
}
