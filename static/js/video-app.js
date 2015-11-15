/*global wrapSelect */
/*
 * NOTE: Remember this is running in the browser.
 */
(function(root, undefined) {

  function VolumeBrowser(volumeNames) {
    /* volumeNames = [ name_1, name_2, ..., name_n]
     */
    var self = this
    
    this.ids = { div: 'volumeBrowserDiv'
               , select: 'volumeBrowserSelect'
               , wrapDiv: 'volumeBrowserSelectWrapDiv'
               }
    
    this.volumeNames    = volumeNames
    this.selectedVolume = undefined
    this.subdirs        = []
    this.dirSelects     = [] //should be dirSelects.length == subdirs.length + 1 
    this.launchVideoContentButton = undefined
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
      if (self.launchVideoContentButton) {
        self.launchVideoContentButton.$dom.remove()
        self.launchVideoContentButton = undefined
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
  }

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
        if (self.launchVideoContentButton) {
          self.launchVideoContentButton.$dom.remove()
          self.launchVideoContentButton = undefined
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
      //add launchVideoContentButton
      this.launchVideoContentButton = new LaunchVideoContentButton(
        this.btnNum, this.selectedVolume, this.subdirs, file, this )

      this.btnNum += 1

      this.$dom.after( this.launchVideoContentButton.$dom )
      
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

  } //DirSelect()

  function LaunchVideoContentButton( btnNum
                                   , volume
                                   , subdirs
                                   , file
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

    this.$dom.click(function(e){
      console.log(this.id+" clicked!")
      alert(this.id+" Clicked!")
    })

  }

  function VideoContent(vidNum, volume, subdirs, file, volumeBrowser) {
    
  }
  
  var VIDEO_APP = {
    "init" : function VIDEO_APP_init(cfg) {
      
      console.log('VIDEO_APP.init(cfg) CALLED cfg =', cfg)

      var volumeBrowser = new VolumeBrowser(cfg['video volumes'])
      $('#fileSelect').append( volumeBrowser.$dom )

      VIDEO_APP.volumeBrowser = volumeBrowser
      
      return
    }
  }

  root.VIDEO_APP = VIDEO_APP
})(window)
