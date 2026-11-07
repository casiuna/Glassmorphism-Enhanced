# Third-Party Notices

Glassmorphism Enhanced is an enhanced fork, not a clean-room or wholly original implementation. The upstream Git history and root `LICENSE` are retained.

## Komari Glassmorphism

- Project: <https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism>
- Role: main upstream and complete code base
- License: MIT
- Copyright notice: Copyright (c) 2025 Tony Liu (tonyliuzj, tony-liu.com)
- Upstream maintainer attribution: sanrokamlan

The complete upstream history, copyright notice, and MIT license remain in this repository. Glassmorphism v3.3.7 (`bf8376587c720de915ac48789a8a180357c762d6`) is the release baseline for v3.3.7-enhanced.1.

For v1.1.0, the small `globeCapability.ts` check is selectively adapted from upstream v3.4.2 (`69878cb95cfa43a2573cf1d9916ea62daf3c93c5`, MIT), which credits pwremilk for detecting the renderer's actual WebGL version. The new wrapper uses the existing tiled renderer when that API is unavailable; no wholesale upstream merge or chart algorithm replacement is included.

## Three-Network Fork

- Project: <https://github.com/vlongx/komari-theme-Glassmorphism-three-network>
- Reviewed revision: `2f172e7f9e8a87e0e3a1d0c5c2d2ef3555278b9c`
- Role: source/reference for carrier task-name matching, carrier latency/loss presentation, per-carrier history blocks, multi-task aggregation behavior, and the emerald-style default background treatment
- License: MIT
- Copyright notice in that repository: Copyright (c) 2025 Tony Liu (tonyliuzj, tony-liu.com)

Relevant ideas and portions were selectively adapted into new utilities/composables and the current upstream components. Old `NodeCard.vue`, `useNodePingStats.ts`, and other core files were not copied wholesale over the newer Glassmorphism implementation.

## Komari Emerald

- Project: <https://github.com/Tokinx/komari-theme-emerald>
- Reviewed revision: `1372043e8675af8d522db5cd279bbea7e7bafc00`
- Role: visual/algorithm reference for automatic globe arcs
- License: MIT
- Copyright notice: Copyright (c) 2026 Tokinx

Emerald's current region-to-visitor hub-and-spoke behavior was studied as a visual reference. Glassmorphism Enhanced implements its own deterministic node-cluster arc generation and reuses the Glassmorphism realistic, Cobe, and tiled renderers; the Emerald globe component was not copied wholesale.

## Transit return-route reference (unreleased local development)

- Source: <https://github.com/yyy622hhh/komari-theme-transit>, pinned commit `ee9f31c5ff104e033ded858171ce0b63c672e878`.
- MIT; Copyright (c) 2026 yyy622hhh and Copyright (c) 2025 Tony Liu (tonyliuzj, tony-liu.com).
- `src/utils/returnRouteClassification.ts` selectively adapts the carrier/ASN vocabulary from Transit `routeClassification.ts` and fixed target constants used by its return-route collectors. Enhanced implements a stricter, candidate-only CN2 policy rather than importing the upstream backtrace-derived commercial ranking algorithm or IP-prefix ASN guesses.
- No upstream `admin:exec`, tags writeback, node helper, installer, plugin or official admin frontend is copied. The optional collector remains future integration, not validated Komari 1.6.0 functionality.
- Full MIT permission notice is preserved at [public/licenses/transit-MIT.txt](public/licenses/transit-MIT.txt) and shipped in `dist/licenses/transit-MIT.txt` inside the existing theme ZIP format. Existing project licenses and authorship remain unchanged.

## License compatibility

All four reviewed projects use the MIT License. The licenses permit use, modification, distribution, and sublicensing provided their copyright and permission notices are retained. The upstream root `LICENSE` is unchanged; this file records the additional provenance and attribution relevant to the enhanced patches.
