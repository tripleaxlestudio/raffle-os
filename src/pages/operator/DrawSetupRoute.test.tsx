import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DrawSetupRoute } from './DrawSetupRoute.tsx'

describe('Draw Setup route isolation', () => {
  it('renders explicit static prototype scenarios without production command controls', () => {
    render(<MemoryRouter initialEntries={['/draw/setup?mode=practice&scenario=ready']}><DrawSetupRoute /></MemoryRouter>)
    expect(screen.getByText(/Fictional setup data only/i)).toBeInTheDocument()
    expect(screen.getByText('Static prototype only')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run Practice' })).not.toBeInTheDocument()
  })

  it('uses the production composition when no prototype scenario is supplied', () => {
    render(<MemoryRouter initialEntries={['/draw/setup']}><DrawSetupRoute /></MemoryRouter>)
    expect(screen.getByText(/Loading authoritative Event/i)).toBeInTheDocument()
    expect(screen.queryByText('Fictional setup data only.')).not.toBeInTheDocument()
  })
})
