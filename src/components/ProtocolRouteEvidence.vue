<script setup lang="ts">
import type { ProtocolPaths } from '@/utils/routeProbeSnapshot'
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { RETURN_CARRIER_NAMES } from '@/utils/returnRouteClassification'
import { returnRouteTime } from '@/utils/returnRouteDisplay'
import { protocolEvidenceGroups } from '@/utils/routeProbeSnapshot'

const props = defineProps<{ uuid: string, routes?: ProtocolPaths }>()
const app = useAppStore()
const groups = computed(() => app.privateFeaturesAllowed && props.routes ? protocolEvidenceGroups(props.uuid, props.routes, app.returnRouteTtlHours, app.returnRouteNow) : [])
</script>

<template>
  <section v-if="groups.length" data-protocol-evidence class="min-w-0 space-y-3 rounded-md border border-border/50 p-2 text-xs">
    <h4 class="font-medium">
      IPv4 TCP / UDP 独立路径证据（仅管理员）
    </h4>
    <p class="text-muted-foreground">
      不合并不同协议响应，不以 ASN、IP 前缀或 Ping 认证商业线路。固定目标 TCP 默认 443；CDN 使用双端管理员批准的端口。原始 IP 仅在管理员证据中展示。
    </p>
    <div v-for="group in groups" :key="group.carrier" :data-protocol-carrier="group.carrier" class="min-w-0 space-y-2">
      <p class="font-medium" :data-protocol-comparison="group.summary.protocolState">
        {{ RETURN_CARRIER_NAMES[group.carrier] }}：{{ group.summary.protocolState === 'different' ? 'TCP/UDP 路径不同（未合并）' : group.summary.protocolState === 'same' ? 'TCP/UDP 路径一致（非认证）' : group.summary.protocolState === 'single' ? '单协议采集' : '部分失败或过期，待复核' }}
      </p>
      <details v-for="row in group.rows" :key="row.protocol" :data-protocol-trace="row.protocol" :data-probe-status="row.trace.status ?? 'unknown'" class="min-w-0 rounded border border-border/40 p-2">
        <summary class="cursor-pointer break-words">
          {{ row.protocol.toUpperCase() }} · {{ row.display.label }} · {{ row.display.status }} · {{ row.trace.source === 'fixture' ? '模拟 fixture' : row.trace.source === 'replay' ? '历史 Helper 实测回放' : '节点 Helper' }} · {{ returnRouteTime(row.trace.collectedAt) }}
        </summary>
        <p class="my-2 text-muted-foreground">
          采集状态 {{ row.trace.status ?? 'unknown' }} · {{ row.display.detail }} · 目标 {{ row.trace.target }} · {{ row.trace.reachedTarget ? '已到达目标 IP（不代表服务可用）' : '未确认到达目标' }}
        </p>
        <p class="my-2 text-muted-foreground" data-asn-lookup>
          {{ row.trace.asnLookup?.enabled ? 'Team Cymru 已启用（节点本地同意）' : 'Team Cymru 未启用' }} · 查询 {{ row.trace.asnLookup?.queries ?? 0 }} / 缓存 {{ row.trace.asnLookup?.cacheHits ?? 0 }} / 失败或预算不足 {{ row.trace.asnLookup?.failures ?? 0 }}
        </p>
        <p v-if="row.trace.cdn" class="my-2 break-all text-muted-foreground" data-cdn-evidence>
          CDN {{ row.trace.cdn.hostname }} · {{ row.trace.cdn.selectedIPv4 }}:{{ row.trace.cdn.port }} · DNS {{ returnRouteTime(row.trace.cdn.resolvedAt) }} · 命令退出码 {{ row.trace.cdn.exitCode ?? '未启动' }} · 执行状态 {{ row.trace.cdn.executionStatus }} · 原始 SHA256 {{ row.trace.cdn.rawSha256 }}
        </p>
        <div class="max-w-full overflow-x-auto">
          <table class="w-full text-left text-[10px]">
            <thead>
              <tr>
                <th class="p-1">
                  TTL
                </th>
                <th class="p-1">
                  响应 IPv4
                </th>
                <th class="p-1">
                  实际 ASN / 来源
                </th>
                <th class="p-1">
                  低置信度前缀提示
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="hop in row.trace.hops" :key="hop.ttl" class="border-t border-border/30">
                <td class="p-1">
                  {{ hop.ttl }}
                </td>
                <td class="break-all p-1">
                  {{ hop.ips?.join(' / ') || '* 隐藏跳' }}
                </td>
                <td class="break-words p-1">
                  {{ hop.asns.length ? hop.asns.map(n => `AS${n}`).join(' / ') : '未知' }} · {{ hop.asnSource ?? '旧版未记录' }}
                </td>
                <td class="p-1">
                  {{ hop.prefixHints?.length ? `${hop.prefixHints.join(' / ')}（疑似，非 ASN）` : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  </section>
</template>
