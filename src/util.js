'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const mkdirp = require('mkdirp').sync
const rimraf = require('rimraf').sync

const read = file => String(fs.readFileSync(file))

const TMPDIR = path.join(os.tmpdir(), 'sunshine')
// rimraf(TMPDIR)
mkdirp(TMPDIR)
fs.chmodSync(TMPDIR, 0o777)

const mkTmp = folder => {
  const tmpPath = path.join(TMPDIR, String(Math.random()))

  if (folder) {
    mkdirp(tmpPath)
  }

  return {
    p: tmpPath,
    c: () => rimraf(tmpPath)
  }
}

const units = {
  KiB: 1024,
  MiB: 1024 * 1024,
  GiB: 1024 * 1024 * 1024,
  TiB: 1024 * 1024 * 1024 * 1024
}

function extractCalcUnit (str) {
  let [amount, unit] = str.split(' ')
  amount = parseFloat(amount, 10)
  return amount * 1000 * units[unit] / 1000 // avoid some float-bugs by going up to round numbers, then down again
}

async function withTmp (fnc) {
  const tmp = mkTmp()
  await fnc(tmp.p)
  const out = read(tmp.p)
  tmp.c()
  return out
}

module.exports = {
  read,
  mkTmp,
  withTmp,
  cacheTmp () {
    const tmp = mkTmp(true)
    const arg = path.join(tmp.p, 'cache')
    fs.chmodSync(tmp.p, 0o777)
    return {
      arg,
      clear: tmp.c
    }
  },
  processDryRun (data) {
    const lines = data.split('\n').filter(d => Boolean(d.trim()))

    const out = {
      built: [],
      fetched: [],
      downloadSize: 0,
      unpackSize: 0
    }

    let list

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.startsWith('/nix/store')) {
        if (list === 'built') {
          out.built.push(line)
        } else if (list === 'fetched') {
          out.fetched.push(line)
        } else {
          throw new Error('Parsing exception, nix path without category')
        }
      } else if (line.startsWith('these derivations will be built')) {
        list = 'built'
      } else if (line.startsWith('these paths will be fetched')) {
        list = 'fetched'
        const [, download, unpacked] = line.match(/^.+\((.+), (.+)\):$/i)
        out.downloadSize = extractCalcUnit(download)
        out.unpackSize = extractCalcUnit(unpacked)
      } else if (list) { // if we have garbage in the output, report
        throw new Error('Unexpected ' + line)
      } // otherwise ignore garbage if it's before the output
    }

    return out
  }
}
