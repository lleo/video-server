#!/usr/bin/env node

var cli = require('commander')
  , async = require('async')
  , u = require('lodash')
  , path = require('path')
  , fs = require('fs')
  , cp = require('child_process')

var generic_options = {  xSize: { abbr: 'x'
                                , full: 'x-size'
                                , metavar: 'PIXELS'
                                , default: '800'
                                , help: "number of pixels wide"
                                }
                      , 'twopass': { abbr: '2'
                                   , full: '2pass'
                                   , flag: true
                                   , default: false
                                   , help: "use 2pass encoding"
                                   }
                      }
  , mp4_options = u.extend({}, generic_options
                          //, {}
                          )
  , webm_options = u.extend({}, generic_options
                           , { cpuUsed: { full: 'cpu-used'
                                        , 'default': "0"
                                        , metavar: "NUM"
                                        , help: "number 0-5 (higher quicker/low-res"
                                        }
                           })
  , ogg_options = u.extend({}, generic_options
                          , { maxQuality: { full: 'max'
                                          , flag : true
                                          , help: "set global_quality 10; 10=max"
                                          }
                            })

nomnom.script('trans.js')
.options({ inputFile: { abbr: 'i'
                      , full: 'input-file'
                      , metavar: 'FILE'
                      , help: "input file to ffmpeg"
                      }
         , outputDir: { abbr: 'd'
                      , full: 'output-dir'
                      , metavar: 'DIR'
                      , help: "destination directory of the output file"
                      }
         })


//.options(mp4_options)
console.log(mp4_options.xSize)

nomnom.command('mp4')
.option('xSize', mp4_options.xSize)
.option('twopass', mp4_options.twopass)


//nomnom.command('webm')
//.options(webm_options)
//
//
//nomnom.command('ogg')
//.options(ogg_options)


var opts = nomnom.parse()

console.log(mp4_options)
console.log(opts)

var outfmt = opts.command
  , inputfn = opts.inputFile
  , basefn = path.basename(opts.inputFile)
  , ext = path.extname(basefn)
  , base = path.basename(basefn, ext)
  , outdir = opts.outputDir
  , outparts = [base ]

console.log("outdir: %s base: %s; ext: %s", outdir, base, ext)

var outputfn = path.join(outdir, base+"."+outfmt)

console.log("input file: %s", inputfn)
console.log("output file: %s", outputfn)
