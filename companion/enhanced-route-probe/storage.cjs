'use strict'
// Atomic 0600 checkpoint pattern selectively adapted from Transit storage.cjs,
// Copyright (c) 2026 yyy622hhh; Copyright (c) 2025 Tony Liu. MIT; see LICENSE.
// Unlike the upstream retry/merge implementation this relay fails closed on I/O
// errors: it never leases work or claims durable acceptance without a checkpoint.
class Store {
  constructor(fs, path, directory, coordinator) {
    if (!directory)
      throw new Error('private plugin storage unavailable')
    this.fs = fs
    this.path = path
    this.directory = directory
    this.coordinator = coordinator
    this.file = path.join(directory, 'state-v1.json')
    this.healthy = false
  }

  restore() {
    this.fs.mkdirSync(this.directory, { recursive: true })
    if (this.fs.existsSync(this.file)) {
      const source = this.fs.readFileSync(this.file, 'utf8')
      if (source.length > 4194304)
        throw new Error('state exceeds limit; restore a backup')
      this.coordinator.importState(JSON.parse(source))
    }
    this.save()
  }

  save() {
    const temporary = this.path.join(this.directory, 'state-v1.pending')
    this.healthy = false
    // unlink only our fixed private temp name; do not follow an old symlink.
    if (this.fs.existsSync(temporary))
      this.fs.unlinkSync(temporary)
    this.fs.writeFileSync(temporary, JSON.stringify(this.coordinator.exportState()), { encoding: 'utf8', mode: 0o600 })
    this.fs.renameSync(temporary, this.file)
    this.healthy = true
  }
}
module.exports = { Store }
