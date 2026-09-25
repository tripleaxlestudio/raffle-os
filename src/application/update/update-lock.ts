export type UpdateLockState = 'idle' | 'preparing' | 'ready-to-install'

export class UpdateOperationLockedError extends Error {
  constructor() {
    super('Aplikasi sedang menyiapkan pembaruan. Operasi undian baru tidak dapat dimulai.')
    this.name = 'UpdateOperationLockedError'
  }
}

export class UpdateOperationLock {
  #state: UpdateLockState = 'idle'

  getState(): UpdateLockState {
    return this.#state
  }

  isActive(): boolean {
    return this.#state !== 'idle'
  }

  assertDrawOperationAllowed(): void {
    if (this.isActive()) throw new UpdateOperationLockedError()
  }

  async acquire(validate: () => Promise<boolean>): Promise<boolean> {
    if (this.isActive()) return false
    // The tentative lock is synchronous so no draw-critical operation can enter
    // while the second authoritative safety read is in flight.
    this.#state = 'preparing'
    try {
      if (!await validate()) {
        this.#state = 'idle'
        return false
      }
      return true
    } catch (cause: unknown) {
      this.#state = 'idle'
      throw cause
    }
  }

  markReadyToInstall(): void {
    if (this.#state === 'preparing') this.#state = 'ready-to-install'
  }

  async revalidate(validate: () => Promise<boolean>): Promise<boolean> {
    if (!this.isActive()) return false
    return validate()
  }

  release(): void {
    this.#state = 'idle'
  }
}

export const productionUpdateLock = new UpdateOperationLock()
