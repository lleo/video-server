/*
 * NOTE: Remember this is running in the browser.
 */


var VIDEO_APP = {
  "init" : function init(cfg) {
    //console.log("HERE FROM VIDEO_APP.init()")
    console.log("VIDEO_APP.init(cfg) CALLED")
    console.log(cfg)

    var topDirSelectId = "#topDirSelect"
    var dirs = []

    //console.log(topDirSelectOptionIds)

    $(topDirSelectId).change(function() {
      var val = $(topDirSelectId).val()
      console.log(topDirSelectId+" change() event called: \""+val+'"')
      $.ajax({
        url: "lookup",
        type: "GET",
        data: {
          top  : val,
          dirs : dirs
        },
        success: function(data, status, jqXHR){
          console.log("SUCCESS")
          console.log("data: ", data)
          console.log("status: ", status)
        }
      })
    })
    
  }
}