import { Link, useSearchParams } from 'react-router'
import { settingsFixture } from '../../prototype/data/index.ts'
import type { PrototypeSettingsSection } from '../../prototype/operator-types.ts'
import { resolvePrototypeSettingsSection } from '../../prototype/scenario-query.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Input,
  Select,
  Toggle,
} from '../../shared/ui/index.ts'

const settingsSections = [
  { label: 'Branding', value: 'branding' },
  { label: 'Presentation', value: 'presentation' },
  { label: 'Audio', value: 'audio' },
  { label: 'Display', value: 'display' },
] as const

function SettingsTabs({
  section,
}: {
  section: PrototypeSettingsSection
}) {
  return (
    <nav aria-label="Settings sections" className="settings-tabs">
      <div role="tablist">
        {settingsSections.map((item) => (
          <Link
            aria-selected={section === item.value}
            className={
              section === item.value
                ? 'settings-tab settings-tab--active'
                : 'settings-tab'
            }
            key={item.value}
            role="tab"
            to={`/settings?section=${item.value}`}
          >
            <span aria-hidden="true">
              {String(settingsSections.indexOf(item) + 1).padStart(2, '0')}
            </span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

function SettingsPanelHeading({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <div className="settings-panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <Badge variant="practice">Visual controls only</Badge>
    </div>
  )
}

function BrandingSettings() {
  const branding = settingsFixture.branding

  return (
    <Card className="settings-panel" padding="none">
      <SettingsPanelHeading
        description="Event identity shown in future public presentation states."
        title="Branding"
      />
      <div className="settings-panel__body settings-branding-grid">
        <div className="settings-fields">
          <Input
            defaultValue={branding.eventName}
            description="Prototype text is not saved."
            label="Event name"
          />
          <Input
            defaultValue={branding.eventSubtitle}
            description="Presentation-only subtitle."
            label="Event subtitle"
          />
          <div className="settings-color-grid">
            <Input
              defaultValue={branding.primaryColor}
              label="Primary color"
            />
            <Input
              defaultValue={branding.accentColor}
              label="Accent color"
            />
          </div>
        </div>
        <div className="asset-placeholder-grid">
          <div className="asset-placeholder">
            <span aria-hidden="true">LOGO</span>
            <strong>Event logo placeholder</strong>
            <p>No file is selected, read, or uploaded.</p>
            <Button disabled size="sm" variant="secondary">
              Choose logo · Disabled
            </Button>
          </div>
          <div className="asset-placeholder asset-placeholder--wide">
            <span aria-hidden="true">16:9</span>
            <strong>Background placeholder</strong>
            <p>Static surface only. No asset API is available.</p>
            <Button disabled size="sm" variant="secondary">
              Choose background · Disabled
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function PresentationSettings() {
  const presentation = settingsFixture.presentation

  return (
    <Card className="settings-panel" padding="none">
      <SettingsPanelHeading
        description="Timing and motion preferences for a future Audience experience."
        title="Presentation"
      />
      <div className="settings-panel__body settings-fields-grid">
        <Select defaultValue={presentation.countdownDuration} label="Countdown duration">
          <option>3 seconds</option>
          <option>5 seconds</option>
          <option>10 seconds</option>
        </Select>
        <Select defaultValue={presentation.rollingDuration} label="Rolling duration">
          <option>5 seconds</option>
          <option>8 seconds</option>
          <option>12 seconds</option>
        </Select>
        <Select defaultValue={presentation.revealStyle} label="Reveal style">
          <option>Ticket spotlight</option>
          <option>Instant reveal</option>
          <option>Sequential reveal</option>
        </Select>
        <Select defaultValue={presentation.celebrationEffect} label="Celebration effect">
          <option>Confetti burst</option>
          <option>Light sweep</option>
          <option>None</option>
        </Select>
        <Toggle
          defaultChecked
          description="Shows a restrained future presentation preference."
          label="Respect reduced motion"
        />
        <Select defaultValue={presentation.winnerLayout} label="Winner layout preference">
          <option>Adaptive operator preview</option>
          <option>Single hero</option>
          <option>Compact grid</option>
        </Select>
      </div>
    </Card>
  )
}

function AudioSettings() {
  const audio = settingsFixture.audio

  return (
    <Card className="settings-panel" padding="none">
      <SettingsPanelHeading
        description="Cue selection is visual only. This page never creates or plays audio."
        title="Audio"
      />
      <div className="settings-panel__body">
        <div className="settings-fields-grid">
          <Select defaultValue={audio.countdownCue} label="Countdown cue">
            <option>Pulse countdown</option>
            <option>Minimal tick</option>
            <option>None</option>
          </Select>
          <Select defaultValue={audio.rollingCue} label="Rolling cue">
            <option>Ticket roll</option>
            <option>Soft shuffle</option>
            <option>None</option>
          </Select>
          <Select defaultValue={audio.winnerRevealCue} label="Winner reveal cue">
            <option>Grand reveal</option>
            <option>Short celebration</option>
            <option>None</option>
          </Select>
          <Toggle
            description="Mute appearance only; there is no audio element."
            label="Mute all cues"
          />
        </div>
        <div
          aria-label={`Master volume appearance ${audio.masterVolume}`}
          className="volume-appearance"
        >
          <div>
            <span>Master volume appearance</span>
            <strong>{audio.masterVolume}</strong>
          </div>
          <span aria-hidden="true">
            <i />
          </span>
          <p>No audio playback or device output is connected.</p>
        </div>
      </div>
    </Card>
  )
}

function DisplaySettings() {
  const display = settingsFixture.display

  return (
    <Card className="settings-panel" padding="none">
      <SettingsPanelHeading
        description="Operator preferences for a future separate display surface."
        title="Display"
      />
      <div className="settings-panel__body display-settings-grid">
        <div className="settings-fields">
          <Select defaultValue={display.targetResolution} label="Target resolution">
            <option>1920 × 1080 (16:9)</option>
            <option>1280 × 720 (16:9)</option>
          </Select>
          <Select defaultValue={display.safeArea} label="Safe area">
            <option>5% title-safe margin</option>
            <option>8% broadcast-safe margin</option>
          </Select>
          <Select defaultValue={display.blackoutAppearance} label="Blackout appearance">
            <option>Pure black</option>
            <option>Event color</option>
          </Select>
          <Toggle
            defaultChecked
            description="A future browser preference; fullscreen is not requested here."
            label="Prefer fullscreen"
          />
          <Toggle
            defaultChecked
            description="Shows a safe public message in a future implementation."
            label="Disconnected-safe state"
          />
        </div>
        <div className="display-calibration">
          <div className="display-calibration__screen">
            <span>SAFE AREA</span>
            <strong>1920 × 1080</strong>
            <small>Static display framing preview</small>
          </div>
          <dl>
            <div><dt>Aspect</dt><dd>16:9</dd></div>
            <div><dt>Signal</dt><dd>Preview only</dd></div>
            <div><dt>State</dt><dd>Disconnected-safe</dd></div>
          </dl>
        </div>
      </div>
    </Card>
  )
}

export function SettingsPage() {
  const [searchParams] = useSearchParams()
  const section = resolvePrototypeSettingsSection(searchParams)

  return (
    <section
      aria-labelledby="settings-title"
      className="settings-page"
      data-settings-section={section}
    >
      <div className="prototype-notice" role="note">
        <span aria-hidden="true">PROTO</span>
        Local presentation controls only. No setting, asset, preference, or
        audio data is read, played, uploaded, or stored.
      </div>
      <PageHeader
        actions={
          <ButtonLink size="lg" to="/display/prototype?state=standby">
            Preview display
          </ButtonLink>
        }
        description="Configure a future event presentation while keeping this prototype deterministic and inert."
        eyebrow="Operator preferences"
        headingId="settings-title"
        title="Settings"
      />
      <div className="settings-layout">
        <SettingsTabs section={section} />
        <div className="settings-layout__content">
          {section === 'branding' ? <BrandingSettings /> : null}
          {section === 'presentation' ? <PresentationSettings /> : null}
          {section === 'audio' ? <AudioSettings /> : null}
          {section === 'display' ? <DisplaySettings /> : null}
          <div className="settings-save-bar">
            <div>
              <strong>Prototype controls are not persisted</strong>
              <span>Reloading restores the deterministic fixture.</span>
            </div>
            <Button disabled>Save settings · Prototype only</Button>
          </div>
        </div>
      </div>
    </section>
  )
}
