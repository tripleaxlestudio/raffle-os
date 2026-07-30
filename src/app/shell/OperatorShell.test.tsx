import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type {
  AppMode,
  DisplayConnectionStatus,
} from '../../domain/types/index.ts'
import { ConnectionStatus } from './ConnectionStatus.tsx'
import { ModeBadge } from './ModeBadge.tsx'

const modeCases = [
  ['practice', 'Practice Mode'],
  ['live', 'Live Mode'],
] satisfies ReadonlyArray<readonly [AppMode, string]>

const connectionCases = [
  ['disconnected', 'Audience Display: Disconnected'],
  ['connecting', 'Audience Display: Connecting'],
  ['connected', 'Audience Display: Connected'],
] satisfies ReadonlyArray<readonly [DisplayConnectionStatus, string]>

describe('ModeBadge', () => {
  it.each(modeCases)('renders the %s variant', (mode, label) => {
    render(<ModeBadge mode={mode} />)

    const badge = screen.getByText(label)
    expect(badge).toHaveAttribute('data-mode', mode)
  })
})

describe('ConnectionStatus', () => {
  it.each(connectionCases)('renders the %s variant', (status, label) => {
    render(<ConnectionStatus status={status} />)

    const connectionStatus = screen.getByRole('status', { name: label })
    expect(connectionStatus).toHaveAttribute('data-connection-status', status)
  })
})
