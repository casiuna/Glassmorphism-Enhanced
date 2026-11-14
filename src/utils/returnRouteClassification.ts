// Selectively adapted from yyy622hhh/komari-theme-transit, MIT,
// ee9f31c5ff104e033ded858171ce0b63c672e878: routeClassification.ts ASN vocabulary.
// Copyright (c) 2026 yyy622hhh; Copyright (c) 2025 Tony Liu.
// Full permission notice: public/licenses/transit-MIT.txt.
// Enhanced deliberately does NOT inherit upstream's confident GIA/rank claims,
// treating IP-prefix hints as real ASNs, shell execution, or tag-write transport.
export const RETURN_CARRIERS = ['telecom', 'unicom', 'mobile'] as const
export type ReturnCarrier = typeof RETURN_CARRIERS[number]
export const RETURN_CARRIER_NAMES: Record<ReturnCarrier, string> = { telecom: '电信', unicom: '联通', mobile: '移动' }

// IDs, never an arbitrary hostname/command. This module only validates data;
// importing it or changing theme settings never schedules a network probe.
export const RETURN_TARGETS = {
  'beijing-telecom': { carrier: 'telecom', address: '219.141.140.10' },
  'beijing-unicom': { carrier: 'unicom', address: '202.106.195.68' },
  'beijing-mobile': { carrier: 'mobile', address: '221.179.155.161' },
  'shanghai-telecom': { carrier: 'telecom', address: '202.96.209.133' },
  'shanghai-unicom': { carrier: 'unicom', address: '210.22.97.1' },
  'shanghai-mobile': { carrier: 'mobile', address: '211.136.112.200' },
  'guangzhou-telecom': { carrier: 'telecom', address: '58.60.188.222' },
  'guangzhou-unicom': { carrier: 'unicom', address: '210.21.196.6' },
  'guangzhou-mobile': { carrier: 'mobile', address: '120.196.165.24' },
  'hubei-telecom': { carrier: 'telecom', address: '202.103.24.68' },
  'hubei-unicom': { carrier: 'unicom', address: '218.104.111.122' },
  'hubei-mobile': { carrier: 'mobile', address: '211.137.58.20' },
  'hubei-cdn-telecom': { carrier: 'telecom', address: '' },
  'hubei-cdn-unicom': { carrier: 'unicom', address: '' },
  'hubei-cdn-mobile': { carrier: 'mobile', address: '' },
} as const
export type ReturnTarget = keyof typeof RETURN_TARGETS
export interface ReturnHop { ttl: number, asns: number[], ips?: string[], asnSource?: 'none' | 'traceroute' | 'team-cymru', prefixHints?: Array<'CN2' | '163' | 'CMI'> }
export interface RouteClassification {
  label: string
  confidence: 'observed' | 'mixed' | 'uncertain'
  evidence: string
}
const BACKBONES: Record<ReturnCarrier, Record<number, string>> = {
  telecom: { 4134: '163', 4809: 'CN2', 23764: 'CTGNET' },
  unicom: { 4837: '4837', 9929: '9929', 10099: '10099 / CUG' },
  mobile: { 9808: 'CMNET', 58453: 'CMI', 58807: 'CMIN2' },
}

export function classifyReturnRoute(carrier: ReturnCarrier, hops: readonly ReturnHop[], reachedTarget: boolean): RouteClassification {
  const ordered = [...hops].sort((a, b) => a.ttl - b.ttl)
  const names: Record<number, string> = { ...BACKBONES.telecom, ...BACKBONES.unicom, ...BACKBONES.mobile }
  const matches = ordered.filter(hop => hop.asns.some(asn => BACKBONES[carrier][asn]))
  const evidence = ordered.map(h => `TTL${h.ttl} ${h.asns.length ? h.asns.map(n => `AS${n}`).join('/') : '*'}`).join(' → ') || '没有可识别的逐跳 ASN'
  const uncertain = (label = '未知'): RouteClassification => ({ label, confidence: 'uncertain', evidence })
  if (!matches.length) {
    const allowed = carrier === 'telecom' ? ['CN2', '163'] : carrier === 'mobile' ? ['CMI'] : []
    const hints = [...new Set(ordered.filter(h => !h.asns.length).flatMap(h => h.prefixHints ?? []))].filter(h => allowed.includes(h))
    return uncertain(hints.length ? `疑似 ${hints.join('/')}（仅 IP 前缀，非 ASN）` : '未知')
  }
  const segments: number[] = []
  for (const hop of ordered) {
    for (const asn of hop.asns.filter(n => names[n])) {
      if (segments.at(-1) !== asn)
        segments.push(asn)
    }
  }
  const unique = [...new Set(segments)]
  const ambiguous = ordered.some((h, i) => h.asns.length > 1 || (i > 0 && h.ttl === ordered[i - 1]!.ttl))
  const hidden = ordered.some((h, i) => !h.asns.length || (i > 0 && h.ttl - ordered[i - 1]!.ttl > 1))
  if (!reachedTarget || matches.length < 2 || ambiguous)
    return uncertain(`${unique.map(n => names[n]).join(' / ')}（不确定）`)
  // Collapse only adjacent equal observations, not a global ASN set: a return
  // to a previous backbone remains visible, e.g. 10099 → 4837 → 10099.
  if (carrier === 'telecom' && segments.length === 2 && segments[0] === 4134 && segments[1] === 4809)
    return { label: `CN2 GT 候选 / 163 混合${hidden ? '（疑似，隐藏跳）' : ''}`, confidence: 'mixed', evidence }
  if (carrier === 'telecom' && segments.length === 1 && segments[0] === 4809) {
    const ips = matches.flatMap(h => h.ips ?? [])
    if (hidden || (ips.length > 0 && new Set(ips).size < 2))
      return uncertain('CN2（不确定）')
    return uncertain('CN2（GIA 候选，未认证）')
  }
  if (segments.length > 1)
    return { label: `${segments.map(n => names[n] === '10099 / CUG' ? '10099' : names[n]).join(' → ')} 混合${hidden ? '（疑似，隐藏跳）' : ''}`, confidence: 'mixed', evidence }
  return hidden ? uncertain(`${names[segments[0]!] ?? '未知'}（不确定，隐藏跳）`) : { label: names[segments[0]!] ?? '未知', confidence: 'observed', evidence }
}
