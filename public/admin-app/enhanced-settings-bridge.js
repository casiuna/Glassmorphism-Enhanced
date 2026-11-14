// Owned Enhanced extension; does not edit or copy the official React bundle.
// Only the active Enhanced managed-settings page is routed to our five-category
// editor. All other official admin, login and terminal routes remain untouched.
;((SETTINGS_ROUTE) => {
  let checking = false
  async function openEnhancedSettings() {
    if (checking || !SETTINGS_ROUTE.test(window.location.pathname))
      return
    const requested = new URL(window.location.href).searchParams.get('theme')
    if (requested && requested !== 'Enhanced')
      return
    checking = true
    try {
      const response = await window.fetch('/api/public', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok)
        return
      const payload = await response.json()
      if (payload.status === 'success' && payload.data?.theme === 'Enhanced')
        window.location.replace('/?enhanced_settings=nodes')
    }
    catch {
      // Keep the native admin page if discovery fails. Never inject settings,
      // credentials or a guessed authentication result into either application.
    }
    finally {
      checking = false
    }
  }
  for (const method of ['pushState', 'replaceState']) {
    const original = window.history[method]
    window.history[method] = function (...args) {
      const result = original.apply(this, args)
      void openEnhancedSettings()
      return result
    }
  }
  window.addEventListener('popstate', () => void openEnhancedSettings())
  void openEnhancedSettings()
})(/^\/admin\/theme_managed\/?$/)
