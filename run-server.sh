#!/bin/bash

cd "$(dirname "$0")"

python3 -m http.server 2021 --bind 127.0.0.1
