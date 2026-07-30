import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FieldGroup } from '../components/FieldGroup.tsx'
import {
  ProgressStepper,
  type ProgressStep,
} from '../components/ProgressStepper.tsx'
import { EmptyState, Table, TableHeader } from './index.ts'

const progressSteps = [
  { id: 'upload', label: 'Upload file' },
  { id: 'mapping', label: 'Map columns' },
  { id: 'validation', label: 'Validate data' },
  { id: 'summary', label: 'Import summary' },
] as const satisfies readonly ProgressStep[]

describe('Participant Import shared UI', () => {
  it('renders a semantic table with an accessible caption', () => {
    render(
      <Table caption="Participant rows">
        <thead>
          <tr>
            <th scope="col">Ticket Number</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>000123</td>
          </tr>
        </tbody>
      </Table>,
    )

    const table = screen.getByRole('table', { name: 'Participant rows' })
    expect(table).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Ticket Number' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '000123' })).toBeInTheDocument()
  })

  it('supports a reusable table empty state', () => {
    render(
      <Table
        caption="Empty participant rows"
        emptyState={
          <EmptyState
            description="Change the selected validation filter."
            title="No matching rows"
          />
        }
        isEmpty
      >
        <thead>
          <tr>
            <th scope="col">Ticket Number</th>
          </tr>
        </thead>
        <tbody />
      </Table>,
    )

    expect(screen.getByText('No matching rows')).toBeInTheDocument()
    expect(
      screen.getByText('Change the selected validation filter.'),
    ).toBeInTheDocument()
  })

  it('presents a sortable-looking header without adding sorting behavior', () => {
    render(
      <Table caption="Sortable-looking participant rows">
        <thead>
          <tr>
            <TableHeader scope="col" sortable>
              Ticket Number
            </TableHeader>
          </tr>
        </thead>
        <tbody />
      </Table>,
    )

    const header = screen.getByRole('columnheader', {
      name: 'Ticket Number',
    })
    expect(header).toHaveAttribute('aria-sort', 'none')
    expect(header).toHaveClass('ui-table__header--sortable')
    expect(
      within(header).getByText('\u2195', {
        selector: '[aria-hidden="true"]',
      }),
    ).toBeInTheDocument()
    expect(header.querySelector('button')).toBeNull()
  })

  it('exposes complete, current, and upcoming step states without color alone', () => {
    render(
      <ProgressStepper currentStep="validation" steps={progressSteps} />,
    )

    expect(
      screen.getByRole('navigation', {
        name: 'Participant Import progress',
      }),
    ).toBeInTheDocument()

    const currentStep = screen.getByText('Validate data').closest('li')
    expect(currentStep).toHaveAttribute('aria-current', 'step')
    expect(currentStep).toHaveAttribute('data-state', 'active')
    expect(currentStep).toHaveTextContent('Current')

    expect(screen.getByText('Upload file').closest('li')).toHaveTextContent(
      'Complete',
    )
    expect(screen.getByText('Import summary').closest('li')).toHaveTextContent(
      'Upcoming',
    )
  })

  it('groups fields with a semantic legend and description', () => {
    render(
      <FieldGroup
        description="Required mappings must be present."
        legend="Column assignments"
      >
        <input aria-label="Example mapping" />
      </FieldGroup>,
    )

    const group = screen.getByRole('group', { name: 'Column assignments' })
    expect(group).toHaveAccessibleDescription(
      'Required mappings must be present.',
    )
    expect(
      screen.getByRole('textbox', { name: 'Example mapping' }),
    ).toBeInTheDocument()
  })
})
