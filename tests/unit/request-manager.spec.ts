import { expect, test } from '@playwright/test'
import { REQUEST_CONFIG } from '../../src/constants/request'
import { RequestManager } from '../../src/services/request.service'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

test('cancelled active request cannot remove a same-key replacement', async () => {
  const manager = new RequestManager()
  const firstTask = deferred<string>()
  const replacementTask = deferred<string>()
  const requests: Promise<unknown>[] = []
  let replacementCalls = 0
  let duplicateCalls = 0

  try {
    const first = manager.run('shared', () => firstTask.promise, { retryAttempts: 0 })
    requests.push(first)
    const aborted = expect(first).rejects.toMatchObject({ name: 'AbortError' })

    manager.abort('shared')
    const replacement = manager.run('shared', () => {
      replacementCalls += 1
      return replacementTask.promise
    }, { retryAttempts: 0 })
    requests.push(replacement)

    // Wait for A's finally after B has already registered, without resolving B.
    await aborted
    const reused = manager.run('shared', async () => {
      duplicateCalls += 1
      return 'unexpected duplicate'
    })
    requests.push(reused)

    expect(reused).toBe(replacement)
    expect(replacementCalls).toBe(1)
    expect(duplicateCalls).toBe(0)
    replacementTask.resolve('replacement result')
    await expect(reused).resolves.toBe('replacement result')
  }
  finally {
    const settled = Promise.allSettled(requests)
    manager.abortAll()
    firstTask.resolve('discarded result')
    replacementTask.resolve('replacement result')
    await settled
  }
})

test('cancelled queued request cannot remove a same-key replacement', async () => {
  const manager = new RequestManager()
  const blockerTask = deferred<string>()
  const replacementTask = deferred<string>()
  const replacementStarted = deferred<void>()
  const requests: Promise<unknown>[] = []
  let firstCalls = 0
  let replacementCalls = 0
  let duplicateCalls = 0

  try {
    // Fill the real pool so A and its replacement both have to queue.
    const blockers = Array.from({ length: REQUEST_CONFIG.pool.maxConcurrent }, (_, index) =>
      manager.run(`blocker:${index}`, () => blockerTask.promise, { retryAttempts: 0 }))
    requests.push(...blockers)
    const first = manager.run('shared', async () => {
      firstCalls += 1
      return 'cancelled before starting'
    })
    requests.push(first)
    const aborted = expect(first).rejects.toMatchObject({ name: 'AbortError' })

    manager.abort('shared')
    const replacement = manager.run('shared', () => {
      replacementCalls += 1
      replacementStarted.resolve()
      return replacementTask.promise
    }, { retryAttempts: 0 })
    requests.push(replacement)

    await aborted
    const reused = manager.run('shared', async () => {
      duplicateCalls += 1
      return 'unexpected duplicate'
    })
    requests.push(reused)

    expect(reused).toBe(replacement)
    expect(firstCalls).toBe(0)
    expect(replacementCalls).toBe(0)
    blockerTask.resolve('pool released')
    await replacementStarted.promise
    expect(replacementCalls).toBe(1)
    expect(duplicateCalls).toBe(0)
    replacementTask.resolve('replacement result')
    await expect(reused).resolves.toBe('replacement result')
  }
  finally {
    const settled = Promise.allSettled(requests)
    manager.abortAll()
    blockerTask.resolve('pool released')
    replacementTask.resolve('replacement result')
    await settled
  }
})

test('settled requests release their own key after success and failure', async () => {
  const manager = new RequestManager()
  const first = manager.run('shared', async () => 'first result')
  await expect(first).resolves.toBe('first result')

  const failure = new Error('request failed')
  const failed = manager.run('shared', async () => {
    throw failure
  }, { retryAttempts: 0 })
  expect(failed).not.toBe(first)
  await expect(failed).rejects.toBe(failure)

  const next = manager.run('shared', async () => 'next result')
  expect(next).not.toBe(failed)
  await expect(next).resolves.toBe('next result')
})
