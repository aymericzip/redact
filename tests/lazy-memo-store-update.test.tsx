import { expect, it } from 'vitest'
import { act, lazy, memo, Suspense, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'

const createStore = <Value,>(initialValue: Value) => {
  let value = initialValue
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (nextValue: Value) => {
      value = nextValue
      listeners.forEach(listener => listener())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

it('updates a lazy memo component when an ancestor reads the same store', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const store = createStore(false)

  const Panel = lazy(async () => ({
    default: memo(() => {
      const isOpen = useSyncExternalStore(store.subscribe, store.get)
      return <span id="child">{String(isOpen)}</span>
    }),
  }))

  const App = () => {
    const isOpen = useSyncExternalStore(store.subscribe, store.get)
    return (
      <div id="parent" title={String(isOpen)}>
        <Suspense fallback="Loading">
          <Panel />
        </Suspense>
      </div>
    )
  }

  try {
    await act(async () => {
      root.render(<App />)
    })
    expect(container.querySelector('#child')?.textContent).toBe('false')

    await act(() => store.set(true))

    expect(container.querySelector('#parent')?.getAttribute('title')).toBe('true')
    expect(container.querySelector('#child')?.textContent).toBe('true')
  } finally {
    await act(() => root.unmount())
  }
})
