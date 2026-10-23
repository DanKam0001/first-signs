#!/bin/bash
# Sync D:\fs-vega (source of truth) into the WSL build tree and build the .vpkg.
# Usage (from Windows): wsl -d Ubuntu -- bash /mnt/d/fs-vega/scripts/wsl-sync-build.sh [Release|Debug]
set -e
export PATH=$HOME/vega/bin:$PATH
SRC=/mnt/d/fs-vega
DST=$HOME/vega_apps/fs-vega
TYPE=${1:-Release}
mkdir -p $DST
rsync -a --delete --exclude node_modules --exclude build --exclude buildinfo.json --exclude model-export --exclude '*.vpkg' $SRC/ $DST/
cd $DST
if [ ! -d node_modules/@amazon-devices/react-native-w3cmedia ] || [ package.json -nt node_modules/.package-lock.json ]; then
  npm install --fetch-timeout=600000 --fetch-retries=5 --no-audit --no-fund
fi
[ -d node_modules/ws ] || npm install --no-save --no-audit --no-fund ws@8
mkdir -p model-export/videos
cp -u ${FS_MODEL_EXPORT:-$SRC/../model/export}/videos/*.mp4 model-export/videos/ 2>/dev/null || true
npx react-native build-vega --build-type $TYPE 2>&1 | grep -v "vvman" | tail -25
ls -la build/*/*.vpkg 2>/dev/null || find build -name "*.vpkg" | head
