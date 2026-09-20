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

## Hosted CANARD pipeline (not released yet)

One workflow-level `github-pages` concurrency group serializes code, dataset and withdrawal deployments. Each run resolves current `main` and `canard-data` commits after acquiring that lock. Preparation has read-only repository permissions; only the separate publication job receives contents-write. Build checks out pinned source/data commits, validates the entire data checkout and copies only manifest, current snapshot and matching NOTICE. It never executes code from `canard-data`. Data commits use an isolated Git index and normal fast-forward pushes, with an exact-parent conflict check; source files/index are untouched.

Daily checks run at 03:23 UTC only when repository variable `CANARD_PUBLICATION_ENABLED=true`. That variable does **not** bypass `config/canard-review.json`: reviewed terms/robots, schema, identity evidence and initial candidate hash are independent gates. Failed checks neither advance `checkedAt` nor deploy. Unchanged data gets a manifest heartbeat without changing snapshot bytes/retrieval time. HTTP validators and the upstream body stay in a separate Actions cache, never in Pages or data-branch files. This cache contains public upstream material, not secrets; Actions caches/artifacts are not a confidentiality boundary. The candidate artifact expires after one day.

The initial dataset needs a deliberate bootstrap because its hash includes the original retrieval timestamp:

1. On the reviewed source revision, run `node scripts/canard/cli.js candidate _canard-candidate - .cache/canard/access.json`. This only fetches/validates and writes a local review candidate; it cannot publish.
2. Review the exact candidate, coverage, notices and current reuse/access evidence. Record its hash in `reviewedCandidateSha256`, clear resolved blockers and set `publicationApproved: true` only after approval. Do not refetch and assume the new bytes share the reviewed hash.
3. After explicit publication authority, publish those same bytes with `CANARD_PUBLICATION_ENABLED=true node scripts/canard/cli.js publish _canard-candidate -`. The final `-` means the remote data branch must not exist. An existing branch requires its exact SHA instead.
4. Merge/deploy the reviewed source, set the repository variable, and dispatch `gh workflow run pages.yml --ref main -f operation=deploy`. Subsequent `operation=update` or scheduled runs use the last accepted data. Protect `main` and limit who may change the publication variable/review record.

Manual withdrawal works even with the publication variable off, without fetching CANARD:

```sh
gh variable set CANARD_PUBLICATION_ENABLED --body false
gh workflow run pages.yml --ref main -f operation=withdraw
```

The disabled manifest replaces hosted data in the new Pages artifact; ordinary later code deploys retain that disabled state. Automatic updates refuse to reactivate it. Existing browser projects remain the user's data and are not erased. Withdrawal does **not** purge public Git history, downloaded files, or third-party caches. Re-enabling a withdrawn source requires a separately reviewed change; never force-push data history as a routine withdrawal. If an update fails, `operation=deploy` can still deploy code using the last accepted data commit.

Browser withdrawal is durable: the separate CANARD store retains a withdrawal marker, rejects later active-cache writes and broadcasts invalidation to other open tabs. This marker is not a user-project deletion. Reactivation must explicitly address the marker in a reviewed change, not merely publish a newer timestamp. Older active manifests cannot downgrade either the in-memory or shared stored cache. The publisher independently rechecks identity/count/freshness gates against its actual parent even for direct CLI publication.

Local build with an accepted data-only checkout: `npm run build:web -- --canard-dir /path/to/checkout`. With no argument, CANARD is unavailable and local BIN/CSV/GeoJSON features remain usable. Unexpected files, symlinks, wrong hashes/counts or differing notices fail the build. New artifact construction removes previously generated snapshot files, including after withdrawal.

New action pins were resolved from official v4 tags on 2026-09-20: [upload-artifact](https://github.com/actions/upload-artifact), [download-artifact](https://github.com/actions/download-artifact), [cache](https://github.com/actions/cache). The pipeline does not rely on a bot-generated push triggering another workflow.

Published 2026-09-20 from `459e92c7df0a991dd612b44a03853c27746590d1`: [successful deployment run](https://github.com/szkocot/mivue-trafficcam/actions/runs/35503630138). CI passed 133 Node tests (one local-sample skip) and 40 browser tests (local-sample and opt-in live-source skips); 46 assets were built. Local verification also passed all 134 Node tests and 41 browser tests with the private sample available.

A separate fresh Chromium session against the public HTTPS site loaded 52,935 records directly from Mio, switched PL/EN, opened a synthetic BIN, edited latitude to 37.1, downloaded/reparsed the resulting binary, and imported a source point with attributed speed metadata. App/worker/core module URLs returned 200, the sample BIN URL returned 404, and no page errors occurred. This live smoke check is separate from the skipped optional CI live-source test; no device acceptance is implied.

Non-blocking GitHub warnings: some pinned official Pages actions declare Node 20 and are currently run under Node 24 by GitHub; `ubuntu-latest` has an announced future image migration. The deployment succeeded; review upstream action/runner updates as maintenance, without suppressing test gates.
