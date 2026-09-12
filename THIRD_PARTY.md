# Third-Party Notices

Glassmorphism Enhanced is an enhanced fork, not a clean-room or wholly original implementation. The upstream Git history and root `LICENSE` are retained.

## Komari Glassmorphism

- Project: <https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism>
- Role: main upstream and complete code base
- License: MIT
- Copyright notice: Copyright (c) 2025 Tony Liu (tonyliuzj, tony-liu.com)
- Upstream maintainer attribution: sanrokamlan

The complete upstream history, copyright notice, and MIT license remain in this repository. Glassmorphism v3.3.7 (`bf8376587c720de915ac48789a8a180357c762d6`) is the release baseline for v3.3.7-enhanced.1.

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

## License compatibility

All three reviewed projects use the MIT License. The licenses permit use, modification, distribution, and sublicensing provided their copyright and permission notices are retained. The upstream root `LICENSE` is unchanged; this file records the additional provenance and attribution relevant to the enhanced patches.
