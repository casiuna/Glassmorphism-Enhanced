/* eslint test/no-import-node-test: off -- This suite deliberately uses Node's built-in runner, with no Vitest dependency. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { detectVersion, immutableRelease, releaseMetadata, updateExistingRelease } from '../../scripts/release-metadata.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CI_PREFIX = '$'
const temp = join(root, 'test-results/release-metadata-tests')
mkdirSync(temp, { recursive: true })
function fixture(version = '9.8.7', body = '## 原生主题安装\n\nA native ZIP is enough.') {
  const dir = mkdtempSync(join(temp, 'case-'))
  mkdirSync(join(dir, 'docs'))
  writeFileSync(join(dir, 'komari-theme.json'), JSON.stringify({ version }))
  writeFileSync(join(dir, 'docs', `release-notes-v${version}.md`), `# Glassmorphism Enhanced v${version}\n\n${body}\n`)
  return dir
}
function git(dir, ...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function commit(dir) {
  git(dir, 'add', '.')
  git(dir, '-c', 'user.name=Release Test Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'explicit test fixture')
  return git(dir, 'rev-parse', 'HEAD')
}
test('actual manifest selects exactly its matching notes, with tag-only title and no duplicate H1', () => {
  const m = releaseMetadata(root)
  const version = JSON.parse(readFileSync(join(root, 'komari-theme.json'), 'utf8')).version
  assert.equal(m.name, `v${version}`)
  assert.equal(m.notesPath, join(root, 'docs', `release-notes-v${version}.md`))
  assert(!m.body.startsWith('# Glassmorphism Enhanced'))
})
test('a future version reads future notes rather than a hard-coded current release', () => {
  const dir = fixture()
  writeFileSync(join(dir, 'docs/release-notes-v1.2.1.md'), '# v1.2.1\n\nSTALE NOTES')
  const m = releaseMetadata(dir)
  assert.equal(m.name, 'v9.8.7')
  assert(!m.body.includes('STALE NOTES'))
  assert(m.body.includes('native ZIP'))
})
test('missing notes refuse publication even if old-version notes exist', () => {
  const dir = fixture()
  rmSync(join(dir, 'docs/release-notes-v9.8.7.md'))
  writeFileSync(join(dir, 'docs/release-notes-v1.2.1.md'), '# v1.2.1\n\nOLD')
  assert.throws(() => releaseMetadata(dir), /Missing version-specific Release Notes/)
})
test('renaming old notes to a new filename is rejected by its heading version', () => {
  const dir = fixture()
  writeFileSync(join(dir, 'docs/release-notes-v9.8.7.md'), '# v1.2.1\n\nOLD')
  assert.throws(() => releaseMetadata(dir), /heading does not match/)
})
test('empty version notes refuse publication', () => {
  const dir = fixture('9.8.7', '')
  assert.throws(() => releaseMetadata(dir), /Empty Release Notes/)
})
for (const version of ['../1.2.1', '1.2.1\nname=BAD', 123, 'v1.2.1']) {
  test(`invalid literal version refuses ${JSON.stringify(version)}`, () => {
    const dir = fixture()
    writeFileSync(join(dir, 'komari-theme.json'), JSON.stringify({ version }))
    assert.throws(() => releaseMetadata(dir), /Invalid komari-theme.json/)
  })
}
test('unchanged manifest skips publication and detects notes-only repair separately', () => {
  const dir = fixture()
  git(dir, 'init', '--quiet')
  const before = commit(dir)
  assert.equal(detectVersion(dir, before).version_changed, 'false')
  assert.equal(detectVersion(dir, before).notes_changed, 'false')
  writeFileSync(join(dir, 'docs/release-notes-v9.8.7.md'), '# v9.8.7\n\nCorrected current notes')
  commit(dir)
  const d = detectVersion(dir, before)
  assert.equal(d.version_changed, 'false')
  assert.equal(d.notes_changed, 'true')
  assert.equal(d.release_tag, 'v9.8.7')
})
test('new manifest version preserves the existing version-change trigger', () => {
  const dir = fixture()
  git(dir, 'init', '--quiet')
  const before = commit(dir)
  writeFileSync(join(dir, 'komari-theme.json'), '{"version":"9.8.8"}')
  commit(dir)
  const d = detectVersion(dir, before)
  assert.equal(d.version_changed, 'true')
  assert.equal(d.release_tag, 'v9.8.8')
  assert.throws(() => releaseMetadata(dir), /Missing version-specific/)
})
test('initial push retains the existing version-change behavior', () => {
  const dir = fixture()
  assert.equal(detectVersion(dir, '0000000000000000000000000000000000000000').version_changed, 'true')
})
function client() {
  const release = { id: 7, tag_name: 'v9.8.7', target_commitish: 'original-release-commit', published_at: '2026-01-01T00:00:00Z', draft: false, prerelease: false, name: 'OLD TITLE', body: 'OLD BODY', assets: [{ id: 9, name: 'unchanged.zip', size: 42, digest: 'sha256:fixture', state: 'uploaded', browser_download_url: 'https://example.invalid/unchanged.zip' }] }
  const tag = { type: 'tag', sha: 'original-annotated-tag', url: 'https://example.invalid/tag' }
  const calls = []
  const github = { rest: { repos: {
    getReleaseByTag: async () => ({ data: structuredClone(release) }),
    updateRelease: async (data) => {
      calls.push(data)
      release.name = data.name
      release.body = data.body
    },
  }, git: { getRef: async () => ({ data: { object: structuredClone(tag) } }) } } }
  return { release, github, calls }
}
test('metadata repair uses only updateRelease(name,body), preserves ID, tag and assets, and reads back', async () => {
  const c = client()
  const before = immutableRelease(c.release)
  const metadata = { name: 'v9.8.7', tag: 'v9.8.7', body: '## 原生主题安装\n\nUpdated docs' }
  const r = await updateExistingRelease({ github: c.github, owner: 'owner', repo: 'repo', metadata })
  assert.equal(r.id, 7)
  assert.deepEqual(c.calls, [{ owner: 'owner', repo: 'repo', release_id: 7, name: metadata.name, body: metadata.body }])
  assert.deepEqual(immutableRelease(c.release), before)
  assert.equal(r.tagUnchanged, true)
  assert.equal(r.assetsUnchanged, true)
})
test('a missing existing release does not fall back to create or tag mutation', async () => {
  const c = client()
  c.github.rest.repos.getReleaseByTag = async () => {
    throw new Error('404')
  }
  await assert.rejects(updateExistingRelease({ github: c.github, owner: 'o', repo: 'r', metadata: { tag: 'v9.8.7' } }), /404/)
  assert.equal(c.calls.length, 0)
})
test('metadata readback mismatch fails rather than claiming success', async () => {
  const c = client()
  c.github.rest.repos.updateRelease = async () => {}
  await assert.rejects(updateExistingRelease({ github: c.github, owner: 'o', repo: 'r', metadata: { tag: 'v9.8.7', name: 'v9.8.7', body: 'new' } }), /readback mismatch/)
})
test('asset mutation during metadata repair is detected', async () => {
  const c = client()
  const update = c.github.rest.repos.updateRelease
  c.github.rest.repos.updateRelease = async (data) => {
    await update(data)
    c.release.assets[0].digest = 'changed'
  }
  await assert.rejects(updateExistingRelease({ github: c.github, owner: 'o', repo: 'r', metadata: { tag: 'v9.8.7', name: 'v9.8.7', body: 'new' } }), /identity, Tag or assets changed/)
})
test('workflow keeps every tag/build/asset publication step version-change gated', () => {
  const workflow = readFileSync(join(root, '.github/workflows/release-on-version-bump.yml'), 'utf8')
  assert(!workflow.includes('Glassmorphism Enhanced v1.2.1'))
  assert(!workflow.includes('## Glassmorphism Enhanced'))
  assert(workflow.includes(`name: ${CI_PREFIX}{{ steps.version.outputs.release_tag }}`))
  assert(workflow.includes(`body_path: ${CI_PREFIX}{{ steps.notes.outputs.body_path }}`))
  const blocks = workflow.split('      - name: ')
  for (const name of ['Check release tag state', 'Build project', 'Build stable Full archive', 'Verify stable archives and installer', 'Create and push release tag', 'Create or update GitHub release']) {
    const block = blocks.find(b => b.startsWith(`${name}\n`))
    assert(block?.includes('steps.version.outputs.version_changed == \'true\''), name)
  }
  const repair = blocks.find(b => b.startsWith('Update existing release metadata only\n'))
  assert(repair?.includes('steps.version.outputs.version_changed != \'true\' && steps.version.outputs.notes_changed == \'true\''))
})
