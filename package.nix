let
  pkgs = import <nixpkgs> {};
  nixNodePackage = builtins.fetchGit {
    url = "git@github.com:mkg20001/nix-node-package";
    rev = "6ece1177d0c0b8aca1a983744099235f4191d735";
  };
  makeNode = import "${nixNodePackage}/nix/default.nix" pkgs {
    root = ./.;
    nodejs = pkgs.nodejs-14_x;
  };
in makeNode { }
