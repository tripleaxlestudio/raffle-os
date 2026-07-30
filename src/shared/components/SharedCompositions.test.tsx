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

  it('renders MetricCard label, value, detail, and tone', () => {
    render(
      <MetricCard
        detail="Deterministic records"
        label="Participants"
        tone="info"
        value="1,250"
      />,
    )

    const card = screen.getByText('Participants').closest('.metric-card')
    expect(card).toHaveAttribute('data-tone', 'info')
    expect(card).toHaveTextContent('1,250')
    expect(card).toHaveTextContent('Deterministic records')
  })

  it('renders SummaryList as labelled description pairs', () => {
    const { container } = render(
      <SummaryList
        items={[
          { label: 'Pending', value: '4' },
          { label: 'Confirmed', value: '4' },
        ]}
      />,
    )

    expect(container.querySelector('dl')).toBeInTheDocument()
    expect(screen.getByText('Pending').tagName).toBe('DT')
    expect(screen.getAllByText('4', { selector: 'dd' })).toHaveLength(2)
  })
})
