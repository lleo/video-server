/*global   */

/*
 * GET app page.
 */

var util = require('util')
var u = require('lodash')

var path = require('path')
const MODNAME = path.parse(module.filename).name

function isNonEmptyString(e) {
  if (u.isString(e) && e.length) return true
  return false
}

module.exports = function(req, res, next){
  'use strict';
  var app_cfg = req.app.get('app config by name')

  console.log("%s: app_cfg =", MODNAME, util.inspect(app_cfg, {depth:null}))

  var cfg = { 'title'            : req.app.get('title')
            , 'video root names' : u.clone(app_cfg.order)
            , 'controls config'  :
              { skipForwSecs : app_cfg['skip forward seconds'] || 30
              , skipBackSecs : app_cfg['skip backward seconds'] || 10
              }

              /* cfg['load'] = { 'root'    : 'HDD Videos'
               *               , 'subdirs' : ['Films', 'Harry Potter']
               *               , 'file'    : '1 Harry Potter And The Sorcerer's Stone 2001.mp4'
               *               , 'time'    : 2715
               *               }
               */
            , 'load'             : undefined

              /* From video-app.js:21 or so
               * var levels    = ['info', 'warn', 'crit', 'none', 'error']
               * 'none' is a place holder for no logging except error
               * There is really only three optional levels info, warn, and crit.
               */
            , 'debug'            : 'info'
            }

  console.log('%s: cfg["video root names"] = %j', MODNAME, cfg['video root names'])

  console.log('%s: req.query = %j', MODNAME, req.query)

  var queryOk = (function checkQuery() {
    var load = {}
    var root, subdirs, file, time
    var rootNames = cfg['video root names']
    console.log('%s: checkQuery: req.query == trueish', MODNAME)
    console.log('%s: checkQuery: req.query:\n%s', MODNAME
               , util.inspect(req.query, {depth:null,colors:true}))
    if ( !Object.keys(req.query).length ) {
      console.log('%s: checkQuery: req.query has no keys; fine, skipping the rest of checkQuery.', MODNAME)
      return true
    }

    root = req.query.root
    if (!root) return false
    if ( !rootNames.some(function(e){ return e == root }) ) return false
    load.root = root

    subdirs = req.query.subdirs
    if (!subdirs) return false
    if (!u.isArray(subdirs)) return false
    if ( !subdirs.every(isNonEmptyString) ) return false
    load.subdirs = req.query.subdirs

    file = req.query.file
    if (!file) return false
    if (!isNonEmptyString(file)) return false
    load.file = file

    time = req.query.time
    // we test each false possable except time=0
    if (isNonEmptyString(time) || u.isNumber(time)) {
      if (u.isString(time)) time = parseInt(time, 10)

      if (!isNaN(time)) {
        if (Number.isInteger(time))
          load.time = time
        else {
          load.time = Math.floor(time)
        }
      }
    }

    cfg.load = load

    return true
  })()

  if (!queryOk) {
    console.log('%s: POST checkQuery(): BAD query calling next()', MODNAME)
    next()
    // FIXME: maybe I should do: http status 400 bad client request
    // res.status(400).render('bad_query')
    // and implemnets a nicer looking bad_query.jade
    return
  }
  
  /* FROM the node.js REPL on v5.1.0
   * > rx = /(?:\/\.\.(?![^\/])|^\.\.(?![^\/])|^\.\.$)/
   * /(?:\/\.\.(?![^\/])|^\.\.(?![^\/])|^\.\.$)/
   * > '/..'.match(rx)
   * [ '/..', index: 0, input: '/..' ]
   * > '../'.match(rx)
   * [ '..', index: 0, input: '../' ]
   * > '/../'.match(rx)
   * [ '/..', index: 0, input: '/../' ]  // > '..'.match(rx)
   * [ '..', index: 0, input: '..' ]
   * > '...'.match(rx)
   * null
   * > '..foo'.match(rx)
   * null
   * > 'bar..'.match(rx)
   * null
   * > 'foo/../bar'.match(rx)
   * [ '/..', index: 3, input: 'foo/../bar' ]
   * > 'foo..bar'.match(rx)
   * null
   * > 'foo/..bar'.match(rx)
   * null
   * > 'foo../bar'.match(rx)
   * null
   * > '../foo'.match(rx)
   * [ '..', index: 0, input: '../foo' ]
   * > '../../../../../etc/passwd'.match(rx)
   * [ '..', index: 0, input: '../../../../../etc/passwd' ]
   * > '/../../../../../etc/passwd'.match(rx)
   * [ '/..', index: 0, input: '/../../../../../etc/passwd' ]
   * !!! WE HAVE A WINNER !!!
   */
  // I need a rx that matches a hacker trying to use .. to
  // access files below the video root.
  // 
  // Basically, I wanted /(?![^\/])\.\.(?![^\/])/ using the
  // first (?![^\/]) as a "not preceded by" but it does not
  // work as a "not preceded by" only a "not followed by"
  //
  // This sucessful rx is an non-capturing group of three
  // alternates matches (any where in string)
  //   1 - '/..[not followed by any char but /]'
  //   2 - '[beginning]..[not followed by any char but /]'
  //   3 - '[beginning]..[end]'
  var rx
  if (cfg.load) {
    console.log('%s: cfg.load = %s', MODNAME, util.inspect(cfg.load, {depth:null,colors:true}))
    rx = /(?:\/\.\.(?![^\/])|^\.\.(?![^\/])|^\.\.$)/;
    // http response code 403 == Forbidden
    // see: http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
    for (let subdir of cfg.load.subdirs) {
      console.log('%s: subdir = %j', MODNAME, subdir)
      if (subdir.match(rx)) {
        console.error('%s: %j.match(%s)', MODNAME, subdir, rx.toString())
        res.status(403).end('FUCK OFF')
        return
      }
    }
    //console.log('%s: subdirs passed', MODNAME)
    if (cfg.load.file.match(rx)) {
      console.log('%s: HACKING ATTEMPTY subdir contained ..', MODNAME)
      res.status(403).end('FUCK OFF')
      return
    }
    //console.log('%s: file passed', MODNAME)
  }
  
  console.log("%s: cfg = %j", MODNAME, { cfg: cfg })
  
  res.render('index', { pretty: true, cfg: cfg })
};
