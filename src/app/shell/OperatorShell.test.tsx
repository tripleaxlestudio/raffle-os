import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type {
  AppMode,
  DisplayConnectionStatus,
} from '../../domain/types/index.ts'
import { ConnectionStatus } from './ConnectionStatus.tsx'
import { ModeBadge } from './ModeBadge.tsx'
import { OperatorHeader } from './OperatorHeader.tsx'

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

describe('OperatorHeader chrome', () => {
  const props = {
    connectionStatus: 'connected' as DisplayConnectionStatus,
    eventName: 'Acceptance Event',
    eventSchedule: 'Status: live',
    mode: 'practice' as AppMode,
    onScenarioChange: vi.fn(),
    scenario: 'ready' as const,
  }

  it('hides prototype controls and status indicators for production chrome', () => {
    render(<OperatorHeader {...props} showPrototypeControls={false} />)

    expect(screen.getByText('Acceptance Event')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Prototype scenario' })).not.toBeInTheDocument()
    expect(screen.queryByText('Prototype navigation')).not.toBeInTheDocument()
    expect(screen.queryByText('Practice Mode')).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Audience Display: Connected' })).not.toBeInTheDocument()
  })

  it('keeps prototype controls and status indicators for prototype chrome', () => {
    render(<MemoryRouter><OperatorHeader {...props} /></MemoryRouter>)

    expect(screen.getByRole('combobox', { name: 'Prototype scenario' })).toBeInTheDocument()
    expect(screen.getByText('Prototype navigation')).toBeInTheDocument()
    expect(screen.getByText('Practice Mode')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Audience Display: Connected' })).toBeInTheDocument()
  })
})
