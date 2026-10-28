#!/usr/bin/env bash
# Rebuild js/family-tree.js from src/family-tree.jsx (JSX to plain JS, minified, with a source map).
# The family page used to compile this in the browser with Babel (2.3MB); now it ships 6KB.
set -euo pipefail
npx --yes esbuild@0.24.0 src/family-tree.jsx --loader:.jsx=jsx --jsx=transform --target=es2018 \
  --minify --sourcemap --outfile=js/family-tree.js
