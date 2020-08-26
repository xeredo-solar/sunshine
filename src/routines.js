'use strict'

// functions that use functions from scripts.js to provide higher level routines

/* eslint-disable require-atomic-updates */

const {
  doGc,
  df,
  fetchChannels,
  systemDrv,
  dryRun,
  prefetch,
  build,
  nixosRebuild,
  getUsers,
  dryRunNixEnv,
  upgradeNixEnv
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
    storage.upgradeState = state

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
          state.dry = await dryRun(state.drv.drv)
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
            state.prefetchClear = await prefetch(state.dry)
          })
        }
        state.step = 'build_pre'
        break
      }

      case 'build_pre': {
        await ui.notify('build', state.dry)
        state.buildClear = await build(state.drv.drv)
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
        if (state.prefetchClear) state.prefetchClear()
        if (state.buildClear) state.buildClear()
        if (state.drv) state.drv.clear()
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

async function userUpgrade (storage, ui, control, { silentFetch, silentPrepare, silentApply }, user) { // eslint-disable-line complexity
  const key = user + '_userUpgradeState'

  if (storage[key] && storage[key].started + 24 * 60 * 3600 * 1000 < Date.now()) {
    log('user upgrade stale, restart')
    storage[key] = null
  }

  const state = storage[key] || {
    started: Date.now()
  }

  log('sys upgrade, started %o', state.started)

  while (true) {
    storage[key] = state

    log('doing step %o', state.step)

    switch (state.step || 'init') {
      case 'init': {
        state.step = silentFetch ? 'fetch' : 'fetch_ask'
        break
      }

      case 'fetch_ask': {
        if (!await ui.ask('user_fetch', user)) {
          return
        }

        state.step = 'fetch'
        break
      }
      case 'fetch': {
        await control.network(async () => {
          ui.notify('user_fetch', user)
          await fetchChannels(user)
        })

        state.step = 'prepare_drv'
        break
      }

      case 'prepare_drv': {
        await control.network(async () => {
          state.dry = await dryRunNixEnv(user)
        })

        // if nothing to build we don't really have to do anything, nothing changed at all
        state.step = state.dry.built.length ? (silentPrepare ? 'prepare' : 'prepare_ask') : 'end'
        break
      }
      case 'prepare_ask': {
        if (!await ui.ask('user_build', user, state.dry)) {
          return
        }

        state.step = 'prepare'
        break
      }
      case 'prepare': {
        if (state.dry.fetched.length) {
          await control.network(async () => {
            await ui.notify('user_prefetch', user, state.dry)
            state.prefetchClear = await prefetch(state.dry)
          })
        }
        state.step = silentApply ? 'build' : 'build_ask'
        break
      }

      case 'build_pre': {
        state.buildClear = await build(...state.dry.built)
        state.step = 'build_ask'
        break
      }
      case 'build_ask': {
        if (!ui.ask('user_build', user, state.dry)) {
          return
        }

        state.step = 'build'
        break
      }
      case 'build': {
        ui.notify('user_build', state.dry)
        await upgradeNixEnv(user)
        state.step = 'end'
        break
      }
      case 'end': {
        if (state.prefetchClear) state.prefetchClear()
        if (state.buildClear) state.buildClear()
        ui.notify('user_update_ok', state.dry)
        log('clear user upgrade state')
        storage[key] = null
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
  systemUpgrade,
  userUpgrade,
  getUsers
}
