# Hard-restart the VVD and verify it really stopped first.
export PATH=$HOME/vega/bin:$PATH
vega virtual-device stop 2>&1 | grep -v vvman | tail -1
for i in $(seq 1 20); do vega virtual-device status 2>&1 | grep -q '"running":false' && break; sleep 3; done
pgrep -f qemu-system >/dev/null && { echo "qemu still alive, killing"; pkill -f qemu-system; sleep 5; }
vega virtual-device status 2>&1 | grep -v vvman | tail -1
bash /mnt/d/fs-vega/scripts/wsl-vvd-up.sh
