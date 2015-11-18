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

    var videoContents = new VideoContents(this)
    var videoControls = new VideoControls(controls_cfg, this)
    var volumeBrowser = new VolumeBrowser(cfg['video volumes'], this)

    this.volumeBrowser = volumeBrowser

    /*
     * See comment below on *Multiple Videos*
     */
    this.videoContents = videoContents

    this.videoControls = videoControls

    $('#fileSelect').append( volumeBrowser.$dom )

    $('#videoStuff').append( videoContents.$dom )
    
//    $('#videoStuff').append( videoControls.$dom )

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

  function VideoContents(videoApp) {
    this.videoApp = videoApp
    this.contents = []
    this.id = 'videoContents'
    this.$dom = $( document.createElement('div') )
                .attr('id', this.id)
                .addClass('videoContents')

    this.contents = [] //array of VideoContent objects
    this._isFullscreen = false
  }

  VideoContents.prototype.addVideoContent =
    function VideoContents__addVideoContent(volume, subdirs, file) {
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
      
      var videoContent = new VideoContent(vidNum, volume, subdirs, file,
                                          this.videoApp)

      this.contents.push(videoContent)

      this.$dom.append(videoContent.$dom)
    }

  VideoContents.prototype.startBusy = function VideoContents__startBusy() {
    console.log('VideoContents__startBusy:')
    
    if (this.contents.length) {
      this.contents[0].startBusy()
    }
  }

  VideoContents.prototype.stopBusy = function VideoContents__stopBusy() {
    console.log('VideoContents__stopBusy:')
    
    if (this.contents.length) {
      this.contents[0].stopBusy()
    }
  }
  
  VideoContents.prototype.isPaused = function VideoContents__isPaused() {
    var firstPaused, allPaused
    if (this.contents.length) {
      // Just an internal consistancy check :(
      firstPaused = this.contents[0].isPaused()
      allPaused = this.allPaused()
      if (firstPaused && !allPaused) {
        console.error('VideoContents__isPaused: firstPaused && !allPaused')
        return firstPaused
      }
      return allPaused
    }
    return
    /*
    //only examine the first videoContent assume the rest are the same
    if (this.contents.length)
      return this.contents[0].isPaused()
    else
      return
    */
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
    if (pct > 0 && pct < 1) {
      console.error('VideoContents__setVolume: pct > 0 && pct < 1')
      return
    }
    if (pct < 0) pct = 0
    if (pct > 100) pct = 100

    var allSetVolume = true
    for (let i=0; i<this.contents.length; i+=1) {
      allSetVolume = this.contents[i].setVolume(pct) && allSetVolume
    }
    return allSetVolume
  } //end: VideoContents__setVolume()

  VideoContents.prototype.isFullscreen =
    function VideoContents__isFullscreen() {
      return this._isFullscreen
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
  } //end: VideoContents__toggleFullscreen()


  function VideoContent(vidNum, volume, subdirs, file, videoApp) {
    console.log('VideoContent() constructor')

    this.vidNum   = vidNum
    this.volume   = volume
    this.subdirs  = subdirs
    this.file     = file
    this.videoApp = videoApp
    this.ids = { div     : 'videoConentDiv-'+vidNum
               , canvas  : 'videoCanvas-'+vidNum
               , spinnerSym : 'videoSpinnerSym-'+vidNum
               , spinnerDiv : 'videoSpinnerDiv-'+vidNum
               , display : 'videoDisplay-'+vidNum
               , video   : 'videoSource-'+vidNum
               }
    this._isFullscreen = false //assume not fullscreen to start !?!
    this.canPlay = undefined //set by 'canplay' event

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

    var $display = $( document.createElement('div') )
                   .attr('id', this.ids.display)
                   .addClass('videoDisplay')
                   .append( $canvas )
    this.$display = $display

    var $spinnerSym = $( document.createElement('i') )
                      .attr('id', this.ids.spinnerSym)
                      .addClass('fa')
                      .addClass('fa-spinner')
                      .addClass('fa-pulse')
                      .addClass('fa-3x')

    this.$spinnerSym = $spinnerSym

    var $spinner = $( document.createElement('div') )
                   .attr('id', this.ids.spinnerDiv)
                   .addClass('spinner')
                   //.addClass('hide')
                   .append( this.$spinnerSym )

    this.$spinner = $spinner

    if (0 == vidNum) {
      this.$display.append( this.$spinner )
      this.$display.append( videoApp.videoControls.$dom )
    }

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
                .append( this.$display )
                .append( this.$video )

    this._eventsSetup = false
    this._setupVideoEvents()

  } //end: VideoContent()

  VideoContent.prototype._setupVideoEvents =
    function VideoContent___setupVideoEvents() {
      if (this._eventsSetup) return
      this._eventsSetup = true

      var $video = this.$video
      var $canvas = this.$canvas
      var ctx     = this.ctx

      var videoControls = this.videoApp.videoControls
      
      var self = this
      $video.on('loadeddata', function onLoadedData(e) {
        console.log("onLoadedData: e.target.id=%s", e.target.id)
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

      //HTMLMediaElement Constant
      // eg. HTMLMediaElement.HAV_ENOUGH_DATA == 4
      // see: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement
      var MEC = [ "HAVE_NOTHING"
                , "HAVE_METADATA"
                , "HAVE_CURRENT_DATA"
                , "HAVE_FUTURE_DATA"
                , "HAVE_ENOUGH_DATA" ]

      $video.on('canplay', function onCanPlay(e) {
        self.canPlay = self.$video[0].readyState === HTMLMediaElement.HAVE_ENOUGH_DATA
        console.log("onCanPlay: %s.readyState = %s(%o); "
                   + "set self<VideoContent>.canPlay = %o"
                   , self.$video[0].id
                   , MEC[self.$video[0].readyState]
                   , self.$video[0].readyState
                   , self.canPlay)

        videoControls.enable()
        videoControls.cssPositionControls()
        self.cssCenterSpinner()
      })
      
      $video.on('playing', function onPlaying(e){
        console.log("onPlaying: e.target.id=%s", e.target.id)
      })

      $video.on('play', function onPlayStartCanvasTimer(e) {
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

      $video.on('pause', function onPauseMisc(e){
        console.log("onPlayMisc: e.target.id=%s", e.target.id)
        //do something ...maybe
      })

      $video.on('seeked', function onSeeked(e) {
        // display seeked frame when currentTime is manually changed
        //
        console.log('onSeeked: redrawing canvas')

        //videoControls.enable() //FIXME: this is causing error messages
        //console.log('onSeeked: after videoControls.enable()')
        self.stopBusy()
        
        ctx.drawImage($video[0], 0, 0, self.videoWidth, self.videoHeight)
      })
      
      $video.on('seeking', function onSeeking(e){
        console.log("onSeeking: e.target.id=%s", e.target.id)
        self.startBusy()
//        videoControls.disable()
      })

      $video.on('timeupdate', function onTimeUpdate(e){
        // By observation Chrome seems to fire off every quarter second.
        //
        //console.log("onTimeUpdate: e.target.id=%s; videoEl.currentTime=%f;"
        //           , e.target.id, videoEl.currentTime)
        //history.pushState(stateObj, "page 2", "bar.html");

        //self.videoApp.videoControls.$position
        //positionRngEl.value = e.target.currentTime
        //positionTimEl.value = Math.floor(e.target.currentTime)
      })

      $video.on('ended', function onEnded(e){
        console.log("onEnded: e.target.id=%s", e.target.id)


        //var $play = self.videoApp.videoControls.$play
        var $playSym = self.videoApp.videoControls.$playSym
        
        if ($playSym.hasClass('fa-pause')) {
          $playSym.removeClass('fa-pause')
          $playSym.addClass('fa-play')
        }
      })

      function onFullscreenChange(e) {
        console.log('onFullscreenChange: e = %o', e)
        var event = e.originalEvent.type
        console.log('onFullscreenChange: caused by %o', event)
        self.fullscreenChanged(e)
      }
      $(document).on('webkitfullscreenchange '
                    +'mozfullscreenchange '
                    +'fullscreenchange '
                    +'MSFullscreenChange'
                    , onFullscreenChange);

    } //end: VideoContent__setupVideo()

  VideoContent.prototype.startBusy = function VideoContent__startBusy() {
    console.log('VideoContent__startBusy:')
  }

  VideoContent.prototype.stopBusy = function VideoContent__stopBusy() {
    console.log('VideoContent__stopBusy:')
  }
  
  VideoContent.prototype.fullscreenChanged =
    function VideoContent__fullscreenChanged(e) {
      var videoControls = this.videoApp.videoControls
      var $fullscreenSym = videoControls.$fullscreenSym

      var self = this
      setTimeout(function() {
        self.cssCenterSpinner()
        videoControls.cssPositionControls()
      }, 500)
      
      if ( $fullscreenSym.hasClass('fa-arrows-alt') ) {
        $fullscreenSym.removeClass('fa-arrows-alt')
        $fullscreenSym.addClass('fa-compress')
      }
      else if ( $fullscreenSym.hasClass('fa-compress') ) {
        $fullscreenSym.removeClass('fa-compress')
        $fullscreenSym.addClass('fa-arrows-alt')
      }
      return
    }
  
  VideoContent.prototype.cssCenterSpinner =
    function VideoContent__cssCenterSpinner() {
      var $spinner = this.$spinner
      var $display = this.$display
      var offset_x = ($display.width()/2)-($spinner.width()/2)
      var offset_y = ($display.height()/2)-($spinner.height()/2)
      $spinner.css({top: offset_y, left: offset_x})
    }
  
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
    this.$video[0].currentTime += nsecs
  }

  VideoContent.prototype.setVolume = function VideoContent__setVolume(pct) {
    if (pct > 0 && pct < 1) {
      console.error('VideoContent__setVolume: pct > 0 && pct < 1')
      return
    }
    if (pct < 0) pct = 0
    if (pct > 100) pct = 100
    
    this.$video[0].volume = pct / 100

    return true
  }

  VideoContent.prototype.isFullscreen =
    function VideoContent__isFullscreen() {
      return this._isFullscreen
    }

  VideoContent.prototype.toggleFullscreen =
    function VideoContent__toggleFullscreen() {
      //$(document).on('webkitfullscreenchange '
      //              +'mozfullscreenchange '
      //              +'fullscreenchange '
      //              +'MSFullscreenChange', fn);
      if ( !this.isFullscreen() ) {
        //var el = this.$video[0]
        var el = this.$display[0]
        if (el.requestFullscreen) {
          console.log('VideoContent__toggleFullscreen: used requestFullscreen')
          el.requestFullscreen()
        }
        else if (el.msRequestFullscreen) {
          console.log('VideoContent__toggleFullscreen: used msRequestFullscreen')
          el.msRequestFullscreen()
        }
        else if (el.mozRequestFullScreen) {
          console.log('VideoContent__toggleFullscreen: used mozRequestFullScreen')
          el.mozRequestFullScreen()
        }
        else if (el.webkitRequestFullscreen) {
          console.log('VideoContent__toggleFullscreen: used webkitRequestFullscreen')
          el.webkitRequestFullscreen()
        }
        else {
          console.log('VideoContent__toggleFullscreen: failed to find requestFullScreen equivelent')
          alert("requestFullScreen not implemented by this browser")
          return
        }
        this.cssCenterSpinner()
        return this._isFullscreen = true
      }
      else {
        // try to cancel fullscreen
        if (document.cancelFullScreen) {
          console.log('VideoContent__toggleFullscreen: used document.cancelFullScreen')
          document.cancelFullScreen()
        }
        else if (document.msExitFullscreen) {
          console.log('VideoContent__toggleFullscreen: used document.msExitFullscreen')
          document.msExitFullscreen()
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



  function VideoControls(_cfg, videoApp) {
    this.videoApp = videoApp
    //this.videoContents = videoApp.videoContents
    var cfg = _.cloneDeep(_cfg) || {}
    
    this.skipBackSecs = cfg.skipBackSecs || 10
    this.skipForwSecs = cfg.skipForwSecs || 120

    this._enabled = false

    this.ids = { div           : 'videoControls'
               , playSym       : 'playSym'
               , pauseSym      : 'pauseSym'
               , playDiv       : 'play'
               , skipSym       : 'skipSym'
               , skipDiv       : 'skip'
               , backSym       : 'backSym'
               , backDiv       : 'back'
               , volumeDiv     : 'volume'
               , volumeSym     : 'volumeSym'
               , volumeRng     : 'volumeRng'
               , positionDiv   : 'position'
               , positionTxt   : 'positionTxt'
               , positionRng   : 'positionRng'
               , fullscreenDiv : 'fullscreen'
               , fullscreenSym : 'fullscreenSym'
               }

    this.$playSym       = undefined
    this.$play          = undefined
    this.$skipSym       = undefined
    this.$skip          = undefined
    this.$backSym       = undefined
    this.$back          = undefined
    this.$volume        = undefined
    this.$volumeRng     = undefined
    this.$position      = undefined
    this.$positionTxt   = undefined
    this.$positionRnt   = undefined
    this.$fullscreen    = undefined
    this.$fullscreenSym = undefined

    this.$dom = $( document.createElement('div') )
                .attr('id', this.ids.div)
                .addClass('disabled')

    this.$playSym = $( document.createElement('i') )
                    .attr('id', this.ids.playSym)
                    .addClass('fa')
                    .addClass('fa-play')

    this.$play = $( document.createElement('div') )
                 .attr('id', this.ids.playDiv)
                 .addClass('control')
                 .append( this.$playSym )
    
    var self = this

    this.onPlayClickFn = function onPlayClick(e) {
      var videoContents = self.videoApp.videoContents
      
      console.log('onPlayClick: videoContents.isPaused() = %o', videoContents.isPaused())
      if ( videoContents.isPaused() ) {
        console.log('onPlayClick: calling videoContents.play()')
        videoContents.play()
        self.$playSym.removeClass('fa-play')
        self.$playSym.addClass('fa-pause')
      }
      else {
        console.log('onPlayClick: calling videoContents.pause()')
        videoContents.pause()
        self.$playSym.removeClass('fa-pause')
        self.$playSym.addClass('fa-play')
      }
    }
    
    this.$dom.append( this.$play )

    this.$skipSym = $( document.createElement('i') )
                    .attr('id', this.ids.skipSym)
                    .addClass('fa')
                    .addClass('fa-step-forward')
    
    this.$skip = $( document.createElement('div') )
                 .attr('id', this.ids.skipDiv)
                 .addClass('control')
                 .append( this.$skipSym )

    this.onSkipClickFn = function onSkipClick(e) {
      console.log('onSkipClick: seeking %d secs', self.skipForwSecs)
      var videoContents = self.videoApp.videoContents
      videoContents.seek(self.skipForwSecs)
    }
    
    this.$dom.append( this.$skip )

    this.$backSym = $( document.createElement('i') )
                    .attr('id', this.ids.backSym)
                    .addClass('fa')
                    .addClass('fa-step-backward')
    
    this.$back = $( document.createElement('div') )
                 .attr('id', this.ids.backDiv)
                 .addClass('control')
                 .append( this.$backSym )

    this.onBackClickFn = function onBackClick(e) {
      console.log('onBackClick: seeking %d secs', -self.skipBackSecs)
      var videoContents = self.videoApp.videoContents
      videoContents.seek(-self.skipBackSecs)
    }

    this.$dom.append( this.$back )

    // need to do this.$position

    this.$fullscreenSym = $( document.createElement('i') )
                          .attr('id', this.ids.fullscreenSym)
                          .addClass('fa')
                          .addClass('fa-arrows-alt')

    this.$fullscreen = $( document.createElement('div') )
                       .attr('id', this.ids.fullscreenDiv)
                       .addClass('control')
                       .append( this.$fullscreenSym )

    this.onFullscreenClickFn = function onFullscreenClick(e) {
      console.log('onFullscreenClick: called')

      var videoContents = self.videoApp.videoContents

      videoContents.toggleFullscreen()
      //self.cssPositionControls()
    }

    this.$dom.append( this.$fullscreen )

    this.$volumeSym = $( document.createElement('i') )
                      .attr('id', this.ids.volumeSym)
                      .addClass('fa')
                      .addClass('fa-volume-up')
                      //.addClass('fa-volume-down')
                      //.addClass('fa-volume-off')

    this.onVolumeSymClickFn = function onVolumeSymClick(e) {
      if (self.$volume[0].muted) {
        this.removeClass('fa-volume-off')
        if (self.$volume[0].volume < 0.5) {
          self.$volumeSym.removeClass('fa-volume-up')
          self.$volumeSym.addClass('fa-volume-down')
        }
        else {
          self.$volumeSym.removeClass('fa-volume-down')
          self.$volumeSym.addClass('fa-volume-up')
        }
      }
    }

    this.$volumeRng = $( document.createElement('input') )
                      .attr('id', this.ids.volumeRng)
                      .attr('type', 'range')
                      .attr('min', 0)
                      .attr('max', 100)
                      .attr('value', 100)
                      .addClass('range')

    this.onVolumeRngInputFn = function onVolumeRngInput(e) {
      var volume = e.target.valueAsNumber
      console.log('onVolumeRngInput: volume = %d', volume)

      var videoContents = self.videoApp.videoContents

      videoContents.setVolume(volume)
      //self.$video[0].volume = volume / 100
    }

    this.$volume = $( document.createElement('div') )
                   .attr('id', this.ids.volumeDiv)
                   .addClass('control')
                   .append( this.$volumeSym )
                   .append( this.$volumeRng )
    

    this.$dom.append( this.$volume )

    //this.enable()
  } //end: VideoControls()

  VideoControls.prototype.cssPositionControls =
    function VideoControls__cssPositionControls() {
      var videoContents, $display, $controls, offset
      
      videoContents = this.videoApp.videoContents
      if ( videoContents.contents.length ) {
        //grab the first $display where the controls are under
        $display = videoContents.contents[0].$display
        $controls = $('#videoControls')
        offset = ($display.width()/2) - ($controls.width()/2)
        $controls.css({top: 10, left: offset})
      }
    }
  
  VideoControls.prototype.reset = function VideoControls__reset() {
    this.disable()
    if (this.$playSym.hasClass('fa-pause')) {
      this.$playSym.removeClass('fa-pause')
      this.$playSym.addClass('fa-play')
    }
    this.setVolume(100)
  }

  VideoControls.prototype.isEnabled = function VideoControls__isEnabled() {
    return this._enabled
  }
  
  VideoControls.prototype.enable = function VideoControls__enable() {
    if (!this.isEnabled()) {
      if ( this.$dom.hasClass('disabled') ) {
        this.$dom.removeClass('disabled')
        this.$dom.addClass('enabled')
      }
      else {
        console.error('WTF!!! VideoControls__enable: !this.isEnabled() && !this.$dom.hasClass("disabled")')
        //return;
      }
      
      this.$play.on('click', this.onPlayClickFn)
      this.$skip.on('click', this.onSkipClickFn)
      this.$back.on('click', this.onBackClickFn)
      this.$fullscreen.on('click', this.onFullscreenClickFn)
      this.$volumeSym.on('click', this.onVolumeSymClickFn)
      this.$volumeRng.on('input', this.onVolumeRngInputFn)
      
      this._enabled = true
    }
  }

  VideoControls.prototype.disable = function VideoControls__disable() {
    if (this.isEnabled()) {
      this.$dom.removeClass('enabled')
      this.$dom.addClass('enabled')
      this.$play.off('click', this.onPlayClickFn)
      this.$skip.off('click', this.onSkipClickFn)
      this.$back.off('click', this.onBackClickFn)
      this.$fullscreen.off('click', this.onFullscreenClickFn)
      this.$volumeSym.off('click', this.onVolumeSymClickFn)
      this._enabled = false
    }
  }

  VideoContents.prototype.setVolume = function VideoControls__setVolume(pct) {
    'use strict';
    if (pct < 0) pct = 0
    if (pct > 100) pct = 100
    console.log('VideoControls__setVolume: pct = %d', pct)
    console.log('VideoControls__setVolume: doing nothing for now')

    var allVolumeSet = true
    for (let i=0; i<this.contents.length; i+=1) {
      allVolumeSet = this.contents[i].setVolume(0) && allVolumeSet
    }
    return allVolumeSet
  }
  
  function VolumeBrowser(volumeNames, videoApp) {
    /* volumeNames = [ name_1, name_2, ..., name_n]
     */
    this.videoApp = videoApp
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
      this.addVideoContentButton = new LaunchVideoContentButton(volume,
                                                                subdirs,
                                                                file)

      this.$dom.after( this.addVideoContentButton.$dom )

      var self = this
      function addVideoContent(e) {
        self.addVideoContentButton.$dom.remove()
        self.videoApp.videoContents.addVideoContent(volume, subdirs, file)
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
