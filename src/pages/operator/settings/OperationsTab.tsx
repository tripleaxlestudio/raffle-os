import { useState } from 'react'
import {
  Button,
  Toggle,
  Icon,
} from '../../../shared/ui/index.ts'
import { ShortcutsModal } from './ShortcutsModal.tsx'

export function OperationsTab() {
  const [autoRecoverSession, setAutoRecoverSession] = useState<boolean>(true)
  const [remindActiveSession, setRemindActiveSession] = useState<boolean>(true)

  const [autoOpenAudience, setAutoOpenAudience] = useState<boolean>(false)
  const [openAudienceNewWindow, setOpenAudienceNewWindow] = useState<boolean>(true)

  const [preventSleep, setPreventSleep] = useState<boolean>(true)

  const [shortcutsModalOpen, setShortcutsModalOpen] = useState<boolean>(false)

  return (
    <div className="kc-settings-panel" role="tabpanel" id="panel-operations" aria-labelledby="tab-operations">
      {/* 1. Recovery */}
      <section className="kc-settings-section" aria-labelledby="heading-recovery">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-recovery" className="kc-settings-section__title">
              Recovery
            </h2>
            <p className="kc-settings-section__description">
              Keamanan pemulihan status operasional jika browser atau komputer tertutup mendadak.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <Toggle
            checked={autoRecoverSession}
            description="Mendeteksi sesi undian yang belum tuntas dan segera menyajikan opsi pemulihan state terakhir."
            label="Pulihkan sesi yang terputus otomatis"
            onChange={(e) => setAutoRecoverSession(e.target.checked)}
          />

          <div style={{ borderTop: '1px solid var(--kc-divider)', paddingTop: '14px' }}>
            <Toggle
              checked={remindActiveSession}
              description="Tampilkan dialog konfirmasi perlindungan saat operator berupaya menutup atau berpindah saat sesi aktif."
              label="Ingatkan ketika ada sesi aktif"
              onChange={(e) => setRemindActiveSession(e.target.checked)}
            />
          </div>
        </div>
      </section>

      {/* 2. Audience Display */}
      <section className="kc-settings-section" aria-labelledby="heading-audience-display">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-audience-display" className="kc-settings-section__title">
              Audience Display
            </h2>
            <p className="kc-settings-section__description">
              Pengaturan peluncuran dan pembukaan layar tampilan publik.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <Toggle
            checked={autoOpenAudience}
            description="Luncurkan layar audiens secara otomatis begitu ruang kerja acara siap dibuka."
            label="Buka Audience Display otomatis"
            onChange={(e) => setAutoOpenAudience(e.target.checked)}
          />

          <div style={{ borderTop: '1px solid var(--kc-divider)', paddingTop: '14px' }}>
            <Toggle
              checked={openAudienceNewWindow}
              description="Gunakan popup window independen tanpa address bar browser yang dioptimalkan untuk monitor kedua/LED."
              label="Buka Audience Display di jendela baru"
              onChange={(e) => setOpenAudienceNewWindow(e.target.checked)}
            />
          </div>
        </div>
      </section>

      {/* 3. Perangkat */}
      <section className="kc-settings-section" aria-labelledby="heading-devices">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-devices" className="kc-settings-section__title">
              Perangkat
            </h2>
            <p className="kc-settings-section__description">
              Pengelolaan daya dan kesiapan hardware saat acara berlangsung.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <Toggle
            checked={preventSleep}
            description="Menggunakan Screen Wake Lock API browser agar layar kontrol operator dan proyeksi panggung tidak mati otomatis."
            label="Cegah layar tidur saat sesi aktif"
            onChange={(e) => setPreventSleep(e.target.checked)}
          />
        </div>
      </section>

      {/* 4. Keyboard */}
      <section className="kc-settings-section" aria-labelledby="heading-keyboard">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-keyboard" className="kc-settings-section__title">
              Keyboard
            </h2>
            <p className="kc-settings-section__description">
              Pintasan tombol fisik untuk operasi panggung tanpa mouse.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Keyboard Shortcuts</span>
              <span className="kc-settings-row__desc">
                Daftar pintasan tombol cepat untuk mengeksekusi aksi undian dengan cepat dan presisi.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <Button
                icon={<Icon name="SlidersHorizontal" size={16} />}
                onClick={() => setShortcutsModalOpen(true)}
                type="button"
                variant="secondary"
              >
                Lihat Shortcut
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Dummy Shortcuts Modal */}
      <ShortcutsModal
        open={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </div>
  )
}
