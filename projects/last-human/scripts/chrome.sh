#!/bin/sh
# headless Chromium with software WebGL (SwiftShader via ANGLE) explicitly allowed: this container has no GPU
exec /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell --enable-unsafe-swiftshader "$@"
