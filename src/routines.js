'use strict'

// functions that use functions from scripts.js to provide higher level routines

const {
  doGc,
  df,
  fetchChannels,
  systemDrv,
  dryRun,
  prefetch,
  build,
  nixosRebuild
} = require('./scripts')

const debug = require('debug')
const log = debug('sunshine:routines')

function gc (config, ui) {
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

  return async () => {
    const res = await doGc(gcParams)
    // TODO: ui
  }
}

// TODO: ui changelog gen
async function systemUpgrade (storage, ui, control, { silentFetch, silentPrepare, silentApplyForNextBoot }) { // eslint-disable-line complexity
  if (storage.upgradeState && storage.upgradeState.started + 24 * 60 * 3600 * 1000 < Date.now()) {
    log('sys upgrade stale, restart')
    storage.upgradeState = null
  }

  const state = storage.upgradeState || {
    started: Date.now()
  }

  log('sys upgrade, started %o', state.started)

  while (true) {
    storage.state = state

    log('doing step %o', state.step)

    switch (state.step || 'init') {
      case 'init': {
        state.step = silentFetch ? 'fetch' : 'fetch_ask'
        break
      }

      case 'fetch_ask': {
        if (!await ui.ask('fetch')) {
          return
        }

        state.step = 'fetch'
        break
      }
      case 'fetch': {
        await control.network(async () => {
          ui.notify('fetch')
          await fetchChannels()
        })

        state.step = 'prepare_drv'
        break
      }

      case 'prepare_drv': {
        state.drv = await systemDrv()
        await control.network(async () => {
          state.dry = await dryRun(state.drv)
        })

        // if nothing to build we don't really have to do anything, nothing changed at all
        state.step = state.dry.built.length ? (silentPrepare ? 'prepare' : 'prepare_ask') : 'end'
        break
      }
      case 'prepare_ask': {
        if (!await ui.ask('build', state.dry)) {
          return
        }

        state.step = 'prepare'
        break
      }
      case 'prepare': {
        if (state.dry.fetched.length) {
          await control.network(async () => {
            await ui.notify('prefetch', state.dry)
            await prefetch(state.dry)
          })
        }
        state.step = 'build_pre'
        break
      }

      case 'build_pre': {
        await ui.notify('build', state.dry)
        await build(state.drv)
        state.step = silentApplyForNextBoot ? 'build_ask' : 'build_boot'
        break
      }
      case 'build_ask': {
        switch (ui.ask('build', state.dry)) {
          case 0: { return } // don't
          case 1: { // on next boot
            state.step = 'build_boot'
            state.buildAsk2Ignore = true
            break
          }
          case 2: {
            state.step = 'build_apply'
            break
          }
          default: {
            throw new TypeError('resp ask build invalid')
          }
        }
        break
      }
      case 'build_boot': {
        await nixosRebuild('boot')
        // TODO: roolback security hook?
        state.step = state.buildAsk2Ignore ? 'end' : 'build_ask2'
        break
      }
      case 'build_ask2': {
        state.step = ui.ask('apply', state.dry) ? 'build_apply' : 'end'
        break
      }
      case 'build_apply': {
        await nixosRebuild('switch')
        state.step = 'end'
        break
      }
      case 'end': {
        ui.notify('update_ok', state.dry)
        log('clear upgrade state')
        storage.upgradeState = null
        return
      }

      default: {
        throw new TypeError(state.step)
      }
    }
  }
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
  spaceThreshold,
  systemUpgrade
}
