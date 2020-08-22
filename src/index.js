'use strict'

const path = require('path')
const scripts = require('scriptrr')({
  files: [path.join(__dirname, 'scripts', '*.sh')],
  showOutput: true,
  options: {}
})

const debug = require('debug')
const log = debug('sunshine')

const cron = require('node-cron')
const cronParser = require('cron-parser')

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
      console.error(error.stack.toString())
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

function spaceThreshold (threshold, location, onBelow) {
  return async () => {

  }
}

function setupGc (config, storage) {
  config = config.system.gc

  let cur

  const gcParams = []

  if ((cur = config.keepDays)) {
    gcParams.push('--delete-older-than', `${cur}d`)
  } else {
    gcParams.push('--delete-old')
  }

  if ((cur = config.onLowSpace)) {
    gcParams.push('--max-free', cur)
  }

  const doGc = () => scripts.collectGarbage(...gcParams)

  if ((cur = config.onInterval)) {
    if (cur === true) cur = '0 0 * * *'
    createTask(storage, 'system.gc.daily', cur, doGc)
  }

  if ((cur = config.onLowSpace)) {
    createTask(storage, 'system.gc.lowSpace', '0 */5 * * *', spaceThreshold(cur, '/nix/store', gcParams))
  }
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

module.exports = async config => {
  if (process.getuid()) { // non-root, abort
    throw new Error("Running as non-root user, that doesn't work. If you're worried, use the service module. It's sandboxed!")
  }

  const storage = await Storage() // bla

  console.log(config)

  // let cur

  setupGc(config, storage)
  // setupGc(config, storage, 'user') // TODO: make this yield different jobs that run in user-space
}
