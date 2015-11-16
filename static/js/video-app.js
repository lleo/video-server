/*global wrapSelect */
/*
 * NOTE: Remember this is running in the browser.
 */
(function(root, undefined) {

  function VideoApp(cfg) {
    this.volumeBrowser = new VolumeBrowser(cfg['video volumes'], this)

    $('#fileSelect').append( this.volumeBrowser.$dom )

    this.videoContents = []
    this.videoControls = undefined
  }

  VideoApp.prototype.addVideoContent =
    function VideoApp__addVideoContent(vidNum, volume, subdirs, file) {
      'use strict';

      if (this.videoContents.length) {
        for (let i=this.videoContents.length-1; i>=0; i-=1) {
          this.videoContents[i].$dom.remove()
        }
      }

      
      var videoContent = new VideoContent(vidNum, volume, subdirs, file, this)

      this.videoContents.push(videoContent)

      $('#videoContents').append(videoContent.$dom)
      
      if (!this.videoControls) {
        this.videoControls = new VideoControls(this)
        $('#videoControls').append(videoControls.$dom)
      }

    } //end: VideoApp__addVideoContent()

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
      
    } //end: VideoControls__setupVideo()

  function VideoControls(videoApp) {
    this.videoApp = videoApp

  } //end: VideoControls()

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
       * REACT to this dirSelect being selected
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
      var btnNum  = this.btnNum
      
      //add addVideoContentButton
      this.addVideoContentButton = new LaunchVideoContentButton(btnNum, volume,
                                                                subdirs, file,
                                                                this )

      var vidNum = this.btnNum
      
      this.btnNum += 1

      this.$dom.after( this.addVideoContentButton.$dom )

      var self = this
      function addVideoContent(e) {
        self.addVideoContentButton.$dom.remove()
        self.videoApp.addVideoContent(vidNum, volume, subdirs, file)
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

  function LaunchVideoContentButton(btnNum, volume, subdirs, file
                                   , volumeBrowser) {
    this.btnNum  = btnNum
    this.volume  = volume
    this.subdirs = _.clone(subdirs)
    this.file    = file
    this.volumeBrowser = volumeBrowser
    this.id = 'launchBtn-'+btnNum
    

    this.$dom = $( document.createElement('button') )
                .attr('type', 'button')
                .attr('id', this.id)
                .attr('value', file)
                .addClass('fileButton')
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
})(window)
