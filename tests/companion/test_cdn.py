"""Synthetic safety tests. No DNS, SSH, traceroute or external ASN traffic."""
import contextlib
import copy
import importlib.util
from pathlib import Path
import time
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('v2',ROOT/'companion/helper/enhanced_probe_v2.py')
assert s is not None and s.loader is not None
v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
profile=lambda:{c:{'hostname':h,'udpPort':80,'tcpPort':80} for c,h in v.CDN_HOSTS.items()}
class CdnSafety(unittest.TestCase):
    def test_catalog_and_ports_only(self):
        self.assertEqual(v.cdn_profiles({'hubei-cdn':profile()})['hubei-cdn'],profile())
        for value in ['evil.example','127.0.0.1','https://hb-ct-v4.ip.zstaticcdn.com','hb-ct-v4.ip.zstaticcdn.com.', 'hb-ct-v4.ip.zstaticcdn.com;id']:
            p=profile();p['telecom']['hostname']=value
            with self.subTest(host=value),self.assertRaises(ValueError):v.cdn_profiles({'hubei-cdn':p})
        for port in [True,0,22,53,65536,'80']:
            p=profile();p['telecom']['tcpPort']=port
            with self.subTest(port=port),self.assertRaises(ValueError):v.cdn_profiles({'hubei-cdn':p})
    def test_dns_fail_closed_mixed_private_and_duplicates(self):
        for bad in ['10.0.0.1','127.0.0.1','169.254.169.254','192.168.0.1','100.64.0.1','224.0.0.1','::1','01.1.1.1']:
            with self.subTest(ip=bad),self.assertRaises(ValueError):v.resolve_cdn(profile(),resolver=lambda h:['1.1.1.1',bad])
        for addresses in [[],['1.1.1.1','1.1.1.1']]:
            with self.assertRaises(ValueError):v.resolve_cdn(profile(),resolver=lambda h:addresses)
    def test_no_remote_profile_or_binding_can_start_dns(self):
        config={'cdnTargets':{'hubei-cdn':profile()},'probeProtocols':['udp','tcp']}
        job={'city':'hubei-cdn','targetBinding':'untrusted'}
        with patch.object(v,'resolve_cdn',side_effect=AssertionError('must not resolve')):
            with self.assertRaises(ValueError):v.run_cdn_job(config,job,None,None)
    def test_live_contract_pins_once_and_never_executes_commands_in_test(self):
        config={'uuid':'00000000-0000-4000-8000-000000000001','tokenFile':'not-opened','cdnTargets':{'hubei-cdn':profile()},'probeProtocols':['udp','tcp']}
        calls=[];resolved=[]
        original=v.resolve_cdn
        def resolve(p):
            return original(p,resolver=lambda h:(resolved.append(h) or ['1.1.1.1']))
        def runner(target,**kw):
            calls.append((target,kw));self.assertEqual(kw['cdn_pins'],frozenset(['1.1.1.1']));self.assertEqual(kw['port'],80);self.assertLessEqual(kw['timeout'],25)
            return '1 1.1.1.1 1 ms','ok',0
        @contextlib.contextmanager
        def runtime(*args):yield {'cache':{}}
        job={'city':'hubei-cdn','targetBinding':v.cdn_binding(profile()),'leaseUntil':(time.time()+180)*1000}
        with patch.object(v,'runtime',runtime),patch.object(v,'resolve_cdn',resolve),patch.object(v.subprocess,'run',side_effect=AssertionError('no real process')):
            result=v.run_cdn_job(config,job,runner,None)
        self.assertEqual(len(resolved),3);self.assertEqual(len(calls),6);self.assertEqual(result['schema'],3)
        self.assertEqual(sum(row['asnLookup']['queries'] for pairs in result['carriers'].values() for row in pairs.values()),0)
    def test_no_fixture_can_supply_runtime_shell(self):
        s=importlib.util.spec_from_file_location('helper',ROOT/'companion/helper/enhanced_route_helper.py')
        assert s is not None and s.loader is not None
        h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
        for target,port,pins in [('1.1.1.1',22,frozenset(['1.1.1.1'])),('10.0.0.1',80,frozenset(['10.0.0.1'])),('1.1.1.1;id',80,frozenset(['1.1.1.1;id'])),('1.1.1.1',80,frozenset(['8.8.8.8']))]:
            with self.subTest(target=target,port=port),patch.object(h.subprocess,'Popen',side_effect=AssertionError('must reject before exec')),self.assertRaises(h.HelperError):h.execute_trace(target,cdn_pins=pins,port=port)
if __name__=='__main__':unittest.main()
