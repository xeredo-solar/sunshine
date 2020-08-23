'use strict'

// every function that directly uses a script

const path = require('path')
const scriptrr = require('scriptrr')
const scriptCtx = (options = {}) =>
  scriptrr({
    files: [path.join(__dirname, 'scripts', '*.sh')],
    showOutput: true,
    options
  })

const scripts = scriptCtx()

const {
  read,
  processDryRun,
  withTmp
} = require('./util')

const users = {}

read('/etc/passwd').split('\n').filter(l => Boolean(l.trim())).map(l => {
  const [name, pw, uid, gid, comment, home, shell] = l.split(':')
  return {
    name,
    pw: pw === 'x' ? true : pw || false,
    uid: parseInt(uid, 10),
    gid: parseInt(gid, 10),
    comment,
    home,
    shell
  }
}).filter(({ uid, home, shell }) =>
  uid >= 1000 && home.startsWith('/home') && !shell.endsWith('nologin')
).forEach(user => {
  users[user.name] = scriptCtx({
    cwd: user.home,
    uid: user.uid,
    gid: user.gid,
    env: Object.assign(Object.assign({}, process.env), {
      HOME: user.home
    })
  })
})

module.exports = {
  getUsers () {
    return Object.keys(users)
  },

  async dryRun (drv) {
    return processDryRun(
      await withTmp(p => scripts.dryRun(drv, p))
    )
  },

  async dryRunNixEnv (user) {
    return processDryRun(
      await withTmp(p => users[user].dryRunNixEnvUpdate(p))
    )
  },

  async systemDrv () {
    const pathList = await withTmp(p => scripts.instantiateSystem(p))
    return pathList.split('\n').filter(str => str.startsWith('/nix')).pop().trim()
  },

  async prefetch (dry) {
    await scripts.prefetch(...dry.fetched)
  },

  async build (...drv) {
    await scripts.build(...drv)
  },

  async nixosRebuild (op) {
    await scripts.nixosRebuild(op)
  },

  fetchChannels (user) {
    const s = user ? users[user] : scripts

    return s.channelFetch()
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
