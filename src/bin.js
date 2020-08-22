'use strict'

const Joi = require('@hapi/joi')

const gc = Joi.object({ // seperate options in user/system override it - upgrade doesn't have this since upgrade works differently (nixos-rebuild vs nix-env)
// NOTE: first we take user.gc & gc for ex, mix them, then Joi.validate, otherwise we end up with the defaults sparkled on both
  onInterval: Joi.or(Joi.boolean().default(true), Joi.string()), // true for daily, otherwise string for interval
  onLowSpace: Joi.number().integer().default(1024 * 1024 * 1024 * 2), // 2gb min free
  keepDerivations: Joi.number().integer().default(2),
  maxFree: Joi.number().integer().default(0)
})

const upgradeCommon = {
  silentFetch: Joi.or(Joi.boolean().default(true), Joi.string()), // fetch channels silently, true (daily) or interval in cron format
  silentPrepare: Joi.boolean().default(true), // note that this will not trigger if we have a pay-per-usage/mobile connection
  forceSilentPrepare: Joi.boolean().default(false), // even run prepare if we are on a paid connection
}

require('mkg-bin-gen')(
  'sunshine',
  {
    validator: Joi.object({
      gc,
      system: Joi.object({
        upgrade: Joi.object({
          ...upgradeCommon,
          silentApplyForNextBoot: Joi.boolean().default(true), // nixos-rebuild boot
          notifyUpdateAvailable: Joi.boolean().default(true), // notify user and let user apply during current boot
          rollbackDetection: Joi.boolean().default(true), // notifi user if we think something went wrong after the update happened (automatic checks failed)
          rollback: Joi.object({
            checks: Joi.object({
              sanityCheck: Joi.boolean().default(true),
              grubFlag: Joi.boolean().default(false) // we'll give it a boot and if it doesn't boot up 3 times until display-manager we'll do a rollback (also should patch the grub config so grub can also catch disasterous kernel updates)
            })
          })
        }),
        gc
      }),
      user: Joi.object({
        upgrade: Joi.object({
          ...upgradeCommon
        }),
        gc
      })
    })
  },
  require('.')
)

