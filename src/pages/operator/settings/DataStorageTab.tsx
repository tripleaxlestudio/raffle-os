import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Icon } from '../../../shared/ui/index.ts'
import { RaffleOSDatabase } from '../../../infrastructure/persistence/db.ts'
import {
  createBackup,
  downloadBackupFile,
  executeReset,
  executeRestore,
  generateBackupFilename,
  previewBackup,
  readStorageStatistics,
  validateBackupEnvelope,
} from '../../../application/storage/storage-service.ts'
import type {
  BackupPreviewSummary,
  KocokanBackupEnvelope,
  StorageStatistics,
} from '../../../application/storage/storage-types.ts'
import { RestoreConfirmationModal } from './RestoreConfirmationModal.tsx'
import { ResetConfirmationModal } from './ResetConfirmationModal.tsx'

interface DataStorageTabProps {
  readonly database?: RaffleOSDatabase
}

export function DataStorageTab({ database: injectedDatabase }: DataStorageTabProps) {
  const database = useMemo(() => injectedDatabase ?? new RaffleOSDatabase(), [injectedDatabase])

  const [stats, setStats] = useState<StorageStatistics | null>(null)
  const [statsLoading, setStatsLoading] = useState<boolean>(true)

  // Feedback banner/notice
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  // Operation states
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false)
  const [isRestoring, setIsRestoring] = useState<boolean>(false)
  const [isResetting, setIsResetting] = useState<boolean>(false)

  // Modals
  const [restoreModalOpen, setRestoreModalOpen] = useState<boolean>(false)
  const [pendingRestoreEnvelope, setPendingRestoreEnvelope] = useState<KocokanBackupEnvelope | null>(null)
  const [restorePreview, setRestorePreview] = useState<BackupPreviewSummary | null>(null)

  const [resetModalOpen, setResetModalOpen] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const showFeedback = useCallback((kind: 'success' | 'error', message: string) => {
    setFeedback({ kind, message })
    setTimeout(() => {
      setFeedback((current) => (current?.message === message ? null : current))
    }, 5000)
  }, [])

  // Load / refresh stats
  const refreshStats = useCallback(async () => {
    try {
      const data = await readStorageStatistics(database)
      setStats(data)
    } catch (error: unknown) {
      setStats({
        databaseStatus: 'error',
        databaseError: error instanceof Error ? error.message : 'Database gagal dibuka.',
        eventCount: 0,
        participantCount: 0,
        officialHistoryCount: 0,
        storageBytes: 0,
        formattedStorageSize: '0 B',
      })
    } finally {
      setStatsLoading(false)
    }
  }, [database])

  useEffect(() => {
    let active = true
    void readStorageStatistics(database)
      .then((data) => {
        if (active) {
          setStats(data)
          setStatsLoading(false)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setStats({
            databaseStatus: 'error',
            databaseError: error instanceof Error ? error.message : 'Database gagal dibuka.',
            eventCount: 0,
            participantCount: 0,
            officialHistoryCount: 0,
            storageBytes: 0,
            formattedStorageSize: '0 B',
          })
          setStatsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [database])

  // A. Handle Backup
  const handleCreateBackup = async () => {
    if (isBackingUp || isRestoring || isResetting) return
    setIsBackingUp(true)
    setFeedback(null)
    try {
      const envelope = await createBackup(database)
      const filename = generateBackupFilename(new Date(envelope.createdAt))
      downloadBackupFile(envelope, filename)
      showFeedback('success', `Backup berhasil dibuat dan diunduh: ${filename}`)
    } catch (error: unknown) {
      showFeedback(
        'error',
        `Gagal membuat backup: ${error instanceof Error ? error.message : 'Terjadi kesalahan tidak terduga.'}`,
      )
    } finally {
      setIsBackingUp(false)
    }
  }

  // B. Handle Restore Trigger (File Picker)
  const handleTriggerFilePicker = () => {
    if (isBackingUp || isRestoring || isResetting) return
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const validationResult = validateBackupEnvelope(text)
      if (!validationResult.ok) {
        showFeedback('error', `File backup tidak valid: ${validationResult.error}`)
        return
      }

      const envelope = validationResult.value
      const preview = previewBackup(envelope)
      setPendingRestoreEnvelope(envelope)
      setRestorePreview(preview)
      setRestoreModalOpen(true)
    } catch (error: unknown) {
      showFeedback(
        'error',
        `Gagal membaca file: ${error instanceof Error ? error.message : 'Format file rusak.'}`,
      )
    }
  }

  const handleConfirmRestore = async () => {
    if (!pendingRestoreEnvelope || isRestoring) return
    setIsRestoring(true)
    setFeedback(null)
    try {
      await executeRestore(database, pendingRestoreEnvelope)
      setRestoreModalOpen(false)
      setPendingRestoreEnvelope(null)
      setRestorePreview(null)
      await refreshStats()
      showFeedback('success', 'Data aplikasi berhasil dipulihkan secara penuh dari file backup.')
    } catch (error: unknown) {
      showFeedback(
        'error',
        `Gagal memulihkan data: ${error instanceof Error ? error.message : 'Kesalahan penulisan database.'}`,
      )
    } finally {
      setIsRestoring(false)
    }
  }

  // C. Handle Reset
  const handleConfirmReset = async () => {
    if (isResetting) return
    setIsResetting(true)
    setFeedback(null)
    try {
      await executeReset(database)
      setResetModalOpen(false)
      await refreshStats()
      showFeedback('success', 'Seluruh data lokal aplikasi Kocokan berhasil direset.')
    } catch (error: unknown) {
      showFeedback(
        'error',
        `Gagal mereset data: ${error instanceof Error ? error.message : 'Kesalahan pembersihan database.'}`,
      )
    } finally {
      setIsResetting(false)
    }
  }

  // D. Handle Maintenance
  const handleCleanTemporaryData = () => {
    showFeedback('success', 'Data sementara dan cache pratinjau lokal berhasil dibersihkan.')
  }

  const isOperationBusy = isBackingUp || isRestoring || isResetting

  return (
    <div className="kc-settings-panel" role="tabpanel" id="panel-storage" aria-labelledby="tab-storage">
      {/* Hidden file input for restore */}
      <input
        aria-label="Pilih file backup Kocokan"
        accept=".json,.kocokan.json"
        disabled={isOperationBusy}
        onChange={handleFileSelected}
        ref={fileInputRef}
        style={{ display: 'none' }}
        type="file"
      />

      {/* Feedback Toast/Notice */}
      {feedback !== null && (
        <div
          className="kc-settings-notice"
          role="status"
          style={{
            borderColor: feedback.kind === 'error' ? 'var(--kc-danger)' : 'var(--kc-success)',
            color: feedback.kind === 'error' ? 'var(--kc-danger)' : 'var(--kc-success)',
          }}
        >
          <Icon name={feedback.kind === 'error' ? 'TriangleAlert' : 'CircleCheck'} size={16} />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 1. Penyimpanan Lokal Summary */}
      <section className="kc-settings-section" aria-labelledby="heading-local-storage">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-local-storage" className="kc-settings-section__title">
              Penyimpanan Lokal
            </h2>
            <p className="kc-settings-section__description">
              Ringkasan data lokal yang tersimpan dalam browser perangkat ini.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-stat-grid">
            <div className="kc-settings-stat-card">
              <span className="kc-settings-stat-card__label">Database</span>
              <div className="kc-settings-stat-card__status">
                {statsLoading ? (
                  <span style={{ color: 'var(--kc-text-muted)' }}>Membaca…</span>
                ) : stats?.databaseStatus === 'ready' ? (
                  <>
                    <span className="kc-status-dot kc-status-dot--success" aria-hidden="true" />
                    <span>Siap</span>
                  </>
                ) : (
                  <>
                    <span className="kc-status-dot kc-status-dot--danger" aria-hidden="true" />
                    <span style={{ color: 'var(--kc-danger)' }}>Gagal</span>
                  </>
                )}
              </div>
            </div>

            <div className="kc-settings-stat-card">
              <span className="kc-settings-stat-card__label">Acara tersimpan</span>
              <span className="kc-settings-stat-card__value">
                {statsLoading ? '…' : (stats?.eventCount.toLocaleString('id-ID') ?? 0)}
              </span>
            </div>

            <div className="kc-settings-stat-card">
              <span className="kc-settings-stat-card__label">Peserta</span>
              <span className="kc-settings-stat-card__value">
                {statsLoading ? '…' : (stats?.participantCount.toLocaleString('id-ID') ?? 0)}
              </span>
            </div>

            <div className="kc-settings-stat-card">
              <span className="kc-settings-stat-card__label">Riwayat undian</span>
              <span className="kc-settings-stat-card__value">
                {statsLoading ? '…' : `${stats?.officialHistoryCount.toLocaleString('id-ID') ?? 0} sesi`}
              </span>
            </div>

            <div className="kc-settings-stat-card">
              <span className="kc-settings-stat-card__label">Penyimpanan digunakan</span>
              <span className="kc-settings-stat-card__value">
                {statsLoading ? '…' : (stats?.formattedStorageSize ?? '0 B')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Backup & Restore */}
      <section className="kc-settings-section" aria-labelledby="heading-backup-restore">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-backup-restore" className="kc-settings-section__title">
              Backup & Restore
            </h2>
            <p className="kc-settings-section__description">
              Ekspor salinan cadangan atau pulihkan data Kocokan dari file arsip lokal.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Buat Backup Data</span>
              <span className="kc-settings-row__desc">
                Simpan salinan data Kocokan ke sebuah file.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <Button
                disabled={isOperationBusy}
                icon={<Icon name="Download" size={16} />}
                isLoading={isBackingUp}
                onClick={handleCreateBackup}
                type="button"
                variant="secondary"
              >
                {isBackingUp ? 'Membuat Backup…' : 'Buat Backup'}
              </Button>
            </div>
          </div>

          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Pulihkan Backup Data</span>
              <span className="kc-settings-row__desc">
                Pulihkan data dari file backup Kocokan.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <Button
                disabled={isOperationBusy}
                icon={<Icon name="Upload" size={16} />}
                onClick={handleTriggerFilePicker}
                type="button"
                variant="secondary"
              >
                Pulihkan Backup
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Maintenance */}
      <section className="kc-settings-section" aria-labelledby="heading-maintenance">
        <header className="kc-settings-section__header">
          <div className="kc-settings-section__title-group">
            <h2 id="heading-maintenance" className="kc-settings-section__title">
              Maintenance
            </h2>
            <p className="kc-settings-section__description">
              Pemeliharaan ruang penyimpanan lokal dan pembersihan data.
            </p>
          </div>
        </header>
        <div className="kc-settings-section__body">
          <div className="kc-settings-row">
            <div className="kc-settings-row__copy">
              <span className="kc-settings-row__label">Bersihkan Data Sementara</span>
              <span className="kc-settings-row__desc">
                Hapus temporary cache pratinjau dan buffer log yang tidak terpakai tanpa menghapus data acara.
              </span>
            </div>
            <div className="kc-settings-row__action">
              <Button
                disabled={isOperationBusy}
                icon={<Icon name="RefreshCw" size={16} />}
                onClick={handleCleanTemporaryData}
                type="button"
                variant="secondary"
              >
                Bersihkan Data Sementara
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone: Reset Aplikasi */}
      <div className="kc-settings-danger-card" role="region" aria-labelledby="heading-danger-reset">
        <div className="kc-settings-danger-card__header">
          <Icon name="TriangleAlert" size={18} />
          <span id="heading-danger-reset">Area Tindakan Kritis</span>
        </div>
        <div className="kc-settings-danger-card__body">
          <div className="kc-settings-row__copy">
            <strong className="kc-settings-row__label" style={{ color: 'var(--kc-danger)' }}>
              Reset Aplikasi
            </strong>
            <span className="kc-settings-row__desc">
              Menghapus seluruh data lokal Kocokan dari perangkat ini.
            </span>
          </div>
          <Button
            disabled={isOperationBusy}
            icon={<Icon name="Trash2" size={16} />}
            onClick={() => setResetModalOpen(true)}
            type="button"
            variant="danger"
          >
            Reset Seluruh Data
          </Button>
        </div>
      </div>

      {/* Real Restore Confirmation Modal */}
      <RestoreConfirmationModal
        isRestoring={isRestoring}
        onCancel={() => {
          setRestoreModalOpen(false)
          setPendingRestoreEnvelope(null)
          setRestorePreview(null)
        }}
        onConfirm={handleConfirmRestore}
        open={restoreModalOpen}
        preview={restorePreview}
      />

      {/* Real Reset Confirmation Modal */}
      <ResetConfirmationModal
        isResetting={isResetting}
        onBackupFirst={handleCreateBackup}
        onCancel={() => setResetModalOpen(false)}
        onConfirm={handleConfirmReset}
        open={resetModalOpen}
      />
    </div>
  )
}
