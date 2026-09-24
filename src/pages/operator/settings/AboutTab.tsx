import { useState } from 'react'
import { checkForUpdate, type UpdateReleaseClient, type UpdateState } from '../../../application/update/update-checker.ts'
import { KOCOKAN_APP_VERSION } from '../../../config/app-version.ts'
import { openExternalLink, type ExternalLinkOpenResult } from '../../../infrastructure/browser/external-link.ts'
import { githubReleaseClient } from '../../../infrastructure/update/github-release-client.ts'
import {
  Button,
  Icon,
} from '../../../shared/ui/index.ts'

interface AboutTabProps {
  readonly updateClient?: UpdateReleaseClient
  readonly openLink?: (url: string) => ExternalLinkOpenResult
  readonly currentVersion?: string
}

function updateStatusText(state: UpdateState): string {
  switch (state.status) {
    case 'idle':
      return 'Belum diperiksa'
    case 'checking':
      return 'Memeriksa pembaruan...'
    case 'up-to-date':
      return 'Anda menggunakan versi terbaru.'
    case 'update-available':
      return `Pembaruan tersedia: v${state.latestVersion}`
    case 'error':
      return 'Tidak dapat memeriksa pembaruan.'
  }
}

function updateButtonText(state: UpdateState): string {
  switch (state.status) {
    case 'idle':
      return 'Periksa Pembaruan'
    case 'checking':
      return 'Memeriksa…'
    case 'error':
      return 'Coba Lagi'
    case 'up-to-date':
    case 'update-available':
      return 'Periksa Lagi'
  }
}

export function AboutTab({
  updateClient = githubReleaseClient,
  openLink = openExternalLink,
  currentVersion = KOCOKAN_APP_VERSION,
}: AboutTabProps) {
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null)
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' })

  const showTemporaryNotice = (msg: string) => {
    setFeedbackNotice(msg)
    setTimeout(() => {
      setFeedbackNotice(null)
    }, 3500)
  }

  const handleCheckUpdate = async () => {
    if (updateState.status === 'checking') return
    setUpdateState({ status: 'checking' })
    setUpdateState(await checkForUpdate(currentVersion, updateClient))
  }

  const handleViewRelease = () => {
    if (updateState.status !== 'update-available') return
    if (openLink(updateState.releaseUrl) === 'blocked') {
      showTemporaryNotice('Izinkan pop-up browser untuk membuka halaman rilis.')
    }
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
          <span className="kc-settings-meta-box__value">{currentVersion}</span>
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
                {updateStatusText(updateState)}
              </span>
              {updateState.status === 'up-to-date' && (
                <span className="kc-settings-row__desc">Versi {updateState.currentVersion}</span>
              )}
            </div>
            <div className="kc-settings-row__action">
              {updateState.status === 'update-available' && (
                <Button
                  icon={<Icon name="ExternalLink" size={16} />}
                  onClick={handleViewRelease}
                  type="button"
                >
                  Lihat Rilis
                </Button>
              )}
              <Button
                icon={<Icon name="RefreshCw" size={16} />}
                isLoading={updateState.status === 'checking'}
                onClick={handleCheckUpdate}
                type="button"
                variant="secondary"
              >
                {updateButtonText(updateState)}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
