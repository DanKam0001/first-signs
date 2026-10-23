#!/bin/bash
export PATH=$HOME/vega/bin:$PATH
vega virtual-device stop 2>&1 | grep -v vvman | tail -2
pkill -f vega-stub-server.js; sleep 3; pgrep -fa qemu | head -2 || echo "qemu gone"
