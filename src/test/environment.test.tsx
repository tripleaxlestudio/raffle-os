import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('test environment', () => {
  it('provides jsdom and jest-dom matchers', () => {
    render(<p>Raffle OS test environment</p>)

    expect(document.body).toBeInstanceOf(HTMLBodyElement)
    expect(screen.getByText('Raffle OS test environment')).toBeInTheDocument()
  })
})
