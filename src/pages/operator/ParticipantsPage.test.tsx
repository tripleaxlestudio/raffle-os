import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { appRoutes } from '../../app/router.tsx'
import { participantImportFixture } from '../../prototype/data/index.ts'
import { ParticipantsPage } from './ParticipantsPage.tsx'

function renderParticipants(path = '/participants') {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  })

  const view = render(<RouterProvider router={router} />)

  return { router, ...view }
}

describe('Participant Import static prototype', () => {
  it.each([
    ['/participants', 'upload'],
    ['/participants?step=unsupported', 'upload'],
    ['/participants?step=upload', 'upload'],
    ['/participants?step=mapping', 'mapping'],
    ['/participants?step=validation', 'validation'],
    ['/participants?step=summary', 'summary'],
  ])('resolves %s to the %s step', (path, expectedStep) => {
    const { container } = renderParticipants(path)

    expect(container.querySelector('.participant-import')).toHaveAttribute(
      'data-import-step',
      expectedStep,
    )
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Participant Import',
      }),
    ).toBeInTheDocument()
  })

  it('renders supported-format guidance and the fictional selected file without a file input', () => {
    const { container } = renderParticipants('/participants?step=upload')

    expect(screen.getByText(/Supported formats: XLSX and CSV/i)).toBeVisible()
    expect(
      screen.getByText('nusantara-tech-gala-participants.xlsx'),
    ).toBeVisible()
    expect(container.querySelector('input[type="file"]')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Browse file' }),
    ).toBeDisabled()

    const primaryAction = screen.getByRole('link', {
      name: 'Continue to column mapping',
    })
    expect(primaryAction).toHaveAttribute(
      'href',
      '/participants?step=mapping',
    )
  })

  it('renders required, optional, and unmapped fields with leading-zero guidance', () => {
    renderParticipants('/participants?step=mapping')

    expect(
      screen.getByRole('combobox', {
        name: /Ticket Number — Required/i,
      }),
    ).toHaveValue('Ticket ID')
    expect(
      screen.getByRole('combobox', {
        name: /Participant Name — Required/i,
      }),
    ).toHaveValue('Full Name')
    expect(
      screen.getByRole('combobox', { name: /Email — Optional/i }),
    ).toHaveValue('Email Address')
    expect(
      screen.getByRole('combobox', {
        name: /Check-in Status — Optional/i,
      }),
    ).toHaveValue('')
    expect(screen.getByText('Unmapped')).toBeVisible()
    expect(
      screen.getByText(/Ticket values remain strings in this prototype/i),
    ).toHaveTextContent('000123')

    expect(
      screen.getByRole('link', {
        name: 'Validate participant data',
      }),
    ).toHaveAttribute('href', '/participants?step=validation')
    expect(
      screen.getByRole('link', { name: 'Return to upload' }),
    ).toHaveAttribute('href', '/participants?step=upload')
  })

  it('renders all validation totals, representative issues, and exact ticket strings', () => {
    renderParticipants('/participants?step=validation')

    const totals = screen.getByRole('region', {
      name: 'Participant validation totals',
    })
    expect(within(totals).getByText('1,250')).toBeVisible()
    expect(within(totals).getByText('1,186')).toBeVisible()
    expect(within(totals).getAllByText('32')).toHaveLength(2)

    const table = screen.getByRole('table', {
      name: 'Representative participant validation rows',
    })
    expect(table).toBeInTheDocument()
    expect(within(table).getByText('000123')).toBeVisible()
    expect(within(table).getByText('004216')).toBeVisible()
    expect(within(table).getAllByText('010039')).toHaveLength(2)
    expect(within(table).getByText('— Empty —')).toBeVisible()
    expect(within(table).getByText('— Missing name —')).toBeVisible()
    expect(
      within(table).getByText(/Email does not match/i),
    ).toBeVisible()
    expect(
      within(table).getByText(/Leading and trailing whitespace/i),
    ).toBeVisible()

    expect(
      screen.getByRole('button', { name: 'Download issues' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'Replace existing dataset',
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'Merge with existing dataset',
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole('link', { name: 'Review import summary' }),
    ).toHaveAttribute('href', '/participants?step=summary')
  })

  it('renders a presentation-only summary without claiming import success', () => {
    renderParticipants('/participants?step=summary')

    expect(screen.getByText('1,250')).toBeVisible()
    expect(screen.getByText('1,186')).toBeVisible()
    expect(screen.getAllByText('32')).toHaveLength(2)
    expect(
      screen.getByText(
        'No participant data has actually been imported.',
      ),
    ).toBeVisible()
    expect(
      screen.queryByText(/successfully imported/i),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Return to Dashboard' }),
    ).toHaveAttribute('href', '/dashboard')
    expect(
      screen.getByRole('link', { name: 'Review validation' }),
    ).toHaveAttribute('href', '/participants?step=validation')
  })

  it('uses route history for Continue, Back, and Forward navigation', async () => {
    const user = userEvent.setup()
    const { router } = renderParticipants('/participants?step=upload')

    await user.click(
      screen.getByRole('link', {
        name: 'Continue to column mapping',
      }),
    )
    expect(router.state.location.search).toBe('?step=mapping')

    await user.click(
      screen.getByRole('link', {
        name: 'Validate participant data',
      }),
    )
    expect(router.state.location.search).toBe('?step=validation')

    await router.navigate(-1)
    await waitFor(() => {
      expect(router.state.location.search).toBe('?step=mapping')
    })

    await router.navigate(1)
    await waitFor(() => {
      expect(router.state.location.search).toBe('?step=validation')
    })
  })

  it('never mutates frozen fixture data through visual mapping controls', async () => {
    const user = userEvent.setup()
    const originalMapping = participantImportFixture.mappings[5]

    expect(Object.isFrozen(participantImportFixture)).toBe(true)
    expect(Object.isFrozen(participantImportFixture.file)).toBe(true)
    expect(Object.isFrozen(participantImportFixture.mappings)).toBe(true)
    expect(Object.isFrozen(participantImportFixture.rows)).toBe(true)
    expect(Object.isFrozen(participantImportFixture.summary)).toBe(true)
    expect(originalMapping?.sourceColumn).toBeNull()

    renderParticipants('/participants?step=mapping')
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: /Check-in Status — Optional/i,
      }),
      'Attendance',
    )

    expect(originalMapping?.sourceColumn).toBeNull()
    expect(participantImportFixture.summary.strategy).toBe('replace')
  })

  it('does not call file, network, or persistence APIs while rendering', () => {
    const fileReaderMock = vi.fn()
    const indexedDbOpen = vi.fn()
    const fetchMock = vi.fn()
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    vi.stubGlobal('FileReader', fileReaderMock)
    vi.stubGlobal('indexedDB', { open: indexedDbOpen })
    vi.stubGlobal('fetch', fetchMock)

    try {
      const { container } = render(
        <MemoryRouter initialEntries={['/participants?step=upload']}>
          <ParticipantsPage />
        </MemoryRouter>,
      )

      expect(container.querySelector('input[type="file"]')).toBeNull()
      expect(fileReaderMock).not.toHaveBeenCalled()
      expect(indexedDbOpen).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(getItem).not.toHaveBeenCalled()
      expect(setItem).not.toHaveBeenCalled()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('keeps Participant Import and Operator prototype controls out of /display', () => {
    renderParticipants('/display')

    expect(
      screen.queryByRole('heading', {
        level: 1,
        name: 'Participant Import',
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Browse file' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Prototype scenario' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', {
        name: 'Participant Import progress',
      }),
    ).not.toBeInTheDocument()
  })
})
