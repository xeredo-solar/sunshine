{ mkNode, nodejs-14_x }:
let
  makeNode = mkNode {
    root = ./.;
    nodejs = nodejs-14_x;
  };
in makeNode { }
