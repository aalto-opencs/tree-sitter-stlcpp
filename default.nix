{
  sources ? import ./npins,
  system ? builtins.currentSystem,
  pkgs ? import sources.nixpkgs {
    inherit system;
    config = { };
    overlays = [ ];
  },
}:
{
  packages.tree-sitter-stlcpp = pkgs.callPackage ./package.nix { };

  shell = pkgs.mkShell {
    packages = with pkgs; [
      tree-sitter
      nodejs_22
    ];
  };
}
