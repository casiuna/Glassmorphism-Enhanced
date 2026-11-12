# Enhanced fixed-target helper · 0.2.0 stable companion

This is a separately installed, outbound-only Linux helper, not a Komari Agent replacement. Requires Python >=3.10 and Linux `traceroute` supporting `-A` AS lookups. No root/raw-socket capability is requested: the collector uses UDP `traceroute -n -A -q 1 -w 1 -m 20` against nine compiled-in IPv4 targets. It never accepts a command, hostname, executable path, shell option or target from the panel.

**This release does not silently install or enable a helper on any production node.** Installation remains an explicit, per-node administrator action. Real-network reachability and ICMP/UDP filtering have not been verified in this release; fixtures are visibly marked as `fixture`/模拟, not real probe results. Missing AS replies mean unknown, not inferred IP-prefix evidence or GIA certification.

## Install files, then explicitly enable

1. Extract the archive into a private staging directory. Run `python3 install.py --prefix /opt/enhanced-route-helper/0.2.0`. This only copies enumerated files. It does not create users, change networking, install dependencies, install/initiate services or read credentials. An existing prefix is refused.
2. On the **test node**, create an unprivileged `enhanced-route` service account using that OS's normal account-management tools. Keep installed code root-owned and not writable by this account. Point `/opt/enhanced-route-helper/current` at the installed version.
3. Create `/etc/enhanced-route-helper/` owned by that service account, mode `0700`. Copy `helper.example.json` there as `helper.json`, mode `0600`, owned by the service account. Enter the exact UUID, HTTPS panel origin and absolute token-file path, then explicitly set `enabled: true`. No URL credentials/query/fragment/path are accepted. `allowLoopback` stays false outside a local isolated lab.
4. Put this node's Agent token in the specified private file, mode `0600`, same service owner. Use an editor or private file transfer; **never put the token in argv, an environment variable, browser, systemd unit, URL or shell history**. The helper validates regular-file owner/mode and rejects symlinks. It sends the token only inside HTTPS JSON POST bodies using Komari 1.6.0 native Agent authentication, never as a query token or an admin API key.
5. Upload `enhanced-route-probe-0.2.0.zip` in the isolated Komari 1.6.0 Plugins page; approve only `node` and `allowRoutes`. Enable its switch and add the UUID policy, e.g. `{"UUID":{"enabled":true,"city":"beijing","periodMinutes":360}}`. Default configuration dispatches nothing. Cities: beijing/shanghai/guangzhou; period 60–10080 minutes. No Agent remote-exec capability is needed.
6. As the service user, run `python3 /opt/enhanced-route-helper/current/enhanced_route_helper.py --config /etc/enhanced-route-helper/helper.json --once`. Inspect the administrator-only plugin snapshot and theme, then install **one** service manager template if desired. A successful upload means `result-accepted`, not a promise that a commercial route was identified.

## systemd / OpenRC

Copy the provided systemd unit to the test OS's system unit directory, inspect its paths/user, reload the manager and explicitly enable/start it. It runs without capabilities, with NoNewPrivileges, a 64 MB memory limit and read-only system files. Do not grant root merely to make a failed trace pass. The alternative OpenRC template uses `supervise-daemon` and an unprivileged account; inspect and install it through that OS's standard `/etc/init.d` process. **Templates and install/uninstall logic are checked locally, but no systemd/OpenRC service was started on the development host; OpenRC runtime compatibility is not claimed as tested.**

Only outbound HTTPS to the panel, DNS and the fixed trace targets/AS lookup provider are needed. The helper opens no listening port. Traceroute/AS lookup behavior depends on the OS build, resolver, transit filtering and destination replies. Use reverse-proxy request-body limits on `/api/enhanced-route-probe/` (16 KiB) and omit request bodies/query credentials from logs. Keep access metadata; do not turn off all auditing. The native Komari authentication layer runs before plugin body validation.

## Limits / errors

One serial collection per helper. Three probes, each 20 hops, 25-second wall-clock limit, 64 KiB combined stdout/stderr cap. Processes use safe argv and a new process group; timeout/output overflow kills that group. No shell or fallback to root/ICMP is used. The helper polls every 30 seconds; the relay has per-node token buckets, at most four running leases, 180-second one-time leases, 10-minute job expiry, a 60-second enqueue cooldown and period-based caching. All evidence is UUID-bound. It never writes normal tags.

Statuses: ok, unknown, timeout, permission-denied, no-traceroute, probe-failed, output-limit. State persists in the plugin's private storage using atomic 0600 replacement. I/O/corruption fails closed rather than discarding an unreadable file or claiming durability. Back up plugin state before changing versions. No Agent credentials are in persisted plugin results.

The theme's automatic-result consumption and companion connection both default off. Results are administrator-only, including private sites; anonymous users retain existing manual public settings. TTL defaults to 24 h and manual overrides win. Fixture results explicitly say 模拟. Commercial CN2 GT/GIA names remain candidates unless evidence supports a stronger conclusion; a single ASN never certifies GIA.

## Stop, uninstall, rollback

Disable the UUID/plugin switch first, stop and disable the OS service, then remove its unit/init script and reload the service manager. Run `python3 install.py --prefix /opt/enhanced-route-helper/0.2.0 --uninstall` **from the extracted archive**. Only unchanged, installer-owned enumerated files are removed. Unknown operator files and `/etc/enhanced-route-helper` credentials/config are preserved; remove those only by a separate deliberate operator decision. No Komari Agent, node tags, Ping tasks, database or firewall is changed.

For rollback, retain the old helper directory and plugin ZIP/state backup. Stop the helper, repoint `current` to the old version, restore the backed-up plugin/version if needed, then explicitly restart the chosen test service. Do not edit a live DB or downgrade blindly across incompatible state formats. Turning off theme companion consumption restores the manual-only behavior without deleting settings or the previous theme.

## Offline fixture-only smoke

`--fixture-dir PATH` is permitted only against literal loopback endpoints with explicit `allowLoopback: true`. It reads three fixed local city/carrier fixture files, never executes traceroute, and labels all results `fixture`. The source repository provides the isolated real-1.6.0 integration lab and deterministic fixtures; these are not bundled into a production helper as measured data.

MIT attribution: Transit `ee9f31c5ff104e033ded858171ce0b63c672e878`, Copyright (c) 2026 yyy622hhh and Copyright (c) 2025 Tony Liu. Full permission notice is in LICENSE. Enhanced's root license and existing attributions remain unchanged.
