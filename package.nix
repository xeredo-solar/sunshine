{ mkNode, nodejs-14_x }:
let
  makeNode = mkNode {
    root = ./.;
    nodejs = nodejs-14_x;
  };
in makeNode {
  preBuild = ''
    opName="node_modules/.bin/opencollective-postinstall"
    opDirs=("$out/$opName" "$out/$opName")
    (
      while sleep .1s; do
        for p in ''${opDirs[*]}; do
          (echo true > $p) 2>/dev/null || true
        done
      done
    ) & opPid=$!
  '';

  postDist = ''
    kill $opPid
  '';
}
