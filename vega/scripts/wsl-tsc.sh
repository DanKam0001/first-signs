#!/bin/bash
export PATH=$HOME/vega/bin:$PATH
SRC=/mnt/d/fs-vega
DST=$HOME/vega_apps/fs-vega
rsync -a --delete --exclude node_modules --exclude build --exclude buildinfo.json --exclude model-export --exclude '*.vpkg' $SRC/ $DST/
cd $DST && npx tsc --noEmit -p . 2>&1 | head -60
