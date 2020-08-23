'use strict'

// every function that directly uses a script

const path = require('path')
const scripts = require('scriptrr')({
  files: [path.join(__dirname, 'scripts', '*.sh')],
  showOutput: true,
  options: {}
})

const {
  processDryRun,
  withTmp
} = require('./util')

module.exports = {
  async dryRun (drv) {
    return processDryRun(
      await withTmp(p => scripts.dryRun(drv, p))
    )
  },

  async dryRunNixEnv () {
    return processDryRun(
      await withTmp(p => scripts.dryRunNixEnvUpdate(p))
    )
  },

  async systemDrv () {
    const pathList = await withTmp(p => scripts.instantiateSystem(p))
    return pathList.split('\n').filter(str => str.startsWith('/nix')).pop().trim()
  },

  async prefetch (dry) {
    await scripts.prefetch(...dry.fetched)
  },

  doGc (params) {
    return scripts.collectGarbage(...params)
  },

  async df (loc, field, isNum) {
    let out = await withTmp(p => scripts.df(loc, field, p))
    out = out.replace(/\n/g, '').trim()
    return isNum ? parseFloat(out, 10) : out
  }
}
