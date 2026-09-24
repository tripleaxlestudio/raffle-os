import { useMemo, useState, type ReactNode } from 'react'
import type { DisplayConnectionStatus } from '../../application/display-transport/connection-status.ts'
import { openManagedAudienceDisplay } from '../../infrastructure/browser/managed-audience-display.ts'
import { AudienceConnectionStatus } from '../../shared/components/AudienceConnectionStatus.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { Icon } from '../../shared/ui/Icon.tsx'
import { Modal } from '../../shared/ui/Modal.tsx'

interface AudienceShareModalProps {
  readonly audiencePath: string
  readonly connectionStatus: DisplayConnectionStatus
  readonly onClose: () => void
  readonly open: boolean
  readonly preview: ReactNode
  readonly stateLabel: string
  readonly transparent: boolean
}

type ActionFeedback = 'idle' | 'copied' | 'copy-failed' | 'popup-blocked'

export function AudienceShareModal({
  audiencePath,
  connectionStatus,
  onClose,
  open,
  preview,
  stateLabel,
  transparent,
}: AudienceShareModalProps) {
  const [feedback, setFeedback] = useState<ActionFeedback>('idle')
  const audienceUrl = useMemo(
    () => new URL(audiencePath, window.location.origin).toString(),
    [audiencePath],
  )

  async function copyAudienceUrl() {
    try {
      await navigator.clipboard.writeText(audienceUrl)
      setFeedback('copied')
    } catch {
      setFeedback('copy-failed')
    }
  }

  function openAudience() {
    setFeedback(openManagedAudienceDisplay(audiencePath) === 'blocked' ? 'popup-blocked' : 'idle')
  }

  return (
    <Modal
      closeAriaLabel="Tutup Bagikan Tampilan Audiens"
      closeLabel="Tutup"
      description="Gunakan link ini untuk membuka Tampilan Audiens di browser, vMix, OBS, atau perangkat lain yang dapat mengakses Kocokan."
      eyebrow="OUTPUT AUDIENS"
      footer={<Button onClick={onClose} variant="secondary">Tutup</Button>}
      headerIcon={<Icon name="Monitor" />}
      headerIconTone="info"
      onClose={onClose}
      open={open}
      title="Bagikan Tampilan Audiens"
    >
      <div className="kc-audience-share">
        <section className="kc-audience-share__output" aria-labelledby="audience-output-title">
          <div className="kc-audience-share__preview">{preview}</div>
          <div className="kc-audience-share__output-heading">
            <div>
              <p>OUTPUT UTAMA</p>
              <h3 id="audience-output-title">Tampilan Audiens</h3>
            </div>
            <div className="kc-audience-share__status">
              <span>{stateLabel}</span>
              <AudienceConnectionStatus state={connectionStatus} />
            </div>
          </div>

          <label className="kc-audience-share__url-field">
            <span>URL Tampilan Audiens</span>
            <input aria-label="URL Tampilan Audiens" readOnly spellCheck={false} type="url" value={audienceUrl} />
          </label>

          <div className="kc-audience-share__actions">
            <Button aria-label="Salin link Tampilan Audiens" icon={<Icon name="Copy" />} onClick={() => void copyAudienceUrl()} variant="secondary">Salin Link</Button>
            <Button icon={<Icon name="ExternalLink" />} iconAfter onClick={openAudience}>Buka Tampilan</Button>
            <span aria-live="polite" className="kc-audience-share__feedback" role="status">
              {feedback === 'copied' ? 'Link disalin' : feedback === 'copy-failed' ? 'Link tidak dapat disalin' : feedback === 'popup-blocked' ? 'Jendela baru diblokir browser' : ''}
            </span>
          </div>
        </section>

        <div className={`kc-audience-share__transparency ${transparent ? 'is-active' : ''}`}>
          <Icon name={transparent ? 'CircleCheck' : 'CircleAlert'} size={18} />
          <span>{transparent
            ? 'Mode transparan aktif — siap digunakan sebagai overlay Browser Input.'
            : 'Gunakan Background Transparan jika ingin menampilkan Kocokan sebagai overlay di vMix/OBS.'}</span>
        </div>

        <section className="kc-audience-share__guide" aria-labelledby="audience-share-guide-title">
          <h3 id="audience-share-guide-title">Cara menggunakan</h3>
          <dl>
            <div><dt>vMix</dt><dd>Add Input → Web Browser → tempel link Tampilan Audiens</dd></div>
            <div><dt>OBS</dt><dd>Sources → Browser → tempel link Tampilan Audiens</dd></div>
          </dl>
        </section>
      </div>
    </Modal>
  )
}
