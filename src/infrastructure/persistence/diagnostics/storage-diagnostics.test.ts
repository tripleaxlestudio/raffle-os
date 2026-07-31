import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  runStorageCapabilityDiagnostic,
} from './storage-diagnostics.ts'

describe('Storage Capability Diagnostic', () => {
  let fakeIndexedDb: IDBFactory

  beforeEach(() => {
    fakeIndexedDb = new IDBFactory()
  })

  it('completes all probe stages successfully on a functional IndexedDB implementation', async () => {
    const result = await runStorageCapabilityDiagnostic({
      indexedDBFactory: fakeIndexedDb,
    })

    expect(result.success).toBe(true)
    expect(result.failedStage).toBeUndefined()
    expect(result.error).toBeUndefined()
    expect(result.cleanupSucceeded).toBe(true)

    // Verify temporary database was deleted during cleanup
    const databases = await fakeIndexedDb.databases()
    expect(databases.length).toBe(0)
  })

  it('handles open stage failure gracefully and attempts cleanup', async () => {
    const failingFactory = new IDBFactory()
    failingFactory.open = () => {
      const req = {} as IDBOpenDBRequest
      setTimeout(() => {
        if (req.onerror) {
          Object.defineProperty(req, 'error', {
            value: new DOMException('Open failed', 'UnknownError'),
          })
          req.onerror({} as Event)
        }
      }, 0)
      return req
    }

    const result = await runStorageCapabilityDiagnostic({
      indexedDBFactory: failingFactory,
    })

    expect(result.success).toBe(false)
    expect(result.failedStage).toBe('open')
    expect(result.error).toBeDefined()
    expect(result.cleanupSucceeded).toBe(true)
  })

  it('handles schema creation failure gracefully and attempts cleanup', async () => {
    const failingFactory = new IDBFactory()
    failingFactory.open = () => {
      const req = {} as IDBOpenDBRequest
      setTimeout(() => {
        if (req.onupgradeneeded) {
          Object.defineProperty(req, 'result', {
            value: {
              createObjectStore: () => {
                throw new DOMException('Schema failed', 'InvalidStateError')
              },
              objectStoreNames: { contains: () => false },
            },
          })
          try {
            req.onupgradeneeded({} as IDBVersionChangeEvent)
          } catch (err) {
            if (req.onerror) {
              Object.defineProperty(req, 'error', { value: err })
              req.onerror({} as Event)
            }
          }
        }
      }, 0)
      return req
    }

    const result = await runStorageCapabilityDiagnostic({
      indexedDBFactory: failingFactory,
    })

    expect(result.success).toBe(false)
    expect(result.failedStage).toBe('schema')
    expect(result.error).toBeDefined()
    expect(result.cleanupSucceeded).toBe(true)
  })

  it('handles write stage failure gracefully and attempts cleanup', async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = fakeIndexedDb.open('Test_Write_Fail', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('sentinels', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
    })

    // Mock store.put failure
    const realTx = db.transaction.bind(db)
    db.transaction = (storeNames, mode) => {
      const tx = realTx(storeNames, mode)
      if (mode === 'readwrite') {
        const store = tx.objectStore('sentinels')
        store.put = () => {
          const req = {} as IDBRequest
          setTimeout(() => {
            if (req.onerror) {
              Object.defineProperty(req, 'error', {
                value: new DOMException('Write quota exceeded', 'QuotaExceededError'),
              })
              req.onerror({} as Event)
            }
          }, 0)
          return req
        }
      }
      return tx
    }

    const failingFactory = new IDBFactory()
    failingFactory.open = () => {
      const req = {} as IDBOpenDBRequest
      setTimeout(() => {
        if (req.onsuccess) {
          Object.defineProperty(req, 'result', { value: db })
          req.onsuccess({} as Event)
        }
      }, 0)
      return req
    }

    const result = await runStorageCapabilityDiagnostic({
      indexedDBFactory: failingFactory,
    })

    expect(result.success).toBe(false)
    expect(result.failedStage).toBe('write')
    expect(result.error).toBeDefined()
    expect(result.cleanupSucceeded).toBe(true)
  })

  it('handles read stage failure gracefully and attempts cleanup', async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = fakeIndexedDb.open('Test_Read_Fail', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('sentinels', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
    })

    const realTx = db.transaction.bind(db)
    db.transaction = (storeNames, mode) => {
      const tx = realTx(storeNames, mode)
      if (mode === 'readonly') {
        const store = tx.objectStore('sentinels')
        store.get = () => {
          const req = {} as IDBRequest
          setTimeout(() => {
            if (req.onerror) {
              Object.defineProperty(req, 'error', {
                value: new DOMException('Read failed', 'UnknownError'),
              })
              req.onerror({} as Event)
            }
          }, 0)
          return req
        }
      }
      return tx
    }

    const failingFactory = new IDBFactory()
    failingFactory.open = () => {
      const req = {} as IDBOpenDBRequest
      setTimeout(() => {
        if (req.onsuccess) {
          Object.defineProperty(req, 'result', { value: db })
          req.onsuccess({} as Event)
        }
      }, 0)
      return req
    }

    const result = await runStorageCapabilityDiagnostic({
      indexedDBFactory: failingFactory,
    })

    expect(result.success).toBe(false)
    expect(result.failedStage).toBe('read')
    expect(result.error).toBeDefined()
    expect(result.cleanupSucceeded).toBe(true)
  })

  it('handles sentinel verification mismatch stage gracefully and attempts cleanup', async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = fakeIndexedDb.open('Test_Verify_Fail', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('sentinels', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
    })

    const realTx = db.transaction.bind(db)
    db.transaction = (storeNames, mode) => {
      const tx = realTx(storeNames, mode)
      if (mode === 'readonly') {
        const store = tx.objectStore('sentinels')
        store.get = () => {
          const req = {} as IDBRequest
          setTimeout(() => {
            if (req.onsuccess) {
              Object.defineProperty(req, 'result', {
                value: { id: 'sentinel', value: 'CORRUPTED_VALUE' },
              })
              req.onsuccess({} as Event)
            }
          }, 0)
          return req
        }
      }
      return tx
    }

    const failingFactory = new IDBFactory()
    failingFactory.open = () => {
      const req = {} as IDBOpenDBRequest
      setTimeout(() => {
        if (req.onsuccess) {
          Object.defineProperty(req, 'result', { value: db })
          req.onsuccess({} as Event)
        }
      }, 0)
      return req
    }

    const result = await runStorageCapabilityDiagnostic({
      indexedDBFactory: failingFactory,
    })

    expect(result.success).toBe(false)
    expect(result.failedStage).toBe('verify')
    expect(result.error?.message).toContain('verification mismatch')
    expect(result.cleanupSucceeded).toBe(true)
  })

  it('handles delete-record stage failure gracefully and attempts cleanup', async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = fakeIndexedDb.open('Test_Delete_Fail', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('sentinels', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
    })

    let writeCount = 0
    const realTx = db.transaction.bind(db)
    db.transaction = (storeNames, mode) => {
      const tx = realTx(storeNames, mode)
      if (mode === 'readwrite') {
        writeCount++
        if (writeCount > 1) {
          // Second readwrite tx is delete-record
          const store = tx.objectStore('sentinels')
          store.delete = () => {
            const req = {} as IDBRequest
            setTimeout(() => {
              if (req.onerror) {
                Object.defineProperty(req, 'error', {
                  value: new DOMException('Delete failed', 'UnknownError'),
                })
                req.onerror({} as Event)
              }
            }, 0)
            return req
          }
        }
      }
      return tx
    }

    const failingFactory = new IDBFactory()
    failingFactory.open = () => {
      const req = {} as IDBOpenDBRequest
      setTimeout(() => {
        if (req.onsuccess) {
          Object.defineProperty(req, 'result', { value: db })
          req.onsuccess({} as Event)
        }
      }, 0)
      return req
    }

    const result = await runStorageCapabilityDiagnostic({
      indexedDBFactory: failingFactory,
    })

    expect(result.success).toBe(false)
    expect(result.failedStage).toBe('delete-record')
    expect(result.error).toBeDefined()
    expect(result.cleanupSucceeded).toBe(true)
  })

  it('handles verify-delete failure when sentinel still exists after deletion attempt', async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = fakeIndexedDb.open('Test_Verify_Delete_Fail', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('sentinels', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
    })

    let readCount = 0
    const realTx = db.transaction.bind(db)
    db.transaction = (storeNames, mode) => {
      const tx = realTx(storeNames, mode)
      if (mode === 'readonly') {
        readCount++
        if (readCount === 2) {
          // Second read is verify-delete
          const store = tx.objectStore('sentinels')
          store.get = () => {
            const req = {} as IDBRequest
            setTimeout(() => {
              if (req.onsuccess) {
                Object.defineProperty(req, 'result', {
                  value: { id: 'sentinel', value: 'still-exists' },
                })
                req.onsuccess({} as Event)
              }
            }, 0)
            return req
          }
        }
      }
      return tx
    }

    const failingFactory = new IDBFactory()
    failingFactory.open = () => {
      const req = {} as IDBOpenDBRequest
      setTimeout(() => {
        if (req.onsuccess) {
          Object.defineProperty(req, 'result', { value: db })
          req.onsuccess({} as Event)
        }
      }, 0)
      return req
    }

    const result = await runStorageCapabilityDiagnostic({
      indexedDBFactory: failingFactory,
    })

    expect(result.success).toBe(false)
    expect(result.failedStage).toBe('verify-delete')
    expect(result.error?.message).toContain('delete verification failed')
    expect(result.cleanupSucceeded).toBe(true)
  })

  it('handles delete-database stage failure gracefully', async () => {
    const failingFactory = new IDBFactory()
    failingFactory.deleteDatabase = () => {
      const req = {} as IDBOpenDBRequest
      setTimeout(() => {
        if (req.onerror) {
          Object.defineProperty(req, 'error', {
            value: new DOMException('Delete database blocked', 'UnknownError'),
          })
          req.onerror({} as Event)
        }
      }, 0)
      return req
    }

    const result = await runStorageCapabilityDiagnostic({
      indexedDBFactory: failingFactory,
    })

    expect(result.success).toBe(false)
    expect(result.failedStage).toBe('delete-database')
    expect(result.cleanupSucceeded).toBe(false)
  })

  it('never touches RaffleOS_DB and uses unique temporary names', async () => {
    const result = await runStorageCapabilityDiagnostic({
      indexedDBFactory: fakeIndexedDb,
    })

    expect(result.success).toBe(true)
    const databases = await fakeIndexedDb.databases()
    expect(databases.find((d) => d.name === 'RaffleOS_DB')).toBeUndefined()
  })
})
