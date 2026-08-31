import { useState, type ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import ReactSelect from 'react-select'
import { describe, expect, it, vi } from 'vitest'
import { UiThemeContext } from './ui-theme.ts'
import { Badge, Button, ButtonLink, Card, Checkbox, ConfirmationDialog, Input, Modal, Pagination, SegmentedControl, Select, SidePanel, Table, TableHeader, Toast, Toggle } from './index.ts'
import { ThemedSelectMenu } from './ThemedSelectMenu.tsx'
import { AudiencePreviewSurface } from '../../ui/audience/AudiencePreviewSurface.tsx'
import { AudienceConnectionStatus } from '../components/AudienceConnectionStatus.tsx'
import { FieldGroup } from '../components/FieldGroup.tsx'

function ProductionTheme({ children }: { children: ReactNode }) {
  return <UiThemeContext value="kocokan"><div data-interface="operator" data-ui-theme="kocokan" data-operator-shell>{children}</div></UiThemeContext>
}

describe('Kocokan production foundation', () => {
  it('keeps legacy defaults separate while retaining native button and link behavior', async () => {
    const user = userEvent.setup()
    const action = vi.fn()
    render(<MemoryRouter><Button>Prototype</Button><ProductionTheme>
      <Button onClick={action}>Primary</Button><Button variant="success">Ready</Button>
      <Button variant="secondary">Secondary</Button><Button variant="danger">Delete</Button>
      <Button variant="quiet" square aria-label="Icon action">+</Button>
      <Button isLoading onClick={action}>Loading</Button><Button disabled onClick={action}>Disabled</Button>
      <ButtonLink to="/settings">Settings</ButtonLink>
    </ProductionTheme></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Prototype' })).toHaveClass('ui-button')
    expect(screen.getByRole('button', { name: 'Primary' })).not.toHaveClass('ui-button')
    expect(screen.getByRole('button', { name: 'Ready' })).toHaveClass('kc-button--success')
    expect(screen.getByRole('button', { name: 'Icon action' })).toHaveClass('kc-button--square')
    await user.click(screen.getByRole('button', { name: 'Primary' }))
    await user.click(screen.getByRole('button', { name: 'Loading' }))
    await user.click(screen.getByRole('button', { name: 'Disabled' }))
    expect(action).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })

  it('preserves input descriptions, switch/checkbox semantics and controlled segments', async () => {
    const user = userEvent.setup()
    function Form() {
      const [value, setValue] = useState('practice')
      return <ProductionTheme><FieldGroup legend="Controls" description="Operational controls">
        <Input label="Ticket" description="Keep zeroes" error="Required" />
        <Select label="Count"><option value="1">One</option><option value="6">Six</option></Select>
        <Checkbox label="Checked in" /><Toggle label="Audio" />
        <SegmentedControl label="Mode" options={[{ value: 'practice', label: 'Practice' }, { value: 'live', label: 'Live' }]} value={value} onChange={setValue} />
      </FieldGroup></ProductionTheme>
    }
    render(<Form />)
    const ticket = screen.getByRole('textbox', { name: 'Ticket' })
    expect(ticket).toHaveAccessibleDescription('Keep zeroes Required')
    await user.type(ticket, '000123')
    expect(ticket).toHaveValue('000123')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Count' }), '6')
    expect(screen.getByRole('combobox')).toHaveValue('6')
    await user.click(screen.getByRole('checkbox', { name: 'Checked in' }))
    await user.click(screen.getByRole('switch', { name: 'Audio' }))
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByRole('switch')).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Live' }))
    expect(screen.getByRole('button', { name: 'Live' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Practice' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('retains table caption, literal tickets and pagination boundaries', async () => {
    const pageChange = vi.fn(), sizeChange = vi.fn()
    const user = userEvent.setup()
    render(<ProductionTheme><Card><Table caption="Tickets"><thead><tr><TableHeader sortable>Ticket</TableHeader></tr></thead><tbody><tr><td>000001</td></tr></tbody></Table>
      <Pagination page={1} pageSize={10} totalItems={21} onPageChange={pageChange} onPageSizeChange={sizeChange} />
    </Card></ProductionTheme>)
    expect(screen.getByRole('table', { name: 'Tickets' })).toHaveClass('kc-table')
    expect(screen.getByRole('cell')).toHaveTextContent('000001')
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none')
    expect(screen.getByRole('button', { name: 'Sebelumnya' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Berikutnya' }))
    expect(pageChange).toHaveBeenCalledWith(2)
    await user.selectOptions(screen.getByRole('combobox'), '50')
    expect(sizeChange).toHaveBeenCalledWith(50)
  })

  it('propagates theme across the body portal, traps focus and restores it on Escape', async () => {
    const user = userEvent.setup()
    function Dialog() {
      const [open, setOpen] = useState(false)
      return <ProductionTheme><Button onClick={() => setOpen(true)}>Open confirmation</Button><ConfirmationDialog open={open} title="Review" consequence="No record is changed in this test" confirmLabel="Confirm" onCancel={() => setOpen(false)} onConfirm={() => setOpen(false)} /></ProductionTheme>
    }
    const { container } = render(<Dialog />)
    const trigger = screen.getByRole('button', { name: 'Open confirmation' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog')
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(dialog.parentElement).toHaveAttribute('data-ui-theme', 'kocokan')
    expect(document.body).not.toHaveAttribute('data-ui-theme')
    expect(container).toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(container).not.toHaveAttribute('inert')
    expect(trigger).toHaveFocus()
  })

  it('keeps legacy portals unthemed and uses explicit production modal semantics', () => {
    const { rerender } = render(<Modal open title="Delete winner" onClose={() => undefined}>Content</Modal>)
    expect(screen.getByRole('dialog')).toHaveClass('ui-modal')
    expect(screen.getByRole('dialog').parentElement).not.toHaveAttribute('data-ui-theme')
    rerender(<ProductionTheme><Modal open title="Delete winner" onClose={() => undefined}>Content</Modal></ProductionTheme>)
    expect(screen.getByRole('dialog').querySelector('[class*="semantic-icon"]')).toBeNull()
    rerender(<ProductionTheme><Modal open title="Review" headerIconTone="danger" onClose={() => undefined}>Content</Modal></ProductionTheme>)
    expect(screen.getByRole('dialog').querySelector('.kc-modal__semantic-icon--danger')).toBeInTheDocument()
  })

  it('preserves SidePanel backdrop dismissal, inert shell, keyboard trap and focus return', async () => {
    const user = userEvent.setup()
    function Panel() {
      const [open, setOpen] = useState(false)
      return <ProductionTheme><Button onClick={() => setOpen(true)}>Open panel</Button><SidePanel open={open} title="Review" description="Details" onClose={() => setOpen(false)} footer={<Button onClick={() => setOpen(false)}>Done</Button>}>Content</SidePanel></ProductionTheme>
    }
    render(<Panel />)
    const trigger = screen.getByRole('button', { name: 'Open panel' })
    await user.click(trigger)
    expect(trigger.closest('[data-operator-shell]')).toHaveAttribute('inert')
    expect(screen.getByRole('dialog').parentElement).toHaveAttribute('data-ui-theme', 'kocokan')
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    const backdrop = document.querySelector('[data-layer="drawer-backdrop"]')
    if (!(backdrop instanceof HTMLElement)) throw new Error('Missing backdrop')
    await user.click(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('retains toast live regions and dismissal without adding a timer', async () => {
    const dismiss = vi.fn()
    render(<ProductionTheme><Toast urgent variant="danger" title="Save failed" description="Still visible" onDismiss={dismiss} /><Toast title="Saved" variant="success" /></ProductionTheme>)
    expect(screen.getByRole('alert')).toHaveTextContent('Still visible')
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    await userEvent.setup().click(within(screen.getByRole('alert')).getByRole('button'))
    expect(dismiss).toHaveBeenCalledOnce()
  })

  it('preserves all six connection state keys, labels and icons inside production', () => {
    const states = ['setup-required', 'waiting', 'connected', 'reconnecting', 'unavailable', 'publication-failed'] as const
    const { container } = render(<ProductionTheme>{states.map(state => <AudienceConnectionStatus state={state} key={state} />)}<Badge variant="live">Live</Badge><Badge variant="practice">Practice</Badge></ProductionTheme>)
    expect([...container.querySelectorAll('[data-connection-state]')].map(e => e.getAttribute('data-connection-state'))).toEqual(states)
    expect(container.querySelectorAll('[data-connection-state] svg')).toHaveLength(6)
    expect(screen.getByText('Menghubungkan ulang')).toBeVisible()
  })

  it('leaves Audience static preview markup unchanged inside a themed Card', () => {
    const preview = <AudiencePreviewSurface displayName="Test event" primaryColor="#7567ff" accentColor="#f2a93b" safeAreaMargin={32} />
    const { container, rerender } = render(<Card>{preview}</Card>)
    const before = container.querySelector('.audience-preview-surface')?.outerHTML
    rerender(<ProductionTheme><Card>{preview}</Card></ProductionTheme>)
    expect(container.querySelector('.audience-preview-surface')?.outerHTML).toBe(before)
    expect(container.querySelector('.audience-preview-surface [class*="kc-"]')).toBeNull()
  })

  it('adapts react-select menu tokens without moving its body portal or changing options', async () => {
    const change = vi.fn()
    render(<ProductionTheme><ReactSelect aria-label="Reason" components={{ Menu: ThemedSelectMenu }} menuPortalTarget={document.body} menuPosition="fixed" options={[{ value: 'absent', label: 'Tidak Hadir' }, { value: 'other', label: 'Lainnya' }]} onChange={change} /></ProductionTheme>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: 'Reason' }))
    const option = screen.getByRole('option', { name: 'Tidak Hadir' })
    expect(option.closest('[data-ui-theme]')).toHaveAttribute('data-ui-theme', 'kocokan')
    expect(option.closest('[data-operator-shell]')).toBeNull()
    await user.click(option)
    expect(change.mock.calls[0]?.[0]).toEqual({ value: 'absent', label: 'Tidak Hadir' })
  })
})
