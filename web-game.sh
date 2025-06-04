#!/bin/bash

# Launch server
node server/server.js &
SERVER_PID=$!

# Launch client
http-server ./client --port 5500 &
CLIENT_PID=$!

# When the script ends, kill both processes
trap "kill $SERVER_PID $CLIENT_PID" EXIT

# Wait until the processes are not completed immediately
wait
