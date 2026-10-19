// Adapted from sanrokamlan-prog/komari-theme-Glassmorphism v3.4.2 (MIT).
// Upstream credits pwremilk for checking the renderer's actual WebGL version.
export function supportsGlobeRenderer(renderer: 'realistic' | 'cobe'): boolean {
  if (typeof document === 'undefined')
    return false
  try {
    const canvas = document.createElement('canvas')
    const context = renderer === 'realistic'
      ? canvas.getContext('webgl2')
      : canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!context)
      return false
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  }
  catch {
    return false
  }
}
