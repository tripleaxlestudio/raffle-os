import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ProductionParticipantImportPreview } from './ProductionParticipantImportPreview.tsx'

function renderPreview() {
  return render(<MemoryRouter><ProductionParticipantImportPreview /></MemoryRouter>)
}

describe('production participant import preview', () => {
  it('renders a real file input and preserves exact ticket strings', async () => {
    const user = userEvent.setup()
    renderPreview()
    const input = screen.getByLabelText('Choose participant file')
    await user.upload(input, new File(['Ticket Number,Name\n00042,Ada\n42,Bea\n,Missing'], 'participants.csv', { type: 'text/csv' }))
    await waitFor(() => expect(screen.getAllByText('00042')).not.toHaveLength(0))
    expect(screen.getAllByText('42')).not.toHaveLength(0)
    expect(screen.getByText('participants.csv')).toBeInTheDocument()
    expect(screen.getByLabelText('Ticket Number — required')).toHaveValue('Ticket Number')
    expect(screen.getByLabelText('Participant Name — optional')).toBeInTheDocument()
    expect(screen.getAllByText('Invalid').length).toBeGreaterThan(0)
    expect(screen.getByText('No Participant data has been saved yet.')).toBeInTheDocument()
  })

  it('renders a safe parser error and clearing returns to idle', async () => {
    const user = userEvent.setup()
    renderPreview()
    const input = screen.getByLabelText('Choose participant file')
    await user.upload(input, new File(['"unterminated'], 'broken.csv', { type: 'text/csv' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'CSV could not be parsed' })).toBeInTheDocument())
    await user.upload(input, new File(['Ticket Number\n00001'], 'valid.csv', { type: 'text/csv' }))
    await waitFor(() => expect(screen.getByText('valid.csv')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Remove file' }))
    expect(screen.getByRole('region', { name: 'Preview participant file' })).toHaveAttribute('data-workflow-state', 'idle')
  })
})
