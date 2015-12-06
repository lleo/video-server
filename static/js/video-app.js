/*global wrapSelect */
/*
 * NOTE: Remember this is running in the browser.
 */
//This wrapper function is wholly unnecessary but whatever ...
(function(window, document, undefined) {

  function VideoApp(_cfg) {
    var cfg = _.cloneDeep(_cfg) || {}

    this.cfg = cfg
    this._eventsSetup = false

    this.debug = cfg.debug || 'info'
    warn() && console.log('cfg.debug = %s; this.debug = %s;', cfg.debug, this.debug)
    VideoApp.setLogLevel(this.debug)

    var globalVideoControls = new GlobalVideoControls(cfg['controls config'], this)
    this.globalVideoControls = globalVideoControls

    var videoContents = new VideoContents(cfg['load'], this)
    this.videoContents = videoContents

    var fileBrowser   = new FileBrowser(cfg['video root names'], this)

    this.fileBrowser = fileBrowser

    this._setupEvents()
  } //end: VideoApp()

  VideoApp.prototype._setupEvents = function VideoApp___setupEvents() {
    if (this._eventsSetup) return

    this._setupWindowEvents()

    return this._eventsSetup = true
  } //end: VideoApp___setupEvents()

  VideoApp.prototype._setupWindowEvents =
    function VideoApp__setupWindowEvents() {
      var self = this

      var videoContents = self.videoContents
      var videoContent = videoContents.contents[0] //could be undefined

      $(window).on('popstate', function onPopState(e) {
        info() && console.log('VideoApp: onPopState: e = %o', e)

        var oldState = e.originalEvent.state
        var curState = self.getState()
        info() && console.log('VideoApp: onPopState: oldState = %o', oldState)
        info() && console.log('VideoApp: onPopState: curState = %o', curState)

        var otime = oldState.time
        if (typeof otime == 'string') {
          info() && console.log('VideoApp: onPopState: otime is a string %o', otime)
          otime = parseFloat(otime)
          info() && console.log('VideoApp: onPopState: otime = %f', otime)
        }

        var ctime = curState && curState.time

        if ( stateEqualExceptTime(oldState, curState)) {
          info() && console.log('VideoApp: onPopState: oldState & curState (minus time) are the same')
          videoContents.setPosition(otime)
        }
        else {
          videoContents.addVideoContent( oldState.root
                                       , oldState.subdirs
                                       , oldState.file
                                       , otime )
        }
      })
    } //end: VideoApp__setupWindowEvents()

  VideoApp.prototype.getState = function VideoApp__getState() {
    // Currently the only state that matters is this.videoContents.state
    // For now, I'll return it at the state of the whole app.
    return this.videoContents.getState()
  }

  /*
   * Logging system. It BLOWS hard, but it used to SUCK worse.
   */
  var logLevel = 0 //default setting
  var logLevels = ['info', 'warn', 'crit', 'none', 'error']
  VideoApp.getLogLevel = function VideoApp_getLogLevel(level) {
    if (typeof level != 'string') return logLevel

    var lvl = logLevels.indexOf(level)

    if (lvl < 0) return logLevel

    return lvl
  }
  VideoApp.setLogLevel = function VideoApp_setLogLevel(level) {
    return logLevel = VideoApp.getLogLevel(level)
  }
  var info_lvl = VideoApp.getLogLevel('info')
  var info = VideoApp.info = function info() {
    if (info_lvl >= logLevel) return true
    return false
  }
  var warn_lvl = VideoApp.getLogLevel('warn')
  var warn = VideoApp.warn = function warn() {
    if (warn_lvl >= logLevel) return true
    return false
  }
  var crit_lvl = VideoApp.getLogLevel('crit')
  var crit = VideoApp.crit = function crit() {
    if (crit_lvl >= logLevel) return true
    return false
  }
  var error = VideoApp.error = function error() {
    //don't even know if this is necessary
    return true
  }

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

  function VideoContents(initialLoad, videoApp) {
    this.videoApp = videoApp
    this.initialLoad = _.cloneDeep(initialLoad)
    this.contents = []
    this._mouseState = { hideBothTimerId : undefined
                       , firstThrottleTimerExecuted : true
                       , overControls : false
                       }
    this.id = 'videoContents'
    this.$dom = $( document.createElement('div') )
                .attr('id', this.id)
                .addClass('nocursor')
                .append( videoApp.globalVideoControls.$dom )

    this.contents = [] //array of VideoContent objects
    this._isFullscreen = false
    this._eventsSetup = false

    // !!! HACK ALERT !!!
    // setTimeout() thing works but I do not like it :(
    // also see onLoadedData for how the time position is set.
    if (this.initialLoad) {
      var self = this
      setTimeout(function() {
        'use strict';
        function sortfn(a,b) {
          var ai = parseInt(a.match(/^video-(\d+)/)[1], 10)
          var bi = parseInt(b.match(/^video-(\d+)/)[1], 10)
          if (isNaN(ai)) {
            console.error('initialLoad: sortfn: isNaN(ai)')
            return 0
          }
          if (isNaN(bi)) {
            console.error('initialLoad: sortfn: isNaN(bi)')
            return 0
          }
          if (ai === bi) return 0
          if (ai < bi) return -1
          if (ai > bi) return 1
        }
        for (var key of Object.keys(self.initialLoad).sort(sortfn)) {
          self.addVideoContent( self.initialLoad[key].root
                              , self.initialLoad[key].subdirs
                              , self.initialLoad[key].file
                              , self.initialLoad[key].time )
        }
      }, 0)
    }

    this._setupEvents()
  } //end: VideoContents constructor

  VideoContents.prototype.getState = function VideoContents__getState() {
    // Ok, I don't support multiple videos yet so just return the state
    // of this.contents[0].getState() if it exists, else undefined.
    return this.contents.length ? this.contents[0].getState() : undefined
  } //end: VideoContents__getState()

  VideoContents.prototype.addVideoContent =
    function VideoContents__addVideoContent(root, subdirs, file, initTime) {
      'use strict';

      /* Remove any video content that exists
       * 
       * NOTE: *Multiple Videos*
       * Eventually I'll guard this with a setting that allows multiple
       * video streams to be open controled with one set of controls.
       * The reason for watching multiple streams at the same time is to
       * compare original versions versus extended versions and such.
       */
      while (this.contents.length) {
        this.contents.pop().$dom.remove()
      }

      var globalVideoControls = this.videoApp.globalVideoControls
      globalVideoControls.reset()

      var vidNum = this.contents.length

      var videoContent = new VideoContent(vidNum, root, subdirs, file,
                                          initTime, this.videoApp)

      this.contents.push(videoContent)
      this.$dom.append(videoContent.$dom)

      info() && console.log('VideoContents__addVideoContent: added new VideoContent')
      info() && console.log('VideoContents__addVideoContent: calling out to "findtrack"')
      var self = this
      function findtrackSuccess(data) {
        info() && console.log('findtrackSuccess: data = %o', data)

        var tracks = []
        if ( data.tracks && _.isArray(data.tracks) &&
             data.tracks.every(function(e) { return _.isPlainObject(e) }) ) {
          info() && console.log('findTrackSuccess: tracks are mostly wellformed')
          tracks = data.tracks
        }
        else {
          warn() && console.log('findTrackSuccess: tracks are NOT wellformed')
          return
        }

        warn() && console.log('VideoContents__addVideoContent: findtrackSuccess: tracks = %o', tracks)

        info() && console.log('VideoContents__addVideoContent: tracks.length = %d', tracks.length)
        var $newTrack
        if (tracks.length) {
          info() && console.log('VideoContents__addVideoContent: tracks.length non-zero adding the first one as the default')
          //the first track is set as default
          $newTrack = $( document.createElement('track') )
                      .attr('default', true)
                      .attr('kind', 'subtitles') //or 'captions'; can be omitted
                      .attr('src', tracks[0].uri)
                      .attr('srclang', tracks[0].lang)
                      .attr('label', tracks[0].label)

          videoContent.$video.append($newTrack)

          for (var i=1; i<tracks.length; i+=1) {
            info() && console.log('VideoContents__addVideoContent: adding track for i=%d', i)
            $newTrack = $( document.createElement('track') )
                        .attr('kind', 'subtitles') //or 'captions'; can be omitted
                        .attr('src', tracks[i].uri)
                        .attr('srclang', tracks[i].lang)
                        .attr('label', tracks[i].label)

            videoContent.$video.append($newTrack)
          } //end: for
        } //end: if
      } //end: findtrackSuccess()
      $.ajax({ url  : 'findtrack'
             , type : 'GET'
             , data : { root    : root
                      , subdirs : subdirs
                      , file    : file
                      }
             , success : findtrackSuccess
             })

    } //end: VideoContents__addVideoContent()

  VideoContents.prototype._setupEvents =
    function VideoContents___setupEvents() {
      if (this._eventsSetup) return
      this._setupWindowEvents()
      this._setupKeyboardEvents()
      this._setupMouseEvents()
      this._eventsSetup = true
    }

  VideoContents.prototype._setupWindowEvents =
    function VideoContents___setupWindowEvents() {
      var self = this

      function onResize(e) {
        info() && console.log('VideoContents: onResize: e = %o', e)
        self.resized()
      }
      $(window).on('resize', onResize)

      function onFullscreenChange(e) {
        info() && console.log('onFullscreenChange: e = %o', e)
        var event = e.originalEvent.type
        warn() && console.log('onFullscreenChange: caused by %o', event)
        self.fullscreenChanged(e)
      }
      $(document).on('webkitfullscreenchange '
                    +'mozfullscreenchange '
                    +'fullscreenchange '
                    +'MSFullscreenChange'
                    , onFullscreenChange )
    } //end: VideoContents___setupWindowEvents)_

  VideoContents.prototype._setupKeyboardEvents =
    function VideoContents___setupKeyboardEvents() {
      if (this._eventsSetup) return
      var self = this

      function onKeyPress(e) {
        info() && console.log('onKeyPress: called e =', e)
        var globalVideoControls = self.videoApp.globalVideoControls
        var videoContents = self.videoApp.videoContents

        /* From https://api.jquery.com/keypress/
         *  e.type 'keypress'
         *  e.timeStamp Date.now()
         *  e.keyCode number of char pressed
         *  e.key ?
         *  e.charCode number of char pressed
         *  e.char ?
         *  e.which number of char pressed
         *  e.ctrlKey
         *  e.shiftKey
         *  e.altKey
         *  e.metaKey
         *  e.cacelable
         *  e.target
         *  e.relatedTarge
         *  e.handleObj
         *  e.data undefined
         *  e.preventDefault()
         *  e.stopPropagation()
         *  e.stopImmediatePropagation()
         * From: https://developer.mozilla.org/en-US/docs/Web/Events/keypress
         *  e.originalEvent.target.id
         *  e.originalEvent.type  type of event 'keypress'?
         *  e.originalEvent.bubbles
         *  e.originalEvent.cancelable
         *  e.originalEvent.char the UniCode character of the key as a one element string
         *  e.originalEvent.charCode the UniCode number (depricated)
         *  e.originalEvent.repeat has the key been pressed long enough to be repeating
         *  e.originalEvent.ctrlKey  true if control key was press along with this key
         *  e.originalEvent.shiftKey ..ditto..
         *  e.originalEvent.altKey   ..ditto..
         *  e.originalEvent.metaKey  ..ditto..
         */
        var msg
        var character = String.fromCharCode( e.charCode )

        switch (character) {
         case 'p':
         case ' ':
          info() && console.log("onKeyPress: '%s' pressed; $play.click()", character)
          globalVideoControls.$play.click()
          break;

         case 's':
          info() && console.log("onKeyPress: 's' pressed; $skip.click()")
          globalVideoControls.$skip.click()
          break;

         case 'S':
          info() && console.log("onKeyPress: 'S' pressed; long skip")
          videoContents.seek( globalVideoControls.skipForwSecs * 3 )
          break;

         case 'b':
          info() && console.log("onKeyPress: 's' pressed; $back.click()")
          globalVideoControls.$back.click()
          break;

         case 'B':
          info() && console.log("onKeyPress: 'B' pressed; long back")
          videoContents.seek( -(globalVideoControls.skipBackSecs * 3) )
          break;

         case 'F':
          info() && console.log("onKeyPress: 'F' pressed; $fullscreen.click()")
          globalVideoControls.$fullscreen.click()
          break;

         default:
          msg = "onKeyPress: Unknown KeyPress: "
              + "e.char="+e.char+" "
              + "e.charCode="+e.charCode+" "
              + "e.keyCode="+e.keyCode+" "
              + "char="+character
          info() && console.log(msg)
        }
      }

      //this.$dom.on('keypress', onKeyPress)
      $(document).on('keypress', onKeyPress)
    } //end: VideoContents___setupKeyboardEvents()

  VideoContents.prototype._resetMouseState =
    function VideoContents___resetMouseState() {
      var ms = this._mouseState
      if (ms.hideBothTimerId) clearTimeout(ms.hideBothTimerId)
      ms.hideBothTimerId = undefined
      ms.firstThrottleTimerExecuted = true
      ms.overControls = false
    }

  VideoContents.prototype._setupMouseEvents =
    function VideoContents___setupMouseEvents() {
      info() && console.log('VideoContents___setupMouseEvents: this._eventsSetup = %o', this._eventsSetup)
      if (this._eventsSetup) return

      var ms = this._mouseState
      var self = this

      function onMouseMove() {
        //info() && console.log('onMouseMove: called')
        // The algorithm is as follows:
        // 0 - turn off the on 'mousemove' event handler
        //   - show controls & cursor & start throttling the 'mousemove' events
        // 1 - if 2000ms after the first throttle timer has fired,
        //     then hide the controls & cursor
        var globalVideoControls = self.videoApp.globalVideoControls

        // Given that every time 50ms after a 'mousemove' event we disable
        // and then reenable this timer function for 2000ms,
        // **this function only fires** when no 'mousemove' events has
        // occured for over 2050ms.
        function hideBothTimerFn() {
          // NOTE: The variable overControls is a boolean that is set true
          // by the 'mouseenter' and false by the 'mouseleave' events
          // See the onMouse{Enter,Leave} functions declared below.
          if (!ms.overControls && !globalVideoControls.$dom.hasClass('hide'))
            globalVideoControls.$dom.addClass('hide')

          if (!ms.overControls && !self.$dom.hasClass('nocursor'))
            self.$dom.addClass('nocursor')

          // reset the firstThrottleTimerExecuted & hideBothTimerId
          ms.firstThrottleTimerExecuted = true
          ms.hideBothTimerId = undefined
        }

        // This is the second part of the throttle algorithm.
        // First, every time onMouseMove() fires we turn off watching for
        //   'mousemove' events and set this timer fuction (see below).
        // When this timer function fires we turn the watch for 'mousemove'
        //   events back on. So for 50ms the 'mousemove' events were ignored.
        function throttleTimerFn() {
          self.$dom.on('mousemove', onMouseMove)
          // IF the the hideBothTimerFn has already been set
          // OR this is the first in a sequence of 'mousemove' events
          if (ms.hideBothTimerId || ms.firstThrottleTimerExecuted) {
            clearTimeout(ms.hideBothTimerId)
            ms.firstThrottleTimerExecuted = false
            ms.hideBothTimerId = setTimeout(hideBothTimerFn, 2000)
          }
        }

        // mouse moved -> disable on 'mousemove' events; throttling
        self.$dom.off('mousemove', onMouseMove)

        // mouse moved -> show controls
        if ( globalVideoControls.$dom.hasClass('hide') ) {
          globalVideoControls.$dom.removeClass('hide')
        }

        // mouse moved -> show cursor
        if ( self.$dom.hasClass('nocursor') ) {
          self.$dom.removeClass('nocursor')
        }

        // in 50ms (1/20th sec) reenable 'mousemove' events
        setTimeout(throttleTimerFn, 50)
      } //end: onMouseMove()

      this.$dom.on('mousemove', onMouseMove)

      function onMouseEnter(e) {
        ms.overControls = true
      }
      function onMouseLeave(e) {
        ms.overControls = false
      }
      this.videoApp.globalVideoControls.$dom.on('mouseenter', onMouseEnter)
      this.videoApp.globalVideoControls.$dom.on('mouseleave', onMouseLeave)

    } //end: VideoContents___setupMouseEvents()

  VideoContents.prototype.startBusy = function VideoContents__startBusy() {
    info() && console.log('VideoContents__startBusy:')

    var allStartBusy = true
    for (var i=0; i<this.contents.length; i+=1) {
      allStartBusy = !!this.contents[i].startBusy() && allStartBusy
    }
    return allStartBusy
  }

  VideoContents.prototype.stopBusy = function VideoContents__stopBusy() {
    info() && console.log('VideoContents__stopBusy:')

    var allStopBusy = true
    for (var i=0; i<this.contents.length; i+=1) {
      allStopBusy = !!this.contents[0].stopBusy() && allStopBusy
    }
    return allStopBusy
  }

  VideoContents.prototype.isPaused = function VideoContents__isPaused() {
    var firstPaused, allPaused
    if (this.contents.length) {
      // Just an internal consistancy check :(
      firstPaused = this.contents[0].isPaused()
      allPaused = this.allPaused()
      if (firstPaused && !allPaused) {
        console.error('VideoContents__isPaused: firstPaused && !allPaused')
      }
      return allPaused
    }
    return //I really don't know what to return when there are no contents
  }

  VideoContents.prototype.allPaused = function VideoContents__allPaused() {
    'use strict';
    var allPaused = true
    for (var i=0; i<this.contents.length; i+=1) {
      allPaused = this.contents[i].isPaused() && allPaused
    }
    return allPaused
  }

  VideoContents.prototype.togglePlay = function VideoContents__togglePlay() {
    'use strict';
    var allToggled = true
    for (var i=0; i<this.contents.length; i+=1) {
      allToggled = this.contents[i].togglePlay() && allToggled
    }
    return allToggled
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
        allSet = !!this.contents[i].setPosition(fsecs) && allSet
      }
      return allSet
    }

  VideoContents.prototype.seek = function VideoContents__seek(nsecs) {
    'use strict';
    var allSeeked = true
    for (var i=0; i<this.contents.length; i+=1) {
      allSeeked = !!this.contents[i].seek(nsecs) && allSeeked
    }
    return allSeeked
  }

  VideoContents.prototype.setVolume = function VideoContents__setVolume(pct) {
    'use strict';
    if (pct < 0) pct = 0
    if (pct > 100) pct = 100

    var allSetVolume = true
    for (var i=0; i<this.contents.length; i+=1) {
      allSetVolume = !!this.contents[i].setVolume(pct) && allSetVolume
    }
    return allSetVolume
  } //end: VideoContents__setVolume()

  VideoContents.prototype.isFullscreen =
    function VideoContents__isFullscreen() {
      return this._isFullscreen
    }

//  VideoContents.prototype.toggleFullscreen =
//    function VideoContents__toggleFullscreen() {
//      'use strict';
//      if (this.contents.length > 1) {
//        /* Only fullScreen the first one for now
//         *
//         * I'm gonna want to arrange screens thus:
//         * +------------------+
//         * |                  |
//         * |                  |
//         * |                  |
//         * +------------------+
//         *               +------------------+
//         *               |                  |
//         *               |                  |
//         *               |                  |
//         *               +------------------+
//         * +------------------+
//         * |                  |
//         * |                  |
//         * |                  |
//         * +------------------+
//         */
//        console.error('VideoContents__toggleFullscreen: not supported for this.contents.length > 1')
//        return
//      }
//      else if (this.contents.length == 1) {
//        return this._isFullscreen = this.contents[0].toggleFullscreen()
//      }
//      else {
//        console.error('VideoContents__toggleFullscreen: no video contents this.contents.length < 1')
//        return
//      }
//    } //end: VideoContents__toggleFullscreen()

  VideoContents.prototype.toggleFullscreen =
    function VideoContents__toggleFullscreen() {
      if ( !this.isFullscreen() ) {
        var el = this.$dom[0]
        if (el.requestFullscreen) {
          info() && console.log('VideoContents__toggleFullscreen: used requestFullscreen')
          el.requestFullscreen()
        }
        else if (el.msRequestFullscreen) {
          info() && console.log('VideoContents__toggleFullscreen: used msRequestFullscreen')
          el.msRequestFullscreen()
        }
        else if (el.mozRequestFullScreen) {
          info() && console.log('VideoContents__toggleFullscreen: used mozRequestFullScreen')
          el.mozRequestFullScreen()
        }
        else if (el.webkitRequestFullscreen) {
          info() && console.log('VideoContents__toggleFullscreen: used webkitRequestFullscreen')
          el.webkitRequestFullscreen()
        }
        else {
          console.error('VideoContents__toggleFullscreen: failed to find requestFullScreen equivelent')
          alert("requestFullScreen not implemented by this browser")
          return false
        }
//        this.cssCenterSpinners()
        this._isFullscreen = true
        return true
      }
      else {
        // try to cancel fullscreen
        if (document.cancelFullScreen) {
          info() && console.log('VideoContents__toggleFullscreen: used document.cancelFullScreen')
          document.cancelFullScreen()
        }
        else if (document.msExitFullscreen) {
          info() && console.log('VideoContents__toggleFullscreen: used document.msExitFullscreen')
          document.msExitFullscreen()
        }
        else if (document.mozCancelFullScreen) {
          info() && console.log('VideoContents__toggleFullscreen: used document.mozCancelFullScreen')
          document.mozCancelFullScreen()
        }
        else if (document.webkitCancelFullScreen) {
          info() && console.log('VideoContents__toggleFullscreen: used document.webkitCancelFullScreen')
          document.webkitCancelFullScreen()
        }
        else {
          console.error('VideoContents__toggleFullscreen: faled to find cancelFullScreen')
          alert('cancelFullScreen not implemented by this browser')
          return false
        }
        this._isFullscreen = false
        return true
      }
      return
    } //end: VideoContents__toggleFullscreen()

  VideoContents.prototype.cssCenterSpinners =
    function VideoContents__cssCenterSpinners() {
      'use strict';
      var allCssCenterSpinner = true
      for (var i=0; i<this.contents.length; i+=1) {
        allCssCenterSpinner = !!this.contents[i].cssCenterSpinner() && allCssCenterSpinner
      }
      return allCssCenterSpinner
    } //end: VideoContents__cssCenterSpinners()

  VideoContents.prototype.setMark = function VideoContents__setMark() {
    if (!this.contents.length) return

    var state = {}
    for (var i=0; i<this.contents.length; i+=1) {
      state['video-'+i] = _.cloneDeep(this.contents[i].state)
    }
    var qstr = $.param( state )

    var url = window.location.origin + window.location.pathname + "?" + qstr

    info() && console.log('VideoContents__setMark: state = %o', state)
    info() && console.log('VideoContents__setMark: url = %s', url)
    
    history.pushState(state, null, url)

    return this
  } //end: VideoContents__setMark()

  VideoContents.prototype.resized = function VideoContents__resized() {
    info && console.log('VideoContents__resized: called')
    this.cssCenterSpinners()
    this.videoApp.globalVideoControls.cssPositionControls()
  }

  VideoContents.prototype.fullscreenChanged =
    function VideoContents__fullscreenChanged() {
      info && console.log('VideoContents__fullscreenChanged: called')
      this.videoApp.globalVideoControls.fullscreenChanged()
    }

  function VideoContent( vidNum, root, subdirs, file
                       , initialTime, videoApp ) {
    info() && console.log('VideoContent() constructor')

    this.vidNum   = vidNum
    this.root     = root
    this.subdirs  = subdirs
    this.file     = file
    this.initialTime = initialTime
    this.videoApp = videoApp
    this.ids = { div     : 'videoConentDiv-'+vidNum
               , canvas  : 'videoCanvas-'+vidNum
               , spinnerSym : 'videoSpinnerSym-'+vidNum
               , spinnerDiv : 'videoSpinnerDiv-'+vidNum
               , display : 'videoDisplay-'+vidNum
               , video   : 'videoSource-'+vidNum
               }
    this._isFullscreen = false //assume not fullscreen to start !?!
    this._eventsSetup = false
    this.canPlay = undefined //set by 'canplay' event
    this.videoWidth  = undefined //set in onLoadedData
    this.videoHeight = undefined //set in onLoadedData

    var self = this
    this.state = { root    : this.root
                 , subdirs : this.subdirs
                 , file    : this.file
                 , get time() { return  Math.floor(self.$video[0].currentTime) }
                 }
    /*
     * Create the video DOM element. Start with the SourceElement first
     */
    var parts = ['/stream', root]
    parts = parts.concat(subdirs)
    parts.push(file)

    var rawUri = parts.join('/')
    var uri = encodeURI(rawUri)

    var mimetype = determineMimetype(file)
    if (!mimetype) {
      console.error("VideoContent: !!!ERROR!!! Unknown mimetype for file="+file)
      mimetype = 'video/mp4' //FIXME: just for shits-n-giggles
    }

    var $source = $( document.createElement('source') )
                  .attr('src', uri)
                  .attr('type', mimetype)

    this.$source = $source

    var $video = $( document.createElement('video') )
                 .attr('id', this.ids.video )
                 .attr('controls', true)
                 .addClass('videoDisplay')
                 .append($source)

    this.$video = $video

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
                .attr('tabindex', 1)
                .addClass('videoContent')
                .append( this.$video )

    this.$dom.append( this.$spinner )

    this._setupEvents()
  } //end: VideoContent()

  VideoContent.prototype.getState = function VideoContent__getState() {
    return _.cloneDeep(this.state)
  }

  VideoContent.prototype._setupEvents = function VideoContent___setupEvents() {
    if (this._eventsSetup) return
    
    this._setupVideoEvents()

    this._eventsSetup = true
  }

  function stateEqualExceptTime(o, n) {
    if (_.isUndefined(o) || _.isUndefined(n)) return false
    if ( _.isEqual(o.root, n.root) &&
         _.isEqual(o.subdirs, n.subdirs) &&
         _.isEqual(o.file, n.file)          ) {
      return true
    }
    return false
  }

  VideoContent.prototype._setupVideoEvents =
    function VideoContent___setupVideoEvents() {
      if (this._eventsSetup) return

      var $video = this.$video

      var self = this

      $video.on('loadeddata', function onLoadedData(e) {
        info() && console.log("onLoadedData: e.target.id=%s", e.target.id)
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

        info() && console.log("onLoadedData: width=%f; height=%f;"
            , self.videoWidth, self.videoHeight)

        info() && console.log('onLoadedData: self.$video[0].duration = %f', self.$video[0].duration)
        var globalVideoControls = self.videoApp.globalVideoControls

        if (0 == self.vidNum) {
          //if ( !globalVideoControls.isEnabled() ) globalVideoControls.enable()
          globalVideoControls.$positionRng[0].max = self.$video[0].duration
        }

        if (self.initialTime) {
          info && console.log('onLoadedData: self.initialTime = %f', self.initialTime)
          if (0 == self.vidNum) globalVideoControls.setPosition(self.initialTime)
          self.setPosition(self.initialTime)
        }

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
        info() && console.log("onCanPlay: %s.readyState = %s(%o); "
                             + "set self<VideoContent>.canPlay = %o"
                             , self.$video[0].id
                             , MEC[self.$video[0].readyState]
                             , self.$video[0].readyState
                             , self.canPlay)

        var globalVideoControls = self.videoApp.globalVideoControls
        if ( !globalVideoControls.isEnabled() ) globalVideoControls.enable()
        globalVideoControls.cssPositionControls()
        self.videoApp.videoContents.cssCenterSpinners()
      })

      $video.on('playing', function onPlaying(e){
        info() && console.log("onPlaying: e.target.id=%s", e.target.id)
        self.playing()
      })

      $video.on('pause', function onPause(e){
        info() && console.log("onPause: e.target.id=%s", e.target.id)
        self.paused()
      })

      $video.on('seeked', function onSeeked(e) {
        // display seeked frame when currentTime is manually changed
        //
        info() && console.log('onSeeked: calling self<VideoContent>.stopBusy()')

        self.stopBusy()
      })

      $video.on('seeking', function onSeeking(e){
        info() && console.log("onSeeking: e.target.id=%s", e.target.id)
        info() && console.log('onSeeking: calling self<VideoContent>.startBusy()')

        self.startBusy()
      })

      $video.on('timeupdate', function onTimeUpdate(e){
        var globalVideoControls = self.videoApp.globalVideoControls
        var videoContents = self.videoApp.videoContents
        self.timeupdated(e.target.currentTime)

      })

      $video.on('ended', function onEnded(e){
        info() && console.log("onEnded: e.target.id=%s", e.target.id)

        var $playSym = self.videoApp.globalVideoControls.$playSym

        if ($playSym.hasClass('fa-pause')) {
          $playSym.removeClass('fa-pause')
          $playSym.addClass('fa-play')
        }
      })
    } //end: VideoContent__setupVideo()

  VideoContent.prototype.startBusy = function VideoContent__startBusy() {
    info() && console.log('VideoContent__startBusy:')
    var globalVideoControls = this.videoApp.globalVideoControls

    if (0 == this.vidNum) {
      //disable the controls
      globalVideoControls.disable()
    }

    //remove the hide class from the $spinner
    if ( this.$spinner.hasClass('hide') ) {
      info() && console.log('VideoContent__startBusy: $spinner has "hide" class')
      info() && console.log('VideoContent__startBusy: removing "hide" class to $spinner')
      this.$spinner.removeClass('hide')
    }

    return this
  }

  VideoContent.prototype.stopBusy = function VideoContent__stopBusy() {
    info() && console.log('VideoContent__stopBusy:')
    var globalVideoControls = this.videoApp.globalVideoControls

    if (0 == this.vidNum) {
      //enable the controls
      globalVideoControls.enable()
    }

    //add the hide class from the $spinner
    if ( !this.$spinner.hasClass('hide') ) {
      info() && console.log('VideoContent_stopBusy: $spinner does not have "hide" class')
      info() && console.log('VideoContent__stopBusy: adding "hide" class to $spinner')
      this.$spinner.addClass('hide')
    }

    return this
  }

  VideoContent.prototype.playing = function VideoContent__playing() {
    info() && console.log('VideoContent__playing: called vidNum = %o', this.vidNum)
    if ( this.vidNum === 0 ) {
      info && console.log('VideoContent__playing: calling globalVideoControls.setPlaying()')
      this.videoApp.globalVideoControls.setPlaying()
    }
  }

  VideoContent.prototype.paused = function VideoContent__paused() {
    info() && console.log('VideoContent__paused: called vidNum = %o', this.vidNum)
    if ( this.vidNum === 0 ) {
      info() && console.log('VideoContent__paused: calling globalVideoControls.setPaused()')
      this.videoApp.globalVideoControls.setPaused()
    }
  }

  VideoContent.prototype.timeupdated =
    function VideoContent__timeupdated(curTime) {
      //info() && console.log('VideoContent__timeupdated: this.vidNum = %d', this.vidNum)
      if ( this.vidNum === 0 ) {
        //info() && console.log('VideoContent__timeupdated: calling globalVideoControls.setPosition(%f)', curTime)
        this.videoApp.globalVideoControls.setPosition(curTime)
      }
    } //end: VideoContent__timeupdated()

  VideoContent.prototype.ended = function VideoContent__ended() {
    if ( this.vidNum === 0 ) {
      this.videoApp.globalVideoControls.setEnded()
    }
  }

  //VideoContent.prototype.resized = function VideoContent__resized(e) {
  //  info() && console.log('VideoContent__resized: called e = %o', e)
  //  var self = this
  //
  //  /* This is called only from the fullscreenchange event.
  //   * For some reason that fires off before the new fullscreen element
  //   * has its dimensions set. So, I have inserted this delayed function
  //   * to set the positioning of the spinner and controls.
  //   * 500ms seems to be enought most of the time on my MacBook Pro
  //   * (early 2011) running Chrome.
  //   */
  //  setTimeout(function() {
  //    self.cssCenterSpinner()
  //  }, 500)
  //
  //  return true
  //} //end: VideoContent__resized()

  VideoContent.prototype.cssCenterSpinner =
    function VideoContent__cssCenterSpinner() {
      var $spinner = this.$spinner
      var $dom = this.$dom
      var offset_x = ($dom.width()/2)-($spinner.width()/2)
      var offset_y = ($dom.height()/2)-($spinner.height()/2)
      $spinner.css({top: offset_y, left: offset_x})
      return this
    }

  VideoContent.prototype.isPaused = function VideoContent__isPaused() {
    return this.$video[0].paused
  }

  VideoContent.prototype.togglePlay = function VideoContent__togglePlay() {
    if ( this.isPaused() )
      return this.play()
    else
      return this.pause()
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
      info() && console.log('VideoContent__setPosition: fsecs = %f', fsecs)

      this.$video[0].currentTime = fsecs

      return this
    }

  VideoContent.prototype.seek = function VideoContent__seek(nsecs) {
    info() && console.log('VideoContent__seek: nsecs = %d', nsecs)
    var newTime = this.$video[0].currentTime + nsecs
    this.setPosition(newTime)
    return this
  }

  VideoContent.prototype.setVolume = function VideoContent__setVolume(pct) {
    if (pct > 0 && pct < 1) {
      console.error('VideoContent__setVolume: pct > 0 && pct < 1')
      return
    }
    if (pct < 0) pct = 0
    if (pct > 100) pct = 100

    this.$video[0].volume = pct / 100

    return this
  }

  VideoContent.prototype.isFullscreen =
    function VideoContent__isFullscreen() {
      return this._isFullscreen
    }

  VideoContent.prototype.toggleFullscreen =
    function VideoContent__toggleFullscreen() {
      if ( !this.isFullscreen() ) {
        //var el = this.$video[0]
        var el = this.$dom[0]
        if (el.requestFullscreen) {
          info() && console.log('VideoContent__toggleFullscreen: used requestFullscreen')
          el.requestFullscreen()
        }
        else if (el.msRequestFullscreen) {
          info() && console.log('VideoContent__toggleFullscreen: used msRequestFullscreen')
          el.msRequestFullscreen()
        }
        else if (el.mozRequestFullScreen) {
          info() && console.log('VideoContent__toggleFullscreen: used mozRequestFullScreen')
          el.mozRequestFullScreen()
        }
        else if (el.webkitRequestFullscreen) {
          info() && console.log('VideoContent__toggleFullscreen: used webkitRequestFullscreen')
          el.webkitRequestFullscreen()
        }
        else {
          console.error('VideoContent__toggleFullscreen: failed to find requestFullScreen equivelent')
          alert("requestFullScreen not implemented by this browser")
          return false
        }
        this.cssCenterSpinner()
        this._isFullscreen = true
        return true
      }
      else {
        // try to cancel fullscreen
        if (document.cancelFullScreen) {
          info() && console.log('VideoContent__toggleFullscreen: used document.cancelFullScreen')
          document.cancelFullScreen()
        }
        else if (document.msExitFullscreen) {
          info() && console.log('VideoContent__toggleFullscreen: used document.msExitFullscreen')
          document.msExitFullscreen()
        }
        else if (document.mozCancelFullScreen) {
          info() && console.log('VideoContent__toggleFullscreen: used document.mozCancelFullScreen')
          document.mozCancelFullScreen()
        }
        else if (document.webkitCancelFullScreen) {
          info() && console.log('VideoContent__toggleFullscreen: used document.webkitCancelFullScreen')
          document.webkitCancelFullScreen()
        }
        else {
          console.error('VideoContent__toggleFullscreen: faled to find cancelFullScreen')
          alert('cancelFullScreen not implemented by this browser')
          return false
        }
        this._isFullscreen = false
        return true
      }
      return
    } //end: VideoContent__toggleFullscreen()


  function GlobalVideoControls(_cfg, videoApp) {
    this.videoApp = videoApp
    var cfg = _.cloneDeep(_cfg) || {}
    
    this.skipBackSecs = cfg.skipBackSecs || 10
    this.skipForwSecs = cfg.skipForwSecs || 30

    this._enabled = false

    this.ids = { div           : 'globalVideoControls'
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
               , markDiv       : 'mark'
               , markSym       : 'markSym'
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
    this.$mark          = undefined
    this.$markSym       = undefined

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

      info() && console.log('onPlayClick: videoContents.isPaused() = %o', videoContents.isPaused())
      if ( videoContents.isPaused() ) {
        info() && console.log('onPlayClick: calling videoContents.play()')
        videoContents.play()
        //self.$playSym.removeClass('fa-play')
        //self.$playSym.addClass('fa-pause')
      }
      else {
        info() && console.log('onPlayClick: calling videoContents.pause()')
        videoContents.pause()
        //self.$playSym.removeClass('fa-pause')
        //self.$playSym.addClass('fa-play')
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
      info() && console.log('onSkipClick: seeking %d secs', self.skipForwSecs)
      self.videoApp.videoContents.seek(self.skipForwSecs)
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
      info() && console.log('onBackClick: seeking %d secs', -self.skipBackSecs)
      self.videoApp.videoContents.seek(-self.skipBackSecs)
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
      info() && console.log('onPositionNumInput: e.target.valueAsNumber = %f'
                   , e.target.valueAsNumber)
      var val = e.target.valueAsNumber
      //self.setPosition(val)
      self.videoApp.videoContents.setPosition(val)
    }

    this.$positionRng = $( document.createElement('input') )
                        .attr('id', this.ids.positionRng)
                        .attr('type', 'range')
                        .attr('min', 0)
                        .attr('max', 300)
                        .attr('value', 0)

    this.onPositionRngInputFn = function onPositionRngInput(e) {
      info() && console.log('onPositionRngInput: e.target.valueAsNumber = %f'
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

      info() && console.log('onVolumeSymClick: before volume = %f', videoEl.volume)
      if (videoEl.muted) {
        videoEl.muted = false
        info() && console.log('onVolumeSymClick: muted after volume = %f', videoEl.volume)

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
        info() && console.log('onVolumeSymClick: not muted after volume = %f', videoEl.volume)

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
      info() && console.log('onVolumeRngInput: e.target.valueAsNumber = %f', e.target.valueAsNumber)
      var volume = e.target.valueAsNumber
      info() && console.log('onVolumeRngInput: volume = %d', volume)

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
                          .addClass('fa-expand')
                          //.addClass('fa-compress')

    this.$fullscreen = $( document.createElement('div') )
                       .attr('id', this.ids.fullscreenDiv)
                       .addClass('control')
                       .append( this.$fullscreenSym )

    this.onFullscreenClickFn = function onFullscreenClick(e) {
      info() && console.log('onFullscreenClick: called')

      var videoContents = self.videoApp.videoContents
      //var globalVideoControls = self.videoApp.globalVideoControls

      videoContents.toggleFullscreen()
    }

    this.$flexWrapper.append( this.$fullscreen )

    /********************************
     * Mark Video & Position Button *
     ********************************/
    this.$markSym = $( document.createElement('i') )
                    .attr('id', this.ids.markSym)
                    .addClass('fa')
                    .addClass('fa-bookmark')

    this.$mark = $( document.createElement('div') )
                 .attr('id', this.ids.markDiv)
                 .addClass('control')
                 .append( this.$markSym )

    this.onMarkClickFn = function onMarkClick(e) {
      info() && console.log('onMarkClick: called')

      var videoContents = self.videoApp.videoContents
      videoContents.setMark()

    }

    this.$flexWrapper.append( this.$mark )
  } //end: GlobalVideoControls()

  GlobalVideoControls.prototype.setPlaying =
    function GlobalVideoControls__setPlaying() {
      info() && console.log('GlobalVideoControls__setPlaying: called')
      if ( this.$playSym.hasClass('fa-play') ) {
        this.$playSym.removeClass('fa-play')
        this.$playSym.addClass('fa-pause')
      }
    }

  GlobalVideoControls.prototype.setPaused =
    function GlobalVideoControls__setPaused() {
      info() && console.log('GlobalVideoControls__setPaused: called')
      if ( this.$playSym.hasClass('fa-pause') ) {
        this.$playSym.removeClass('fa-pause')
        this.$playSym.addClass('fa-play')
      }
    }

  GlobalVideoControls.prototype.setEnded =
    function GlobalVideoControls__setEnded() {
      if ( this.$playSym.hasClass('fa-pause') ) {
        this.$playSym.removeClass('fa-pause')
        this.$playSym.addClass('fa-play')
      }
    }

  GlobalVideoControls.prototype.setPosition =
    function GlobalVideoControls__setPosition(fsecs) {
      //info() && console.log('GlobalVideoControls__setPosition: fsecs = %f', fsecs)
      if (fsecs < 0) fsecs = 0
      this.$positionRng[0].value = fsecs
      this.$positionNum[0].value = Math.floor(fsecs)
    }

  GlobalVideoControls.prototype.setPlayable =
    function GlobalVideoControls__setPlayable() {
      if (this.$playSym.hasClass('fa-pause')) {
        this.$playSym.removeClass('fa-pause')
        this.$playSym.addClass('fa-play')
      }
    }

  GlobalVideoControls.prototype.fullscreenChanged =
    function GlobalVideoControls__fullscreenChanged() {
      console.log('GlobalVideoControls__fullscreenChanged: called')
      var self = this

      /* This is called only from the fullscreenchange event.
       * For some reason that fires off before the new fullscreen element
       * has its dimensions set. So, I have inserted this delayed function
       * to set the positioning of the spinner and controls.
       * 500ms seems to be enought most of the time on my MacBook Pro
       * (early 2011) running Chrome.
       */
      setTimeout(function() {
        self.cssPositionControls()
      }, 500)

      if ( this.$fullscreenSym.hasClass('fa-expand') ) {
        this.$fullscreenSym.removeClass('fa-expand')
        this.$fullscreenSym.addClass('fa-compress')
      }
      else if ( this.$fullscreenSym.hasClass('fa-compress') ) {
        this.$fullscreenSym.removeClass('fa-compress')
        this.$fullscreenSym.addClass('fa-expand')
      }
    } //end: GlobalVideoControls__fullscreenChanged()

  GlobalVideoControls.prototype.cssPositionControls =
    function GlobalVideoControls__cssPositionControls() {
      var videoContents, $dom, $controls, offset

      videoContents = this.videoApp.videoContents
      $dom = videoContents.$dom
      $controls = $('#globalVideoControls')
      offset = ($dom.width()/2) - ($controls.width()/2)
      $controls.css({top: 10, left: offset})
    }

  GlobalVideoControls.prototype.setVolume =
    function GlobalVideoControls__setVolume(pct) {
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

  GlobalVideoControls.prototype.reset =
    function GlobalVideoControls__reset() {
    if ( this.isEnabled() ) this.disable()
    if (this.$playSym.hasClass('fa-pause')) {
      this.$playSym.removeClass('fa-pause')
      this.$playSym.addClass('fa-play')
    }
    this.setVolume(100)
    this.setPosition(0)
    this.setPlayable()
  }

  GlobalVideoControls.prototype.isEnabled =
    function GlobalVideoControls__isEnabled() {
      return this._enabled
    }

  GlobalVideoControls.prototype.enable = function GlobalVideoControls__enable() {
    info() && console.log('GlobalVideoControls__enable: this._enabled = %o', this._enabled)
    if ( this.isEnabled() ) {
      warn() && console.log('GlobalVideoControls__enable: controls already enabled!')
      console.trace()
      return
    }

    if ( this.$dom.hasClass('disabled') ) {
      this.$dom.removeClass('disabled')
    }
    else {
      console.error('WTF!!! GlobalVideoControls__enable: !this.isEnabled() && !this.$dom.hasClass("disabled")')
      console.trace()
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
    this.$mark.on('click', this.onMarkClickFn)

    return this._enabled = true
  } //end: GlobalVideoControls__enable()

  GlobalVideoControls.prototype.disable =
    function GlobalVideoControls__disable() {
      info() && console.log('GlobalVideoControls__disable: this._enabled = %o', this._enabled)
      if ( !this.isEnabled() ) {
        warn() && console.log('GlobalVideoControls__disable: controls already disabled')
        console.trace()
        return
      }

      if ( this.$dom.hasClass('enabled') ) {
        this.$dom.removeClass('enabled')
      }
      else {
        console.error('WTF!!! GlobalVideoControls__disable: this.isEnabled() && !this.$dom.hasClass("enabled")')
        console.trace()
        //return
      }

      if ( !this.$dom.hasClass('disabled') ) this.$dom.addClass('disabled')

      this.$play.off('click', this.onPlayClickFn)
      this.$skip.off('click', this.onSkipClickFn)
      this.$back.off('click', this.onBackClickFn)
      this.$fullscreen.off('click', this.onFullscreenClickFn)
      this.$volumeSym.off('click', this.onVolumeSymClickFn)
      this.$mark.off('click', this.onMarkClickFn)

      this._enabled = false
    } //end: GlobalVideoControls__disable()

  function PerVideoControls(_cfg, videoContent, videoApp) {
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
    this._eventsSetup   = false

    this.$dom = $(document.createElement('div'))
                .attr('id', this.ids.div)

    var $rootSelect = $(document.createElement('select'))
                      .attr('id', this.ids.select)
                      .attr('size', this.rootNames.length)


    this.$rootSelect = $rootSelect

    for (var i=0; i<this.rootNames.length; i+=1) {
      this.$rootSelect.append(
        $(document.createElement('option'))
        .attr('value', this.rootNames[i])
        .append(this.rootNames[i])
      )
    }

    this.$dom.append( $(document.createElement('div'))
                      .attr('id', this.ids.wrapDiv)
                      .append( this.$rootSelect )
                    )

    var self = this
    function selectChanged() {
      var val = $(this).val()
      var i
      var dirSelect

      info() && console.log('FileBrowser: selectChanged: val = '+JSON.stringify(val))

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

      function readdirSuccess(data) {
        info() && console.log('FileBrowser: selectChanged: readdirSuccess: data =', data)
        self.addDirSelect(data.dirs, data.files)
      }

      $.ajax({ url  : 'readdir'
             , type : 'GET'
             , data : { root    : val
                      , subdirs : self.subdirs
                      }
             , success : readdirSuccess
             })
    } //end: selectChanged()

    this.$rootSelect.change( selectChanged )

    this._setupEvents()
  } //end: FileBroswer()

  FileBrowser.prototype.getState = function FileBrowser__getState() {
    // NOOP
    return undefined
  } //end: FileBrowser__getState()

  FileBrowser.prototype._setupEvents = function FileBrowser___setupEvents() {
    if (this._eventsSetup) return

    this._setupKeyboardEvents()

    this._eventsSetup = true
  }

  FileBrowser.prototype._setupKeyboardEvents =
    function FileBrowser___setupKeyboardEvents() {
      if (this._eventsSetup) return

      // For an complete list of keyCode's see:
      // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode

      var self = this
      function onKeyDown(e) {
        info() && console.log("FileBrowser: onKeyDown: called %o", e)
        if (e.originalEvent.repeat) return

        var left  = 37
        // up    = 38
        var right = 39
        // down  = 40

        // only concerned with left and right
        switch (e.keyCode) {
         case left:
          info() && console.log("fileBrowser.$rootSelect: onKeyDown: left goes no where.")
          break;

         case right:
          info() && console.log("fileBrowser.$rootSelect: onKeyDown: right should focus right")
          e.stopImmediatePropagation()
          e.preventDefault()
          self.focusNext()
          break;

         default:

        }

        //return false
      } //end: onKeyDown()

      this.$rootSelect.on('keydown', onKeyDown)
    } //end: FileBrowser___setupKeyboardEvents()

  FileBrowser.prototype.focusNext = function FileBroswer__focusNext() {
    if (this.dirSelects.length < 1) {
      info() && console.log("FileBroswer__focusNext: this.dirSelects.length = %d", this.dirSelects.length)
      return
    }
    this.dirSelects[0].$select.focus()
  }

  FileBrowser.prototype.addDirSelect =
    function FileBrowser__addDirSelect(dirs, files) {
      info() && console.log('FileBrowser__addDirSelect: dirs =', dirs)
      info() && console.log('FileBrowser__addDirSelect: files =', files)

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

        info() && console.log('FileBrowser: selectChanged: val = '+JSON.stringify(val))

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

          function readdirSuccess(data) {
            info() && console.log('FileBrowser__addDirSelect: disSelectChanged: readdirSuccess; data = ', data)
            self.addDirSelect(data.dirs, data.files)
          }

          $.ajax({ url     : 'readdir'
                 , type    : 'GET'
                 , data    : { root    : self.selectedRoot
                             , subdirs : self.subdirs
                             }
                 , success : readdirSuccess
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
      info() && console.log('FileBrowser__fileSelected: fqfn:'
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
      function addVideoContentFn(e) {
        self.addVideoContentButton.$dom.remove()
        // the last argument of addVideoContent initialTime is left undefined
        self.videoApp.videoContents.addVideoContent(root, subdirs, file)
      }
      this.addVideoContentButton.$dom.click( addVideoContentFn )
    } //end: FileBrowser__fileSelected()

  function DirSelect(dirNum, dirs, files, fileBrowser) {
    this.dirNum        = dirNum
    this.dirs          = dirs
    this.files         = files
    this.fileBrowser   = fileBrowser
    this.nextDirSelect = undefined
    this._eventsSetup  = false

    var size = dirs.length + files.length

    this.ids = { div    : 'fileSelectorDiv-'+dirNum
               , wrapDiv: 'dirWrapDiv-'+dirNum
               , select : 'dirSelect-'+dirNum
               }

    this.$dom = $(document.createElement('div'))
                .attr('id', this.ids.div)
                .addClass('fileSelector')

    var i
    if ( size > 0) {
      this.$select = $(document.createElement('select'))
                     .attr('id', this.ids.select)
                     .attr('size', size<2 ? 2 : size)
                     .addClass('fileSelector')

      for (i=0; i<dirs.length; i+=1) {
        this.$select.append( $(document.createElement('option'))
                             .attr('value', dirs[i])
                             .addClass('directory')
                             .append( dirs[i]+'/' )
                           )
      }
      for (i=0; i<files.length; i+=1) {
        this.$select.append( $(document.createElement('option'))
                             .attr('value', files[i])
                             .addClass('file')
                             .append( files[i] )
                           )
      }

      this.$dom.append( $(document.createElement('div'))
                        .attr('id', this.ids.wrapDiv)
                        .addClass('wrapSelect')
                        .append( this.$select )
                      )
    }
    else {
      this.$dom.append( $( document.createElement('span') )
                        .addClass('notice')
                        .append('Empty')
                      )
    }

    this._setupEvents()
  } //end: DirSelect()

  DirSelect.prototype.getState = function DirSelect__getState() {
    // NOOP
    return undefined
  } //end: DirSelect__getState()

  DirSelect.prototype.focusNext = function DirSelect__focusNext() {
    var lastIdx = this.fileBrowser.dirSelects.length - 1
    if ( this.dirNum < lastIdx) {
      this.fileBrowser.dirSelects[this.dirNum+1].$select.focus()
    }
    //else do nothing
  }

  DirSelect.prototype.focusPrev = function DirSelect__focusPrev() {
    if (this.dirNum == 0) {
      this.fileBrowser.$rootSelect.focus()
    }
    if (this.dirNum > 0) {
      this.fileBrowser.dirSelects[this.dirNum-1].$select.focus()
    }
  }

  DirSelect.prototype._setupEvents = function DirSelect___setupEvents() {
    if (this._eventsSetup) return

    this._setupKeyboardEvents()

    this._eventsSetup = true
  }

  DirSelect.prototype._setupKeyboardEvents =
    function DirSelect___setupKeyboardEvents() {
      if (this._eventsSetup) return

      var self = this
      function onKeyDown(e) {
        if (e.originalEvent.repeat) return

        var left  = 37
        // up    = 38
        var right = 39
        // down  = 40

        // only concerned with left and right
        switch (e.keyCode) {
         case left:
          info() && console.log("dirSelect[%d].$select: onKeyDown: left should focus left", self.dirNum)
          e.stopImmediatePropagation()
          e.preventDefault()
          self.focusPrev()
          break;

         case right:
          info() && console.log("fileBrowser.$rootSelect: onKeyDown: right should focus right")
          e.stopImmediatePropagation()
          e.preventDefault()
          self.focusNext()
          break;

         default:
          info() && console.log("dirSelect[%d].$select: onKeyDown: unknown keyCode=%d"
              , self.dirNum, e.keyCode)
        }

        //return false
      } //end: onKeyDown()

      if (this.$select) //non-empty box
        this.$select.on('keydown', onKeyDown)
    } //end: DirSelect___setupKeyboardEvents()

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

  window.VideoApp = VideoApp

})(window, window.document)
