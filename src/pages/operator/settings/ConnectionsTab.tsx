import { useState } from 'react'
import {
  Button,
  Badge,
  Icon,
} from '../../../shared/ui/index.ts'

export function ConnectionsTab() {
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null)
  const [audienceTestState, setAudienceTestState] = useState<string>('Menunggu')

  const showTemporaryNotice = (msg: string) => {
    setFeedbackNotice(msg)
    setTimeout(() => {
      setFeedbackNotice(null)
    }, 3500)
  }

  const handleTestConnection = () => {
    setAudienceTestState('Menguji sinyal…')
    setTimeout(() => {
      setAudienceTestState('Menunggu')
      showTemporaryNotice('Tes koneksi dummy selesai: BroadcastChannel siap menerima listener.')
    }, 1200)
  }

  const handleRestartConnection = () => {
    setAudienceTestState('Menghubungkan ulang…')
    setTimeout(() => {
      setAudienceTestState('Menunggu')
      showTemporaryNotice('Koneksi dummy berhasil diinisialisasi ulang.')
    }, 1000)
  }

  const handleCopyAddress = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText('http://127.0.0.1:5173')
    }
    showTemporaryNotice('Alamat server http://127.0.0.1:5173 disalin ke clipboard.')
  }

  return (
    <div className="kc-settings-panel" role="tabpanel" id="panel-connections" aria-labelledby="tab-connections">
      {/* Feedback Toast/Notice */}
      {feedbackNotice !== null && (
        <div className="kc-settings-notice" role="status">
          <Icon name="CircleCheck" size={16} />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* 1. Audience Connection */}
      <section className="kc-settings-section" aria-labelledby="heading-audience-connection">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-audience-connection" className="kc-settings-section__title">
              Audience Connection
            </h2>
            <p className="kc-settings-section__description">
              Saluran sinkronisasi lokal antara Operator Panel dan Audience Display.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Audience Display</span>
              <span className="kc-settings-row__desc">
                Status komunikasi transport tampilan layar audiens.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <Badge variant={audienceTestState === 'Menunggu' ? 'warning' : 'info'} indicator>
                {audienceTestState}
              </Badge>
            </div>
          </div>

          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Channel Transport</span>
              <span className="kc-settings-row__desc">
                Protokol saluran pertukaran pesan antar jendela dalam browser yang sama.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <code>BroadcastChannel</code>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
            <Button
              icon={<Icon name="MonitorCheck" size={16} />}
              onClick={handleTestConnection}
              type="button"
              variant="primary"
            >
              Tes Koneksi
            </Button>
            <Button
              icon={<Icon name="RefreshCw" size={16} />}
              onClick={handleRestartConnection}
              type="button"
              variant="secondary"
            >
              Restart Koneksi
            </Button>
          </div>
        </div>
      </section>

      {/* 2. Local Server */}
      <section className="kc-settings-section" aria-labelledby="heading-local-server">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-local-server" className="kc-settings-section__title">
              Local Server
            </h2>
            <p className="kc-settings-section__description">
              Informasi host dan port lokal untuk akses jaringan internal venue.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Local Server</span>
              <span className="kc-settings-row__desc">
                Status runtime server aplikasi di mesin operator.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <Badge variant="success" indicator>
                Aktif
              </Badge>
            </div>
          </div>

          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Alamat & Port</span>
              <span className="kc-settings-row__desc">
                Alamat IP lokal dan port yang dapat diakses oleh perangkat lain dalam satu WiFi/LAN.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                <code>127.0.0.1</code>
                <span style={{ color: 'var(--kc-text-muted)' }}>:</span>
                <code>5173</code>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
            <Button
              icon={<Icon name="Copy" size={16} />}
              onClick={handleCopyAddress}
              type="button"
              variant="secondary"
            >
              Salin Alamat
            </Button>
            <Button
              icon={<Icon name="ExternalLink" size={16} />}
              onClick={() => showTemporaryNotice('Simulasi membuka URL di tab baru browser.')}
              type="button"
              variant="secondary"
            >
              Buka di Browser
            </Button>
          </div>
        </div>
      </section>

      {/* 3. Integrasi */}
      <section className="kc-settings-section" aria-labelledby="heading-integrations">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-integrations" className="kc-settings-section__title">
              Integrasi
            </h2>
            <p className="kc-settings-section__description">
              Kandidat integrasi eksternal untuk penyiaran video dan remote controller panggung.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-integration-grid">
            {/* NDI Output */}
            <div className="kc-settings-integration-card">
              <div className="kc-settings-integration-card__top">
                <div className="kc-settings-integration-card__header">
                  <h3 className="kc-settings-integration-card__title">NDI Output</h3>
                  <Badge variant="neutral">Coming Soon</Badge>
                </div>
                <p className="kc-settings-integration-card__desc">
                  Output Audience Display melalui NDI untuk koneksi video IP langsung ke vMix, OBS, atau switcher video studio.
                </p>
              </div>
              <div className="kc-settings-integration-card__footer">
                <Button disabled icon={<Icon name="Settings" size={14} />} size="sm" variant="secondary">
                  Konfigurasi
                </Button>
              </div>
            </div>

            {/* Remote Controller */}
            <div className="kc-settings-integration-card">
              <div className="kc-settings-integration-card__top">
                <div className="kc-settings-integration-card__header">
                  <h3 className="kc-settings-integration-card__title">Remote Controller</h3>
                  <Badge variant="neutral">Coming Soon</Badge>
                </div>
                <p className="kc-settings-integration-card__desc">
                  Kontrol sederhana dari smartphone atau tablet operator panggung untuk memicu putaran undian tanpa kabel.
                </p>
              </div>
              <div className="kc-settings-integration-card__footer">
                <Button disabled icon={<Icon name="Settings" size={14} />} size="sm" variant="secondary">
                  Konfigurasi
                </Button>
              </div>
            </div>

            {/* Network Controller */}
            <div className="kc-settings-integration-card">
              <div className="kc-settings-integration-card__top">
                <div className="kc-settings-integration-card__header">
                  <h3 className="kc-settings-integration-card__title">Network Controller</h3>
                  <Badge variant="neutral">Coming Soon</Badge>
                </div>
                <p className="kc-settings-integration-card__desc">
                  Kontrol operator melalui jaringan lokal via WebSocket atau integrasi perangkat keras seperti Elgato Stream Deck.
                </p>
              </div>
              <div className="kc-settings-integration-card__footer">
                <Button disabled icon={<Icon name="Settings" size={14} />} size="sm" variant="secondary">
                  Konfigurasi
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
