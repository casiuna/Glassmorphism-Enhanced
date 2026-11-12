<script setup lang="ts">
import { AppDialog } from '@/components/ui/app-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useEnhancedManagement } from '@/composables/useEnhancedManagement'
import { RETURN_CARRIERS } from '@/utils/returnRouteClassification'
import pluginManifest from '../../companion/enhanced-route-probe/komari-plugin.json'
import helperManifest from '../../companion/helper/helper-version.json'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const manager = useEnhancedManagement()
const { state, selected, draft, busy, dirty, confirmed, error, notice, choices, selectedProbe, presence, command, lastResult, refresh, save, enable } = manager
const labels = { telecom: '电信', unicom: '联通', mobile: '移动' }
const productVersion = __BUILD_VERSION__
const commit = __BUILD_GIT_HASH__
</script>

<template>
  <AppDialog :open="props.open" title="Enhanced 集中管理" description="一个产品 · 统一发行与 UUID 策略 · 自动结果仅管理员读取" @update:open="emit('update:open', $event)">
    <div class="space-y-4 text-sm" data-enhanced-management>
      <p class="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
        真实公网 traceroute / ASN 尚未验证；模拟结果会明确标记。Helper 必须在被测节点运行；此页面不会登录或安装远端 VPS。
      </p>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="break-all">产品 {{ productVersion }} · commit {{ commit }}</span>
        <Button variant="outline" :disabled="busy" @click="refresh">
          {{ dirty ? '放弃更改并刷新' : '刷新状态' }}
        </Button>
      </div>
      <p v-if="error" role="alert" class="break-words text-destructive">
        {{ error }}
      </p>
      <p v-if="notice" role="status" class="text-success">
        {{ notice }}
      </p>
      <p v-if="busy && !state" role="status">
        正在核验管理员权限和组件状态…
      </p>
      <template v-if="state">
        <dl class="grid grid-cols-1 gap-2 rounded-md border border-border/60 p-3 sm:grid-cols-2" data-enhanced-versions>
          <div class="min-w-0 break-all">
            <dt class="text-muted-foreground">
              Komari / Enhanced 主题
            </dt>
            <dd>{{ state.komariVersion }} / {{ state.themeVersion ?? '未安装' }}</dd>
          </div>
          <div class="min-w-0 break-all">
            <dt class="text-muted-foreground">
              插件 / 期望版本
            </dt>
            <dd>{{ state.plugin?.version ?? '未安装' }} / {{ pluginManifest.version }}+git.{{ commit }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground">
              插件服务 / 存储
            </dt>
            <dd>{{ state.plugin?.running ? '运行中' : '未运行' }} / {{ state.health?.storage ?? '未能读取' }}</dd>
          </div>
          <div class="min-w-0 break-all">
            <dt class="text-muted-foreground">
              节点 Helper 期望版本
            </dt>
            <dd>{{ helperManifest.version }}+git.{{ commit }}</dd>
          </div>
        </dl>
        <p v-if="state.plugin && state.plugin.version !== `${pluginManifest.version}+git.${commit}`" class="text-warning" data-enhanced-upgrade>
          插件与本次 Full 构建不同；请先用统一 CLI 检查/升级，不要把已安装当作版本匹配。
        </p>
        <p v-if="state.error" role="alert" class="text-destructive">
          {{ state.error }}
        </p>
        <div v-if="!state.plugin" class="space-y-2 rounded-md border border-border/60 p-3">
          <p>插件未安装。请在管理员本机解压同一个 Full 包，用统一 CLI 安装 Theme + Plugin，默认先 dry-run：</p>
          <code class="block whitespace-pre-wrap break-all">python3 manage.py install --panel 'HTTPS-TEST-PANEL' --username ADMIN</code>
          <p class="text-muted-foreground">
            检查计划后显式加 --apply --approve-route-plugin --activate --backup-dir 私有新目录。Full ZIP 不是原生主题上传包；不会在这里静默请求额外权限。
          </p>
        </div>
        <template v-else>
          <label class="block space-y-1">
            <span>按节点 UUID 管理（改名不丢配置）</span>
            <select v-model="selected" aria-label="管理节点 UUID" class="w-full rounded-md border border-border bg-background p-2" :disabled="busy">
              <option v-for="node in choices" :key="node.uuid" :value="node.uuid">{{ node.name }} · {{ node.uuid }}</option>
            </select>
          </label>
          <p v-if="!choices.length" class="text-muted-foreground">
            尚无节点；先在原生后台登记测试节点，再在节点上接入 Helper。
          </p>
          <template v-if="draft">
            <section class="space-y-2 rounded-md border border-border/60 p-3" data-helper-status>
              <p class="font-medium">
                {{ presence }}
              </p>
              <p class="break-all">
                UUID：{{ selected }}
              </p>
              <p class="break-all">
                Helper 版本：{{ selectedProbe?.helperVersion ?? '未上报' }}
              </p>
              <p>最后心跳：{{ selectedProbe?.seenAt ? new Date(selectedProbe.seenAt).toISOString() : '尚无' }} · 心跳不等于探测成功</p>
              <p>最后回报：{{ lastResult }} · 任务状态：{{ selectedProbe?.state ?? '未检测' }}</p>
              <p v-for="(entry, carrier) in selectedProbe?.auto" :key="carrier" class="break-words">
                {{ labels[carrier] }}：{{ entry?.status ?? 'unknown' }} · {{ entry?.source === 'fixture' ? '模拟 fixture' : '节点 Helper' }}
              </p>
              <p v-if="Object.values(draft.manual).some(Boolean)">
                存在手动覆盖；manual 优先于有效自动结果。
              </p>
              <details>
                <summary class="cursor-pointer font-medium">
                  安装 / 重新接入指引（必须在该测试节点执行）
                </summary>
                <p class="my-2 text-muted-foreground">
                  先在该节点解压同一个 Full 包。替换下列本机路径；使用专用无特权用户和该节点 0600 私有 Agent 配置。命令不会修改 Agent。去掉 --apply 可先预演；--run 是前台运行，常驻服务另按包内说明配置。
                </p>
                <pre class="max-w-full whitespace-pre-wrap break-all rounded bg-background/70 p-2 text-xs" data-node-bootstrap>{{ command }}</pre>
                <p class="mt-2 text-muted-foreground">
                  1.6.0 没有本版本可用的原生短期 enrollment。节点必须本地保留原生凭据（0600），不进入浏览器或命令参数；若不接受该权限取舍，请只用手工线路。
                </p>
              </details>
            </section>
            <form class="space-y-3" @submit.prevent="save">
              <fieldset class="grid grid-cols-1 gap-3 rounded-md border border-border/60 p-3 sm:grid-cols-2" :disabled="busy || !state.plugin.running || !!state.error">
                <legend class="px-1 font-medium">
                  一次填写策略和显示，不重复配置城市 / 周期
                </legend>
                <label class="flex items-start gap-2"><input v-model="draft.globalEnabled" type="checkbox" aria-label="允许全局自动采集"><span>允许全局自动采集（默认关闭；仍须逐节点授权）</span></label>
                <label class="flex items-start gap-2"><input v-model="draft.nodeEnabled" type="checkbox" aria-label="授权当前节点采集"><span>仅授权当前 UUID 的采集策略</span></label>
                <label class="block space-y-1"><span>国内固定目标城市</span><select v-model="draft.city" aria-label="回程城市" class="w-full rounded-md border border-border bg-background p-2"><option value="beijing">北京</option><option value="shanghai">上海</option><option value="guangzhou">广州</option></select></label>
                <label class="block space-y-1"><span>周期（分钟，60–10080）</span><Input v-model.number="draft.periodMinutes" type="number" min="60" max="10080" aria-label="回程周期分钟" /></label>
                <label class="flex items-start gap-2"><input v-model="draft.displayEnabled" type="checkbox" aria-label="显示并消费回程结果"><span>统一打开线路显示 / 自动消费 / 插件连接（仍仅管理员读取自动结果）</span></label>
                <label class="block space-y-1"><span>结果 TTL（小时，1–168）</span><Input v-model.number="draft.ttlHours" type="number" min="1" max="168" aria-label="回程 TTL 小时" /></label>
                <label v-for="carrier in RETURN_CARRIERS" :key="carrier" class="block space-y-1"><span>{{ labels[carrier] }}手动覆盖（留空使用自动 / 未检测）</span><Input v-model="draft.manual[carrier]" maxlength="80" :aria-label="`${labels[carrier]}手动覆盖`" /></label>
              </fieldset>
              <p class="text-xs text-muted-foreground">
                保存仅改变当前 UUID 的策略/手动覆盖，以及明确显示的全局开关和 TTL。城市/周期仅存插件；不改其他节点、普通 tags、Ping 或 Agent。官方 API 无跨配置事务，请勿与其他管理员同时编辑。
              </p>
              <label class="flex items-start gap-2"><input v-model="confirmed" type="checkbox" aria-label="确认当前管理操作"><span>我确认上述影响范围；若启用插件服务，批准 Node 兼容 + HTTP routes（不含 system RPC / exec），现有已启用策略可能开始采集。</span></label>
              <div class="flex flex-wrap gap-2">
                <Button type="submit" :disabled="busy || !confirmed || !state.plugin.running || !!state.error">
                  保存当前节点及显示设置
                </Button>
                <Button v-if="!state.plugin.running" type="button" variant="outline" :disabled="busy || !confirmed" @click="enable">
                  批准并启用插件服务
                </Button>
              </div>
            </form>
          </template>
        </template>
      </template>
    </div>
  </AppDialog>
</template>
