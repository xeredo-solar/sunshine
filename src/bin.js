'use strict'

const Joi = require('joi')

const gc = Joi.object({ // seperate options in user/system override it - upgrade doesn't have this since upgrade works differently (nixos-rebuild vs nix-env)
  onInterval: Joi.alternatives().try(Joi.boolean().default(true), Joi.string()), // true for daily, otherwise string for interval
  onLowSpace: Joi.number().integer().default(1024 * 1024 * 1024 * 2), // 2gb min free
  keepDays: Joi.number().integer().default(2),
  maxFree: Joi.number().integer().default(0)
})

const upgradeCommon = {
  silentFetch: Joi.alternatives().try(Joi.boolean().default(true), Joi.string()), // fetch channels silently, true (daily) or interval in cron format
  silentPrepare: Joi.alternatives().try(Joi.boolean().default(true), Joi.string()), // note that this will not trigger if we have a pay-per-usage/mobile connection
  forceSilentPrepare: Joi.boolean().default(false) // even run prepare if we are on a paid connection
}

// TODO: instead of the silent settings we should have e.g. "fetch" => "notifi"/"silent"/false (tho currently silent can be interpreted as that)
// TODO: system.gc is the only one that's needed since newer nix

const validateReal = Joi.object({
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
        }),
        allowAuto: Joi.string().valid('never', 'critical', 'always')
      })
    }),
    gc
  }),
  user: Joi.object({
    upgrade: Joi.object({
      ...upgradeCommon
    }),
    gc
  }),
  cooldownMsAfterBoot: Joi.number().integer().min(0).max(3600 * 60 * 1000).default(3600 * 5 * 1000) // 5 mins after boot first run
})

require('mkg-bin-gen')(
  'sunshine',
  {
    validator: {
      validate: obj => {
      // NOTE: first we take user.gc & gc for ex, mix them, then Joi.validate, otherwise we end up with the defaults sparkled on both

        if (obj.gc && obj.system.gc) {
          obj.system.gc = Object.assign(Object.assign({}, obj.gc), obj.system.gc)
        }

        if (obj.gc && obj.user.gc) {
          obj.user.gc = Object.assign(Object.assign({}, obj.gc), obj.user.gc)
        }

        return validateReal.validate(obj)
      }
    }
  },
  require('.')
)
