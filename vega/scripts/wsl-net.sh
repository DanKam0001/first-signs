export PATH=$HOME/vega/bin:$PATH
vega exec vda shell "ip route; ip -4 addr | grep inet; (curl -s -m 3 -o /dev/null -w '%{http_code} 172\n' http://172.21.189.78:8790/ || echo no172); (curl -s -m 3 -o /dev/null -w '%{http_code} 10.0.2.2\n' http://10.0.2.2:8790/ || echo no10); (curl -s -m 4 -o /dev/null -w '%{http_code} win8788\n' http://192.168.0.60:8788/healthz || echo nowin)" 2>&1 | grep -v vvman
