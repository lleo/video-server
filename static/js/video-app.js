/*global wrapSelect */
/*
 * NOTE: Remember this is running in the browser.
 */
//This wrapper function is wholly unnecessary but whatever ...
(function(window, document, undefined) {

  function debug() {
    var args
    var videoApp = VIDEO_APP.videoApp
    if (videoApp.debug) {
      args = [].slice.apply(arguments)
      lvl = args.shift()
      if (lvl >= videoApp.debug)
        console.log.apply(console, args)
    }
  }

  var LogLevels = ['info', 'warn', 'crit', 'none', 'error']
  {
    var info_lvl  = LogLevels.indexOf('info')
    var warn_lvl  = LogLevels.indexOf('warn')
    var crit_lvl  = LogLevels.indexOf('crit')
    var error_lvl = LogLevels.indexOf('error')
    var _slice    = Array.prototype.slice

    function info() {
      var args, debug_lvl = VIDEO_APP.videoApp.debugLvl
      if (info_lvl >= debug_lvl) {
        args = _slice.apply(arguments)
        if (args.length == 0) args.push('')
        args[0] = '[INFO] '+args[0]
        console.log.apply(console, args)
      }
    }

    function warn() {
      var args, debug_lvl = VIDEO_APP.videoApp.debugLvl
      if (warn_lvl >= debug_lvl) {
        args = _slice.apply(arguments)
        if (args.length == 0) args.push('')
        args[0] = '[WARN] '+args[0]
        console.log.apply(console, args)
      }
    }

    function crit() {
      var args, debug_lvl = VIDEO_APP.videoApp.debugLvl
      if (crit_lvl >= debug_lvl) {
        args = _slice.apply(arguments)
        if (args.length == 0) args.push('')
        args[0] = '[CRIT] '+args[0]
        console.log.apply(console, args)
      }
    }

    function error() {
      var args = _slice.apply(arguments)
        , debug_lvl = VIDEO_APP.videoApp.debugLvl
      if (args.length == 0) args.push('')
      args[0] = '[ERROR] '+args[0]
      console.error.apply(console, args)
    }

  } //end: closure block
  

  
  function VideoApp(_cfg) {
    var cfg = _.cloneDeep(_cfg) || {}
    var controls_cfg = cfg.controls || {}

    this.cfg = cfg
    this.debug = cfg.debug || 'info'
    this.debugLvl = LogLevels.indexOf(this.debug)
    console.log('cfg.debug = %s; this.debug = %s;', cfg.debug, this.debug)
    

    var videoContents = new VideoContents(this)
    var videoControls = new VideoControls(controls_cfg, this)
    var fileBrowser   = new FileBrowser(cfg['video root names'], this)

    this.fileBrowser = fileBrowser

    /*
     * See comment below on *Multiple Videos*
     */
    this.videoContents = videoContents

    this.videoControls = videoControls

    $('#fileSelect').append( fileBrowser.$dom )

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
    function VideoContents__addVideoContent(root, subdirs, file) {
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
      var videoControls = this.videoApp.videoControls
      videoControls.disable()
      videoControls.reset()

      var vidNum = this.contents.length
      
      var videoContent = new VideoContent(vidNum, root, subdirs, file,
                                          this.videoApp)

      this.contents.push(videoContent)

      this.$dom.append(videoContent.$dom)
    }

  VideoContents.prototype.startBusy = function VideoContents__startBusy() {
    info('VideoContents__startBusy:')
    
    if (this.contents.length) {
      this.contents[0].startBusy()
    }
  }

  VideoContents.prototype.stopBusy = function VideoContents__stopBusy() {
    info('VideoContents__stopBusy:')
    
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
  }

  VideoContents.prototype.allPaused = function VideoContents__allPaused() {
    'use strict';
    var allPaused = true
    for (var i=0; i<this.contents.length; i+=1) {
      allPaused = this.contents[i].isPaused() && allPaused
    }
    return allPaused
  }
  
  VideoContents.prototype.play = function VideoContents__play() {
    'use strict';
    var allPlayed = true
    for (var i=0; i<this.contents.length; i+=1) {
      if ( this.contents[i].isPaused() )
        allPlayed = this.contents[i].play() && allPlayed
    }
    return allPlayed
  }
  
  VideoContents.prototype.pause = function VideoContents__pause() {
    'use strict';
    var allPaused = true
    for (var i=0; i<this.contents.length; i+=1) {
      if ( !this.contents[i].isPaused() )
        allPaused = this.contents[i].pause() && allPaused
    }
    return allPaused
  }

  VideoContents.prototype.setPosition =
    function VideoContents__setPosition(fsecs) {
      'use strict';
      var allSet = true
      for (var i=0; i<this.contents.length; i+=1) {
        allSet = this.contents[i].setPosition(fsecs) && allSet
      }
      return allSet
    }
  
  VideoContents.prototype.seek = function VideoContents__seek(nsecs) {
    'use strict';
    var allSeeked = true
    for (var i=0; i<this.contents.length; i+=1) {
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
    for (var i=0; i<this.contents.length; i+=1) {
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


  function VideoContent(vidNum, root, subdirs, file, videoApp) {
    info('VideoContent() constructor')

    this.vidNum   = vidNum
    this.root     = root
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
    this.videoWidth  = undefined //set in onLoadedData
    this.videoHeight = undefined //set in onLoadedData

    /*
     * Create the video DOM element. Start with the SourceElement first
     */
    var parts = ['/stream', root]
    //if (subdirs.length) parts.push( subdirs.join('/') )
    parts = parts.concat(subdirs)
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
                 //.attr('controls', true)
                 .addClass('videoDisplay')
                 .append($source)

    this.$video = $video
    
    //var $display = $( document.createElement('div') )
    //               .attr('id', this.ids.display)
    //               .addClass('videoDisplay')
    //               .append( this.$video )
    //
    //this.$display = $display

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
                   .addClass('hide')
                   .append( this.$spinnerSym )

    this.$spinner = $spinner

    this.$dom = $( document.createElement('div') )
                .attr('id', this.ids.div)
                .addClass('videoContent')
                .addClass('nocursor')
                .append( this.$video )

    if (0 == vidNum) {
      this.$dom.append( this.$spinner )
      this.$dom.append( videoApp.videoControls.$dom )
    }

    this._eventsSetup = false
    this._setupVideoEvents()

  } //end: VideoContent()

  VideoContent.prototype._setupVideoEvents =
    function VideoContent___setupVideoEvents() {
      if (this._eventsSetup) return
      this._eventsSetup = true

      var $video = this.$video
      //var videoControls = this.videoApp.videoControls
      
      var self = this


      { // closure of these mouse event functions over these state variables
        var hideBothTimerId
          , firstThrottleTimerExecuted = false
          , overControls = false

        function onMouseMove() {
          // The algorithm is as follows:
          // 0 - turn off the on 'mousemove' event handler
          //   - show controls & cursor & start throttling the 'mousemove' events
          // 1 - if 2000ms after the first throttle timer has fired,
          //     then hide the controls & cursor
          var videoControls = self.videoApp.videoControls

          // After a longish time after the last mouse movement event was fired,
          // this code will fire causing the controls and cursor to hide.
          function hideBothTimerFn() {
            // the variable overControls is a boolean that is set try by the 
            // 'mouseenter' and 'false' by the 'mouseleave' events declared
            // below this onMouseMoved() function declaration.
            if (!overControls && !videoControls.$dom.hasClass('hide'))
              videoControls.$dom.addClass('hide')

            if (!overControls && !self.$dom.hasClass('nocursor'))
              self.$dom.addClass('nocursor')

            // reset the firstThrottleTimerExecuted & hideBothTimerId
            firstThrottleTimerExecuted = false
            hideBothTimerId = undefined
          }
          function throttleTimerFn() {
            // turn 'mousemove' back on
            self.$dom.on('mousemove', onMouseMove)

            // if the hideBothTimerId for the histBothTimerFn exists
            // and this is NOT the first in a sequence of 'mousemove' events
            if (hideBothTimerId || !firstThrottleTimerExecuted) {
              clearTimeout(hideBothTimerId)
              firstThrottleTimerExecuted = true
              hideBothTimerId = setTimeout(hideBothTimerFn, 2000)
            }
          }

          // mouse moved -> disable on 'mousemove' events; throttling
          self.$dom.off('mousemove', onMouseMove)

          // mouse moved -> show controls
          if ( videoControls.$dom.hasClass('hide') ) {
            videoControls.$dom.removeClass('hide')
          }

          // mouse moved -> show cursor
          if ( self.$dom.hasClass('nocursor') ) {
            self.$dom.removeClass('nocursor')
          }

          // in 50ms (1/20th sec) reenable 'mousemove' events
          setTimeout(throttleTimerFn, 50)
        } //end: onMouseMove()

        //function onMouseMove(e) { //[test]
        //  info('onMouseMove: overControls = %o', overControls)
        //
        //  function hideBothTimerFn() {
        //    info('hideBothTimerFn: overControls = %o', overControls)
        //    hideBothTimerId = undefined
        //    if (!overControls) {
        //      if ( !self.videoApp.videoControls.$dom.hasClass('hide') ) {
        //        self.videoApp.videoControls.$dom.addClass('hide')
        //      }
        //      if ( !self.$dom.hasClass('nocursor') ) {
        //        self.$dom.addClass('nocursor')
        //      }
        //    }
        //  }
        //
        //  // mouse moved -> show controls
        //  if ( self.videoApp.videoControls.$dom.hasClass('hide') ) {
        //    info("onMouseMove: calling videoControls.$dom.removeClass('hide')")
        //    self.videoApp.videoControls.$dom.removeClass('hide')
        //  }
        //
        //  // mouse moved -> show cursor
        //  if ( self.$dom.hasClass('nocursor') ) {
        //    info("onMouseMove: calling self.$dom.removeClass('nocursor')")
        //    self.$dom.removeClass('nocursor')
        //  }
        //
        //  if (hideBothTimerId) clearTimeout(hideBothTimerId)
        //  hideBothTimerId = setTimeout(hideBothTimerFn, 2000)
        //} //end: onMouseMove() [test]
        this.$dom.on('mousemove', onMouseMove)

        function onMouseEnter(e) {
          overControls = true
        }
        function onMouseLeave(e) {
          overControls = false
        }
        self.videoApp.videoControls.$dom.on('mouseenter', onMouseEnter)
        self.videoApp.videoControls.$dom.on('mouseleave', onMouseLeave)
      } //end: closure for mouse event state

      $video.on('loadeddata', function onLoadedData(e) {
        info("onLoadedData: e.target.id=%s", e.target.id)
        // 'loadeddata' means that the HTMLMediaElement has loaded enough
        // data to display one frame.
        //
        // developer.mozilla.org/en-US/docs/Web/Guide/Events/Media_events says:
        //  "loadeddata" -> "The first frame of the media has finished loading"
        //
        // So I can grab the videoWidth and videoHeight of the video at this
        //  point, and set the canvasEl width and height.
        //

        self.videoWidth  = self.$video[0].videoWidth
        self.videoHeight = self.$video[0].videoHeight

        info("onLoadedData: width=%f; height=%f;"
            , self.videoWidth, self.videoHeight)

        info('onLoadedData: self.$video[0].duration = %f', self.$video[0].duration)
        var videoControls = self.videoApp.videoControls
        videoControls.$positionRng[0].max = self.$video[0].duration

        //console.log('onLoadedData: self.cfg.initTime = %f', self.cfg.initTime)
        //videoControls.setPosition(self.cfg.initTime)
        //videoContents.setPosition(self.cfg.initTime)
        
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
        info("onCanPlay: %s.readyState = %s(%o); "
            + "set self<VideoContent>.canPlay = %o"
            , self.$video[0].id
            , MEC[self.$video[0].readyState]
            , self.$video[0].readyState
            , self.canPlay)

        var videoControls = self.videoApp.videoControls
        videoControls.enable()
        videoControls.cssPositionControls()
        self.cssCenterSpinner()
      })
      
      $video.on('playing', function onPlaying(e){
        info("onPlaying: e.target.id=%s", e.target.id)
      })

      $video.on('pause', function onPauseMisc(e){
        info("onPlayMisc: e.target.id=%s", e.target.id)
        //do something ...maybe
      })

      $video.on('seeked', function onSeeked(e) {
        // display seeked frame when currentTime is manually changed
        //
        info('onSeeked: calling self<VideoContent>.stopBusy()')

        self.stopBusy()
      })
      
      $video.on('seeking', function onSeeking(e){
        info("onSeeking: e.target.id=%s", e.target.id)
        info('onSeeking: calling self<VideoContent>.startBusy()')

        self.startBusy()
      })

      $video.on('timeupdate', function onTimeUpdate(e){
        var videoControls = self.videoApp.videoControls
        videoControls.$positionRng[0].value = e.target.currentTime
        videoControls.$positionNum[0].value = Math.floor(e.target.currentTime)
      })

      $video.on('ended', function onEnded(e){
        info("onEnded: e.target.id=%s", e.target.id)


        //var $play = self.videoApp.videoControls.$play
        var $playSym = self.videoApp.videoControls.$playSym
        
        if ($playSym.hasClass('fa-pause')) {
          $playSym.removeClass('fa-pause')
          $playSym.addClass('fa-play')
        }
      })

      function onFullscreenChange(e) {
        info('onFullscreenChange: e = %o', e)
        var event = e.originalEvent.type
        warn('onFullscreenChange: caused by %o', event)
        self.fullscreenChanged(e)
      }
      $(document).on('webkitfullscreenchange '
                    +'mozfullscreenchange '
                    +'fullscreenchange '
                    +'MSFullscreenChange'
                    , onFullscreenChange);

    } //end: VideoContent__setupVideo()

  VideoContent.prototype.startBusy = function VideoContent__startBusy() {
    info('VideoContent__startBusy:')
    var videoControls = this.videoApp.videoControls

    if (0 == this.vidNum) {
      //disable the controls
      videoControls.disable()
    }

    //remove the hide class from the $spinner
    if ( this.$spinner.hasClass('hide') ) {
      info('VideoContent__startBusy: $spinner has "hide" class')
      info('VideoContent__startBusy: removing "hide" class to $spinner')
      this.$spinner.removeClass('hide')
    }
  }

  VideoContent.prototype.stopBusy = function VideoContent__stopBusy() {
    info('VideoContent__stopBusy:')
    var videoControls = this.videoApp.videoControls

    if (0 == this.vidNum) {
      //enable the controls
      videoControls.enable()
    }

    //add the hide class from the $spinner
    if ( !this.$spinner.hasClass('hide') ) {
      info('VideoContent_stopBusy: $spinner does not have "hide" class')
      info('VideoContent__stopBusy: adding "hide" class to $spinner')
      this.$spinner.addClass('hide')
    }
  }
  
  VideoContent.prototype.fullscreenChanged =
    function VideoContent__fullscreenChanged(e) {
      var videoControls = this.videoApp.videoControls
      var $fullscreenSym = videoControls.$fullscreenSym

      var self = this

      /* This is called only from the fullscreenchange event.
       * For some reason that fires off before the new fullscreen element
       * has its dimensions set. So, I have inserted this delayed function
       * to set the positioning of the spinner and controls.
       * 500ms seems to be enought most of the time on my MacBook Pro
       * (early 2011).
       */
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
      var $dom = this.$dom
      var offset_x = ($dom.width()/2)-($spinner.width()/2)
      var offset_y = ($dom.height()/2)-($spinner.height()/2)
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

  VideoContent.prototype.setPosition =
    function VideoContent__setPosition(fsecs) {
      info('VideoContent__setPosition: fsecs = %f', fsecs)

      this.$video[0].currentTime = fsecs

      return true
    }

  VideoContent.prototype.seek = function VideoContent__seek(nsecs) {
    info('VideoContent__seek: nsecs = %d', nsecs)
    var newTime = this.$video[0].currentTime + nsecs
    this.setPosition(newTime)
    return true
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
        var el = this.$dom[0]
        if (el.requestFullscreen) {
          info('VideoContent__toggleFullscreen: used requestFullscreen')
          el.requestFullscreen()
        }
        else if (el.msRequestFullscreen) {
          info('VideoContent__toggleFullscreen: used msRequestFullscreen')
          el.msRequestFullscreen()
        }
        else if (el.mozRequestFullScreen) {
          info('VideoContent__toggleFullscreen: used mozRequestFullScreen')
          el.mozRequestFullScreen()
        }
        else if (el.webkitRequestFullscreen) {
          info('VideoContent__toggleFullscreen: used webkitRequestFullscreen')
          el.webkitRequestFullscreen()
        }
        else {
          warn('VideoContent__toggleFullscreen: failed to find requestFullScreen equivelent')
          alert("requestFullScreen not implemented by this browser")
          return
        }
        this.cssCenterSpinner()
        return this._isFullscreen = true
      }
      else {
        // try to cancel fullscreen
        if (document.cancelFullScreen) {
          info('VideoContent__toggleFullscreen: used document.cancelFullScreen')
          document.cancelFullScreen()
        }
        else if (document.msExitFullscreen) {
          info('VideoContent__toggleFullscreen: used document.msExitFullscreen')
          document.msExitFullscreen()
        }
        else if (document.mozCancelFullScreen) {
          info('VideoContent__toggleFullscreen: used document.mozCancelFullScreen')
          document.mozCancelFullScreen()
        }
        else if (document.webkitCancelFullScreen) {
          info('VideoContent__toggleFullscreen: used document.webkitCancelFullScreen')
          document.webkitCancelFullScreen()
        }
        else {
          warn('VideoContent__toggleFullscreen: faled to find cancelFullScreen')
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
    this.skipForwSecs = cfg.skipForwSecs || 30

    this._enabled = false

    this.ids = { div           : 'videoControls'
               , flexWrapper   : 'flexWrapper'
               , playSym       : 'playSym'
               , pauseSym      : 'pauseSym'
               , playDiv       : 'play'
               , skipSym       : 'skipSym'
               , skipDiv       : 'skip'
               , backSym       : 'backSym'
               , backDiv       : 'back'
               , volumeDiv     : 'volume'
               , volumeSym     : 'volumeSym'
               , volumeSymDiv  : 'volumeSymDiv'
               , volumeRng     : 'volumeRng'
               , positionDiv   : 'position'
               , positionNum   : 'positionNum'
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
    this.$volumeSym     = undefined
    this.$volumeSymDiv  = undefined
    this.$volumeRng     = undefined
    this.$position      = undefined
    this.$positionNum   = undefined
    this.$positionRng   = undefined
    this.$fullscreen    = undefined
    this.$fullscreenSym = undefined

    this.$flexWrapper = $( document.createElement('div') )
                        .attr('id', this.ids.flexWrapper)


    this.$dom = $( document.createElement('div') )
                .attr('id', this.ids.div)
                .addClass('disabled')
                .addClass('hide')
                .append( this.$flexWrapper )

    var self = this //for callbacks

    /* *************
     * Play Button *
     *************** */
    this.$playSym = $( document.createElement('i') )
                    .attr('id', this.ids.playSym)
                    .addClass('fa')
                    .addClass('fa-play')

    this.$play = $( document.createElement('div') )
                 .attr('id', this.ids.playDiv)
                 .addClass('control')
                 .append( this.$playSym )
    
    this.onPlayClickFn = function onPlayClick(e) {
      var videoContents = self.videoApp.videoContents
      
      info('onPlayClick: videoContents.isPaused() = %o', videoContents.isPaused())
      if ( videoContents.isPaused() ) {
        info('onPlayClick: calling videoContents.play()')
        videoContents.play()
        self.$playSym.removeClass('fa-play')
        self.$playSym.addClass('fa-pause')
      }
      else {
        info('onPlayClick: calling videoContents.pause()')
        videoContents.pause()
        self.$playSym.removeClass('fa-pause')
        self.$playSym.addClass('fa-play')
      }
    }
    
    this.$flexWrapper.append( this.$play )


    /***************
     * Skip Button *
     ***************/
    this.$skipSym = $( document.createElement('i') )
                    .attr('id', this.ids.skipSym)
                    .addClass('fa')
                    .addClass('fa-step-forward')
    
    this.$skip = $( document.createElement('div') )
                 .attr('id', this.ids.skipDiv)
                 .addClass('control')
                 .append( this.$skipSym )

    this.onSkipClickFn = function onSkipClick(e) {
      info('onSkipClick: seeking %d secs', self.skipForwSecs)
      var videoContents = self.videoApp.videoContents
      videoContents.seek(self.skipForwSecs)
    }
    
    this.$flexWrapper.append( this.$skip )

    /***************
     * Back Button *
     ***************/
    this.$backSym = $( document.createElement('i') )
                    .attr('id', this.ids.backSym)
                    .addClass('fa')
                    .addClass('fa-step-backward')
    
    this.$back = $( document.createElement('div') )
                 .attr('id', this.ids.backDiv)
                 .addClass('control')
                 .append( this.$backSym )

    this.onBackClickFn = function onBackClick(e) {
      info('onBackClick: seeking %d secs', -self.skipBackSecs)
      var videoContents = self.videoApp.videoContents
      videoContents.seek(-self.skipBackSecs)
    }

    this.$flexWrapper.append( this.$back )

    /*************************
     * Position Text & Range *
     *************************/
    this.$positionNum = $( document.createElement('input') )
                        .attr('id', this.ids.positionNum)
                        .attr('type', 'number')
                        .attr('value', 0)

    this.onPositionNumInputFn = function onPositionNumInput(e) {
      info('onPositionNumInput: e.target.valueAsNumber = %f'
          , e.target.valueAsNumber)
      var val = e.target.valueAsNumber
      self.setPosition(val)
      self.videoApp.videoContents.setPosition(val)
    }

    this.$positionRng = $( document.createElement('input') )
                        .attr('id', this.ids.positionRng)
                        .attr('type', 'range')
                        .attr('min', 0)
                        .attr('max', 300)
                        .attr('value', 0)

    this.onPositionRngInputFn = function onPositionRngInput(e) {
      info('onPositionRngInput: e.target.valueAsNumber = %f'
          , e.target.valueAsNumber)

      var val = e.target.valueAsNumber

      self.setPosition(val)
      self.videoApp.videoContents.setPosition(val)
    }

    this.$position = $( document.createElement('div') )
                     .attr('id', this.ids.positionDiv)
                     .addClass('control')
                     .append( this.$positionNum )
                     .append( this.$positionRng )

    this.$flexWrapper.append( this.$position )

    /*****************
     * Volume Range  *
     *****************/
    this.$volumeSym = $( document.createElement('i') )
                      .attr('id', this.ids.volumeSym)
                      .addClass('fa')
                      .addClass('fa-volume-up')
    //.addClass('fa-volume-down')
    //.addClass('fa-volume-off')

    this.$volumeSymDiv = $( document.createElement('div') )
                         .attr('id', this.ids.volumeSymDiv)
                         .append( this.$volumeSym )

    
    this.onVolumeSymClickFn = function onVolumeSymClick(e) {
      var videoEl
      var videoContents = self.videoApp.videoContents
      if (videoContents.contents.length) {
        videoEl = videoContents.contents[0].$video[0]
      }
      else {
        console.error('onVolumeSymClick: videoContents.contents.length = 0')
        return
      }
      
      info('onVolumeSymClick: before volume = %f', videoEl.volume)
      if (videoEl.muted) {
        videoEl.muted = false
        info('onVolumeSymClick: muted after volume = %f', videoEl.volume)

        if ( self.$volumeSym.hasClass('fa-volume-off') ) {
          self.$volumeSym.removeClass('fa-volume-off')

          if (videoEl.volume < 0.5) {
            self.$volumeSym.addClass('fa-volume-down')
          }
          else {
            self.$volumeSym.addClass('fa-volume-up')
          }
        }
        
      }
      else { //volume on
        videoEl.muted = true
        info('onVolumeSymClick: not muted after volume = %f', videoEl.volume)

        if ( self.$volumeSym.hasClass('fa-volume-down') ) {
          self.$volumeSym.removeClass('fa-volume-down')
        }
        if ( self.$volumeSym.hasClass('fa-volume-up') ) {
          self.$volumeSym.removeClass('fa-volume-up')
        }

        self.$volumeSym.addClass('fa-volume-off')
        return
      }
      
    } //end: onVolumeSymClick()

    this.$volumeRng = $( document.createElement('input') )
                      .attr('id', this.ids.volumeRng)
                      .attr('type', 'range')
                      .attr('min', 0)
                      .attr('max', 100)
                      .attr('value', 100)
                      .addClass('range')

    this.onVolumeRngInputFn = function onVolumeRngInput(e) {
      info('onVolumeRngInput: e.target.valueAsNumber = %f', e.target.valueAsNumber)
      var volume = e.target.valueAsNumber
      info('onVolumeRngInput: volume = %d', volume)

      var videoContents = self.videoApp.videoContents

      videoContents.setVolume(volume)
    }

    this.$volume = $( document.createElement('div') )
                   .attr('id', this.ids.volumeDiv)
                   .addClass('control')
                   .append( this.$volumeSymDiv )
                   .append( this.$volumeRng )
    

    this.$flexWrapper.append( this.$volume )

    /*********************
     * Fullscreen Button *
     *********************/
    this.$fullscreenSym = $( document.createElement('i') )
                          .attr('id', this.ids.fullscreenSym)
                          .addClass('fa')
                          .addClass('fa-arrows-alt')

    this.$fullscreen = $( document.createElement('div') )
                       .attr('id', this.ids.fullscreenDiv)
                       .addClass('control')
                       .append( this.$fullscreenSym )

    this.onFullscreenClickFn = function onFullscreenClick(e) {
      info('onFullscreenClick: called')

      var videoContents = self.videoApp.videoContents

      videoContents.toggleFullscreen()
      //self.cssPositionControls()
    }

    this.$flexWrapper.append( this.$fullscreen )

    //this.enable()
  } //end: VideoControls()

  VideoControls.prototype.setPosition =
    function VideoControls__setPosition(fsecs) {
      this.$positionNum[0].value = fsecs
      this.$positionRng[0].value = fsecs
    }

  VideoControls.prototype.cssPositionControls =
    function VideoControls__cssPositionControls() {
      var videoContents, $dom, $controls, offset
      
      videoContents = this.videoApp.videoContents
      if ( videoContents.contents.length ) {
        //grab the first $dom where the controls are under
        $dom = videoContents.contents[0].$dom
        $controls = $('#videoControls')
        offset = ($dom.width()/2) - ($controls.width()/2)
        $controls.css({top: 10, left: offset})
      }
    }

  VideoControls.prototype.setVolume = function VideoControls__setVolume(pct) {
    pct = Math.floor(pct) //want it to be an integer
    if (pct < 0) pct = 0
    if (pct > 100) pct = 100
    this.$volumeRng[0].value = pct

    if (this.$playSym.hasClass('fa-volume-off')) {
      this.removeClass('fa-volume-off')
    }
    if (pct < 50) {
      if ( this.$playSym.hasClass('fa-volume-up') ) {
        this.$playSym.removeClass('fa-volume-up')
      }
      this.$playSym.addClass('fa-volume-down')
    }
    else {
      if ( this.$playSym.hasClass('fa-volume-down') ) {
        this.$playSym.removeClass('fa-voluem-down')
      }
      this.$playSym.addClass('fa-volume-up')
    }
  }

  VideoControls.prototype.setPosition =
    function VideoControls__setPosition(fsecs) {
      if (fsecs < 0) fsecs = 0
      this.$positionRng[0].value = fsecs
      this.$positionNum[0].value = Math.floor(fsecs)
    }

  VideoControls.prototype.setPlayable = function VideoControls__setPlayable() {
    if (this.$playSym.hasClass('fa-pause')) {
      this.$playSym.removeClass('fa-pause')
      this.$playSym.addClass('fa-play')
    }
  }
  
  VideoControls.prototype.reset = function VideoControls__reset() {
    this.disable()
    if (this.$playSym.hasClass('fa-pause')) {
      this.$playSym.removeClass('fa-pause')
      this.$playSym.addClass('fa-play')
    }
    this.setVolume(100)
    this.setPosition(0)
    this.setPlayable()
  }

  VideoControls.prototype.isEnabled = function VideoControls__isEnabled() {
    return this._enabled
  }
  
  VideoControls.prototype.enable = function VideoControls__enable() {
    if (!this.isEnabled()) {
      if ( this.$dom.hasClass('disabled') ) {
        this.$dom.removeClass('disabled')
      }
      else {
        error('WTF!!! VideoControls__enable: !this.isEnabled() && !this.$dom.hasClass("disabled")')
        //return;
      }

      if ( !this.$dom.hasClass('enabled') ) this.$dom.addClass('enabled')

      this.$play.on('click', this.onPlayClickFn)
      this.$skip.on('click', this.onSkipClickFn)
      this.$back.on('click', this.onBackClickFn)
      this.$positionNum.on('input', this.onPositionNumInputFn)
      this.$positionRng.on('input', this.onPositionRngInputFn)
      this.$volumeSymDiv.on('click', this.onVolumeSymClickFn)
      this.$volumeRng.on('input', this.onVolumeRngInputFn)
      this.$fullscreen.on('click', this.onFullscreenClickFn)
      
      return this._enabled = true
    }
  }

  VideoControls.prototype.disable = function VideoControls__disable() {
    if (this.isEnabled()) {
      if ( this.$dom.hasClass('enabled') ) {
        this.$dom.removeClass('enabled')
      }
      else {
        error('WTF!!! VideoControls__disable: this.isEnabled() && !this.$dom.hasClass("enabled")')
        //return
      }

      if ( !this.$dom.hasClass('disabled') ) this.$dom.addClass('disabled')

      this.$play.off('click', this.onPlayClickFn)
      this.$skip.off('click', this.onSkipClickFn)
      this.$back.off('click', this.onBackClickFn)
      this.$fullscreen.off('click', this.onFullscreenClickFn)
      this.$volumeSym.off('click', this.onVolumeSymClickFn)
      this._enabled = false
    }
  }

  VideoContents.prototype.setVolume = function VideoContents__setVolume(pct) {
    'use strict';
    if (pct < 0) pct = 0
    if (pct > 100) pct = 100
    info('VideoContents__setVolume: pct = %d', pct)

    var allVolumeSet = true
    for (var i=0; i<this.contents.length; i+=1) {
      allVolumeSet = this.contents[i].setVolume(pct) && allVolumeSet
    }
    return allVolumeSet
  }
  
  function FileBrowser(rootNames, videoApp) {
    /* rootNames = [ name_1, name_2, ..., name_n]
     */
    this.videoApp = videoApp
    this.ids = { div: 'fileBrowser'
               , select: 'rootBrowserSelect'
               , wrapDiv: 'rootBrowserSelectWrapDiv'
               }
    
    this.rootNames    = rootNames
    this.selectedRoot = undefined
    this.subdirs        = []
    this.dirSelects     = [] //should be dirSelects.length == subdirs.length + 1 
    this.addVideoContentButton = undefined
    this.btnNum         = 0

    this.$dom = $(document.createElement('div'))
                .attr('id', this.ids.div)
                //.addClass('rootSelector')

    var $select = $(document.createElement('select'))
                  .attr('id', this.ids.select)
                  .attr('size', this.rootNames.length)
                  //.addClass('rootSelector')

    for (var i=0; i<this.rootNames.length; i+=1) {
      $select.append(
        $(document.createElement('option'))
        .attr('value', this.rootNames[i])
        .append(this.rootNames[i])
      )
    }

    this.$dom.append( $(document.createElement('div'))
                      .attr('id', this.ids.wrapDiv)
                      //.addClass('wrapRootSelect')
                      .append( $select )
                    )

    var self = this
    function selectChanged() {
      var val = $(this).val()
      var i
      var dirSelect
      
      info('FileBrowser: selectChanged: val = '+JSON.stringify(val))

      self.selectedRoot = val
      
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
        info('FileBrowser: selectChanged: lookupSuccess: data =', data)
        self.addDirSelect(data.dirs, data.files)
      }

      $.ajax({ url  : 'lookup'
             , type : 'GET'
             , data : { root    : val
                      , subdirs : self.subdirs
                      }
             , success : lookupSuccess

             })
    } //end: selectChanged()
    
    $select.change( selectChanged )
  } //end: FileBroswer()

  FileBrowser.prototype.addDirSelect =
    function FileBrowser__addDirSelect(dirs, files) {
      info('FileBrowser__addDirSelect: dirs =', dirs)
      info('FileBrowser__addDirSelect: files =', files)

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

        info('FileBrowser: selectChanged: val = '+JSON.stringify(val))

        //if the captured number of DirSelects < the current number of DirSelects
        if (numDirSelects < self.dirSelects.length) {
          //remove the newer ones in reverse order
          while (self.dirSelects.length > numDirSelects) {
            self.dirSelects.pop().$dom.remove()
          }

          //truncate FileBrowser's subdirs array
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
            info('FileBrowser__addDirSelect: disSelectChanged: lookupSuccess; data = ', data)
            self.addDirSelect(data.dirs, data.files)
          }

          $.ajax({ url     : 'lookup'
                 , type    : 'GET'
                 , data    : { root    : self.selectedRoot
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
          error(errmsg)
          throw new Error(errmsg)
        }

        return
      } //end: dirSelectChanged()
      
      $( '#'+dirSelect.ids.select ).change( dirSelectChanged )
    } //end: FileBrowser__addDirSelect()

  FileBrowser.prototype.fileSelected =
    function FileBrowser__fileSelected(file) {
      info('FileBrowser__fileSelected: fqfn:'
          + '"' + this.selectedRoot + '"/'
          + this.subdirs.join('/')
          + '/'
          + file
          )
      var root = this.selectedRoot
      var subdirs = _.clone(this.subdirs)
      
      //add addVideoContentButton
      this.addVideoContentButton = new LaunchVideoContentButton(file)

      this.$dom.after( this.addVideoContentButton.$dom )

      var self = this
      function addVideoContent(e) {
        self.addVideoContentButton.$dom.remove()
        self.videoApp.videoContents.addVideoContent(root, subdirs, file)
      }
      this.addVideoContentButton.$dom.click( addVideoContent )
    } //end: FileBrowser__fileSelected()

  function DirSelect(dirNum, dirs, files, fileBrowser) {
    this.dirNum        = dirNum
    this.dirs          = dirs
    this.files         = files
    this.fileBrowser   = fileBrowser
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

  function LaunchVideoContentButton(file) {
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

  window.VIDEO_APP = VIDEO_APP
  
})(window, window.document)
