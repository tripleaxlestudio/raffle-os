import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '../ui/Button.tsx'
import { MetricCard } from './MetricCard.tsx'
import { PageHeader } from './PageHeader.tsx'
import { SectionHeader } from './SectionHeader.tsx'
import { StatusBanner } from './StatusBanner.tsx'
import { SummaryList } from './SummaryList.tsx'

describe('shared compositions', () => {
  it('renders PageHeader copy and an accessible action', () => {
    render(
      <PageHeader
        actions={<Button>Review prototype</Button>}
        description="Static operator context."
        eyebrow="Operator review"
        title="Prototype page"
      />,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Prototype page' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Operator review')).toBeVisible()
    expect(screen.getByText('Static operator context.')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Review prototype' }),
    ).toBeVisible()
  })

  it('supports SectionHeader heading levels, copy, and actions', () => {
    render(
      <SectionHeader
        actions={<Button>Open static detail</Button>}
        description="No record is changed."
        eyebrow="Session index"
        headingLevel={3}
        title="Recent sessions"
      />,
    )

    expect(
      screen.getByRole('heading', { level: 3, name: 'Recent sessions' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Session index')).toBeVisible()
    expect(screen.getByText('No record is changed.')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Open static detail' }),
    ).toBeVisible()
  })

  it('renders a labelled StatusBanner with textual status', () => {
    render(
      <StatusBanner badge="Ready" title="Prototype ready" tone="success">
        Frozen values are ready for review.
      </StatusBanner>,
    )

    const banner = screen.getByRole('region', { name: 'Prototype ready' })
    expect(within(banner).getByText('Ready')).toBeVisible()
    expect(banner).toHaveTextContent('Frozen values are ready for review.')
  })

  it('keeps StatusBanner label relationships unique when tones repeat', () => {
    render(<><StatusBanner badge="Blocked" title="First warning" tone="warning">First recovery action.</StatusBanner><StatusBanner badge="Review" title="Second warning" tone="warning">Second recovery action.</StatusBanner></>)

    const first = screen.getByRole('region', { name: 'First warning' })
    const second = screen.getByRole('region', { name: 'Second warning' })
    expect(first.getAttribute('aria-labelledby')).not.toBe(second.getAttribute('aria-labelledby'))
  })

  it('renders MetricCard label, value, detail, and tone', () => {
    render(
      <MetricCard
        detail="Deterministic records"
        label="Peserta"
        tone="info"
        value="1,250"
      />,
    )

    const card = screen.getByText('Peserta').closest('.metric-card')
    expect(card).toHaveAttribute('data-tone', 'info')
    expect(card).toHaveTextContent('1,250')
    expect(card).toHaveTextContent('Deterministic records')
  })

  it('renders SummaryList as labelled description pairs', () => {
    const { container } = render(
      <SummaryList
        items={[
          { label: 'Tertunda', value: '4' },
          { label: 'Dikonfirmasi', value: '4' },
        ]}
      />,
    )

    expect(container.querySelector('dl')).toBeInTheDocument()
    expect(screen.getByText('Tertunda').tagName).toBe('DT')
    expect(screen.getAllByText('4', { selector: 'dd' })).toHaveLength(2)
  })
})
