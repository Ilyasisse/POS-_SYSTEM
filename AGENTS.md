# Project Agent Instructions

These instructions apply to every agent working anywhere in this repository.

## Branches and worktrees

- Do not perform agent work directly in the user's primary checkout.
- Before making changes, inspect `git status --short --branch` and `git worktree list --porcelain`. Preserve all existing user changes and unrelated worktrees.
- Create each task branch with the `codex/` prefix, for example `codex/fix-order-totals`.
- Create the task checkout inside this repository at `.codex/worktrees/<task-slug>`. Do not create project worktrees in AppData, a system temporary directory, the desktop, or another external path.
- From the repository root, use a command shaped like:

  ```powershell
  git worktree add ".codex/worktrees/<task-slug>" -b "codex/<task-slug>" main
  ```

- Use a unique task slug and verify that neither the branch nor destination already exists before creating it.

## Worktree dependencies and environment

- Give every worktree its own physical `node_modules` directory by running `npm ci` inside that worktree.
- Never junction or symlink `node_modules` from another checkout. Turbopack rejects dependency links that resolve outside the active project root.
- Give every worktree its own ignored `.env` file when the application requires one. Copy it from an authorized local source without displaying secrets, and never commit `.env` contents.
- Keep generated dependencies, `.next`, logs, caches, and other ignored runtime artifacts out of Git.

## Finishing and removing worktrees

- Confirm the task branch is committed and merged before cleanup. Use `git merge-base --is-ancestor <branch> <target>` when appropriate.
- Remove a live worktree with `git worktree remove ".codex/worktrees/<task-slug>"`. Do not manually delete its directory in File Explorer or with filesystem removal commands.
- After removal, run `git worktree prune --dry-run --verbose`, inspect the proposed cleanup, and then run `git worktree prune --verbose` if it is safe.
- Delete the local branch with `git branch -d codex/<task-slug>` only after it is merged.
- Delete the remote branch only after its pull request is merged and the user wants it removed, then run `git fetch --prune`.
- Never use `git branch -D`, force-remove a worktree, delete Git metadata manually, or discard uncommitted changes without explicit user approval.

## Safety checks

- Treat the primary checkout and every other registered worktree as user-owned state.
- Do not stage, commit, move, or modify unrelated files.
- Before finishing, verify `git status`, `git diff --check`, and `git worktree list` so the task contains only intended changes and no stale registrations.
