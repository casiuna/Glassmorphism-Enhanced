# Enhanced fixed-target helper · 0.3.0 development companion

This separately installed, outbound-only Linux helper is not a Komari Agent replacement. Requires Python >=3.10 and an administrator-provided Linux `traceroute`; it does not install dependencies. UDP remains available. TCP uses fixed port 443. Both use compiled-in IPv4 targets; IPv6 probes are rejected. No command, hostname, executable, port or target is accepted from the panel.

**Automatic collection and external ASN queries default off. This development work does not install or enable anything on production nodes.** Fixtures are explicitly marked `fixture`/模拟. Real-network TCP/UDP behavior, Team Cymru availability, systemd/OpenRC runtime and IPv6 have not been validated by the offline tests.

## Installation and local choices

1. Prefer the existing Full product's node-local bootstrap. Alternatively extract this helper archive into a private staging directory and run `python3 install.py --prefix /opt/enhanced-route-helper/0.3.0`. This copies enumerated files only; existing prefixes are refused. It does not create users, install services, change networking or read credentials.
2. Keep installed code non-writable by the dedicated unprivileged service account. Point `/opt/enhanced-route-helper/current` at the chosen version.
3. Keep the helper configuration directory `0700`, with `helper.json` and the selected node token file both `0600`, owned by that service account. Use the exact UUID, HTTPS panel origin and absolute token-file path. URL credentials, path, query and fragment are rejected. `allowLoopback` remains false outside an isolated local lab.
4. Never put credentials in argv, environment variables, browser, systemd unit, URL or shell history. The helper only sends the node token inside HTTPS JSON POST bodies to the configured panel, using Komari 1.6.0 native Agent authentication. It does not change the Agent.
5. Upgrade the plugin to the matching 0.3.0 component **before** enabling new schema2 output. Approve only the existing `node` and `allowRoutes` permissions. Authorize the exact UUID; the panel selects only beijing/shanghai/guangzhou and a period of 60–10080 minutes.
6. In this node's private configuration, set `probeProtocols` to `["udp"]`, `["tcp"]` or `["udp", "tcp"]`. Set `addressFamily: 4`. The example remains `enabled: false`; changing a protocol is not authorization to probe. Enable the local helper and panel UUID policy deliberately, then run once on an authorized **test node** and inspect the result.

A configuration without `probeProtocols` keeps schema1 UDP output; cached old results remain readable. New installations using `helper.example.json` select schema2 UDP explicitly. A same-identity Full bootstrap preserves the local protocol, prefix and external-query consent fields. Unknown fields, changed identities and credentials still cause a refusal.

### External ASN lookup consent

`cymruEnabled: false`, `cymruConsent: false` and `prefixHints: false` are defaults. To enable Team Cymru, an administrator must explicitly set **both** `cymruEnabled: true` and `cymruConsent: true` locally, with `probeProtocols` present. The helper announces this on stderr: **public responding hop IPs may be sent to `whois.cymru.com:43`**, with DNS resolution; node credentials, UUID and full reports are not sent there. This is a privacy decision, not an installation default or remotely supplied command.

Each WHOIS subprocess includes DNS in its maximum 2-second wall-clock timeout, has a 4096-byte response limit, and uses a fixed service and request format. The batch permits at most 8 uncached queries. Owner-only cache: at most 512 IPs, positive TTL 3600 seconds and failure TTL 300 seconds. Timeouts, malformed/mismatched responses, unavailable WHOIS, expired budgets and missing ASN data fall back to unknown or explicit low-confidence prefix hints. Prefixes never populate `asns` or override actual ASNs.

**The traceroute command no longer uses `-A`.** That option can make unbounded implicit registry queries outside the explicit consent/budget mechanism. Without enrichment, live traces may have no actual ASNs; this is shown honestly as unknown, not a fabricated commercial label. Previously stored ASN evidence is not erased. Annotated offline fixtures still exercise parsing with provenance `traceroute` and overall source `fixture`.

## systemd / OpenRC and TCP permission

Inspect and explicitly install at most one service template on the authorized test node. The systemd template retains its unprivileged user, empty capability set, `NoNewPrivileges`, read-only system and resource limits. It adds `StateDirectory=enhanced-route-helper` with mode `0700`; runtime lock/cache/cooldown files use that provided `STATE_DIRECTORY`, not read-only `/etc`. Outside systemd, those files live in the private, writable token-file directory. They are `0600`, reject symlinks/corruption and reserve the cooldown before executing a probe.

TCP `traceroute -T` often needs host-provided raw-socket permission. Neither installer nor helper grants capabilities, switches to root, changes sysctls or silently substitutes UDP. The shipped zero-capability service may therefore report `permission-denied` for TCP on such hosts; choose UDP or separately review host policy. This is not proof that TCP works on every VPS. No service was installed or started on the development host.

Only outbound HTTPS to the panel, fixed IPv4 traceroute traffic, and (only with consent) DNS/WHOIS to Team Cymru are used. No listening socket, speed test, ranking, report upload, dynamic target retrieval or dependency auto-installer is added.

## Limits, independent evidence and compatibility

Collection is serial, protected by an owner-only lock and persistent 60-second local cooldown, including after helper restart. Each trace: 20 TTLs, one packet per TTL, 1-second hop wait, at most 25 seconds wall-clock, 64 KiB combined stdout/stderr. Safe argv and a new process group are used; timeout/output overflow kills that group. Schema2 has an overall deadline no greater than 164 seconds or the remaining lease minus 16 seconds, and an 11000-byte encoded-result cap. Overflow becomes an explicit `output-limit` result, not silent successful truncation.

The panel still enforces native UUID identity, leases, request-body limits, per-node token buckets, enqueue cooldown, global concurrency and period caching. No arbitrary target, Shell field, remote protocol override or port is added to its jobs. All results remain administrator-only. Manual UUID overrides win, each protocol retains its own collection time and TTL, and old schema1 results remain readable.

The theme uses one neutral, compact return-route line with tiny carrier-color markers. No current valid result means no card region; unknown, expired, failed, fixture or disagreeing protocol results stay in administrator diagnostics rather than appearing as a confirmed line. Guests see only explicit manual labels, never private auto results or raw evidence. Administrators retain separate hops, IPv4, ASN/provenance, hidden TTLs, target reachability, lookup statistics and fixture/source timestamps in Enhanced management or authorized expanded details. ASN appearance never certifies a commercial product; CN2 GT/GIA remain candidates. IP prefix evidence is explicitly labelled as low-confidence and not ASN. The product's `docs/single-node-route-trial.md` covers separately authorized, foreground `--once` trials and rollback; dirty development Full bundles cannot be used on non-loopback panels.

## Stop, uninstall and rollback

Disable the UUID/plugin policy, then stop/disable the selected service before changing code. Run the extracted archive's `install.py --prefix /opt/enhanced-route-helper/0.3.0 --uninstall`. Only unchanged, installer-owned files are removed. Unknown operator files, private credentials/config and runtime/cache remain until an explicit separate removal decision. No Agent, node tags, Ping tasks, counters, history, database or firewall is changed.

To roll back, retain the old code, matching plugin ZIP and private-state backup. Stop polling, restore/repoint code and plugin/state together, and remove new local options before using an older helper that rejects them. A plugin older than 0.3.0 cannot read schema2; disable polling and restore its pre-upgrade state rather than editing a live database. Turning off companion consumption restores manual-only presentation without deleting settings.

## Offline fixture smoke

`--fixture-dir PATH` requires a literal loopback panel and explicit `allowLoopback: true`. It reads fixed city/carrier/protocol files (UDP can fall back to old city/carrier filenames), executes neither traceroute nor WHOIS, and marks all results `fixture`. Fixtures are repository test data, not measured routes bundled as production results.

MIT attribution: Transit `ee9f31c5ff104e033ded858171ce0b63c672e878`, Copyright (c) 2026 yyy622hhh and Copyright (c) 2025 Tony Liu. Full permission notice is in LICENSE. Enhanced's root license and existing attributions remain unchanged. TcpQuality GPL-3.0-only is a method reference only; none of its Shell program is included here. See the product's `docs/tcpquality-adaptation.md` for scope and verification boundaries.
