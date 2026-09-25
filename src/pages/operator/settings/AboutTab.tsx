import { useEffect, useRef, useState } from 'react'
import { checkForUpdate, type UpdateReleaseClient, type UpdateState } from '../../../application/update/update-checker.ts'
import { productionUpdateLock, type UpdateOperationLock } from '../../../application/update/update-lock.ts'
import { readAuthoritativeUpdateSafety, updateSafetyCopy, type UpdateSafetyAuthority, type UpdateSafetyResult } from '../../../application/update/update-safety.ts'
import { KOCOKAN_APP_VERSION } from '../../../config/app-version.ts'
import { openExternalLink, type ExternalLinkOpenResult } from '../../../infrastructure/browser/external-link.ts'
import { githubReleaseClient } from '../../../infrastructure/update/github-release-client.ts'
import { LocalUpdateClientError, localUpdateClient, type LocalUpdateClient, type NativeUpdateCapabilities, type NativeUpdateErrorCode, type NativeUpdateInstallResult, type NativeUpdateStatus } from '../../../infrastructure/update/local-update-client.ts'
import {
  Button,
  Icon,
} from '../../../shared/ui/index.ts'

interface AboutTabProps {
  readonly updateClient?: UpdateReleaseClient
  readonly openLink?: (url: string) => ExternalLinkOpenResult
  readonly currentVersion?: string
  readonly nativeClient?: LocalUpdateClient
  readonly safetyAuthority?: UpdateSafetyAuthority
  readonly updateLock?: UpdateOperationLock
}

const AUTOMATIC_UPDATE_UNAVAILABLE = 'Pembaruan otomatis hanya tersedia pada versi Kocokan yang terpasang.'

function nativeErrorText(error: NativeUpdateErrorCode | 'generic'): string {
  if (error === 'release-unavailable' || error === 'release-invalid') return 'Rilis pembaruan tidak dapat ditemukan.'
  if (error === 'download-failed') return 'Pembaruan gagal diunduh.'
  if (error === 'checksum-invalid') return 'Verifikasi pembaruan gagal.'
  if (error === 'storage-failed') return 'Pembaruan tidak dapat disimpan.'
  if (error === 'install-handoff-failed') return 'Pemasangan pembaruan tidak dapat dimulai.'
  return 'Pembaruan tidak dapat disiapkan.'
}

function preparationText(status: NativeUpdateStatus): string {
  if (status.state === 'preparing') return 'Menyiapkan pembaruan...'
  if (status.state === 'downloading') return 'Mengunduh pembaruan...'
  if (status.state === 'verifying') return 'Memverifikasi pembaruan...'
  if (status.state === 'ready-to-install') return 'Siap dipasang'
  if (status.state === 'installing') return 'Menyiapkan instalasi...'
  if (status.state === 'error') return nativeErrorText(status.error ?? 'generic')
  return 'Menyiapkan pembaruan...'
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
  nativeClient = localUpdateClient,
  safetyAuthority = readAuthoritativeUpdateSafety,
  updateLock = productionUpdateLock,
}: AboutTabProps) {
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null)
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' })
  const [capabilities, setCapabilities] = useState<NativeUpdateCapabilities>({ environment: 'development', prepareSupported: false, installSupported: false })
  const [safety, setSafety] = useState<UpdateSafetyResult | null>(null)
  const [preparation, setPreparation] = useState<NativeUpdateStatus | null>(null)
  const [preparationError, setPreparationError] = useState<string | null>(null)
  const [installResult, setInstallResult] = useState<NativeUpdateInstallResult | null>(null)
  const pollingAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([nativeClient.detectCapabilities(), nativeClient.getInstallResult().catch(() => null)]).then(([next, result]) => { if (active) { setCapabilities(next); setInstallResult(result) } })
    return () => { active = false; pollingAbortRef.current?.abort() }
  }, [nativeClient])

  const showTemporaryNotice = (msg: string) => {
    setFeedbackNotice(msg)
    setTimeout(() => {
      setFeedbackNotice(null)
    }, 3500)
  }

  const handleCheckUpdate = async () => {
    if (updateState.status === 'checking') return
    setUpdateState({ status: 'checking' })
    const [next, nativeCapabilities] = await Promise.all([
      checkForUpdate(currentVersion, updateClient),
      nativeClient.detectCapabilities(),
    ])
    setCapabilities(nativeCapabilities)
    setUpdateState(next)
    if (next.status === 'update-available' && nativeCapabilities.prepareSupported) setSafety(await safetyAuthority())
  }

  const handleInstallUpdate = async () => {
    if (updateState.status !== 'update-available' || preparation?.state !== 'ready-to-install' || !capabilities.installSupported) return
    const before = await safetyAuthority()
    setSafety(before)
    if (!before.safe) return
    const stillSafe = await updateLock.revalidate(async () => {
      const authoritative = await safetyAuthority()
      setSafety(authoritative)
      return authoritative.safe
    })
    if (!stillSafe) return
    setPreparationError(null)
    setPreparation({ state: 'installing', version: updateState.latestVersion })
    try { setPreparation(await nativeClient.install(updateState.latestVersion)) }
    catch (cause: unknown) {
      if (cause instanceof LocalUpdateClientError && cause.code === 'runtime-unavailable') return
      setPreparationError('Pemasangan pembaruan tidak dapat dimulai.')
      setPreparation({ state: 'ready-to-install', version: updateState.latestVersion })
    }
  }

  const handlePrepareUpdate = async () => {
    if (updateState.status !== 'update-available' || !capabilities.prepareSupported) return
    setPreparationError(null)
    const before = await safetyAuthority()
    setSafety(before)
    if (!before.safe) return
    let acquiredSafety: UpdateSafetyResult = { safe: false, reason: 'workspace-unreadable' }
    const acquired = await updateLock.acquire(async () => {
      acquiredSafety = await safetyAuthority()
      return acquiredSafety.safe
    })
    if (!acquired) { setSafety(acquiredSafety); return }
    setPreparation({ state: 'preparing', version: updateState.latestVersion })
    const abort = new AbortController()
    pollingAbortRef.current?.abort()
    pollingAbortRef.current = abort
    try {
      const accepted = await nativeClient.prepare(updateState.latestVersion)
      setPreparation(accepted)
      const terminal = await nativeClient.pollStatus(setPreparation, { signal: abort.signal, intervalMs: 750 })
      if (terminal.state === 'ready-to-install') updateLock.markReadyToInstall()
      else {
        updateLock.release()
      }
    } catch (cause: unknown) {
      updateLock.release()
      nativeClient.clearRuntimeAuthorization()
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        setPreparationError(nativeErrorText('generic'))
      }
    }
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
              {updateState.status === 'update-available' && !capabilities.prepareSupported && (
                <span className="kc-settings-row__desc">{AUTOMATIC_UPDATE_UNAVAILABLE}</span>
              )}
              {updateState.status === 'update-available' && capabilities.prepareSupported && safety !== null && !safety.safe && (
                <span className="kc-settings-row__desc">{updateSafetyCopy(safety)}</span>
              )}
              {preparation !== null && preparation.state !== 'idle' && (
                <span className="kc-settings-row__desc kc-settings-update-status" role="status">
                  {preparationText(preparation)}
                  {preparation.state === 'downloading' && (
                    <progress aria-label="Progres unduhan pembaruan" max={100} {...(preparation.progress?.percent === undefined ? {} : { value: preparation.progress.percent })} />
                  )}
                </span>
              )}
              {preparationError !== null && <span className="kc-settings-row__desc kc-settings-update-error" role="alert">{preparationError}</span>}
              {installResult !== null && <span className="kc-settings-row__desc" role="status">{installResult.result === 'success' ? `Pembaruan v${installResult.version} berhasil dipasang.` : installResult.result === 'cancelled' ? `Pemasangan v${installResult.version} dibatalkan.` : `Pemasangan v${installResult.version} gagal.`}</span>}
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
              {updateState.status === 'update-available' && capabilities.prepareSupported && preparation?.state !== 'ready-to-install' && (
                <Button
                  icon={<Icon name="Download" size={16} />}
                  isLoading={preparation !== null && ['preparing', 'downloading', 'verifying'].includes(preparation.state)}
                  disabled={safety?.safe !== true || (preparation !== null && ['preparing', 'downloading', 'verifying'].includes(preparation.state))}
                  onClick={() => { void handlePrepareUpdate() }}
                  type="button"
                >
                  {preparationError === null && preparation?.state !== 'error' ? 'Update Sekarang' : 'Coba Lagi Menyiapkan'}
                </Button>
              )}
              {updateState.status === 'update-available' && capabilities.installSupported && preparation?.state === 'ready-to-install' && (
                <Button icon={<Icon name="Download" size={16} />} onClick={() => { void handleInstallUpdate() }} type="button">Pasang Pembaruan</Button>
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
