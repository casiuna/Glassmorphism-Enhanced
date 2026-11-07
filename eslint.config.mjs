import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['public/admin-app/**'],
  formatters: true,
  vue: true,
}, {
  // Komari's sandbox exposes compatibility names rather than node: URLs.
  files: ['companion/enhanced-route-probe/script.js'],
  languageOptions: { globals: { __storageDir__: 'readonly' } },
  rules: { 'unicorn/prefer-node-protocol': 'off' },
})
