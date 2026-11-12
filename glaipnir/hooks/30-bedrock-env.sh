#!/usr/bin/env bash
set -euo pipefail

# Run by glaipnir inside the sandbox at start, after 20-vertex-env.sh.
# Gives pi's amazon-bedrock provider credentials without mounting ~/.aws: the
# sandbox profile gets its keys from `bedrock-creds`, a host command (see
# glaipnir.conf CMDS and glaipnir/bedrock-creds/) that only returns the
# temporary keys of the host `bedrock` profile. The AWS SDK calls it again when
# they expire. extensions/bedrock-env.ts sets AWS_PROFILE and AWS_REGION in pi.
# Needs `aws sso login --profile default` on the host.
mkdir -p "$HOME/.aws"
cat > "$HOME/.aws/config" <<'CONF'
[profile bedrock]
region = eu-central-1
credential_process = /usr/local/bin/bedrock-creds
CONF

cp /home/aiuser/pi-config/extensions/bedrock-env.ts "$HOME/.pi/agent/extensions/bedrock-env.ts"
