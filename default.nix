let
  solaros = (builtins.fetchTarball https://nix.ssd-solar.dev/dev/solaros/nixexprs.tar.xz);
in
with (import "${solaros}/dev.nix");
callPackage ./package.nix {
  mkNode = callPackage "${nixNodePackage}/nix/default.nix" { };
}
