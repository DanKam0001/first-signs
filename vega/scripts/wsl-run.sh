#!/bin/bash
# Install + launch the built x86_64 vpkg on the VVD.
export PATH=$HOME/vega/bin:$PATH
cd $HOME/vega_apps/fs-vega
vega run-app build/x86_64-release/firstsigns_x86_64.vpkg com.dankam.firstsigns.main -d VirtualDevice 2>&1 | grep -v vvman | tail -4
