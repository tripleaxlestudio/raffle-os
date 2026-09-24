import { useState } from 'react'
import {
  Button,
  Icon,
} from '../../../shared/ui/index.ts'

export function AboutTab() {
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false)

  const showTemporaryNotice = (msg: string) => {
    setFeedbackNotice(msg)
    setTimeout(() => {
      setFeedbackNotice(null)
    }, 3500)
  }

  const handleCheckUpdate = () => {
    setIsCheckingUpdate(true)
    setTimeout(() => {
      setIsCheckingUpdate(false)
      showTemporaryNotice('Anda menggunakan versi pengembangan terbaru (v0.1.0-dev).')
    }, 1200)
  }

  return (
    <div className="kc-settings-panel" role="tabpanel" id="panel-about" aria-labelledby="tab-about">
      {/* Feedback Toast/Notice */}
      {feedbackNotice !== null && (
        <div className="kc-settings-notice" role="status">
          <Icon name="CircleCheck" size={16} />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* 1. Hero / About Card */}
      <div className="kc-settings-about-hero">
        <div className="kc-settings-about-monogram" aria-hidden="true">
          K
        </div>
        <div className="kc-settings-about-copy">
          <h2 className="kc-settings-about-title">KOCOKAN</h2>
          <p className="kc-settings-about-subtitle">Kontrol Undian untuk Event</p>
          <p className="kc-settings-about-author">by Tripleaxle</p>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="kc-settings-meta-grid">
        <div className="kc-settings-meta-box">
          <span className="kc-settings-meta-box__label">Version</span>
          <span className="kc-settings-meta-box__value">0.1.0</span>
        </div>
        <div className="kc-settings-meta-box">
          <span className="kc-settings-meta-box__label">Build</span>
          <span className="kc-settings-meta-box__value">Development</span>
        </div>
        <div className="kc-settings-meta-box">
          <span className="kc-settings-meta-box__label">Release Channel</span>
          <span className="kc-settings-meta-box__value">Development</span>
        </div>
      </div>

      {/* 2. Application */}
      <section className="kc-settings-section" aria-labelledby="heading-application">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-application" className="kc-settings-section__title">
              Application
            </h2>
            <p className="kc-settings-section__description">
              Informasi dokumentasi, rilis fitur baru, dan lisensi perangkat lunak.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Yang Baru</span>
              <span className="kc-settings-row__desc">
                Catatan perubahan dan pengumuman fitur baru pada versi ini.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <Button
                icon={<Icon name="Sparkles" size={16} />}
                onClick={() => showTemporaryNotice('Simulasi membuka catatan rilis fitur.')}
                type="button"
                variant="secondary"
              >
                Buka
              </Button>
            </div>
          </div>

          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Panduan Pengguna</span>
              <span className="kc-settings-row__desc">
                Petunjuk operasional penggunaan Kocokan untuk operator dan tim AV panggung.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <Button
                icon={<Icon name="BookOpen" size={16} />}
                onClick={() => showTemporaryNotice('Simulasi membuka manual panduan pengguna.')}
                type="button"
                variant="secondary"
              >
                Buka
              </Button>
            </div>
          </div>

          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Dukungan</span>
              <span className="kc-settings-row__desc">
                Pusat bantuan kendala teknis dan pelaporan masalah operasional.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <Button
                icon={<Icon name="LifeBuoy" size={16} />}
                onClick={() => showTemporaryNotice('Simulasi membuka kanal dukungan teknis.')}
                type="button"
                variant="secondary"
              >
                Buka
              </Button>
            </div>
          </div>

          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Lisensi & Open Source</span>
              <span className="kc-settings-row__desc">
                Informasi hak cipta dan atribusi pustaka pihak ketiga yang digunakan.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <Button
                icon={<Icon name="FileText" size={16} />}
                onClick={() => showTemporaryNotice('Simulasi membuka rincian lisensi software.')}
                type="button"
                variant="secondary"
              >
                Lihat
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Update */}
      <section className="kc-settings-section" aria-labelledby="heading-update">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-update" className="kc-settings-section__title">
              Pembaruan Aplikasi
            </h2>
            <p className="kc-settings-section__description">
              Pemeriksaan patch keamanan dan rilis software terbaru.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Status Versi</span>
              <span className="kc-settings-row__desc">
                Anda menggunakan versi pengembangan.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <Button
                icon={<Icon name="RefreshCw" size={16} />}
                isLoading={isCheckingUpdate}
                onClick={handleCheckUpdate}
                type="button"
                variant="secondary"
              >
                {isCheckingUpdate ? 'Memeriksa…' : 'Periksa Pembaruan'}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
