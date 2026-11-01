# CANARD car-speed imports

The hosted CANARD snapshot combines public map coordinates/identities with the public device-detail response for each PP, OPP and RL observation. The browser imports the prepared snapshot; it does not perform hundreds of individual detail requests.

## Selection policy

At the user's request, select the **minimum positive numeric passenger-car limit across every supplied time and direction**. Truck limits are not candidates. Numeric limits are interpreted as **km/h by this explicit import policy**; the original source response does not itself declare units. Empty, zero, negative or symbolic passenger values remain original evidence but do not create a numeric limit. If no numeric passenger value is supplied, the selected limit stays unknown.

For example, car values 70 (day) and 50 (night/opposite direction), with truck value 40, produce **50 km/h**, not 40. This is a conservative reduction of source conditions, not a claim that 50 is the unconditional posted limit on every approach. PL/EN labels disclose the reduction.

Every enriched observation keeps `originalProperties.canardDetail`: complete original detail, selected row indexes, selection/unit policy, response SHA-256, source URL and detail retrieval time. Vehicle/time/named-direction/chainage conditions remain available there and survive project and reference export. Operational status and compass bearing are not inferred from technical-condition or chainage fields. The normalized map geometry remains authoritative for this import.

## Retrieval and publication

The existing server-side publisher validates map terms/robots/schema/identities before fetching details. Requests are identified, credential-free, serial read-only POSTs to the map's published `/objdata` resource, with at least 250 ms between requests. Each response is limited to 1 MiB and 30 seconds; decoding limits expanded detail metadata to 64 KiB. A batch is limited to 1,000 observations, 20 MiB of retained encoded responses/cache, and 20 minutes. Denied/rate-limited, malformed or mismatched responses stop the batch without publication or modification of accepted data. Missing numeric speed in a valid detail is legitimate unknown data.

The private 24-hour cache is bound to source ID, category, serial and geometry; response hashes and decoded identities are revalidated on reuse. Removed identities are pruned. Public snapshots contain source evidence/provenance, not the HTTP cache. Existing withdrawal, terms, identity/count and publication gates remain in force. The workflow gives preparation 25 minutes to accommodate bounded serial enrichment.

To create a review candidate using an accepted data checkout:

```sh
node scripts/canard/cli.js candidate NEW_CANDIDATE ACCEPTED_DATA .cache/canard/access.json
```

The output directory must satisfy the existing dataset writer rules. Review the candidate and test import/persistence before using the existing publication workflow. Scheduled checks refresh expired detail cache entries. A transient upstream failure retains the last accepted snapshot and its visible freshness dates.

## Browser behavior

Import or reapply the latest CANARD snapshot through the existing source controls. Projects with CANARD synchronization enabled receive a newer accepted snapshot through normal reconciliation. Speed labels include the minimum-car policy; selected details retain the original rows. Reimport preserves manually owned coordinates and deletions. Source limits are metadata and remain separate from raw BIN speed fields; this feature does not automatically rewrite device bytes or generate OPP links.

Tests cover conditional minima, truck exclusion, absent/symbolic limits, complete provenance, all three device categories, malformed identity/compression, cache invalidation, network boundaries, project/reference export and PL/EN browser persistence. Live results and deployment are recorded in [deployment](deployment.md).


## Live verification — 2026-11-01

The first complete run fetched all **811** details successfully. It selected speeds for **506 PP + 136 OPP = 642** observations; all **169 RL** observations legitimately supplied no numeric passenger limit. The quoted PP `91359960` supplies passenger limit `50`, imports as **50 km/h**, and has one Mio candidate 3.22 m away storing 50. Its original truck/direction/time evidence remains in the observation. Total retained encoded cache is 2,768,870 bytes, below the 20 MiB aggregate budget.

Snapshot SHA-256: `b5cac0745d9cf952d91066655640f8c31a99adf540ee5c8b154b839508bb9a6c`; 4,571,535 bytes. The actual hosted-import path preserved every observation, detail/provenance field and notice through project persistence/reference export; unchanged BIN bytes were retained.

The private comparison package is `exports/canard-mio-car-speeds-2026-11-01/`. Among unique geometric candidates, **53/54 PP** and **16/17 OPP pairs** agree numerically with Mio; both endpoint values are checked for each section. Differences remain review evidence: PP `70721541` selects CANARD 50 versus Mio 70, and OPP `113414005` selects CANARD 100 versus Mio 80 at both endpoints. Identity, timing and conditional applicability still require review; these are not automatically importer failures. Ambiguous and out-of-range candidates retain separate evidence and are not counted as unique matches. A source observation can have candidates in multiple review groups, so per-group observation counts must not be summed as disjoint totals.

Offline report QA imported all 2,808 analysis features, counted all 53,338 BIN inventory rows, and observed no remote requests, injected scripts/images or page errors. Generated files remain private/ignored.

Released with source `b8e25bb` and data `920a977`, successfully deployed in [run 41335986512](https://github.com/szkocot/mivue-trafficcam/actions/runs/41335986512). Fresh public Chromium confirmed the exact snapshot hash, all 811 observations/642 car limits, the quoted 50 km/h record, an explicit blue binding, PL/EN legend, private-file exclusions and no page errors.


## Direction and merges

The editor uses CANARD `limity[].typ.kierunek` and `urzadzenie.nazwaKierunku1/2` as exact named direction labels in metadata, merge review and optional map labels. Numeric compass bearings remain separate. `masztKierunekPomiaru` and `kierunekPikietazu` are explicitly road-chainage evidence, never converted into a guessed bearing. The actual inspected snapshot has only three nonempty per-limit kierunek values (one OPP); section direction names supply useful labels for the other OPPs. Car-speed minimum selection still includes every direction/time row as requested. Complete newer detail snapshots clear removed numeric limits rather than retaining stale values. See [merge workflow](browser-editor.md#merge-matching-points-and-opps).
