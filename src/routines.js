'use strict'

// functions that use functions from scripts.js to provide higher level routines

const {
  doGc,
  df
} = require('./scripts')

function gc (config) {
  const gcParams = []
  let cur

  if ((cur = config.keepDays)) {
    gcParams.push('--delete-older-than', `${cur}d`)
  } else {
    gcParams.push('--delete-old')
  }

  if ((cur = config.onLowSpace)) {
    gcParams.push('--max-free', cur)
  }

  return () => doGc(gcParams)
}

function spaceThreshold (threshold, location, onBelow) {
  return async () => {
    const curSpace = await df(location, 'avail', true) * 1024 // is given in mb
    if (curSpace < threshold) {
      return onBelow()
    }
  }
}

module.exports = {
  gc,
  spaceThreshold
}
