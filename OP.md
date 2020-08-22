# operations

# user

- fetch channels (nix-channels --update)
  - inform about failures
- collect garbage (nix-collect-garbage & nix-collect-garbage --delete-old / nix-collect-garbage --delete-older-than)
- update store-env apps (future)
- update nix-env apps

# system

- fetch channels (nix-channels --update)
  - inform about failures
- collect garbage (nix-collect-garbage & nix-collect-garbage --delete-old / nix-collect-garbage --delete-older-than)
- nixos-rebuild
  - est size and prepare changelog
  - download & build
  - ask for switch
    - switch on reboot
    - switch right now
    - ignore derivation
  - rollback system
