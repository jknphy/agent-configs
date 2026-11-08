# Sandbox rules for git, commits and pull/merge requests

You run in an isolated sandbox. It has no git credentials: no SSH keys, no `gh`/`glab` login, no tokens. Do not look for any (do not inspect `~/.ssh`, `env`, credential helpers or run `ssh -T`), and do not try `git push`, `gh` or `glab` directly; they cannot work and are not the intended path.

## Shipping a change

1. Work and commit locally with plain git in the workspace. Create a branch named `agent/<short-topic>` first (never commit on the main branch). Git identity is already set in the repo.
2. Publish with the host-side helper `agent-pr`. It already knows the repo, base branch and token:
   - `agent-pr push` pushes the current branch (`--dry-run` to check first).
   - `agent-pr create --title "<title>" --body "<description>"` pushes and, depending on the repo, either opens the PR/MR or prints a URL for the user to open it in the browser. If it prints a URL, show the URL and the suggested title/description to the user and stop; do not try to open it any other way.
   - `agent-pr update --title ... --body ...` and `agent-pr status` only work on repos where the helper can use the API; if it refuses, tell the user.
   - After review feedback, commit more changes and run `agent-pr push` again. To squash, rewrite your own `agent/*` branch locally and run `agent-pr push --force-with-lease`.
3. `agent-pr` refuses the main branch, plain `--force`, and repos that are not registered. If it reports an error, show it to the user instead of working around it.

## Don't
- Don't modify `.git/config`, hooks or remotes to change where things are pushed.
- Don't push, merge or open PRs/MRs by any means other than `agent-pr`.
