'use strict'

const cronParser = require('cron-parser')

const debug = require('debug')
const log = debug('sunshine:cron')

const tasks = []

function clock () {
  const time = Date.now()
  tasks.forEach(task => {
    if (task.next < time) {
      log('ping %o', task.id)
      task.ping()
    }
  })
}

setInterval(clock, 1000)

const randSkew = () => Math.random() / 8

module.exports = function createTask (storage, taskId, taskInterval, taskFunction) {
  log('creating task %o', taskId)

  const parsedInterval = () => cronParser.parseExpression(taskInterval)
  const next = () => parsedInterval().next().getTime()
  const nextSkewed = () => next() + Math.floor((next() - parsedInterval().prev().getTime()) * randSkew())

  let lock

  const onCron = async () => {
    if (lock) {
      await lock
    } else {
      lock = _onCron()
      await lock
      lock = null
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
  }

  if (!storage[taskId]) { // on first run, assign next cycle directly to storage
    storage[taskId] = next()
  }

  const task = {
    next: storage[taskId],
    ping: () => {
      task.next = storage[taskId] = nextSkewed() // eslint-disable-line no-multi-assign
      onCron()
    },
    id: taskId
  }

  tasks.push(task)
}
