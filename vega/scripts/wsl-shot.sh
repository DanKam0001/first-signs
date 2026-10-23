#!/bin/bash
# Screenshot the VVD via its Android-emulator console (127.0.0.1:5554). Usage: wsl-shot.sh <name>  -> /mnt/d/fs-vega/shots/<name>.png
OUT=/mnt/d/fs-vega/shots; mkdir -p $OUT; TMP=$(mktemp -d)
python3 - "$TMP" <<'PY'
import socket,sys,time,os
tok=open(os.path.expanduser('~/.emulator_console_auth_token')).read().strip()
s=socket.create_connection(('127.0.0.1',5554),timeout=10)
def rd():
    time.sleep(0.4); 
    try: return s.recv(65536).decode(errors='ignore')
    except Exception: return ''
rd(); s.sendall(f'auth {tok}\n'.encode()); rd()
s.sendall(f'screenrecord screenshot {sys.argv[1]}\n'.encode()); time.sleep(2); rd(); s.sendall(b'quit\n')
PY
f=$(ls -t $TMP/*.png 2>/dev/null | head -1)
[ -n "$f" ] && cp "$f" "$OUT/$1.png" && echo "$OUT/$1.png" || echo "no screenshot"
rm -rf $TMP
