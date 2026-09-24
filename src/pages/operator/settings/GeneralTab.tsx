import { useState } from 'react'
import {
  Select,
  Toggle,
  SegmentedControl,
  type SegmentedControlOption,
} from '../../../shared/ui/index.ts'

const scaleOptions: readonly SegmentedControlOption[] = [
  { label: 'Compact', value: 'compact' },
  { label: 'Normal', value: 'normal' },
  { label: 'Besar', value: 'large' },
]

export function GeneralTab() {
  // Temporary UI states for evaluation (unpersisted)
  const [language, setLanguage] = useState<string>('id')
  const [timeFormat, setTimeFormat] = useState<string>('24')
  const [dateFormat, setDateFormat] = useState<string>('DD/MM/YYYY')

  const [startupBehavior, setStartupBehavior] = useState<string>('last-event')
  const [autoRestore, setAutoRestore] = useState<boolean>(true)
  const [initialMode, setInitialMode] = useState<string>('practice')

  const [uiScale, setUiScale] = useState<string>('normal')
  const [reduceMotion, setReduceMotion] = useState<boolean>(false)

  return (
    <div className="kc-settings-panel" role="tabpanel" id="panel-general" aria-labelledby="tab-general">
      {/* 1. Bahasa & Regional */}
      <section className="kc-settings-section" aria-labelledby="heading-regional">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-regional" className="kc-settings-section__title">
              Bahasa & Regional
            </h2>
            <p className="kc-settings-section__description">
              Sesuaikan preferensi bahasa dan format representasi waktu lokal.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-grid kc-settings-grid--3col">
            <Select
              id="settings-language"
              label="Bahasa aplikasi"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English (US)</option>
            </Select>

            <Select
              id="settings-time-format"
              label="Format waktu"
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value)}
            >
              <option value="24">24 Jam (14:30)</option>
              <option value="12">12 Jam (02:30 PM)</option>
            </Select>

            <Select
              id="settings-date-format"
              label="Format tanggal"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-12-31)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</option>
            </Select>
          </div>
        </div>
      </section>

      {/* 2. Startup */}
      <section className="kc-settings-section" aria-labelledby="heading-startup">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-startup" className="kc-settings-section__title">
              Startup
            </h2>
            <p className="kc-settings-section__description">
              Tentukan tindakan awal saat aplikasi Kocokan pertama kali dibuka.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-grid kc-settings-grid--2col">
            <Select
              id="settings-startup-behavior"
              label="Saat Kocokan dibuka"
              value={startupBehavior}
              onChange={(e) => setStartupBehavior(e.target.value)}
            >
              <option value="last-event">Buka acara terakhir</option>
              <option value="selector">Tampilkan pemilih acara</option>
              <option value="new-event">Mulai acara baru</option>
            </Select>

            <Select
              id="settings-initial-mode"
              label="Mode awal"
              value={initialMode}
              onChange={(e) => setInitialMode(e.target.value)}
            >
              <option value="practice">Practice Mode</option>
              <option value="standby">Mode Siaga (Standby)</option>
              <option value="live">Live Mode</option>
            </Select>
          </div>

          <div style={{ borderTop: '1px solid var(--kc-divider)', paddingTop: '14px' }}>
            <Toggle
              checked={autoRestore}
              description="Membuka kembali ruang kerja dan konfigurasi acara yang terakhir aktif secara otomatis saat startup."
              label="Pulihkan acara terakhir secara otomatis"
              onChange={(e) => setAutoRestore(e.target.checked)}
            />
          </div>
        </div>
      </section>

      {/* 3. Antarmuka Operator */}
      <section className="kc-settings-section" aria-labelledby="heading-interface">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-interface" className="kc-settings-section__title">
              Antarmuka Operator
            </h2>
            <p className="kc-settings-section__description">
              Sesuaikan kepadatan tata letak dan performa visual antarmuka kendali.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Skala antarmuka</span>
              <span className="kc-settings-row__desc">
                Pilih ukuran elemen kendali agar nyaman untuk layar laptop atau monitor kontrol panggung.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <SegmentedControl
                label="Skala antarmuka"
                onChange={setUiScale}
                options={scaleOptions}
                value={uiScale}
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--kc-divider)', paddingTop: '14px' }}>
            <Toggle
              checked={reduceMotion}
              description="Membatasi efek transisi dan gerakan visual untuk pengalaman yang lebih hemat daya dan cepat."
              label="Kurangi animasi antarmuka"
              onChange={(e) => setReduceMotion(e.target.checked)}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
