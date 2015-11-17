/*global wrapSelect */
/*
 * NOTE: Remember this is running in the browser.
 */
//This wrapper function is wholly unnecessary but whatever ...
(function(window, document, undefined) {
  var root = window //stupid I know :(

  function VideoApp(_cfg) {
    var cfg = _.cloneDeep(_cfg) || {}
    var controls_cfg = cfg.controls || {}

    this.cfg = cfg

    var videoContents = new VideoContents()
    var videoControls = new VideoControls(videoContents, controls_cfg)
    var volumeBrowser = new VolumeBrowser(cfg['video volumes'], videoContents)

    this.volumeBrowser = volumeBrowser

    /*
     * See comment below on *Multiple Videos*
     */
    this.videoContents = videoContents

    this.videoControls = videoControls

    $('#fileSelect').append( volumeBrowser.$dom )

    $('#videoStuff').append( videoContents.$dom )
    
    $('#videoStuff').append( videoControls.$dom )

  } //end: VideoApp()

  {
    var ext2mimetype = { 'webm': 'video/webm'
                       , 'mp4' : 'video/mp4'
                       , 'm4v' : 'video/mp4'
                       , 'ogg' : 'video/ogg'
                       , 'ogv' : 'video/ogg'
                       }

    function determineMimetype(file) {
      var ext, mimetype
      var m = file.match(/^.*\.(.*)$/)
      if (m) {
        ext = m[1]
        mimetype = ext2mimetype[ext]
        return mimetype
      }
      return
    }
  }

  function VideoContents() {
    this.contents = []
    this.id = 'videoContents'
    this.$dom = $( document.createElement('div') )
                .attr('id', this.id)
                .addClass('videoContents')

    this.contents = [] //array of VideoContent objects
    this._isFullscreen = false
  }

  VideoContents.prototype.addVideoContent =
    function VideoContents__addVideoContent(volume, subdirs, file, videoApp) {
      'use strict';

      /* Remove any video content that exists
       * 
       * Node: *Multiple Videos*
       * Eventually I'll guard this with a setting that allows multiple
       * video streams to be open controled with one set of controls.
       * The reason for watching multiple streams at the same time is to
       * compare original versions versus extended versions and such.
       */
      while (this.contents.length) {
        this.contents.pop().$dom.remove()
      }

      var vidNum = this.contents.length
      
      var videoContent = new VideoContent(vidNum, volume, subdirs, file)

      this.contents.push(videoContent)

      this.$dom.append(videoContent.$dom)
    }

  VideoContents.prototype.isPaused = function VideoContents__isPaused() {
    //only examine the first videoContent assume the rest are the same
    if (this.contents.length)
      return this.contents[0].isPaused()
    else
      return /* undefined  */
  }

  VideoContents.prototype.allPaused = function VideoContents__allPaused() {
    'use strict';
    var allPaused = true
    for (let i=0; i<this.contents.length; i+=1) {
      allPaused = this.contents[i].isPaused() && allPaused
    }
    return allPaused
  }
  
  VideoContents.prototype.play = function VideoContents__play() {
    'use strict';
    var allPlayed = true
    for (let i=0; i<this.contents.length; i+=1) {
      if ( this.contents[i].isPaused() )
        allPlayed = this.contents[i].play() && allPlayed
    }
    return allPlayed
  }
  
  VideoContents.prototype.pause = function VideoContents__pause() {
    'use strict';
    var allPaused = true
    for (let i=0; i<this.contents.length; i+=1) {
      if ( !this.contents[i].isPaused() )
        allPaused = this.contents[i].pause() && allPaused
    }
    return allPaused
  }
  
  VideoContents.prototype.seek = function VideoContents__seek(nsecs) {
    'use strict';
    var allSeeked = true
    for (let i=0; i<this.contents.length; i+=1) {
      allSeeked = this.contents[i].seek(nsecs) && allSeeked
    }
    return allSeeked
  }

  VideoContents.prototype.setVolume = function VideoContents__setVolume(pct) {
    'use strict';
    allSetVolume = true
    for (let i=0; i<this.contents.length; i+=1) {
      allSetVolume = this.contents[i].setVolume(pct) && allSetVolume
    }
    return allSetVolume
  } //end: VideoContents__setVolume()

  VideoContents.prototype.pause = function VideoContents__pause() {
    'use strict';
    var allPaused = true
    for (let i=0; i<this.contents.length; i+=1) {
      if ( !this.contents[i].isPaused() )
        allPaused = this.contents[i].pause() && allPaused
    }
    return allPaused
  }

  VideoContents.prototype.toggleFullscreen =
    function VideoContents__toggleFullscreen() {
      'use strict';
      if (this.contents.length > 1) {
        /* Only fullScreen the first one for now
         *
         * I'm gonna want to arrange screens thus:
         * +------------------+
         * |                  |
         * |                  |
         * |                  |
         * +------------------+
         *               +------------------+
         *               |                  |
         *               |                  |
         *               |                  |
         *               +------------------+
         * +------------------+
         * |                  |
         * |                  |
         * |                  |
         * +------------------+
         */
        console.error('VideoContents__toggleFullscreen: not supported for this.contents.length > 1')
        return
      }
      else if (this.contents.length == 1)
        return this._isFullscreen = this.contents[0].toggleFullscreen()
      else {
        console.error('VideoContents__toggleFullscreen: no video contents this.contents.length < 1')
        return
      }
  } //end: VideoContents__fullscreen()


  function VideoContent(vidNum, volume, subdirs, file, videoApp) {
    console.log('VideoContent() constructor')

    this.vidNum   = vidNum
    this.volume   = volume
    this.subdirs  = subdirs
    this.file     = file
    this.videoApp = videoApp
    this.ids = { div   : 'videoConentDiv-'+vidNum
               , canvas: 'videoDisplay-'+vidNum
               , video : 'videoSource-'+vidNum
               }
    this._isFullscreen = false //assume not fullscreen to start !?!

    /*
     * Create the canvas to paint the video onto
     */
    var $canvas = $( document.createElement('canvas') )
                  .attr('id', this.ids.canvas )
                  .addClass('videoDisplay')

    this.$canvas = $canvas
    this.canvasPaintTid = undefined
    
    var ctx = $canvas[0].getContext('2d')
    this.ctx = ctx

    /*
     * Create the video DOM element. Start with the SourceElement first
     */
    var parts = ['/stream', volume]
    if (subdirs.length) parts.push( subdirs.join('/') )
    parts.push(file)
    
    var rawUri = parts.join('/')
    var uri = encodeURI(rawUri)
    
    var mimetype = determineMimetype(file)
    if (!mimetype) {
      console.error("Unknown mimetype for file="+file)
      mimetype = 'video/mp4' //just for shits-n-giggles
    }

    var $source = $( document.createElement('source') )
                  .attr('src', uri)
                  .attr('type', mimetype)

    this.$source = $source

    var $video = $( document.createElement('video') )
                 .attr('id', this.ids.video )
                 .attr('controls', true)
                 .addClass('videoSource')
                 .append($source)

    this.$video = $video
    
    this.$dom = $( document.createElement('div') )
                .attr('id', this.ids.div)
                .addClass('videoContent')
                .append($canvas)
                .append($video)

    this.setupVideoEvents()

  } //end: VideoContent()

  VideoContent.prototype.setupVideoEvents =
    function VideoContent__setupVideoEvents() {
      var $video = this.$video
      var $canvas = this.$canvas
      var ctx     = this.ctx
      
      
      var self = this
      $video.on('loadeddata', function onLoadedData(evt) {
        console.log("onLoadedData: evt.target.id=%s", evt.target.id)
        // 'loadeddata' means that the HTMLMediaElement has loaded enough
        // data to display one frame.
        //
        // developer.mozilla.org/en-US/docs/Web/Guide/Events/Media_events says:
        //  "loadeddata" -> "The first frame of the media has finished loading"
        //
        // So I can grab the videoWidth and videoHeight of the video at this
        //  point, and set the canvasEl width and height.
        //

        self.videoWidth  = $video[0].videoWidth
        self.videoHeight = $video[0].videoHeight

        console.log("onLoadedData: width=%f; height=%f;"
                   , self.videoWidth, self.videoHeight)

        $canvas[0].width  = self.videoWidth
        $canvas[0].height = self.videoHeight
        
        // display first frame in canvasEl
        //
        ctx.drawImage($video[0], 0, 0, self.videoWidth, self.videoHeight)
      })

      this.$video.on('play', function onPlayStartCanvasTimer(evt) {
        function timerFn() {
          self.canvasPaintTid = undefined

          if ($video[0].paused || $video[0].ended) {
            return
          }

          ctx.drawImage($video[0], 0, 0, self.videoWidth, self.videoHeight)

          self.canvasPaintTid = setTimeout(timerFn, 20) // 50 times a second
        }

        timerFn()
      })

      this.$video.on('seeked', function onSeeked(evt) {
        // display seeked frame when currentTime is manually changed
        //
        ctx.drawImage($video[0], 0, 0, self.videoWidth, self.videoHeight)
      })
      
    } //end: VideoContent__setupVideo()

  VideoContent.prototype.isPaused = function VideoContent__isPaused() {
    return this.$video[0].paused
  }

  VideoContent.prototype.play = function VideoContent__play() {
    if ( this.isPaused() )
      this.$video[0].play()
    return !this.isPaused()
  }

  VideoContent.prototype.pause = function VideoContent__pause() {
    if ( !this.isPaused() )
      this.$video[0].pause()
    return this.isPaused()
  }

  VideoContent.prototype.seek = function VideoContent__seek(nsecs) {
    
  }

  VideoContent.prototype.setVolume = function VideoContent__setVolume(pct) {
    
  }

  VideoContent.prototype.toggelFullscreen =
    function VideoContent__toggleFullscreen() {
      if (this._isFullscreen) {
        if (this.$video[0].requestFullscreen) {
          console.log('VideoContent__toggleFullscreen: used requestFullscreen')
          this.$video[0].requestFullscreen()
        }
        else if (this.$video[0].mozRequestFullScreen) {
          console.log('VideoContent__toggleFullscreen: used mozRequestFullScreen')
          this.$video[0].mozRequestFullScreen()
        }
        else if (this.$video[0].webkitRequestFullscreen) {
          console.log('VideoContent__toggleFullscreen: used webkitRequestFullscreen')
          this.$video[0].webkitRequestFullscreen()
        }
        else {
          console.log('VideoContent__toggleFullscreen: failed to find requestFullScreen equivelent')
          alert("requestFullScreen not implemented by this browser")
          return
        }
        return this._isFullscreen = true
      }
      else {
        // try to cancel fullscreen
        if (document.cancelFullScreen) {
          console.log('VideoContent__toggleFullscreen: used document.cancelFullScreen')
          document.cancelFullScreen()
        }
        else if (document.mozCancelFullScreen) {
          console.log('VideoContent__toggleFullscreen: used document.mozCancelFullScreen')
          document.mozCancelFullScreen()
        }
        else if (document.webkitCancelFullScreen) {
          console.log('VideoContent__toggleFullscreen: used document.webkitCancelFullScreen')
          document.webkitCancelFullScreen()
        }
        else {
          console.log('VideoContent__toggleFullscreen: faled to find cancelFullScreen')
          alert('cancelFullScreen not implemented by this browser')
          return
        }
        return this._isFullscreen = false
      }
      return
    } //end: VideoContent__toggleFullscreen()



  function VideoControls(videoContents, _cfg) {
    this.videoContents = videoContents

    var cfg = _.cloneDeep(_cfg) || {}
    
    this.skipBackSecs = -(cfg.skipBackSecs || 10)
    this.skipForwSecs = cfg.skipForwSecs || 30

    this.ids = { div      : 'videoControls'
               , playSym  : 'playSym'
               , pauseSym : 'pauseSym'
               , playDiv  : 'play'
               }

    this.$dom = $( document.createElement('div') )
                .attr('id', this.ids.div)
                .attr('class', "controls")

    var $playSym = $( document.createElement('i') )
                   .attr('id', this.ids.playSym)
                   .addClass('fa')
                   .addClass('fa-play')

    var $play = $( document.createElement('div') )
                .attr('id', this.ids.playDiv)
                .addClass('btn')
                .addClass('play')
                .append( $playSym )

    var self = this

    $play.click(function(e) {
      if ( self.videoContents.isPaused() ) {
        self.videoContents.play()
        $playSym.removeClass('fa-play')
        $playSym.addClass('fa-pause')
      }
      else {
        self.videoContents.pause()
        $playSym.removeClass('fa-pause')
        $playSym.addClass('fa-play')
      }
    })
    
    this.$dom.append( $play )

  } //end: VideoControls()
  
  function VolumeBrowser(volumeNames, videoContents) {
    /* volumeNames = [ name_1, name_2, ..., name_n]
     */
    this.videoContents = videoContents
    this.ids = { div: 'volumeBrowserDiv'
               , select: 'volumeBrowserSelect'
               , wrapDiv: 'volumeBrowserSelectWrapDiv'
               }
    
    this.volumeNames    = volumeNames
    this.selectedVolume = undefined
    this.subdirs        = []
    this.dirSelects     = [] //should be dirSelects.length == subdirs.length + 1 
    this.addVideoContentButton = undefined
    this.btnNum         = 0

    this.$dom = $(document.createElement('div'))
                .attr('id', this.ids.div)
                .addClass('volumeSelector')

    var $select = $(document.createElement('select'))
                  .attr('id', this.ids.select)
                  .attr('size', this.volumeNames.length)
                  .addClass('volumeSelector')

    for (var i=0; i<this.volumeNames.length; i+=1) {
      $select.append(
        $(document.createElement('option'))
        .attr('value', this.volumeNames[i])
        .append(this.volumeNames[i])
      )
    }

    this.$dom.append( $(document.createElement('div'))
                      .attr('id', this.ids.wrapDiv)
                      .addClass('wrapVolumeSelect')
                      .append( $select )
                    )

    var self = this
    function selectChanged() {
      var val = $(this).val()
      var i
      var dirSelect
      
      console.log('VolumeBrowser: selectChanged: val = '+JSON.stringify(val))

      self.selectedVolume = val
      
      if (self.dirSelects.length > 0) {
        //reset the DOM
        while (self.dirSelects.length > 0) {
          self.dirSelects.pop().$dom.remove()
        }

        //reset this object
        self.subdirs = []
      }
      if (self.addVideoContentButton) {
        self.addVideoContentButton.$dom.remove()
        self.addVideoContentButton = undefined
        self.btnNum = 0
      }

      function lookupSuccess(data) {
        console.log('VolumeBrowser: selectChanged: lookupSuccess: data =', data)
        self.addDirSelect(data.dirs, data.files)
      }

      $.ajax({ url  : 'lookup'
             , type : 'GET'
             , data : { top     : val
                      , subdirs : self.subdirs
                      }
             , success : lookupSuccess

             })
    } //end: selectChanged()
    
    $select.change( selectChanged )
  } //end: VolumeBroswer()

  VolumeBrowser.prototype.addDirSelect =
    function VolumeBrowser__addDirSelect(dirs, files) {
      console.log('VolumeBrowser__addDirSelect: called')
      console.log('VolumeBrowser__addDirSelect: dirs =', dirs)
      console.log('VolumeBrowser__addDirSelect: files =', files)

      var nextNum = this.dirSelects.length

      var dirSelect = new DirSelect(nextNum, dirs, files, this)

      this.dirSelects.push( dirSelect )

      this.$dom.append( dirSelect.$dom )

      /* 
       * React to this dirSelect being selected
       */
      // capture the number of dirSelect currently
      var numDirSelects = this.dirSelects.length
      var self = this
      function dirSelectChanged() {
        var val = $(this).val()
        var i

        console.log('VolumeBrowser: selectChanged: val = '+JSON.stringify(val))

        //if the captured number of DirSelects < the current number of DirSelects
        if (numDirSelects < self.dirSelects.length) {
          //remove the newer ones in reverse order
          while (self.dirSelects.length > numDirSelects) {
            self.dirSelects.pop().$dom.remove()
          }

          //truncate VolumeBroswer's subdirs array
          self.subdirs.length = numDirSelects-1
        }
        if (self.addVideoContentButton) {
          self.addVideoContentButton.$dom.remove()
          self.addVideoContentButton = undefined
          self.btnNum = 0
        }

        //if val is one of the directory entries directory
        if ( dirs.some(function(e,i,a) { return e == val }) ) {
          self.subdirs.push(val)

          function lookupSuccess(data) {
            console.log('VolumeBrowser__addDirSelect: disSelectChanged: lookupSuccess; data = ', data)
            self.addDirSelect(data.dirs, data.files)
          }

          $.ajax({ url     : 'lookup'
                 , type    : 'GET'
                 , data    : { top     : self.selectedVolume
                             , subdirs : self.subdirs
                             }
                 , success : lookupSuccess
                 })
        }
        else if ( files.some(function(e,i,a) { return e == val }) ) {
          self.fileSelected(val)
        }
        else {
          //WTF!!!
          var errmsg = 'selected val='
                     + JSON.stringify(val)
                     + ' is neither in dirs[] nor files[]'
          console.error(errmsg)
          throw new Error(errmsg)
        }

        return
      } //end: dirSelectChanged()
      
      $( '#'+dirSelect.ids.select ).change( dirSelectChanged )
    } //end: VolumeBrowser__addDirSelect()

  VolumeBrowser.prototype.fileSelected =
    function VolumeBrowser__fileSelected(file) {
      console.log('VolumeBrowser__fileSelected: fqfn:'
                 + '"' + this.selectedVolume + '"/'
                 + this.subdirs.join('/')
                 + '/'
                 + file
                 )
      var volume = this.selectedVolume
      var subdirs = _.clone(this.subdirs)
      
      //add addVideoContentButton
      var vidCnts = this.videoContents
      this.addVideoContentButton = new LaunchVideoContentButton(volume,
                                                                subdirs,
                                                                file,
                                                                vidCnts)


      this.$dom.after( this.addVideoContentButton.$dom )

      var self = this
      function addVideoContent(e) {
        self.addVideoContentButton.$dom.remove()
        self.videoContents.addVideoContent(volume, subdirs, file)
      }
      this.addVideoContentButton.$dom.click( addVideoContent )
    } //end: VolumeBrowser__fileSelected()

  function DirSelect(dirNum, dirs, files, volumeBrowser) {
    this.dirNum        = dirNum
    this.dirs          = dirs
    this.files         = files
    this.volumeBrowser = volumeBrowser
    this.nextDirSelect = undefined

    var size = dirs.length + files.length
    
    this.ids = { div    : 'fileSelectorDiv-'+dirNum
               , wrapDiv: 'dirWrapDiv-'+dirNum
               , select : 'dirSelect-'+dirNum
               }

    this.$dom = $(document.createElement('div'))
                .attr('id', this.ids.div)
                .addClass('fileSelector')

    var $select
    var i
    if ( size > 0) {
      $select = $(document.createElement('select'))
                .attr('id', this.ids.select)
                .attr('size', size<2 ? 2 : size)
                .addClass('fileSelector')

      for (i=0; i<dirs.length; i+=1) {
        $select.append( $(document.createElement('option'))
                        .attr('value', dirs[i])
                        .addClass('directory')
                        .append( dirs[i]+'/' )
                      )
      }
      for (i=0; i<files.length; i+=1) {
        $select.append( $(document.createElement('option'))
                        .attr('value', files[i])
                        .addClass('file')
                        .append( files[i] )
                      )
      }

      this.$dom.append( $(document.createElement('div'))
                        .attr('id', this.ids.wrapDiv)
                        .addClass('wrapSelect')
                        .append($select)
                      )
    }
    else {
      this.$dom.append( $( document.createElement('span') )
                        .addClass('notice')
                        .append('Empty')
                      )
    }

  } //end: DirSelect()

  function LaunchVideoContentButton(volume, subdirs, file) {
    this.volume  = volume
    this.subdirs = _.clone(subdirs)
    this.file    = file
    this.id = 'launchButton'
    

    this.$dom = $( document.createElement('button') )
                .attr('type', 'button')
                .attr('id', this.id)
                .attr('value', file)
                .addClass('launchButton')
                .append(file)

  } //end: LaunchVideoConentButton()

  var VIDEO_APP = {
    "init" : function VIDEO_APP_init(cfg) {
      
      console.log('VIDEO_APP.init(cfg) CALLED cfg =', cfg)

      var videoApp = new VideoApp(cfg)

      VIDEO_APP.videoApp = videoApp

      return
    }
  }

  root.VIDEO_APP = VIDEO_APP
})(window, window.document)
