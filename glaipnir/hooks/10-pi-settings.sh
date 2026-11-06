#!/usr/bin/env bash
set -euo pipefail
 
# Run by glaipnir inside the sandbox at start: apply the host-managed pi
# settings. /home/aiuser/pi-config is a read-only mount of
# ~/Code/agent-configs/pi-settings.
mkdir -p "$HOME/.pi/agent"
cp /home/aiuser/pi-config/settings.json "$HOME/.pi/agent/settings.json"
cp /home/aiuser/pi-config/models.json "$HOME/.pi/agent/models.json"

mkdir -p "$HOME/.pi/agent/extensions/pi-permission-system"
cp /home/aiuser/pi-config/pi-permission-system/config.json "$HOME/.pi/agent/extensions/pi-permission-system/config.json"

mkdir -p "$HOME/.config/ponytail"
cp /home/aiuser/pi-config/ponytail/config.json "$HOME/.config/ponytail/config.json"
