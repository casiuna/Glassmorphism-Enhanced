/** Historical A/B helper retained for old tests; final NodeCard never calls it. */
export function returnRoutePreviewLayout(search: string, visualTest: boolean): 'line' | 'ping' {
  return visualTest && new URLSearchParams(search).get('return_route_preview') === 'ping' ? 'ping' : 'line'
}
