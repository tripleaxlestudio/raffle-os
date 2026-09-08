import { useState } from 'react'
import { Link } from 'react-router'
import {
  Button,
  Icon,
} from '../../../shared/ui/index.ts'

export function DiagnosticsTab() {
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState<boolean>(false)

  const showTemporaryNotice = (msg: string) => {
    setFeedbackNotice(msg)
    setTimeout(() => {
      setFeedbackNotice(null)
    }, 3500)
  }

  const handleRunSystemCheck = () => {
    setIsChecking(true)
    setTimeout(() => {
      setIsChecking(false)
      showTemporaryNotice('Pemeriksaan diagnostik selesai: Semua komponen lokal beroperasi normal (dummy).')
    }, 1200)
  }

  return (
    <div className="kc-settings-panel" role="tabpanel" id="panel-diagnostics" aria-labelledby="tab-diagnostics">
      {/* Feedback Toast/Notice */}
      {feedbackNotice !== null && (
        <div className="kc-settings-notice" role="status">
          <Icon name="CircleCheck" size={16} />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* 1. System Health */}
      <section className="kc-settings-section" aria-labelledby="heading-system-health">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-system-health" className="kc-settings-section__title">
              System Health
            </h2>
            <p className="kc-settings-section__description">
              Status kesiapan infrastruktur dan API browser untuk operasional undian tanpa internet.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-health-list">
            <div className="kc-settings-health-item">
              <span className="kc-settings-health-item__label">Database</span>
              <span className="kc-settings-health-item__value kc-settings-health-item__value--success">
                <Icon name="Check" size={15} />
                <span>Siap</span>
              </span>
            </div>

            <div className="kc-settings-health-item">
              <span className="kc-settings-health-item__label">Secure Random</span>
              <span className="kc-settings-health-item__value kc-settings-health-item__value--success">
                <Icon name="Check" size={15} />
                <span>Tersedia</span>
              </span>
            </div>

            <div className="kc-settings-health-item">
              <span className="kc-settings-health-item__label">Audience Channel</span>
              <span className="kc-settings-health-item__value kc-settings-health-item__value--success">
                <Icon name="Check" size={15} />
                <span>Tersedia</span>
              </span>
            </div>

            <div className="kc-settings-health-item">
              <span className="kc-settings-health-item__label">Local Storage</span>
              <span className="kc-settings-health-item__value kc-settings-health-item__value--success">
                <Icon name="Check" size={15} />
                <span>Tersedia</span>
              </span>
            </div>

            <div className="kc-settings-health-item">
              <span className="kc-settings-health-item__label">Offline Support</span>
              <span className="kc-settings-health-item__value kc-settings-health-item__value--success">
                <Icon name="Check" size={15} />
                <span>Siap</span>
              </span>
            </div>

            <div className="kc-settings-health-item">
              <span className="kc-settings-health-item__label">Browser</span>
              <span className="kc-settings-health-item__value kc-settings-health-item__value--mono">
                Microsoft Edge 128.0
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Diagnostics */}
      <section className="kc-settings-section" aria-labelledby="heading-diagnostics">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-diagnostics" className="kc-settings-section__title">
              Diagnostics
            </h2>
            <p className="kc-settings-section__description">
              Peralatan pengujian performa sistem dan pemantauan rekaman log operasional.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button
              icon={<Icon name="ListChecks" size={16} />}
              isLoading={isChecking}
              onClick={handleRunSystemCheck}
              type="button"
              variant="secondary"
            >
              {isChecking ? 'Menjalankan…' : 'Jalankan Pemeriksaan Sistem'}
            </Button>

            <Link
              to="/log"
              className="kc-button kc-button--secondary kc-button--md"
            >
              <span className="kc-button__icon">
                <Icon name="FileText" size={16} />
              </span>
              <span>Buka Log</span>
            </Link>

            <Button
              icon={<Icon name="Download" size={16} />}
              onClick={() => showTemporaryNotice('Simulasi export: Diagnostic report dummy dibuat.')}
              type="button"
              variant="secondary"
            >
              Export Diagnostic Report
            </Button>
          </div>
        </div>
      </section>

      {/* 3. Maintenance */}
      <section className="kc-settings-section" aria-labelledby="heading-cache-maintenance">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-cache-maintenance" className="kc-settings-section__title">
              Maintenance
            </h2>
            <p className="kc-settings-section__description">
              Pembersihan resource internal aplikasi yang dicache di memori browser.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Bersihkan Cache Aplikasi</span>
              <span className="kc-settings-row__desc">
                Hapus memori cache aset gambar pratinjau, stylesheet, dan script tanpa menghapus database undian.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <Button
                icon={<Icon name="RefreshCw" size={16} />}
                onClick={() => showTemporaryNotice('Cache aplikasi berhasil dibersihkan (simulasi dummy).')}
                type="button"
                variant="secondary"
              >
                Bersihkan Cache Aplikasi
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
