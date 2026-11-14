"""Synthetic HISTORY FIXTURE for an already-created isolated Komari lab ONLY.

INSERTs into existing metric tables; never ALTER/UPDATE/DELETE, never a real
node database. HTTP/RPC responses still come from the actual Komari process.
"""
import argparse
import calendar
import datetime as dt
import hashlib
import json
import re
import sqlite3
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LABS = ROOT / 'test-results/full'
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
TZ = dt.timezone(dt.timedelta(hours=8))
GIB = 1024 ** 3
METRICS = ['traffic.up', 'traffic.down', 'net.total.up', 'net.total.down']


def period_start(now, day):
    def boundary(year, month):
        return dt.datetime(year, month, min(day, calendar.monthrange(year, month)[1]), tzinfo=TZ)
    current = boundary(now.year, now.month)
    if now >= current:
        return current
    previous = now.replace(day=1) - dt.timedelta(days=1)
    return boundary(previous.year, previous.month)


def fingerprint(con, cutoff):
    rows = con.execute('SELECT * FROM metric_rollups WHERE bucket_milli < ? ORDER BY series_id,resolution_id,label_id,bucket_milli', (cutoff,)).fetchall()
    serial = [[v.hex() if isinstance(v, bytes) else v for v in row] for row in rows]
    return {'rows': len(rows), 'sha256': hashlib.sha256(json.dumps(serial, separators=(',', ':')).encode()).hexdigest()}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--database', required=True)
    p.add_argument('--node-a', required=True)
    p.add_argument('--node-b', required=True)
    p.add_argument('--verify', help='read-only comparison with a prior fixture summary')
    args = p.parse_args()
    database = Path(args.database).resolve(strict=True)
    relative = database.relative_to(LABS.resolve())
    if len(relative.parts) < 3 or not relative.parts[0].startswith('native-lab-') or database.name != 'metrics.db' or not UUID.fullmatch(args.node_a) or not UUID.fullmatch(args.node_b):
        raise SystemExit('REFUSED: isolated native-lab metric fixture only')
    con = sqlite3.connect('file:' + str(database) + ('?mode=ro' if args.verify else '?mode=rw'), uri=True)
    try:
        if args.verify:
            before = json.loads(Path(args.verify).read_text())
            after = fingerprint(con, before['fingerprintCutoff'])
            assert after == before['retainedHistoryFingerprint'], 'configuration writes altered retained history'
            print(json.dumps({'syntheticFixtureHistoryPreserved': True, **after}))
            return
        now = dt.datetime.now(TZ)
        day = now.day
        prior = (now - dt.timedelta(days=1)).day
        changed = (now - dt.timedelta(days=2)).day
        days = sorted({day, prior, changed})
        cutoff = int((now - dt.timedelta(minutes=10)).timestamp() * 1000)
        label = con.execute('SELECT id FROM metric_label_sets WHERE labels = ?', ('{}',)).fetchone()
        assert label, 'native empty label set not initialized'
        label_id = label[0]
        resolutions = []
        for ms in (60000, 300000, 3600000):
            con.execute('INSERT OR IGNORE INTO metric_resolutions(resolution_milli) VALUES (?)', (ms,))
            resolutions.append((con.execute('SELECT id FROM metric_resolutions WHERE resolution_milli=?', (ms,)).fetchone()[0], ms))
        times = {}
        for reset in days:
            start = period_start(now, reset)
            for offset, up, down in [(-60, 0, 0), (3600, GIB, 2 * GIB), (7200, GIB, 2 * GIB)]:
                stamp = int((start + dt.timedelta(seconds=offset)).timestamp() * 1000)
                if stamp < cutoff:
                    times[stamp] = (up, down)
        assert times, 'fixture must have retained historical samples'
        hour = min(period_start(now, d) for d in days) - dt.timedelta(hours=1)
        while hour < now:
            times.setdefault(int(hour.timestamp() * 1000), (0, 0))
            hour += dt.timedelta(hours=1)
        times[int((now - dt.timedelta(seconds=1)).timestamp() * 1000)] = (0, 0)
        inserted = 0
        for uuid in (args.node_a, args.node_b):
            values = {name: [] for name in METRICS}
            total_up = total_down = 1024 * GIB
            for index, (stamp, (up, down)) in enumerate(sorted(times.items())):
                if index == 2:
                    total_up = total_down = 0  # explicit counter restart fixture
                total_up += up
                total_down += down
                for name, value in [('traffic.up', up), ('traffic.down', down), ('net.total.up', total_up), ('net.total.down', total_down)]:
                    values[name].append((stamp, value))
            for name in METRICS:
                definition = con.execute('SELECT name FROM metric_definitions WHERE name=?', (name,)).fetchone()
                assert definition, 'native traffic metric is not initialized'
                series = con.execute('SELECT id FROM metric_series WHERE metric_name=? AND entity_id=? AND tags=?', (name, uuid, '{}')).fetchone()
                if not series:
                    template = con.execute('SELECT tags_hash,tags FROM metric_series WHERE metric_name=? AND tags=? LIMIT 1', (name, '{}')).fetchone()
                    assert template, 'native series metadata not initialized'
                    con.execute('INSERT INTO metric_series(metric_name,entity_id,tags_hash,tags) VALUES (?,?,?,?)', (name, uuid, *template))
                    series = (con.execute('SELECT last_insert_rowid()').fetchone()[0],)
                for resolution_id, step in resolutions:
                    buckets = {}
                    for stamp, value in values[name]:
                        buckets.setdefault(stamp // step * step, []).append((stamp, value))
                    for bucket, samples in buckets.items():
                        numbers = [v for _, v in samples]
                        cursor = con.execute('INSERT OR IGNORE INTO metric_rollups(series_id,resolution_id,label_id,bucket_milli,count,sum,sum_sq,min_val,max_val,first_val,first_ts_milli,last_val,last_ts_milli,digest,created_at_milli) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                            (series[0], resolution_id, label_id, bucket, len(samples), float(sum(numbers)), float(sum(v*v for v in numbers)), float(min(numbers)), float(max(numbers)), float(samples[0][1]), samples[0][0], float(samples[-1][1]), samples[-1][0], None, int(time.time()*1000)))
                        inserted += cursor.rowcount
        con.commit()
        print(json.dumps({'kind': 'EXPLICIT_SYNTHETIC_SQLITE_HISTORY_IN_ISOLATED_NATIVE_LAB', 'database': str(database), 'nodeAResetDay': day, 'nodeBResetDay': prior, 'changedNodeAResetDay': changed, 'insertedRollupRows': inserted, 'fingerprintCutoff': cutoff, 'retainedHistoryFingerprint': fingerprint(con, cutoff), 'rawCountersCleared': False, 'productionTouched': False}))
    finally:
        con.close()


if __name__ == '__main__':
    main()
