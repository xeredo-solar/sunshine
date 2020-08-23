{ mkNode }:
let
  makeNode = mkNode {{
    root = ./.;
    nodejs = pkgs.nodejs-14_x;
  };
in makeNode { }
