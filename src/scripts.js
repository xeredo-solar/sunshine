'use strict'

// every function that directly uses a script

const fs = require('fs')
const path = require('path')
const scriptrr = require('scriptrr')
const scriptCtx = (options = {}) =>
  scriptrr({
    files: [path.join(__dirname, 'scripts', '*.sh')],
    showOutput: true,
    options
  })

const scripts = scriptCtx()/* ({
  env: Object.assign(Object.assign({}, process.env), {
    HOME: '/root',
    NIX_PATH: '/root/.nix-defexpr/channels:' + process.env.NIX_PATH
  })
}) */

const {
  read,
  processDryRun,
  withTmp,
  mkTmp,
  cacheTmp,
  clear
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
      HOME: user.home,
      NIX_PATH: user.home + '/.nix-defexpr/channels'
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

  upgradeNixEnv (user) {
    return users[user].nixEnvUpdate()
  },

  async systemDrv () {
    const tmp = mkTmp()
    await scripts.instantiateSystem(tmp.p)
    return {
      drv: fs.realpathSync(tmp.p),
      clear: tmp.c
    }
  },

  async prefetch (dry) {
    const { arg, clear } = cacheTmp()
    await scripts.prefetch(arg, ...dry.fetched)
    return clear
  },

  async build (...drv) {
    const { arg, clear } = cacheTmp()
    await scripts.build(arg, ...drv)
    return clear
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
  },

  clear
}
