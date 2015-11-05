#!/usr/bin/env node

var cli = require('nomnom')

cli.option('input', { abbr: 'i'
                    , help: "input value"
                    })

cli.command('abc')
.option('foo', { abbr: 'f'
               , flag: true
               , help: "foo option"
               })

cli.command('def')
.option('bar', { abbr: 'b'
               , flag: true
               , help: "bar option"
               })

var opts = cli.parse()

console.log(opts)
