import { shallowRef } from 'vue'
import { getAuthSession } from '@/services/auth.service'
import { requestManager } from '@/services/request.service'
import { parseProbeSnapshot } from '@/utils/routeProbeSnapshot'

const KEY = 'return-route:companion:snapshot'
export const probeSnapshot = shallowRef<ReturnType<typeof parseProbeSnapshot>>({ nodes: {} })
export const probeConnection = shallowRef('未连接')
let references = 0
let timer: ReturnType<typeof setInterval> | undefined

async function refresh() {
  if (!getAuthSession().authenticated)
    return
  try {
    const snapshot = await requestManager.run(KEY, async (signal) => {
      const response = await fetch('/api/enhanced-route-probe/v1/snapshot', {
        credentials: 'same-origin',
        headers: { 'X-Enhanced-Route': '1' },
        signal,
      })
      if (!response.ok)
        throw new Error(response.status === 403 ? '需要管理员登录' : '伴生插件不可用')
      const body = await response.text()
      if (body.length > 4194304)
        throw new Error('伴生结果超过限制')
      return parseProbeSnapshot(JSON.parse(body))
    }, { retryAttempts: 0, timeout: 10000 })
    if (references && getAuthSession().authenticated) {
      probeSnapshot.value = snapshot
      probeConnection.value = '已连接（管理员）'
    }
  }
  catch (error) {
    if (references) {
      probeSnapshot.value = { nodes: {} }
      probeConnection.value = error instanceof Error && error.name === 'AbortError' ? '已停止' : '伴生插件不可用或鉴权失败'
    }
  }
}

export function subscribeRouteProbe(): () => void {
  references++
  if (references === 1) {
    void refresh()
    timer = setInterval(() => void refresh(), 30000)
  }
  let released = false
  return () => {
    if (released)
      return
    released = true
    if (--references === 0) {
      clearInterval(timer)
      timer = undefined
      requestManager.abort(KEY)
      probeSnapshot.value = { nodes: {} }
      probeConnection.value = '未连接'
    }
  }
}
