'use strict'

const debug = require('debug')
const log = debug('sunshine')

const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp').sync

const {
  gc,
  spaceThreshold,
  systemUpgrade,
  userUpgrade,
  getUsers
} = require('./routines')

const createTask = require('./cron')

function Storage (path) {
  log('loading %s', path)

  let data = {}

  try {
    if (fs.existsSync(path)) {
      data = JSON.parse(String(fs.readFileSync(path)))
    }
  } catch (error) {
    log(error)
    log('using blank value')
  }

  let timeout

  function save () {
    log('saving %s', path)
    fs.writeFileSync(path + '~', JSON.stringify(data))
    fs.renameSync(path + '~', path)

    timeout = null
  }

  const queueSave = () => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(save, 5 * 1000)
  }

  return new Proxy(data, {
    get: (target, key) => target[key],
    set: (target, key, value) => {
      target[key] = value
      queueSave()
      return true
    }
  })
}

function setupGc (config, storage) {
  config = config.system.gc

  let cur

  const doGc = gc(config)

  if ((cur = config.onInterval)) {
    if (cur === true) cur = '0 0 * * *'
    createTask(storage, 'system.gc.daily', cur, doGc)
  }

  if ((cur = config.onLowSpace)) {
    createTask(storage, 'system.gc.lowSpace', '0 */5 * * *', spaceThreshold(cur, '/nix/store', doGc))
  }
}

function setupSystemUpgrade (config, storage) {
  config = config.system.upgrade

  let cur

  if ((cur = config.interval)) {
    if (cur === true) cur = '0 0 * * *'
    createTask(storage, 'system.upgrade', cur, () => systemUpgrade(storage, ui, control, config))
  }
}

function setupUserUpgrade (config, storage, user) {
  config = config.user.upgrade

  let cur

  if ((cur = config.interval)) {
    if (cur === true) cur = '0 0 * * *'
    createTask(storage, 'user$' + user + '.upgrade', cur, () => userUpgrade(storage, ui, control, config, user))
  }
}

const ui = { // stub for now
  ask (type, ...params) {
    // int
    return 1
  },
  notify (type, ...params) {
    // bool
    return false
  }
}

const control = { // stub for now
  async network (exec, force) {
    // wait for network, check paid (then wait) or run directly with force, execute "await exec()", if fails check if network available and then restart if netproblem, otherwise rethrow
    await exec()
  }
}

module.exports = async config => {
  if (process.getuid()) { // non-root, abort
    throw new Error("Running as non-root user, that doesn't work. If you're worried, use the service module. It's sandboxed!")
  }

  mkdirp(config.storage)
  const storage = Storage(path.join(config.storage, 'state.json')) // bla

  setupGc(config, storage)
  setupSystemUpgrade(config, storage)
  getUsers().forEach(user => {
    setupUserUpgrade(config, storage, user)
  })

  // await systemUpgrade(storage, ui, control, config.system.upgrade)
}
