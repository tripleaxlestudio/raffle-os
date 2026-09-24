import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackToTopButton } from './BackToTopButton.tsx'

describe('BackToTopButton', () => {
  let containerEl: HTMLDivElement

  beforeEach(() => {
    containerEl = document.createElement('div')
    containerEl.id = 'operator-main'
    containerEl.setAttribute('tabindex', '-1')
    // Mock scroll dimensions
    Object.defineProperty(containerEl, 'clientHeight', { value: 600, configurable: true })
    Object.defineProperty(containerEl, 'scrollHeight', { value: 2000, configurable: true })
    Object.defineProperty(containerEl, 'scrollTop', { value: 0, writable: true, configurable: true })
    containerEl.scrollTo = vi.fn((...args: [options?: ScrollToOptions] | [x: number, y: number]) => {
      const [options] = args
      if (typeof options === 'object') {
        containerEl.scrollTop = options.top ?? 0
      } else if (typeof options === 'number') {
        containerEl.scrollTop = options
      }
      containerEl.dispatchEvent(new Event('scroll'))
    })
    document.body.appendChild(containerEl)
  })

  afterEach(() => {
    document.body.removeChild(containerEl)
  })

  it('renders disabled and hidden when scroll position is at the top', () => {
    render(<BackToTopButton />)

    const button = screen.getByRole('button', { name: 'Kembali ke atas', hidden: true })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Kembali ke atas')

    const wrapper = button.closest('.operator-back-to-top-wrapper')
    expect(wrapper).toHaveAttribute('aria-hidden', 'true')
    expect(wrapper).not.toHaveClass('operator-back-to-top-wrapper--visible')
  })

  it('becomes visible and enabled when scrolled past threshold (400px)', () => {
    render(<BackToTopButton />)

    const button = screen.getByRole('button', { name: 'Kembali ke atas', hidden: true })
    expect(button).toBeDisabled()

    // Scroll past 400px
    act(() => {
      containerEl.scrollTop = 450
      containerEl.dispatchEvent(new Event('scroll'))
    })

    expect(button).not.toBeDisabled()
    const wrapper = button.closest('.operator-back-to-top-wrapper')
    expect(wrapper).toHaveAttribute('aria-hidden', 'false')
    expect(wrapper).toHaveClass('operator-back-to-top-wrapper--visible')
  })

  it('does not become visible if scrollable height is not sufficient', () => {
    // Content height is only slightly larger than viewport (no long scroll)
    Object.defineProperty(containerEl, 'scrollHeight', { value: 700, configurable: true })
    render(<BackToTopButton />)

    act(() => {
      containerEl.scrollTop = 450
      containerEl.dispatchEvent(new Event('scroll'))
    })

    const button = screen.getByRole('button', { name: 'Kembali ke atas', hidden: true })
    expect(button).toBeDisabled()
  })

  it('smoothly scrolls to top on click and becomes hidden again', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<BackToTopButton onClick={onClick} />)

    act(() => {
      containerEl.scrollTop = 500
      containerEl.dispatchEvent(new Event('scroll'))
    })

    const button = screen.getByRole('button', { name: 'Kembali ke atas' })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(containerEl.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    })
    expect(onClick).toHaveBeenCalledTimes(1)

    // After scrolling to 0, button becomes disabled/hidden
    expect(button).toBeDisabled()
    const wrapper = button.closest('.operator-back-to-top-wrapper')
    expect(wrapper).toHaveAttribute('aria-hidden', 'true')
  })

  it('supports keyboard activation via Enter/Space', async () => {
    const user = userEvent.setup()
    render(<BackToTopButton />)

    act(() => {
      containerEl.scrollTop = 500
      containerEl.dispatchEvent(new Event('scroll'))
    })

    const button = screen.getByRole('button', { name: 'Kembali ke atas' })
    button.focus()
    expect(button).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(containerEl.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    })
  })

  it('respects custom threshold and custom targetRef', () => {
    const customContainer = document.createElement('div')
    customContainer.setAttribute('tabindex', '-1')
    Object.defineProperty(customContainer, 'clientHeight', { value: 500, configurable: true })
    Object.defineProperty(customContainer, 'scrollHeight', { value: 1500, configurable: true })
    Object.defineProperty(customContainer, 'scrollTop', { value: 0, writable: true, configurable: true })
    customContainer.scrollTo = vi.fn()
    document.body.appendChild(customContainer)

    const ref = { current: customContainer }

    render(<BackToTopButton targetRef={ref} threshold={200} />)

    const button = screen.getByRole('button', { name: 'Kembali ke atas', hidden: true })
    expect(button).toBeDisabled()

    act(() => {
      customContainer.scrollTop = 250
      customContainer.dispatchEvent(new Event('scroll'))
    })

    expect(button).toBeEnabled()

    fireEvent.click(button)
    expect(customContainer.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    })

    document.body.removeChild(customContainer)
  })

  it('respects prefers-reduced-motion for scroll behavior', async () => {
    const user = userEvent.setup()
    const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    window.matchMedia = matchMediaMock

    render(<BackToTopButton />)

    act(() => {
      containerEl.scrollTop = 600
      containerEl.dispatchEvent(new Event('scroll'))
    })

    const button = screen.getByRole('button', { name: 'Kembali ke atas' })
    await user.click(button)

    expect(containerEl.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'auto',
    })
  })
})
