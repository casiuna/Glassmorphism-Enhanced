// Selectively adapted from yyy622hhh/komari-theme-transit, MIT,
// ee9f31c5ff104e033ded858171ce0b63c672e878: routeClassification.ts ASN vocabulary.
// Copyright (c) 2026 yyy622hhh; Copyright (c) 2025 Tony Liu.
// Full permission notice: public/licenses/transit-MIT.txt.
// Enhanced deliberately does NOT inherit upstream's confident GIA/rank claims,
// IP-prefix guesses, shell execution, or tag-write transport.
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
} as const
export type ReturnTarget = keyof typeof RETURN_TARGETS
export interface ReturnHop { ttl: number, asns: number[] }
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
  const recognized = ordered.flatMap(hop => hop.asns.filter(asn => BACKBONES[carrier][asn]))
  const unique = [...new Set(recognized)]
  const evidence = unique.map(asn => `AS${asn}`).join(' → ') || '没有可识别的逐跳 ASN'
  const uncertain = (label = '未知'): RouteClassification => ({ label, confidence: 'uncertain', evidence })
  if (!unique.length)
    return uncertain()
  // A partial trace, multiple ASNs at the same TTL or a single responding hop
  // cannot establish a commercial route product, especially CN2 GIA.
  const matches = ordered.filter(hop => hop.asns.some(asn => BACKBONES[carrier][asn]))
  if (!reachedTarget || matches.length < 2 || matches.some(hop => hop.asns.length > 1))
    return uncertain(`${unique.map(asn => BACKBONES[carrier][asn]).join(' / ')}（不确定）`)
  if (carrier === 'telecom' && unique.includes(4809)) {
    const cn2 = ordered.filter(hop => hop.asns.includes(4809))
    const regular = ordered.filter(hop => hop.asns.includes(4134))
    if (regular.length && regular[0]!.ttl < cn2[0]!.ttl)
      return { label: 'CN2 GT 候选 / 163 混合', confidence: 'mixed', evidence }
    // Even two AS4809 replies can be the same router or a filtered partial path.
    // Retain a candidate, never assert that GIA has been proven by an ASN alone.
    if (cn2.length >= 2 && !regular.length && unique.length === 1)
      return uncertain('CN2（GIA 候选，未认证）')
    return { label: `${unique.map(asn => BACKBONES[carrier][asn]).join(' / ')} 混合`, confidence: 'mixed', evidence }
  }
  return {
    label: unique.map(asn => BACKBONES[carrier][asn]).join(' / ') + (unique.length > 1 ? ' 混合' : ''),
    confidence: unique.length > 1 ? 'mixed' : 'observed',
    evidence,
  }
}
