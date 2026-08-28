import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OperatorPersistenceStatus } from './OperatorPersistenceStatus.tsx'

describe('OperatorPersistenceStatus', () => {
  it('describes a saved local state', () => {
    render(<OperatorPersistenceStatus kind="saved" detail="The Event is available locally." />)
    expect(screen.getByTestId('operator-persistence-status')).toHaveTextContent('Saved locally')
    expect(screen.getByRole('status')).toHaveTextContent('available locally')
  })

  it('exposes a retry action for failed persistence', () => {
    const onAction = vi.fn()
    render(<OperatorPersistenceStatus actionLabel="Retry read" detail="Read failed." kind="failed" onAction={onAction} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed')
    expect(screen.getByRole('button', { name: 'Retry read' })).toBeEnabled()
  })
})
