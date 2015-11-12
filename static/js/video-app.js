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
               }
    
    this.volumeNames    = volumeNames
    this.firstDirSelect = undefined
    this.selectedVolume = undefined
    this.subdirs        = []
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
                      .addClass('wrapVolumeSelect')
                      .append( $select )
                    )
    
    function selectChanged() {
      var val = $(this).val()

      console.log('VolumeBrowser: selectChanged: val = '+JSON.stringify(val))

      self.selectedVolume = val
      
      if (self.firstDirSelect) {
        //reset the DOM
        self.firstDirSelect.$dom.remove()

        //reset this object
        self.firstDirSelect = undefined
        self.subdirs = []
      }

      function lookupSuccess(data) {
        console.log('VolumeBrowser: selectChanged: lookupSuccess: data =', data)
        self.addFirstDirSelect(data.dirs, data.files )
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
  VolumeBrowser.prototype.addFirstDirSelect =
    function VolumeBrowser__addFirstDirSelect(dirs, files) {
      console.log('VolumeBrowser__addFirstDirSelect: called')
      console.log('VolumeBrowser__addFirstDirSelect: dirs =', dirs)
      console.log('VolumeBrowser__addFirstDirSelect: files =', files)

      var size   = dirs.length + files.length

      this.firstDirSelect = new DirSelect(0, dirs, files, this)
      this.$dom.append( this.firstDirSelect.$dom )
    }


  function DirSelect(dirNum, dirs, files, volumeBrowser) {
    this.dirNum        = dirNum
    this.dirs          = dirs
    this.files         = files
    this.volumeBrowser = volumeBrowser
    this.nextDirSelect = undefined

    var size = dirs.length + files.length
    
    this.ids = { wrapDiv: 'dirWrapDiv-'+dirNum
               , select : 'dirSelect-'+dirNum
               , nextDiv: 'dirNextDiv-'+dirNum
               }

    this.$dom = $(document.createElement('div'))
                .attr('id', this.ids.wrapDiv)
                .addClass('fileSelector')

    var $select = $(document.createElement('select'))
                  .attr('id', this.ids.select)
                  .attr('size', size)
                  .addClass('fileSelector')

    var i
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
                      .addClass('wrapSelect')
                      .append( $select )
                    )

    var self = this
    function selectChanged() {
      var val = $(this).val()

      console.log('DirSelect: selectChanged: val='+JSON.stringify(val))
      
      if (self.nextDirSelect) {
        //reset the DOM
        self.nextDirSelect.$dom.remove()

        //reset this Object
        self.nextDirSelect = undefined

        //reset volumeBrowser
        self.volumeBrowser.subdirs.length = self.dirNum
      }

      //if a directory was selected
      if ( dirs.some(function(e,i,a) { return e == val }) ) {
        self.volumeBrowser.subdirs.push(val)

        function lookupSuccess(data) {
          console.log('DirSelect: selectChanged: lookupSuccess: data =', data)
          self.addDirSelect(data.dirs, data.files)
        }

        $.ajax({ url  : 'lookup'
               , type : 'GET'
               , data : { top    : self.volumeBrowser.selectedVolume
                        , subdirs: self.volumeBrowser.subdirs
                        }
               , success : lookupSuccess
               })
      }
      else if ( files.some(function(e,i,a) { return e == val }) ) {
        self.fileSelected(val)
      }
      else {
        //WTF!!!
        var errormsg = 'selected val='
                     +JSON.stringify(val)
                     +' neither in dirs nor files'
        console.error(errormsg)
        throw new Exception(errmsg)
      }
      return
    } //end: selectChanged()
    
    $select.change( selectChanged )
  } //DirSelect()

  DirSelect.prototype.addDirSelect =
    function DirSelect__addDirSelect(dirs, files) {
      console.log('DirSelect__addDirSelect: called')
      console.log('DirSelect__addDirSelect: dirs =', dirs)
      console.log('DirSelect__addDirSelect: files =', files)

      //var size = dirs.length + files.length

      this.nextDirSelect = new DirSelect(this.dirNum+1, dirs, files,
                                         this.volumeBrowser)

      this.$dom.append( this.nextDirSelect.$dom )
      
    }

  DirSelect.prototype.fileSelected = function DirSelect__fileSlected(file) {
    console.log('DirSelect__fileSelected: fqfn:'
               + '"' + this.volumeBrowser.selectedVolume + '"/'
               + this.volumeBrowser.subdirs.join('/')+'/'
               + file
               )

  }

  var VIDEO_APP = {
    "init" : function VIDEO_APP_init(cfg) {
      
      console.log('VIDEO_APP.init(cfg) CALLED cfg =', cfg)

      var volumeBrowser = new VolumeBrowser(cfg['video volumes'])
      $('#fileSelect').append( volumeBrowser.$dom )
      
      return
    }
  }

  root.VIDEO_APP = VIDEO_APP
})(window)
