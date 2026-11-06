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
│   └── hooks/
│       └── 10-pi-settings.sh    # Startup hook provisioning configs inside the sandbox
└── pi-settings/
    ├── settings.json            # Core Pi agent settings, enabled models, and packages/skills
    ├── models.json              # Provider & model overrides (e.g., Google Vertex context windows)
    ├── pi-permission-system/
    │   └── config.json          # Granular security policies & command guardrails
    └── ponytail/
        └── config.json          # Configuration for the ponytail skill
```

---

## Configurations & Extensions

### 1. Pi Agent Settings (`pi-settings/settings.json`)
- **Default Provider & Model**: Google Vertex (`gemini-3.8-flash`) with support for Gemini and Claude models.
- **Compaction**: Automatic context compaction enabled (`reserveTokens: 64000`, `keepRecentTokens: 40000`).
- **Installed Packages & Skills**:
  - `@gotgenes/pi-permission-system`: Fine-grained tool and command execution guardrails.
  - `@dietrichgebert/ponytail`: Pragmatic, minimalist senior developer mode skill.
  - `openQA-skill`: openQA test development, triage, and debugging skill.
  - `@raidou/pi-notify`: Desktop notifications for agent events.
  - `pi-open-tui` & `@inobit/pi-themes`: Enhanced TUI experience (Rose Pine theme).
  - `@monotykamary/pi-retry`: Auto-retry policies for transient model errors.
  - `i-have-adhd`: Agent workflow enhancements.

### 2. Model Overrides (`pi-settings/models.json`)
- Expands context window limits for Google Vertex models (`gemini-3.8-flash` and `gemini-3.1-pro-preview` configured for 320,000 tokens).

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
