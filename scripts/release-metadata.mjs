// Release text is version-specific; existing release repair is PATCH-only.
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Z.-]+)?$/i
const ZERO = '0000000000000000000000000000000000000000'
const HEADER = /^# ([^\r\n]+)$/
const REGEXP_META = /[.*+?^${}()|[\]\\]/g
export function currentVersion(root) {
  const version = JSON.parse(readFileSync(join(root, 'komari-theme.json'), 'utf8')).version
  if (typeof version !== 'string' || !VERSION.test(version))
    throw new Error('Invalid komari-theme.json version; release refused')
  return version
}
export function detectVersion(root, beforeSha) {
  const version = currentVersion(root)
  let previous = ''
  let changed = true
  let notesChanged = false
  if (beforeSha && beforeSha !== ZERO) {
    try {
      previous = JSON.parse(execFileSync('git', ['show', `${beforeSha}:komari-theme.json`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).version ?? ''
      changed = previous !== version
      const paths = execFileSync('git', ['diff', '--name-only', beforeSha, 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split('\n')
      notesChanged = paths.includes(`docs/release-notes-v${version}.md`)
    }
    catch {
      // Preserve the existing first-push/unreadable-baseline version policy.
      changed = true
    }
  }
  return { current_version: version, previous_version: previous, version_changed: String(changed), release_tag: `v${version}`, notes_changed: String(notesChanged) }
}
export function releaseMetadata(root) {
  const version = currentVersion(root)
  const path = join(root, 'docs', `release-notes-v${version}.md`)
  if (!existsSync(path) || !lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
    throw new Error(`Missing version-specific Release Notes: docs/release-notes-v${version}.md; release refused, no fallback`)
  if (dirname(realpathSync(path)) !== realpathSync(join(root, 'docs')))
    throw new Error('Release Notes must be inside the repository docs directory')
  const text = readFileSync(path, 'utf8').replaceAll('\r\n', '\n').trim()
  const lines = text.split('\n')
  const title = HEADER.exec(lines[0])?.[1]
  const expected = new RegExp(`(?:^|[^\\d.])v?${version.replace(REGEXP_META, '\\$&')}(?![\\d.])`)
  if (!title || !expected.test(title))
    throw new Error(`Release Notes heading does not match ${version}; release refused`)
  // The GitHub Release title already contains vX.Y.Z. Do not repeat the H1.
  const body = lines.slice(1).join('\n').trim()
  if (!body)
    throw new Error('Empty Release Notes body; release refused')
  return { version, tag: `v${version}`, name: `v${version}`, body, notesPath: path }
}
export function immutableRelease(release) {
  return {
    id: release.id,
    tag_name: release.tag_name,
    target_commitish: release.target_commitish,
    published_at: release.published_at,
    draft: release.draft,
    prerelease: release.prerelease,
    assets: release.assets.map(a => ({ id: a.id, name: a.name, size: a.size, digest: a.digest, state: a.state, browser_download_url: a.browser_download_url })).sort((a, b) => a.id - b.id),
  }
}
export async function updateExistingRelease({ github, owner, repo, metadata }) {
  const before = (await github.rest.repos.getReleaseByTag({ owner, repo, tag: metadata.tag })).data
  const tagBefore = (await github.rest.git.getRef({ owner, repo, ref: `tags/${metadata.tag}` })).data.object
  if (before.draft || before.prerelease || before.tag_name !== metadata.tag)
    throw new Error('Expected an existing published stable release; no create fallback')
  // Deliberately no target_commitish, draft, prerelease, tag or asset fields.
  await github.rest.repos.updateRelease({ owner, repo, release_id: before.id, name: metadata.name, body: metadata.body })
  const after = (await github.rest.repos.getReleaseByTag({ owner, repo, tag: metadata.tag })).data
  const tagAfter = (await github.rest.git.getRef({ owner, repo, ref: `tags/${metadata.tag}` })).data.object
  if (JSON.stringify(immutableRelease(before)) !== JSON.stringify(immutableRelease(after)) || JSON.stringify(tagBefore) !== JSON.stringify(tagAfter))
    throw new Error('Release identity, Tag or assets changed during metadata-only update')
  if (after.name !== metadata.name || after.body !== metadata.body)
    throw new Error('Release metadata readback mismatch')
  return { id: after.id, previousName: before.name, name: after.name, tag: after.tag_name, assetCount: after.assets.length, tagUnchanged: true, assetsUnchanged: true }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd()
  const command = process.argv[2]
  if (command === 'detect') {
    for (const [key, value] of Object.entries(detectVersion(root, process.env.BEFORE_SHA)))
      console.log(`${key}=${value}`)
  }
  else if (command === 'prepare') {
    const metadata = releaseMetadata(root)
    const output = 'test-results/release/current-release-notes.md'
    mkdirSync(dirname(join(root, output)), { recursive: true })
    writeFileSync(join(root, output), `${metadata.body}\n`)
    console.log(`body_path=${output}`)
    console.log(`release_name=${metadata.name}`)
  }
  else {
    throw new Error('Usage: release-metadata.mjs detect|prepare')
  }
}
