# GitHub Pages deployment

Target: https://szkocot.github.io/mivue-trafficcam/

The user explicitly requested deployment of the current experimental version on 2026-09-20, ahead of the unfinished live CANARD connector and country-filtering increments. This changes the earlier wait-until-all-features release sequencing, not the stated feature limitations. MiVue 955W device acceptance remains unverified; use at your own risk.

GitHub Pages uses the Actions publishing source. `.github/workflows/pages.yml` runs on non-documentation pushes to `main` or manual dispatch. It installs locked dependencies, runs Node tests and Chromium browser tests, rebuilds the allowlisted static assets, then publishes only `dist/`. Deployment requires the build job to succeed. Official GitHub actions are pinned to commit IDs. Only the deployment job can write Pages and request its OIDC deployment token.

The proprietary sample is ignored and absent from the repository/artifact. CI therefore skips the local-sample tests; deterministic synthetic tests still run. The optional live-source test is not enabled in CI. The app downloads the official database directly from Mio and keeps working projects in browser storage; it does not host or upload user BIN/project files.

Documentation-only changes do not rebuild the site. To deliberately redeploy the current `main`:

```sh
gh workflow run pages.yml --ref main
gh run list --workflow pages.yml --limit 5
```

After deployment, verify the HTTPS root and module/worker assets, switch PL/EN, open a synthetic BIN, edit/export it, and confirm `/Speedcam_Data_FEU.bin` is not published. Browser location requires an explicit click and permission. Back up projects before testing; browser storage is not durable backup.

Workflow reference: [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Published 2026-09-20 from `459e92c7df0a991dd612b44a03853c27746590d1`: [successful deployment run](https://github.com/szkocot/mivue-trafficcam/actions/runs/35503630138). CI passed 133 Node tests (one local-sample skip) and 40 browser tests (local-sample and opt-in live-source skips); 46 assets were built. Local verification also passed all 134 Node tests and 41 browser tests with the private sample available.

A separate fresh Chromium session against the public HTTPS site loaded 52,935 records directly from Mio, switched PL/EN, opened a synthetic BIN, edited latitude to 37.1, downloaded/reparsed the resulting binary, and imported a source point with attributed speed metadata. App/worker/core module URLs returned 200, the sample BIN URL returned 404, and no page errors occurred. This live smoke check is separate from the skipped optional CI live-source test; no device acceptance is implied.

Non-blocking GitHub warnings: some pinned official Pages actions declare Node 20 and are currently run under Node 24 by GitHub; `ubuntu-latest` has an announced future image migration. The deployment succeeded; review upstream action/runner updates as maintenance, without suppressing test gates.
