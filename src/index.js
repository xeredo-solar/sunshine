'use strict'

const debug = require('debug')
const log = debug('sunshine')

const cron = require('node-cron')
const cronParser = require('cron-parser')

const {
  gc,
  spaceThreshold,
  systemUpgrade
} = require('./routines')

function createTask (storage, taskId, taskInterval, taskFunction) {
  log('creating task %o', taskId)

  const lastCycle = storage[taskId] || Date.now() // first time init shouldn't "blow up"
  const parsedInterval = cronParser.parseExpression(taskInterval)

  let lock

  const onCron = async () => {
    if (lock) {
      await lock
    } else {
      lock = _onCron()
    }
  }

  const _onCron = async () => {
    try {
      log('running %o', taskId)
      await taskFunction()
      log('finished %o', taskId)
    } catch (error) {
      console.error(error.stack.toString()) // eslint-disable-line no-console
      setTimeout(onCron, 3600 * 1000 * 5) // 5min cooldown, TODO: exponential backoff
      return
    }

    log('%o success', taskId)
    storage[taskId] = Date.now()
  }

  if (parsedInterval.prev().getTime() > lastCycle) {
    log('immediate scheudling')
    onCron()
  }

  return cron.schedule(taskInterval, onCron, { scheduled: true })
}

function Storage (path) {
  const data = {} // TODO: read initially from disk

  const queueSave = () => {}

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

  const storage = await Storage() // bla

  setupGc(config, storage)
  setupSystemUpgrade(config, storage)
  // setupUserUpgrade()
  // await systemUpgrade(storage, ui, control, config.system.upgrade)
}
