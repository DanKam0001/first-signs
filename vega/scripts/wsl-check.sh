#!/bin/bash
export PATH=$HOME/vega/bin:$PATH
ps aux | grep -i qemu | grep -v grep | wc -l
vega virtual-device status 2>&1 | grep -v vvman | tail -3
cd ~/vega_apps/fs-vega && grep -rlo "192.168.0.60:8788" build/ 2>/dev/null | head -3; grep -rl "10.0.2.2:8790" build/ 2>/dev/null | head -3
