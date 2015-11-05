
var fs = require('fs')
  , path = require('path')
  , util = require('util')

module.exports = streamVideo

var ext2mimeType = {
  "webm": "video/webm"
, "mp4" : "video/mp4"
, "ogg" : "video/ogg"
, "ogv" : "video/ogg"
}

function streamVideo(req, res, next) {
  var app = res.app
    , video = path.resolve('/', req.param('video')) // '..' do not go farther back
    , video_directory = app.get('video directory')
    , vidfqfn = path.join(video_directory, video)
    , videofn = path.basename(vidfqfn)
    , ext = path.extname(videofn).toLowerCase().replace(/./, '')
    , vidstat, total
    , mimetype

  try {
    vidstat = fs.statSync(vidfqfn)
    total = vidstat.size
  } catch (x) {
    console.error("streamVideo: ", x)
    next()
    return
  }

  console.log("streamVideo: %s %s", req.method, req.url)
  console.log(util.inspect(req.headers))
  console.log("video=%s", video)
  console.log("res.app.get('video directory')=%s", util.inspect(res.app.get('video directory')))
  console.log("vidfqfn=%s", vidfqfn)

  mimetype = ext2mimeType[ext]
  console.log("!!! ext=%s; mimetype=%s;", ext, mimetype)

  if ( req.headers['range'] ) {
    var range = req.headers.range
      , parts = range.replace(/bytes=/, "").split("-")
      , partialstart = parts[0]
      , partialend = parts[1]
      , start = parseInt(partialstart, 10)
      , end = partialend ? parseInt(partialend, 10) : total-1
      , chunksize = (end-start)+1

    console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize)

    var file = fs.createReadStream(vidfqfn, {start: start, end: end})

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
    file.pipe(res)
  }
  else {
    console.log('ALL: ' + total)
    res.status(200)
    res.set({'Content-Length': total
            , 'Content-Type': mimetype
            })
    fs.createReadStream(vidfqfn).pipe(res)
  }
}
