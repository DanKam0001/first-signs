#!/bin/bash
# Start the VVD (software GL) fully detached (setsid) so it survives the wsl.exe call that launched it,
# then wait for boot + ~25 s settle (FRICTION.md #14).
export PATH=$HOME/vega/bin:$PATH
if vega virtual-device status 2>&1 | grep -q '"running":true'; then echo already running; exit 0; fi
setsid nohup bash $HOME/vega_apps/start_vvd.sh > /tmp/vvd.log 2>&1 < /dev/null &
disown
for i in $(seq 1 80); do grep -q "ready" /tmp/vvd.log && break; sleep 3; done
tail -2 /tmp/vvd.log; sleep 25
vega device list 2>&1 | grep -v vvman
