import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { getAttributionAttrs, getFirstTouchAttrs } from './cart'

const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

function installStorage(): void {
  const store = new Map<string, string>()
  const storage = {
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
    key() {
      return null
    },
    get length() {
      return store.size
    },
  }
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
}

function restore(
  name: 'window' | 'localStorage',
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor)
  else Reflect.deleteProperty(globalThis, name)
}

afterEach(() => {
  restore('window', priorWindow)
  restore('localStorage', priorStorage)
})

function clickIds(attrs: Array<{ key: string; value: string }>, prefix: string) {
  return attrs.filter(
    (attr) =>
      attr.key === `${prefix}gclid` ||
      attr.key === `${prefix}gbraid` ||
      attr.key === `${prefix}wbraid`
  )
}

test('last-touch attrs stamp gbraid and wbraid immediately after gclid', () => {
  installStorage()
  localStorage.setItem(
    '_pd_attribution',
    JSON.stringify({
      gclid: 'G',
      gbraid: 'X',
      wbraid: 'Y',
      _timestamp: Date.now(),
    })
  )

  assert.deepEqual(clickIds(getAttributionAttrs(), '_pd_'), [
    { key: '_pd_gclid', value: 'G' },
    { key: '_pd_gbraid', value: 'X' },
    { key: '_pd_wbraid', value: 'Y' },
  ])
})

test('first-touch attrs stamp gbraid and wbraid immediately after gclid', () => {
  installStorage()
  localStorage.setItem(
    '_pd_first_touch',
    JSON.stringify({
      gclid: 'G',
      gbraid: 'X',
      wbraid: 'Y',
      _timestamp: Date.now(),
    })
  )

  assert.deepEqual(clickIds(getFirstTouchAttrs(), '_pd_ft_'), [
    { key: '_pd_ft_gclid', value: 'G' },
    { key: '_pd_ft_gbraid', value: 'X' },
    { key: '_pd_ft_wbraid', value: 'Y' },
  ])
})
