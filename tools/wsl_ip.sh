#!/bin/sh
set -e

# Return first non-loopback IPv4 address.
ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -n1
