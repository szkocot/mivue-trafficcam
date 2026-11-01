# CANARD minimum car-speed imports

User policy: use passenger-car limits and select the minimum numeric value over every time and direction. Treat the Polish numeric limits as km/h for this explicit import policy; preserve all original passenger/truck/conditional rows and identify the reduction so it is not mistaken for an unconditional posted limit.

Extend the existing server-side CANARD publisher rather than issuing hundreds of requests from every browser. Fetch identified public detail resources serially with a delay, bounded response/time/count limits and a private per-identity cache. Stop on denied/rate-limited/malformed responses; never publish a partially enriched candidate or overwrite accepted data on failure. Existing notice/schema/identity/withdrawal gates remain.

The shared pure detail decoder validates source identity/category and derives speeds without changing geometry/status/direction. Snapshots carry detail provenance and the selection policy. Existing browser imports/reconciliation/export retain this evidence; BIN raw fields remain separate. Test missing/conditional/truck-only/malformed limits, identity mismatch, refresh/cache/error handling and real snapshot persistence. Retrieve the cited PP point in live verification; publish the enriched accepted dataset only after checks.

README becomes a short overview, usage/development guide and documentation index. Preserve lengthy project history under docs/project-history.md.

Additional user requirement: test CANARD–Mio speed consistency for available points, keeping coverage/identity ambiguity separate from agreement. Compare both OPP endpoint limits and retain range checks. Add root AGENTS.md for future contributors/agents, alongside the requested README cleanup.
