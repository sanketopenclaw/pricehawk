// Patch Module._load to intercept require('axios') in CJS tests
// This is needed because pool: 'forks' doesn't intercept native require() with vi.mock()
const Module = require('module')
const { fn } = require('@vitest/spy')

const axiosMock = {
  post: fn(),
  get: fn(),
  head: fn().mockResolvedValue({ status: 200 }),
  create: fn(),
  defaults: { headers: { common: {} } },
}

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'axios') {
    return axiosMock
  }
  return originalLoad.call(this, request, parent, isMain)
}

// Expose to global so tests can clear it via beforeEach
globalThis.__axiosMock = axiosMock
