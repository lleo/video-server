/*global wrapSelect */
/*
 * NOTE: Remember this is running in the browser.
 */
{
  var idNum = 0
  function newDirNumIds(n) {
    var id
    if (n == undefined) {
      n = idNum
      idNum += 1
    }
    return { dirSelectNumId : "dirSelect-"+n
           , dirDivNumId : "dirDiv-"+n
           }

  }
  function prevDirNumIds() {
    var n = idNum - 1
    return newDirNumIds(n)
  }
  function curIdNum() {
    return idNum
  }
  function resetIdNum(n) {
    return idNum = n || 0
  }
}

var VIDEO_APP = {
  "subdirs" : [],
  "init" : function VIDEO_APP_init(cfg) {
    
    console.log("VIDEO_APP.init(cfg) CALLED")
    console.log(cfg)

    var topDirSelectId = "#topDirSelect"
    /*  var dirs = []
     *  function lookupAjax() {
     *    var val = $(this).val()
     *    console.log(this.value+' change() event called: "'+val+'"')
     *    $.ajax({
     *      url: "lookup",
     *      type: "GET",
     *      data: {
     *        top  : val,
     *        dirs : VIDEO_APP.subdirs
     *      },
     *      success: onDirLookup
     *    })
     *  }
     */
    function lookupAjaxTopChanged() {
      var val = $(this).val()
      console.log("lookupAjaxTopChanged: VIDEO_App.subdirs ="
                 , VIDEO_APP.subdirs)
      console.log("lookupAjaxTopChanged: curIdNum() =", curIdNum())
      if (curIdNum() > 0) {
        VIDEO_APP.subdirs = []
        // remove contents of div#fileSelectDirs
        $("#fileSelectDirs").empty()
        // reset Num Ids
        resetIdNum()
      }
      console.log("lookupAjaxTopChanged: "+this.value
                 +' change() event called: "'+val+'"')
      $.ajax({
        url: "lookup",
        type: "GET",
        data: { top     : val
              , subdirs : VIDEO_APP.subdirs
              },
        success: VIDEO_APP.addFirstDirSelectBox
      })
    }

    $(topDirSelectId).change(lookupAjaxTopChanged)

    return
  },
  "addFirstDirSelectBox": function addFirstDirSelectBox(data) {
    console.log("addFirstDirSelectBox CALLED")
    console.log("addFirstDirSelectBox: data=", data)

    var top   = data.top
    var dirs  = data.dirs
    var files = data.files
    var size  = dirs.length + files.length
    
    var ids = newDirNumIds() //increments curIdNum()
    var curNum = curIdNum() //grab the value 1 at this point
    var dirDivNumId    = ids.dirDivNumId
    var dirSelectNumId = ids.dirSelectNumId

    function lookupAjaxFirstDirChanged() {
      var val = $(this).val()
      console.log("lookupAjaxFirstDirChanged: "+this.value
                 +' change() event called: "'+val+'"')

      console.log("lookupAjaxFirstDirChanged: curNum="+curNum)
      console.log("lookupAjaxFirstDirChanged: curIdNum()="+curIdNum())
      if (curNum < curIdNum()) {
        console.log("lookupAjaxFirstDirChanged: curNum < curIdNum():"
                   +curNum+" < "+curIdNum()
                   )
        var forwardIds = newDirNumIds(curNum)
        console.log("lookupAjaxFirstDirChanged: removing #"+forwardIds.dirDivNumId)
        console.log("lookupAjaxFirstDirChanged: dirDivNumId="+dirDivNumId)

        //this is the meat of the removal
        $('#'+forwardIds.dirDivNumId).remove()

        console.log('lookupAjaxFirstDirChanged: VIDEO_APP.subdirs ='
                   +JSON.stringify(VIDEO_APP.subdirs))
        VIDEO_APP.subdirs.length = curNum-1
        console.log('lookupAjaxFirstDirChanged: VIDEO_APP.subdirs ='
                   +JSON.stringify(VIDEO_APP.subdirs))

        resetIdNum(curNum)
      }

      if ( dirs.some(function(e,i,a) { return e == val }) ) {
        VIDEO_APP.subdirs.push(val)
      
        $.ajax({ url: "lookup"
               , type: "GET"
               , data: { top     : top
                       , subdirs : VIDEO_APP.subdirs
                       }
               , success: VIDEO_APP.addDirSelectBox
               })
        return
      }

      if ( files.some(function(e,i,a) { return e == val }) ) {
        console.log('SELECTED a file = '+JSON.stringify(val))
        return
      }

      throw new Error('selection '+JSON.stringify(val)
                     +' is in neither dirs='+JSON.stringify(dirs)
                     +' nor files='+JSON.stringify(files)
                     )
    }
    
    $('#fileSelectDirs').append(
      '<div id="'+dirDivNumId+'" class="fileselector">'
    )

    $('#'+dirDivNumId).append('<div class="wrapSelect">'
                             +'<select id="'+dirSelectNumId+'" size="'+20
                             +'" class="fileselector"></select>'
                             +'</div>'
                             )

    var i, id
    for (i=0; i<dirs.length; i+=1) {
      id='dirOptionId-'+i
      $('#'+dirSelectNumId).append('<option id="'+id
                                  +'" class="directory" value="'+dirs[i]
                                  +'">'
                                  +dirs[i]+'/'
                                  +'</option>'
                                  )
    }

    for (i=0; i<files.length; i+=1) {
      id='fileOptionId-'+i
      $('#'+dirSelectNumId).append('<option id="'+id
                                  +'" class="file" value="'+files[i]
                                  +'">'
                                  +files[i]
                                  +'</option>'
                                  )
    }

    $('#'+dirSelectNumId).change(lookupAjaxFirstDirChanged)    

    return dirSelectNumId
  },
  "addDirSelectBox": function addDirSelectBox(data) {
    console.log("addDirSelectBox CALLED")
    console.log("addDirSelectBox: data =", data)

    console.log("addDirSelectBox: idNum=", curIdNum())
    console.log("addDirSelectBox: prevDirNumIds:", prevDirNumIds())

    var top   = data.top
    var dirs  = data.dirs
    var files = data.files
    var size  = data.dirs.length + data.files.length

    var prevIds = prevDirNumIds()
    var prevDirDivNumId = prevIds.dirDivNumId

    var ids = newDirNumIds()
    var curNum = curIdNum() //grab the value at this point
    var dirDivNumId    = ids.dirDivNumId
    var dirSelectNumId = ids.dirSelectNumId

    function lookupAjaxDirChanged() {
      var val = $(this).val()
      console.log("lookupAjaxDirChanged: "+this.value
                 +' change() event called: "'+val+'"')

      if (curNum < curIdNum()) {
        console.log("lookupAjaxDirChanged: curNum < curIdNum():"
                   +curNum+" < "+curIdNum()
                   )
        var forwardIds = newDirNumIds(curNum)
        console.log("lookupAjaxDirChanged: removing #"+forwardIds.dirDivNumId)
        console.log("lookupAjaxDirChanged: dirDivNumId="+dirDivNumId)

        //this is the meat of the removal
        $('#'+forwardIds.dirDivNumId).remove()

        console.log('lookupAjaxDirChanged: VIDEO_APP.subdirs ='+JSON.stringify(VIDEO_APP.subdirs))
        VIDEO_APP.subdirs.length = curNum-1
        console.log('lookupAjaxDirChanged: VIDEO_APP.subdirs ='+JSON.stringify(VIDEO_APP.subdirs))

        resetIdNum(curNum)

      }
      
      //test if val is in dirs
      if ( dirs.some(function(e,i,a) { return e == val }) ) {
        VIDEO_APP.subdirs.push(val)

        $.ajax({ url : "lookup"
               , type: "GET"
               , data: { top: top
                       , subdirs: VIDEO_APP.subdirs
                       }
               , success: VIDEO_APP.addDirSelectBox
               })
        return
      }

      if ( files.some(function(e,i,a) { return e == val }) ) {
        console.log('SELECTED a file = "'+JSON.stringify(val))
        return
      }

      throw new Error('selection '+JSON.stringify(val)
                     +' is in neither dirs='+JSON.stringify(dirs)
                     +' nor files='+JSON.stringify(files)
                     )
    }

    $('#'+prevDirDivNumId).append(
      '<div id="'+dirDivNumId+'" class="fileselector">'
    )

    $('#'+dirDivNumId).append('<div class="wrapSelect">'
                             +'<select id="'+dirSelectNumId+'" size="'+20
                             +'" class="fileselector"></select>'
                             +'</div>'
                             )

    var i
    for (i=0; i<dirs.length; i+=1) {
      $('#'+dirSelectNumId).append('<option class="directory" value="'+dirs[i]
                                  +'">'
                                  +dirs[i]+'/'
                                  +'</option>'
                                  )
    }

    for (i=0; i<files.length; i+=1) {
      $('#'+dirSelectNumId).append('<option class="file" value="'+files[i]
                                  +'">'
                                  +files[i]
                                  +'</option>'
                                  )
    }

    $('#'+dirSelectNumId).change(lookupAjaxDirChanged)

    return dirSelectNumId
  }
}

