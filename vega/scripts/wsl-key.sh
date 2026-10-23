#!/bin/bash
# Press remote keys on the VVD: wsl-key.sh dpad_down dpad_center back ...   (optional last arg shot:<name>)
export PATH=$HOME/vega/bin:$PATH
for k in "$@"; do
  case $k in
    shot:*) bash /mnt/d/fs-vega/scripts/wsl-shot.sh "${k#shot:}";;
    wait:*) sleep "${k#wait:}";;
    *) vega exec vda shell "inputd-cli button_press $k" 2>&1 | grep -v vvman | grep -iv "^$" | head -2; sleep 0.8;;
  esac
done
