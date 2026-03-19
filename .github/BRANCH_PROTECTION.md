# Branch Protection (Lenient Team Preset)

This is the recommended branch/ruleset configuration for this repository.

## Scope

Apply to:
- `main`
- Any long-lived integration branch (optional, same profile)

## Turn On

1. `Require a pull request before merging`
- Required approvals: `1` (recommended) or `0` (most lenient)
- Dismiss stale approvals when new commits are pushed: `On`
- Require review from Code Owners: `Off`
- Require review from specific teams: `Off`
- Require approval of most recent reviewable push: `Off`

2. `Require status checks to pass`
- Require branches to be up to date before merging: `On`
- Required checks:
  - `Backend Tests`
  - `Frontend Lint`
  - `Integration Tests`
  - `Docker Build Test`
  - `Complexity and Security Analysis`

3. `Require conversation resolution before merging`: `On`

4. `Require linear history`: `On`

5. `Block force pushes`: `On`

6. `Automatically request Copilot code review`: `On`
- `Review new pushes`: `On`
- `Review draft pull requests`: `Off`

## Turn Off

- `Restrict creations`
- `Restrict updates`
- `Restrict deletions`
- `Require deployments to succeed` (enable later if you add environment gates)
- `Require signed commits` (optional to add later)
- `Require code scanning results` (enable once CodeQL gating is fully configured)
- `Require code quality results` (enable once a quality gate is selected)

## Allowed Merge Methods

Keep:
- `Squash`
- `Rebase`

Disable:
- `Merge commit`

This aligns with linear history and avoids merge-commit noise.

## Notes

- Copilot reviews are advisory comments only and do not replace human approvals.
- If you pick `0` approvals, merges are still protected by checks + conversation resolution + PR requirement.
- If you want a slightly safer default with minimal friction, use `1` approval.

## Quick Setup Path

1. Repository `Settings` -> `Rules` -> `Rulesets` (recommended) or `Branches`.
2. Create/update rule for `main`.
3. Apply toggles exactly as above.
4. Repeat for any long-lived integration branch if desired.
5. Validate on a test PR.

## Validation Checklist

- PR without passing checks cannot merge.
- PR with unresolved conversation cannot merge.
- Direct push to protected branch is blocked.
- Force push to protected branch is blocked.
- Copilot review is auto-requested on PR open/sync.
