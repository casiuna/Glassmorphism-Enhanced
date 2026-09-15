import type { MessageApi } from '@/utils/message'

declare const __BUILD_VERSION__: string
declare const __BUILD_GIT_HASH__: string
declare const __TRAFFIC_MIGRATION_ROLLOUT_ANCHOR__: string

declare global {
  interface Window {
    $message: MessageApi
  }
}

export {}
