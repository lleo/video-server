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
    console.log('cfg.debug = %s; this.debug = %s;', cfg.debug, this.debug)
    VideoApp.setLogLevel(this.debug)

    var videoControls = new VideoControls(cfg['controls config'], this)
    this.videoControls = videoControls

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
        info('VideoApp: onPopState: e = %o', e)

        var oldState = e.originalEvent.state
        var curState = self.getState()
        info('VideoContent: onPopState: oldState = %o', oldState)
        info('VideoContent: onPopState: curState = %o', curState)

        var otime = oldState.time
        if (typeof otime == 'string') {
          info('VideoContent: onPopState: otime is a string %o', otime)
          otime = parseFloat(otime)
          info('VideoContent: onPopState: otime = %f', otime)
        }

        var ctime = curState && curState.time

        if ( stateEqualExceptTime(oldState, curState)) {
          info('VideoContent: onPopState: oldState & curState (minus time) are the same')
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
  var _slice   = Array.prototype.slice
  var info_lvl = VideoApp.getLogLevel('info')
  var info = VideoApp.info = function info() {
    var args
    if (info_lvl >= VideoApp.getLogLevel()) {
      args = _slice.apply(arguments)
      if (args.length == 0) args.push('')
      args[0] = '[INFO] '+args[0]
      console.log.apply(console, args)
    }
  }
  var warn_lvl = VideoApp.getLogLevel('warn')
  var warn = VideoApp.warn = function warn() {
    var args
    if (warn_lvl >= VideoApp.getLogLevel()) {
      args = _slice.apply(arguments)
      if (args.length == 0) args.push('')
      args[0] = '[WARN] '+args[0]
      console.log.apply(console, args)
    }
  }
  var crit_lvl = VideoApp.getLogLevel('crit')
  var crit = VideoApp.crit = function crit() {
    var args
    if (crit_lvl >= VideoApp.getLogLevel()) {
      args = _slice.apply(arguments)
      if (args.length == 0) args.push('')
      args[0] = '[CRIT] '+args[0]
      console.log.apply(console, args)
    }
  }
  var error = VideoApp.error = function error() {
    var args = _slice.apply(arguments)
    if (args.length == 0) args.push('')
    args[0] = '[ERROR] '+args[0]
    console.error.apply(console, args)
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
    this.id = 'videoContents'
    this.$dom = $( document.createElement('div') )
                .attr('id', this.id)
                .addClass('videoContents')
                .addClass('nocursor')

    this.contents = [] //array of VideoContent objects
    this._isFullscreen = false
    this._eventsSetup = false

    // !!! HACK ALERT !!!
    // setTimeout() thing works but I do not like it :(
    // also see onLoadedData for how the time position is set.
    if (this.initialLoad) {
      var self = this
      setTimeout(function() {
        self.addVideoContent( self.initialLoad.root
                            , self.initialLoad.subdirs
                            , self.initialLoad.file
                            , self.initialLoad.time )
        self.contents[0].$dom.focus()
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
      var videoControls = this.videoApp.videoControls
      videoControls.disable()
      videoControls.reset()

      var vidNum = this.contents.length
      
      var videoContent = new VideoContent(vidNum, root, subdirs, file,
                                          initTime, this.videoApp)

      this.contents.push(videoContent)

      this.$dom.append(videoContent.$dom)
    }

  VideoContents.prototype._setupEvents =
    function VideoContents___setupEvents() {
      if (this._eventsSetup) return
      this._setupKeyboardEvents()
      this._setupMouseEvents()
      this._eventsSetup = true
    }

  VideoContents.prototype._setupKeyboardEvents =
    function VideoContents___setupKeyboardEvents() {
      if (this._eventsSetup) return
      var self = this

      function onKeyPress(e) {
        info('onKeyPress: called e =', e)
        var videoControls = self.videoApp.videoControls
        var videoContents = self.videoApp.videoContents

        if ( videoContents.contents.length < 0 ) return

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
          info("onKeyPress: '%s' pressed; $play.click()", character)
          videoControls.$play.click()
          break;

         case 's':
          info("onKeyPress: 's' pressed; $skip.click()")
          videoControls.$skip.click()
          break;

         case 'S':
          info("onKeyPress: 'S' pressed; long skip")
          videoContents.seek( videoControls.skipForwSecs * 3 )
          break;

         case 'b':
          info("onKeyPress: 's' pressed; $back.click()")
          videoControls.$back.click()
          break;

         case 'B':
          info("onKeyPress: 'B' pressed; long back")
          videoContents.seek( -(videoControls.skipBackSecs * 3) )
          break;

         case 'F':
          info("onKeyPress: 'F' pressed; $fullscreen.click()")
          videoControls.$fullscreen.click()
          break;

         default:
          msg = "onKeyPress: Unknown KeyPress: "
              + "e.char="+e.char+" "
              + "e.charCode="+e.charCode+" "
              + "e.keyCode="+e.keyCode+" "
              + "char="+character
          info(msg)
          //alert(msg)
        }
      }

      //this.$dom.on('keypress', onKeyPress)
      $(document).on('keypress', onKeyPress)
    } //end: VideoContents___setupKeyboardEvents()

  VideoContents.prototype._setupMouseEvents =
    function VideoContents___setupMouseEvents() {
      if (this._eventsSetup) return

      var hideBothTimerId
        , firstThrottleTimerExecuted = true
        , overControls = false

      var self = this

      function onMouseMove() {
        //info('onMouseMove: called')
        // The algorithm is as follows:
        // 0 - turn off the on 'mousemove' event handler
        //   - show controls & cursor & start throttling the 'mousemove' events
        // 1 - if 2000ms after the first throttle timer has fired,
        //     then hide the controls & cursor
        var videoControls = self.videoApp.videoControls

        // Given that every time 50ms after a 'mousemove' event we disable
        // and then reenable this timer function for 2000ms,
        // **this function only fires** when no 'mousemove' events has
        // occured for over 2050ms.
        function hideBothTimerFn() {
          // NOTE: The variable overControls is a boolean that is set true
          // by the 'mouseenter' and false by the 'mouseleave' events
          // See the onMouse{Enter,Leave} functions declared below.
          if (!overControls && !videoControls.$dom.hasClass('hide'))
            videoControls.$dom.addClass('hide')

          if (!overControls && !self.$dom.hasClass('nocursor'))
            self.$dom.addClass('nocursor')

          // reset the firstThrottleTimerExecuted & hideBothTimerId
          firstThrottleTimerExecuted = true
          hideBothTimerId = undefined
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
          if (hideBothTimerId || firstThrottleTimerExecuted) {
            clearTimeout(hideBothTimerId)
            firstThrottleTimerExecuted = false
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

      // This was a test to see if there was any jQuery or Browser trottleing
      // of 'mousemove' events.
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
      //
      //    self.videoApp.videoControls.$dom.removeClass('hide')
      //  }
      //
      //  // mouse moved -> show cursor
      //  if ( self.$dom.hasClass('nocursor') ) {
      //
      //    self.$dom.removeClass('nocursor')
      //  }
      //
      //  clearTimeout(hideBothTimerId)
      //  hideBothTimerId = setTimeout(hideBothTimerFn, 2000)
      //} //end: onMouseMove() [test]
      this.$dom.on('mousemove', onMouseMove)

      function onMouseEnter(e) {
        overControls = true
      }
      function onMouseLeave(e) {
        overControls = false
      }
      console.log('VideoContents___setupMouseEvents: this = %o', this)
      console.log('VideoContents___setupMouseEvents: this.videoApp = %o', this.videoApp)
      console.log('VideoContents___setupMouseEvents: this.videoApp.videoControls = %o', this.videoApp.videoControls)
      this.videoApp.videoControls.$dom.on('mouseenter', onMouseEnter)
      this.videoApp.videoControls.$dom.on('mouseleave', onMouseLeave)

    } //end: VideoContents___setupMouseEvents()

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

  VideoContents.prototype.setMark = function VideoContents__setMark() {
    if (!this.contents.length) return

    var state = _.cloneDeep(this.contents[0].state)
    var qstr = $.param( state )

    var url = window.location.origin + window.location.pathname + "?" + qstr

    history.pushState(state, null, url)
  } //end: VideoContents__setMark()

  function VideoContent(vidNum, root, subdirs, file, initTime, videoApp) {
    info('VideoContent() constructor')

    this.vidNum   = vidNum
    this.root     = root
    this.subdirs  = subdirs
    this.file     = file
    this.initTime = initTime
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

    //FIXME: delete this
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
                .attr('tabindex', 1)
                .addClass('videoContent')
                .append( this.$video )

    if (0 == vidNum) {
      this.$dom.append( this.$spinner )
      this.$dom.append( videoApp.videoControls.$dom )
    }

    this._setupEvents()
  } //end: VideoContent()

  VideoContent.prototype.getState = function VideoContent__getState() {
    return _.cloneDeep(this.state)
  }

  VideoContent.prototype._setupEvents = function VideoContent___setupEvents() {
    if (this._eventsSetup) return
    
    this._setupVideoEvents()
    //this._setupMouseEvents()
    //this._setupKeyboardEvents()

    this._eventsSetup = true
  }

  //VideoContent.prototype._setupKeyboardEvents =
  //  function VideoContent___setupKeyboardEvents() {
  //    var self = this
  //
  //    function onKeyPress(e) {
  //      info('onKeyPress: called e =', e)
  //      var videoControls = self.videoApp.videoControls
  //      var videoContents = self.videoApp.videoContents
  //
  //      if ( videoContents.contents.length < 0 ) return
  //
  //      /* From https://api.jquery.com/keypress/
  //       *  e.type 'keypress'
  //       *  e.timeStamp Date.now()
  //       *  e.keyCode number of char pressed
  //       *  e.key ?
  //       *  e.charCode number of char pressed
  //       *  e.char ?
  //       *  e.which number of char pressed
  //       *  e.ctrlKey
  //       *  e.shiftKey
  //       *  e.altKey
  //       *  e.metaKey
  //       *  e.cacelable
  //       *  e.target
  //       *  e.relatedTarge
  //       *  e.handleObj
  //       *  e.data undefined
  //       *  e.preventDefault()
  //       *  e.stopPropagation()
  //       *  e.stopImmediatePropagation()
  //       * From: https://developer.mozilla.org/en-US/docs/Web/Events/keypress
  //       *  e.originalEvent.target.id
  //       *  e.originalEvent.type  type of event 'keypress'?
  //       *  e.originalEvent.bubbles
  //       *  e.originalEvent.cancelable
  //       *  e.originalEvent.char the UniCode character of the key as a one element string
  //       *  e.originalEvent.charCode the UniCode number (depricated)
  //       *  e.originalEvent.repeat has the key been pressed long enough to be repeating
  //       *  e.originalEvent.ctrlKey  true if control key was press along with this key
  //       *  e.originalEvent.shiftKey ..ditto..
  //       *  e.originalEvent.altKey   ..ditto..
  //       *  e.originalEvent.metaKey  ..ditto..
  //       */
  //      var msg
  //      var character = String.fromCharCode( e.charCode )
  //
  //      switch (character) {
  //       case 'p':
  //       case ' ':
  //        info("onKeyPress: '%s' pressed; $play.click()", character)
  //        videoControls.$play.click()
  //        break;
  //
  //       case 's':
  //        info("onKeyPress: 's' pressed; $skip.click()")
  //        videoControls.$skip.click()
  //        break;
  //
  //       case 'S':
  //        info("onKeyPress: 'S' pressed; long skip")
  //        videoContents.seek( videoControls.skipForwSecs * 3 )
  //        break;
  //
  //       case 'b':
  //        info("onKeyPress: 's' pressed; $back.click()")
  //        videoControls.$back.click()
  //        break;
  //
  //       case 'B':
  //        info("onKeyPress: 'B' pressed; long back")
  //        videoContents.seek( -(videoControls.skipBackSecs * 3) )
  //        break;
  //
  //       case 'F':
  //        info("onKeyPress: 'F' pressed; $fullscreen.click()")
  //        videoControls.$fullscreen.click()
  //        break;
  //
  //       default:
  //        msg = "onKeyPress: Unknown KeyPress: "
  //            + "e.char="+e.char+" "
  //            + "e.charCode="+e.charCode+" "
  //            + "e.keyCode="+e.keyCode+" "
  //            + "char="+character
  //        info(msg)
  //        //alert(msg)
  //      }
  //    }
  //
  //    //this.$dom.on('keypress', onKeyPress)
  //    $(document).on('keypress', onKeyPress)
  //  }

  //VideoContent.prototype._setupMouseEvents =
  //  function VideoContent___setupMouseEvents() {
  //    if (this._eventsSetup) return
  //
  //    var hideBothTimerId
  //      , firstThrottleTimerExecuted = true
  //      , overControls = false
  //
  //    var self = this
  //
  //    function onMouseMove() {
  //      //info('onMouseMove: called')
  //      // The algorithm is as follows:
  //      // 0 - turn off the on 'mousemove' event handler
  //      //   - show controls & cursor & start throttling the 'mousemove' events
  //      // 1 - if 2000ms after the first throttle timer has fired,
  //      //     then hide the controls & cursor
  //      var videoControls = self.videoApp.videoControls
  //
  //      // Given that every time 50ms after a 'mousemove' event we disable
  //      // and then reenable this timer function for 2000ms,
  //      // **this function only fires** when no 'mousemove' events has
  //      // occured for over 2050ms.
  //      function hideBothTimerFn() {
  //        // NOTE: The variable overControls is a boolean that is set true
  //        // by the 'mouseenter' and false by the 'mouseleave' events
  //        // See the onMouse{Enter,Leave} functions declared below.
  //        if (!overControls && !videoControls.$dom.hasClass('hide'))
  //          videoControls.$dom.addClass('hide')
  //
  //        if (!overControls && !self.$dom.hasClass('nocursor'))
  //          self.$dom.addClass('nocursor')
  //
  //        // reset the firstThrottleTimerExecuted & hideBothTimerId
  //        firstThrottleTimerExecuted = true
  //        hideBothTimerId = undefined
  //      }
  //
  //      // This is the second part of the throttle algorithm.
  //      // First, every time onMouseMove() fires we turn off watching for
  //      //   'mousemove' events and set this timer fuction (see below).
  //      // When this timer function fires we turn the watch for 'mousemove'
  //      //   events back on. So for 50ms the 'mousemove' events were ignored.
  //      function throttleTimerFn() {
  //        self.$dom.on('mousemove', onMouseMove)
  //
  //        // IF the the hideBothTimerFn has already been set
  //        // OR this is the first in a sequence of 'mousemove' events
  //        if (hideBothTimerId || firstThrottleTimerExecuted) {
  //          clearTimeout(hideBothTimerId)
  //          firstThrottleTimerExecuted = false
  //          hideBothTimerId = setTimeout(hideBothTimerFn, 2000)
  //        }
  //      }
  //
  //      // mouse moved -> disable on 'mousemove' events; throttling
  //      self.$dom.off('mousemove', onMouseMove)
  //
  //      // mouse moved -> show controls
  //      if ( videoControls.$dom.hasClass('hide') ) {
  //        videoControls.$dom.removeClass('hide')
  //      }
  //
  //      // mouse moved -> show cursor
  //      if ( self.$dom.hasClass('nocursor') ) {
  //        self.$dom.removeClass('nocursor')
  //      }
  //
  //      // in 50ms (1/20th sec) reenable 'mousemove' events
  //      setTimeout(throttleTimerFn, 50)
  //    } //end: onMouseMove()
  //
  //    // This was a test to see if there was any jQuery or Browser trottleing
  //    // of 'mousemove' events.
  //    //function onMouseMove(e) { //[test]
  //    //  info('onMouseMove: overControls = %o', overControls)
  //    //
  //    //  function hideBothTimerFn() {
  //    //    info('hideBothTimerFn: overControls = %o', overControls)
  //    //    hideBothTimerId = undefined
  //    //    if (!overControls) {
  //    //      if ( !self.videoApp.videoControls.$dom.hasClass('hide') ) {
  //    //        self.videoApp.videoControls.$dom.addClass('hide')
  //    //      }
  //    //      if ( !self.$dom.hasClass('nocursor') ) {
  //    //        self.$dom.addClass('nocursor')
  //    //      }
  //    //    }
  //    //  }
  //    //
  //    //  // mouse moved -> show controls
  //    //  if ( self.videoApp.videoControls.$dom.hasClass('hide') ) {
  //    //
  //    //    self.videoApp.videoControls.$dom.removeClass('hide')
  //    //  }
  //    //
  //    //  // mouse moved -> show cursor
  //    //  if ( self.$dom.hasClass('nocursor') ) {
  //    //
  //    //    self.$dom.removeClass('nocursor')
  //    //  }
  //    //
  //    //  clearTimeout(hideBothTimerId)
  //    //  hideBothTimerId = setTimeout(hideBothTimerFn, 2000)
  //    //} //end: onMouseMove() [test]
  //    this.$dom.on('mousemove', onMouseMove)
  //
  //    function onMouseEnter(e) {
  //      overControls = true
  //    }
  //    function onMouseLeave(e) {
  //      overControls = false
  //    }
  //    this.videoApp.videoControls.$dom.on('mouseenter', onMouseEnter)
  //    this.videoApp.videoControls.$dom.on('mouseleave', onMouseLeave)
  //
  //  } //end: VideoContent___setupMouseEvents()

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
      //var videoControls = this.videoApp.videoControls
      
      var self = this

      //$(window).on('popstate', function onPopState(e) {
      //  info('VideoContent: onPopState: e = %o', e)
      //  var oldState = e.originalEvent.state
      //  var curState = _.cloneDeep(self.state)
      //  info('VideoContent: onPopState: oldState = %o', oldState)
      //  info('VideoContent: onPopState: curState = %o', curState)
      //  var otime = oldState.time
      //  if (typeof otime == 'string') {
      //    info('VideoContent: onPopState: otime is a string %o', otime)
      //    otime = parseFloat(otime)
      //    info('VideoContent: onPopState: otime = %f', otime)
      //  }
      //  var ctime = curState.time
      //  if ( stateEqualExceptTime(oldState, curState)) {
      //    info('VideoContent: onPopState: oldState & curState (minus time) are the same')
      //    self.setPosition(otime)
      //  }
      //  else {
      //    self.videoApp.videoContents.addVideoContent( oldState.root
      //                                               , oldState.subdirs
      //                                               , oldState.file
      //                                               , otime )
      //  }
      //})

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
        var videoContents = self.videoApp.videoContents

        if (0 == self.vidNum)
          videoControls.$positionRng[0].max = self.$video[0].duration

        if (self.initTime) {
          console.log('onLoadedData: self.initTime = %f', self.initTime)
          if (0 == self.vidNum) videoControls.setPosition(self.initTime)
          self.setPosition(self.initTime)
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

  VideoContent.prototype.togglePlay = function VideoContent__togglePlay() {
    if ( this.isPaused() )
      return this.play()   //true on play?
    else
      return !this.pause() //false on pause?
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
      info('onMarkClick: called')

      var videoContent = self.videoApp.videoContents.contents[0]
      var root    = videoContent.root
      var subdirs = videoContent.subdirs
      var file    = videoContent.file
      var time    = Math.floor(videoContent.$video[0].currentTime)

      var q = { "root"    : root
              , "subdirs" : subdirs
              , "file"    : file
              , "time"    : time
              }
      var qstr = $.param( q )

      var url = window.location.origin + window.location.pathname + "?" + qstr

      info('onMarkClick: window.location.origin = %s', window.location.origin)
      info('onMarkClick: window.location.pathname = %s', window.location.pathname)
      info('onMarkClick: q = %o', q)
      info('onMarkClick: qstr = %s', qstr)
      info('onMarkClick: url = %s', url)

      var state = _.cloneDeep(videoContent.state)
      info('onMarkClick: state = %o', state)

      history.pushState(state, null, url)
    }

    this.$flexWrapper.append( this.$mark )
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
      this.$mark.on('click', this.onMarkClickFn)

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
      this.$mark.off('click', this.onMarkClickFn)

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
    this._eventsSetup   = false

    this.$dom = $(document.createElement('div'))
                .attr('id', this.ids.div)
                //.addClass('rootSelector') //FIXME: delete this

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
                      //.addClass('wrapRootSelect') //FIXME: delete this
                      .append( this.$rootSelect )
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

      function readdirSuccess(data) {
        info('FileBrowser: selectChanged: readdirSuccess: data =', data)
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
        info("FileBrowser: onKeyDown: called %o", e)
        if (e.originalEvent.repeat) return

        var left  = 37
        // up    = 38
        var right = 39
        // down  = 40

        // only concerned with left and right
        switch (e.keyCode) {
         case left:
          info("fileBrowser.$rootSelect: onKeyDown: left goes no where.")
          break;

         case right:
          info("fileBrowser.$rootSelect: onKeyDown: right should focus right")
          e.stopImmediatePropagation()
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
      info("FileBroswer__focusNext: this.dirSelects.length = %d", this.dirSelects.length)
      return
    }
    this.dirSelects[0].$select.focus()
  }

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

          function readdirSuccess(data) {
            info('FileBrowser__addDirSelect: disSelectChanged: readdirSuccess; data = ', data)
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
      function addVideoContentFn(e) {
        self.addVideoContentButton.$dom.remove()
        // the last argument of addVideoContent initTime is left undefined
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
          info("dirSelect[%d].$select: onKeyDown: left should focus left", self.dirNum)
          e.stopImmediatePropagation()
          self.focusPrev()
          break;

         case right:
          info("fileBrowser.$rootSelect: onKeyDown: right should focus right")
          e.stopImmediatePropagation()
          self.focusNext()
          break;

         default:
          info("dirSelect[%d].$select: onKeyDown: unknown keyCode=%d"
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
