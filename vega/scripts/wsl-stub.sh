#!/bin/bash
# Run the Vega stub server (fake phone) on :8790 from its own folder, so it gets ws@8
# (the RN app tree hoists an old ws that has no WebSocketServer).
D=$HOME/vega_apps/fs-stub
mkdir -p $D && cd $D
[ -d node_modules/ws ] || npm install --no-save --no-audit --no-fund ws@8 >/dev/null 2>&1
cp /mnt/d/fs-vega/scripts/vega-stub-server.js /mnt/d/fs-vega/scripts/sync-model.js .
pkill -f vega-stub-server.js 2>/dev/null; sleep 1
MODEL_DIR=$HOME/vega_apps/fs-vega/model-export setsid nohup node vega-stub-server.js "${@:---fake-phone}" --port 8790 > /tmp/stub.log 2>&1 < /dev/null & disown
sleep 2; cat /tmp/stub.log
curl -s -o /dev/null -w "video http %{http_code} %{size_download}B\n" http://localhost:8790/model/videos/milk.mp4
