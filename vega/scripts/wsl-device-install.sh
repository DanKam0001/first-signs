#!/bin/bash
# Install + launch First Signs on a REAL Vega Fire TV over TCP/IP (NOT yet run by the agent: needs the user's go-ahead).
# Usage (from Windows): wsl -d Ubuntu -- bash /mnt/d/fs-vega/scripts/wsl-device-install.sh 192.168.0.147
# Prereqs: Developer Mode enabled on the stick; Connection Mode = TCP/IP (port 5555), or `vega exec vda tcpip 5555` over USB once.
set -e
export PATH=$HOME/vega/bin:$PATH
IP=${1:-192.168.0.147}
cd $HOME/vega_apps/fs-vega
vega exec vda connect $IP:5555
vega device list
SERIAL=$IP:5555
vega device -d $SERIAL install-app --packagePath build/armv7-release/firstsigns_armv7.vpkg
vega device -d $SERIAL launch-app --appName com.dankam.firstsigns.main
vega device -d $SERIAL running-apps | grep firstsigns || true
