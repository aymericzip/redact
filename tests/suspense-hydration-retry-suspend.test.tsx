import { expect, it, vi } from 'vitest'
import * as React from 'react'
import { hydrateRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

it('waits when a boundary suspends while recovering from a mismatch during its hydration retry', async () => {
  const container = document.body.appendChild(document.createElement('div'))
  container.innerHTML = '<main><!--$--><p>Server</p><!--/$--></main>'

  let resolveFirst!: () => void
  let resolveSecond!: () => void
  const first = new Promise<void>(resolve => { resolveFirst = resolve })
  const second = new Promise<void>(resolve => { resolveSecond = resolve })
  let firstDone = false
  let secondDone = false
  first.then(() => { firstDone = true })
  second.then(() => { secondDone = true })

  function Lazy() {
    if (!secondDone) throw second
    return <p>Client</p>
  }

  // Suspends during the initial hydration. Once `first` settles the boundary
  // retries, its markup no longer matches the server, and the client render
  // used to recover from that suspends on `second`.
  function Content() {
    if (!firstDone) throw first
    return <><h1>Mismatch</h1><Lazy /></>
  }

  // An error boundary above the Suspense boundary, as routers add around pages.
  class Catch extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false }
    static getDerivedStateFromError() { return { failed: true } }
    render() { return this.state.failed ? <b>Failed</b> : this.props.children }
  }

  const uncaught: unknown[] = []
  const onError = (event: ErrorEvent) => {
    uncaught.push(event.error)
    event.preventDefault()
  }
  window.addEventListener('error', onError)

  const root = hydrateRoot(
    container,
    <main><Catch><React.Suspense fallback={<i>Loading</i>}><Content /></React.Suspense></Catch></main>,
    { onUncaughtError: error => uncaught.push(error), onRecoverableError: () => {} },
  )

  try {
    resolveFirst()
    await first
    // Let the retry scheduled on `first` run while `second` is still pending.
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(uncaught).toEqual([])

    resolveSecond()
    await vi.waitFor(() => expect(container.querySelector('main')!.textContent).toBe('MismatchClient'))
    expect(uncaught).toEqual([])
  } finally {
    resolveFirst()
    resolveSecond()
    window.removeEventListener('error', onError)
    flushSync(() => root.unmount())
    container.remove()
  }
})
