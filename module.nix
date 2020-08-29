{ lib, pkgs, config, ... }:

with lib;

let
  cfg = config.services.sunshine;
in
{
  options = {
    services.sunshine = {
      enable = mkEnableOption "sunshine";
      extraConfig = mkOption {
        type = types.lines;

        default = "";

        example = ''
          gc:
            onInterval: true # true=daily, false=never or string containing cron interval
            onLowSpace: 2147483648 # 2gb, 0 to disable, will trigger every minute and check threshold on /nix/store partition
            keepDays: 7 # how many days to keep old, unused stuff arround for rollbacks
            maxFree: 0 # _only_ free _up to_ this much space, 0=ignore
          system:
            upgrade: # affects nixos-rebuild
              silentFetch: true # fetch channels silently, true=daily false=never or string in cron interval
              silentPrepare: true # prefetch already built derivations from cache but don't build anything just yet, will not run on paid networks (e.g. mobile)
              forceSilentPrepare: false # always run silentPrepare
              silentApplyForNextBoot: true # build with nixos-rebuild boot so update gets applied on next boot
              notifyUpdateAvailable: true # make a notification to apply update during current boot
              rollback:
                checks:
                  sanityCheck: true # perform checks while the system is running
                  grubFlag: false # add settings to grub to auto-rollback
                allowAuto: critical # never, critical, always - change when auto-rollbacks are done
          user:
            upgrade: # affects nix-env
              silentFetch: true # fetch channels silently, true=daily false=never or string in cron interval
              silentPrepare: true # prefetch already built derivations from cache but don't build anything just yet, will not run on paid networks (e.g. mobile)
              forceSilentPrepare: false # always run silentPrepare
          cooldownMsAfterBoot: 18000000 # 5 min
        '';
      };
    };
  };

  config = mkIf cfg.enable {
    systemd.services.sunshine = {
      description = "System update daemon";

      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      environment = {
        SUNSHINE_SYSTEMD = "1";
      };

      path = [ pkgs.sunshine config.nix.package ];

      script = ''
        export HOME=/root
        source /etc/set-environment
        ${pkgs.sunshine}/bin/sunshine
      '';

      serviceConfig = {
        Restart = "on-failure";
        LimitNOFILE = 500000;
        LimitNPROC = 500000;
      };
    };

    environment.etc."sunshine.yaml".text = cfg.extraConfig;
  };
}
