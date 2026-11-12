# Agent Configurations

Centralized configuration repository for AI coding agents (specifically [Pi / Pi-Bolt](https://github.com/opensec-git/Pi-Bolt)) tailored for running inside isolated **Glaipnir** sandboxes.

---

## Overview

This repository manages agent settings, model overrides, skills, and safety permissions on the host and automatically provisions them inside Glaipnir container sandboxes.

### How It Works

1. **Host Source of Truth**: Agent configurations live in `pi-settings/` on the host.
2. **Read-Only Mounting**: Glaipnir mounts `pi-settings/` into the sandbox at `/home/aiuser/pi-config:ro` via `glaipnir/glaipnir.conf`.
3. **Startup Hook**: A Glaipnir lifecycle hook (`glaipnir/hooks/10-pi-settings.sh`) runs inside the sandbox at startup and copies the read-only templates to their active locations (`~/.pi/agent/`, `~/.config/ponytail/`).
4. **Safety & Isolation**: Sandboxed agents cannot accidentally overwrite or corrupt host templates, while keeping all settings version-controlled.

---

## Repository Structure

```text
agent-configs/
├── .gitignore
├── README.md
├── glaipnir/
│   ├── glaipnir.conf            # Glaipnir sandbox settings (agent selection, host mounts)
│   ├── glaipnir-herdr           # Wrapper: runs glaipnir, then releases the herdr pane
│   ├── bedrock-creds/
│   │   └── bedrock-creds        # Host-side helper: temporary keys of the `bedrock` AWS profile only
│   └── hooks/
│       ├── 10-pi-settings.sh    # Startup hook provisioning configs inside the sandbox
│       ├── 20-vertex-env.sh     # Vertex env handling and gemini wrapper
│       └── 30-bedrock-env.sh    # Sandbox AWS profile that gets its keys from bedrock-creds
└── pi-settings/
    ├── extensions/
    │   ├── bedrock-env.ts       # Selects the bedrock AWS profile and region in pi
    │   ├── vertex-env.ts        # Sets the Vertex project/region in pi
    │   └── herdr-sandbox-state.ts  # Reports pi state to herdr through the glaipnir proxy
    ├── AGENTS.md                # Sandbox rules for the agent: how to commit and use agent-pr
    ├── settings.json            # Core Pi agent settings, enabled models, and packages/skills
    ├── models.json              # Provider & model overrides (Vertex context windows, Bedrock models missing from the catalog)
    ├── pi-permission-system/
    │   └── config.json          # Granular security policies & command guardrails
    └── ponytail/
        └── config.json          # Configuration for the ponytail skill
```

---

## Configurations & Extensions

### 1. Pi Agent Settings (`pi-settings/settings.json`)
- **Default Provider & Model**: Amazon Bedrock (`global.anthropic.claude-sonnet-5-5`), with Gemini, Vertex Claude and Bedrock Sonnet/Haiku/Opus 5.5 enabled.
- **Compaction**: Automatic context compaction enabled (`reserveTokens: 64000`, `keepRecentTokens: 40000`).
- **Installed Packages & Skills**:
  - `@gotgenes/pi-permission-system`: Fine-grained tool and command execution guardrails.
  - `@dietrichgebert/ponytail`: Pragmatic, minimalist senior developer mode skill.
  - `openQA-skill`: openQA test development, triage, and debugging skill.
  - `pi-open-tui` & `@inobit/pi-themes`: Enhanced TUI experience (Rose Pine theme).
  - `@monotykamary/pi-retry`: Auto-retry policies for transient model errors.
  - `i-have-adhd`: Agent workflow enhancements.

### 2. Model Overrides (`pi-settings/models.json`)
- Expands context window limits for Google Vertex models (`gemini-3.8-flash` and `gemini-3.1-pro-preview` configured for 320,000 tokens).
- Adds `global.anthropic.claude-sonnet-5-5` (1,000,000 tokens) and `global.anthropic.claude-haiku-5-5` (200,000 tokens) to `amazon-bedrock`, because pi's bundled catalog does not list them yet. The context windows are estimates taken from Sonnet 5 and Haiku 4.5; `modelOverrides` ignores unknown IDs, so these need full `models` entries. Remove them once the catalog includes the models. Opus 5.5 is already in the catalog.

### 3. Permission System Guardrails (`pi-settings/pi-permission-system/config.json`)
Enforces strict security boundaries inside the sandbox:
- **Protected Paths**: Denies access to sensitive credentials and dotfiles (`.env`, `~/.ssh/*`, `~/.aws/*`, `*/.git/*`).
- **Command Denylist**: Blocks destructive shell commands (`rm -rf /`, `mkfs`, `dd`, `shutdown`, `reboot`).
- **Interactive Confirmation**: Prompts user confirmation for disruptive Git actions (`git push --force`, `git reset --hard`, `git clean -fd`).
- **Directory Access Control**: Restricts arbitrary external directory writes while allowing sandbox reads.

### 4. Glaipnir Integration (`glaipnir/`)
- `glaipnir.conf`: Configures default agent (`AGENTS=pi`), command whitelists (`CMDS`), and maps host directories:
  ```bash
  RO_MOUNTS=(
      /home/jrivera/Code/agent-configs/pi-settings:/home/aiuser/pi-config:ro
  )
  ```
- `hooks/10-pi-settings.sh`: Ensures sandbox user environment has identical configurations across ephemeral sandbox sessions.

### 5. Safe push and PR/MR from the sandbox (`glaipnir/agent-pr/`)
Glaipnir `CMDS` run on the **host** with prefix matching, so allowlisting `git push` would let the agent push anywhere your credentials reach (and host-side git would run hooks/config planted in the workspace). Instead only `agent-pr` is allowlisted (`CMDS=("agent-pr")`); plain `git add/commit/log/...` works inside the sandbox.

```text
agent-pr push [--dry-run] [--force-with-lease]
agent-pr create --title T [--body B] [--draft]
agent-pr update [--title T] [--body B]
agent-pr status
```

- Acts on the current branch only, which must be `agent/<name>` (never the base branch, hooks disabled). Plain `--force` is not accepted. `push --force-with-lease` is allowed for rewriting the agent's own branch, for example after squashing: it needs the branch to already exist on the remote and leases on the tip the remote has at that moment, so it only protects against a concurrent push, not against overwriting commits you never saw. Squashing at merge time ("Squash and merge") needs no force push at all.
- Repo, base branch and token come from `glaipnir/agent-pr/repos.conf` (host side), not from the workspace's `.git/config`. It refuses to run if the repo-local config sets `url.*`, `http.*` or `credential.*`.
- Each repo has a mode, set in the last column of `repos.conf`:
  - `full`: the agent can also open and edit the PR/MR (`create`, `update`, `status`) through `gh`/`glab`. The token then needs API rights.
  - `push-only`: the agent only pushes. `create` pushes and prints the browser URL where you open the PR/MR yourself (so you can review first); `update` and `status` are refused. Later changes are new commits with `push`, or a squash with `push --force-with-lease`. Use it when the token can't open PRs on the upstream (for example a fork whose upstream is in an org) or when you prefer to open them yourself. The token then only needs push rights.
- One **repo-scoped token** per repo does everything: `git push` over HTTPS, and PR/MR creation through `gh` (GitHub) or `glab` (GitLab). Your own CLI logins, SSH keys and credential helpers are never used. A leaked or misused token can only touch that one repo.
- Branch protection on the base branch is still recommended.

#### Setup on a new machine
1. Install `gh` and/or `glab`, and link the wrapper onto the host `PATH`: `ln -s "$PWD/glaipnir/agent-pr/agent-pr" ~/.local/bin/agent-pr`
2. Create a token for each repo (see below) and store it as `~/.ssh/agent-pr/<name>.token`.
3. Copy `glaipnir/agent-pr/repos.conf.example` to `glaipnir/agent-pr/repos.conf` (git-ignored, because it names your internal hosts and projects) and add a line per repo:
   `<host repo path> <github|gitlab> <host> <upstream owner/repo> <base branch> <token file> [<fork owner/repo> or -] [full|push-only]`
   For a fork, the token belongs to the **fork** (the repo the agent pushes to) and the optional last column holds its path; the PR/MR targets upstream.
4. Set a commit identity in each registered clone, on the host (the sandbox has no global git config, so without it agent commits fail with `unable to auto-detect email address`):
   ```sh
   git -C <clone> config user.name "<your name>"
   git -C <clone> config user.email "<your email>"
   ```
   It is stored in the clone's `.git/config`, which the sandbox sees through the mounted workspace, and it also applies to your own commits there. For a public GitHub repo, the `<id>+<user>@users.noreply.github.com` address keeps your work email out of the history. Verify with `git -C <clone> config --local --get-regexp '^user\.'`.
5. Check it without pushing anything: on a throwaway `agent/test` branch run `agent-pr push --dry-run`.

#### Creating or renewing a token
Name tokens `agent-pr-<short-repo>` (GitHub limits token names to 40 characters), give them a short expiry (e.g. 90 days) and put the renewal date in the description.

- **GitHub** (Settings, Developer settings, Fine-grained tokens): repository access limited to the one repo. Under repository permissions set these to Read and write (Metadata: read is added automatically). `push-only` repos need only **Contents**:
  - **Contents**: needed for `git push`.
  - **Pull requests**: needed for `create`, `update` and `status`. If it is missing, pushing works but opening a PR fails with `Resource not accessible by personal access token (createPullRequest)`. Permissions of an existing token can be edited in place, so the token file stays valid.
- **GitLab** (project, Settings, Access tokens): role Developer. Scope `write_repository` is enough for `push-only` repos; use `api` only for `full` mode (it grants the whole project API). Create it on the project the agent pushes to (the fork, if you use one). Developer cannot push to protected branches, which is the desired guard.

Store the token in a file readable only by you (keeps it out of shell history and out of the repo):
```sh
mkdir -p ~/.ssh/agent-pr && chmod 700 ~/.ssh/agent-pr
install -m 600 /dev/stdin ~/.ssh/agent-pr/<name>.token
```
Paste the token, press Enter, then press **Ctrl-D** (twice if the cursor is not on an empty line) to finish. `install` reads until end-of-input, so nothing happens on Enter alone. The token is visible on screen while you paste it. The wrapper strips trailing whitespace, so a newline in the file is harmless.

To renew, create a new token with the same settings and overwrite the file with the command above; nothing else changes. The wrapper requires the file to be mode 600 and owned by you. To revoke, delete the token on the forge.

### 6. herdr agent status from the sandbox (`glaipnir/glaipnir-herdr`, `pi-settings/extensions/`)
herdr's own pi extension talks to a unix socket and reads `HERDR_*` variables. Neither exists inside the microVM, so the sandboxed pi never shows up in herdr. Instead, `pi-settings/extensions/herdr-sandbox-state.ts` (copied in by the startup hook) runs `herdr` through the Glaipnir proxy, which executes it on the host with the environment of the pane Glaipnir was started from. It is inactive outside the sandbox.

- `glaipnir.conf` allowlists exactly `herdr pane current` (finds the pane), `herdr pane report-agent` (working/idle) and `herdr pane release-agent` (on `/quit`). Prefix matching applies, so those subcommands accept any arguments, including another pane id.
- Start the sandbox with `glaipnir/glaipnir-herdr run pi ...` (same arguments as `glaipnir`; link it onto your `PATH` if you like). After glaipnir exits it releases the pane, which covers a sandbox that is killed before pi can release it. Without it the pane keeps showing `pi`.
- herdr quirks: `release-agent` only parses with the pane id before the options, and both `report-agent` and `release-agent` silently ignore a call whose `--seq` is not above the last one. Both the extension and the wrapper seed `--seq` from the clock in microseconds.
- Debugging: run `export HERDR_SANDBOX_DEBUG=1` in the sandbox before starting pi. Every proxied call and its result is then appended to `~/.pi/agent/herdr-sandbox.log` in the sandbox, which is `~/.cache/glaipnir/agents-mount/.pi/agent/herdr-sandbox.log` on the host.

### 7. Amazon Bedrock from the sandbox (`glaipnir/bedrock-creds/`, `glaipnir/hooks/30-bedrock-env.sh`)
The host `bedrock` profile assumes a role from the SSO `default` profile (PowerUser). Mounting `~/.aws` would hand the sandbox that SSO session, so it is not mounted. Instead the sandbox asks the host for temporary keys through the Glaipnir proxy:

- `glaipnir/bedrock-creds/bedrock-creds` runs on the host and prints the temporary keys of the `bedrock` profile only (`aws configure export-credentials`). It ignores its arguments, because `CMDS` uses prefix matching and the sandbox must not be able to ask for another profile.
- `30-bedrock-env.sh` writes a sandbox `~/.aws/config` with `[profile bedrock]` and `credential_process = /usr/local/bin/bedrock-creds`. The AWS SDK calls it again when the keys expire.
- `extensions/bedrock-env.ts` sets `AWS_PROFILE=bedrock` and `AWS_REGION=eu-central-1` in the pi process.
- One-time setup on the host: `ln -s "$PWD/glaipnir/bedrock-creds/bedrock-creds" ~/.local/bin/bedrock-creds`. Keep the host logged in with `aws sso login`.

### 8. Host `GOOGLE_CLOUD_PROJECT` in the sandbox
Glaipnir copies the host's `GOOGLE_CLOUD_PROJECT` into the container, and only when it creates the container. `20-vertex-env.sh` adds `unset GOOGLE_CLOUD_PROJECT GOOGLE_CLOUD_LOCATION` to the sandbox `~/.bashrc`, so shells stay clean. pi still sets what it needs through `vertex-env.ts`, so `env` run through pi's bash tool still shows them.

---

## Usage

### Updating Configurations
1. Edit the relevant JSON configuration file in `pi-settings/`.
2. Commit and push changes to version control.
3. Restart or start a new Glaipnir sandbox session to apply updates.

### Adapting Host Path
If using a different host username or directory path, update `RO_MOUNTS` in `glaipnir/glaipnir.conf` to match your local clone location:
```bash
RO_MOUNTS=(
    /path/to/your/agent-configs/pi-settings:/home/aiuser/pi-config:ro
)
```
