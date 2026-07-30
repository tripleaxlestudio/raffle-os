import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Input,
  Select,
  Toggle,
} from './index.ts'

describe('core UI primitives', () => {
  it('renders button variants with safe native defaults', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <Button onClick={onClick} variant="secondary">
        Review setup
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Review setup' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('ui-button--secondary')

    await user.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disables a loading button and exposes busy state', () => {
    render(<Button isLoading>Preparing preview</Button>)

    const button = screen.getByRole('button', {
      name: 'Preparing preview',
    })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('renders a navigation button as a real link', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/draw/setup">Set up next draw</ButtonLink>
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('link', { name: 'Set up next draw' }),
    ).toHaveAttribute('href', '/draw/setup')
  })

  it('connects input descriptions and errors to the native input', () => {
    render(
      <Input
        description="Use the public event title."
        error="An event name is required."
        label="Event name"
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Event name' })
    expect(input).toHaveAccessibleDescription(
      'Use the public event title. An event name is required.',
    )
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('preserves native select form behavior', async () => {
    const user = userEvent.setup()

    render(
      <Select label="Prototype view" name="scenario">
        <option value="ready">Ready state</option>
        <option value="attention">Needs attention</option>
      </Select>,
    )

    const select = screen.getByRole('combobox', {
      name: 'Prototype view',
    })
    await user.selectOptions(select, 'attention')

    expect(select).toHaveValue('attention')
    expect(select).toHaveAttribute('name', 'scenario')
  })

  it('supports native checkbox keyboard interaction', async () => {
    const user = userEvent.setup()

    render(
      <Checkbox
        description="Static prototype option"
        label="Require check-in"
      />,
    )

    const checkbox = screen.getByRole('checkbox', {
      name: 'Require check-in',
    })
    checkbox.focus()
    await user.keyboard(' ')

    expect(checkbox).toBeChecked()
    expect(checkbox).toHaveAccessibleDescription('Static prototype option')
  })

  it('exposes a keyboard-operable switch role for Toggle', async () => {
    const user = userEvent.setup()

    render(
      <Toggle
        description="Changes presentation only."
        label="Practice presentation"
      />,
    )

    const toggle = screen.getByRole('switch', {
      name: 'Practice presentation',
    })
    toggle.focus()
    await user.keyboard(' ')

    expect(toggle).toBeChecked()
    expect(toggle).toHaveAccessibleDescription(
      'Changes presentation only.',
    )
  })

  it('renders typed badge and card variants', () => {
    render(
      <Card aria-label="Readiness" tone="raised">
        <Badge variant="confirmed">Confirmed</Badge>
      </Card>,
    )

    expect(screen.getByLabelText('Readiness')).toHaveClass(
      'ui-card--raised',
    )
    expect(screen.getByText('Confirmed')).toHaveClass(
      'ui-badge--confirmed',
    )
  })
})
