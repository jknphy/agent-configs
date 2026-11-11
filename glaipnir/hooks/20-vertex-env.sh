#!/usr/bin/env bash
set -euo pipefail

# Run by glaipnir inside the sandbox at start, after 10-pi-settings.sh.
# pi's Vertex providers need GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in
# their process env (extensions/vertex-env.ts sets them inside pi and pi-bolt),
# but the Gemini CLI (gemini-acp, a child of pi) breaks if it inherits them: it
# needs its own project from ~/.gemini/.env. So gemini gets a wrapper in
# ~/.local/bin that clears both and restores that project. Credentials (ADC)
# persist in the glaipnir cache mount after a one-time
# `gcloud auth application-default login`. The Vertex project is the key of the
# anthropic-vertex entry in auth.json, set once with `/login anthropic-vertex`.
cp /home/aiuser/pi-config/extensions/vertex-env.ts "$HOME/.pi/agent/extensions/vertex-env.ts"

grep -q '.local/bin' "$HOME/.bashrc" 2>/dev/null ||
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"

# Resolved without ~/.local/bin, so a re-run never wraps the wrapper.
mkdir -p "$HOME/.local/bin"
real_path="$(printf '%s' "$PATH" | tr ':' '\n' | grep -vxF "$HOME/.local/bin" | paste -sd:)"
real_gemini="$(PATH="$real_path" command -v gemini || true)"
if [ -n "$real_gemini" ]; then
    cat > "$HOME/.local/bin/gemini" <<EOF
#!/usr/bin/env bash
project="\$(sed -n 's/^[[:space:]]*GOOGLE_CLOUD_PROJECT[[:space:]]*=[[:space:]]*//p' "\$HOME/.gemini/.env" 2>/dev/null | tail -n 1 | tr -d "\\"' ")"
unset GOOGLE_CLOUD_PROJECT GOOGLE_CLOUD_LOCATION
[ -n "\$project" ] && export GOOGLE_CLOUD_PROJECT="\$project"
exec "$real_gemini" "\$@"
EOF
    chmod +x "$HOME/.local/bin/gemini"
fi
