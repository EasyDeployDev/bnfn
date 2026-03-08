# Open Source Launch Checklist

This repository is prepared to publish at `EasyDeployDev/bnfn`. The remaining launch steps happen outside the codebase.

## GitHub

1. Create the public repository at `EasyDeployDev/bnfn`.
2. Push this directory and set `main` as the default branch.
3. Enable GitHub Discussions and private vulnerability reporting.
4. Turn on branch protection for `main` and require the `CI` workflow.

## npm

1. Create or confirm ownership of the `@easydev` npm scope.
2. Add an `NPM_TOKEN` repository secret.
3. Publish from the GitHub Actions `Publish` workflow or from a signed local release process.

## Discord

1. Create the EasyDev Discord server or choose the channel that will handle community support.
2. Generate a permanent invite URL.
3. Publish the invite URL in `README.md`, `.github/ISSUE_TEMPLATE/config.yml`, and the website before announcing the project publicly.
4. Replace the invite if you rotate or revoke it.

## Recommended first release flow

1. Push the repo.
2. Verify `CI` passes on GitHub.
3. Run `bun test` locally if you want one final Bun-side sanity check, then `npm pack` for the publish artifact.
4. Create a GitHub release tag for `v0.1.1`.
5. Trigger the `Publish` workflow.
