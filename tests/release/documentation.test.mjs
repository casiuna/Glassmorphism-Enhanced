/* eslint test/no-import-node-test: off -- This suite deliberately uses Node's built-in runner, with no Vitest dependency. */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { releaseMetadata } from '../../scripts/release-metadata.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = path => readFileSync(join(root, path), 'utf8')
const manifest = JSON.parse(read('komari-theme.json'))
const RELATIVE_LINK = /\[[^\]]*\]\(([^)]+)\)/g
const files = ['README.md', 'docs/full.md', 'docs/companion.md', 'docs/full-validation.md', 'docs/return-routes.md', 'docs/releasing.md', 'docs/release-assets.md', `docs/release-notes-v${manifest.version}.md`]

test('current installation documents distinguish published theme and optional 0.3 components', () => {
  assert.equal(manifest.short, 'Enhanced')
  for (const path of ['companion/enhanced-route-probe/komari-plugin.json', 'companion/helper/helper-version.json'])
    assert.equal(JSON.parse(read(path)).version, '0.3.0')
  for (const path of ['README.md', 'docs/full.md', 'docs/companion.md', 'docs/full-validation.md', 'docs/return-routes.md']) {
    const head = read(path).slice(0, 400)
    assert(head.includes(manifest.version), path)
    assert(!head.includes('尚未发布') && !head.includes('本地候选'), path)
  }
  assert(read('docs/full.md').includes('0.3.0+git.0332d5f'))
})
test('README prioritizes native install and separates developer and optional Full dependencies', () => {
  const text = read('README.md')
  assert(text.indexOf('## 普通主题安装') < text.indexOf('### 可选高级安装'))
  assert(text.includes('不需要额外运行 Node.js、Bun、Python'))
  assert(text.includes('不要先删除旧主题'))
  assert(text.includes('不是普通用户的必装项'))
})
test('rendered Release body leads with native ZIP and links corrected maintained documentation', () => {
  const m = releaseMetadata(root)
  assert(m.body.startsWith('## 推荐安装：原生主题 ZIP'))
  assert(m.body.indexOf('komari-theme-Glassmorphism-build-0332d5f.zip') < m.body.indexOf('## 可选高级安装'))
  assert(m.body.includes('不需要 Enhanced Plugin、Helper 或 Full'))
  assert(m.body.includes('尚未完成生产验收'))
  assert(m.body.includes('/blob/main/docs/full.md'))
  assert(!m.body.includes('/blob/0332d5f7c73f7994ba21c01e4b739d04835120b1/docs/full.md'))
})
test('all new maintained relative file links resolve', () => {
  for (const file of files) {
    for (const m of read(file).matchAll(RELATIVE_LINK)) {
      const path = m[1].split('#')[0]
      if (!path || path.includes('://') || path.startsWith('mailto:'))
        continue
      assert(existsSync(resolve(root, dirname(file), decodeURIComponent(path))), `${file}: ${path}`)
    }
  }
})
test('historical tag and bundled-document limitations are explicit rather than rewritten', () => {
  for (const file of ['README.md', 'docs/full.md', 'docs/companion.md', 'docs/full-validation.md', `docs/release-notes-v${manifest.version}.md`])
    assert(read(file).includes('Tag') && (read(file).includes('不会随') || read(file).includes('不变')), file)
  assert(read('docs/full-validation.md').includes('历史 v1.2.0 记录'))
})
test('future filename migration is assessment-only and preserves old download links', () => {
  const text = read('docs/release-assets.md')
  assert(text.includes('Glassmorphism-Enhanced-vX.Y.Z.zip'))
  assert(text.includes('本轮仅完成影响评估，不激活命名迁移'))
  assert(text.includes('恰有一个 `.zip`'))
  assert(text.includes('/releases/download/v1.2.1/komari-theme-Glassmorphism-build-0332d5f.zip'))
})
