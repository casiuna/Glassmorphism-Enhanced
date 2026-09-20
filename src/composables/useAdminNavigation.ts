import { ref } from 'vue'
import { getAdminEntryUrl } from '@/services/auth.service'

export function useAdminNavigation() {
  const navigating = ref(false)
  async function openAdmin() {
    if (navigating.value)
      return
    navigating.value = true
    try {
      window.location.assign(await getAdminEntryUrl())
    }
    finally {
      navigating.value = false
    }
  }
  return { openAdmin, navigating }
}
