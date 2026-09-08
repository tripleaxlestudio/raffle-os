import { Modal, Button, Icon } from '../../../shared/ui/index.ts'

interface ShortcutsModalProps {
  readonly open: boolean
  readonly onClose: () => void
}

const SHORTCUT_LIST = [
  { key: 'Space', desc: 'Mulai atau putar undian tiket', category: 'Undian' },
  { key: 'Enter', desc: 'Konfirmasi pemenang terpilih', category: 'Undian' },
  { key: 'Esc', desc: 'Batalkan aksi atau tutup dialog/modal aktif', category: 'Navigasi' },
  { key: 'P', desc: 'Beralih ke Practice Mode', category: 'Mode' },
  { key: 'L', desc: 'Beralih ke Live Mode (memerlukan konfirmasi)', category: 'Mode' },
  { key: 'F11', desc: 'Aktifkan layar penuh pada Audience Display', category: 'Tampilan' },
  { key: 'B', desc: 'Minta layar hitam (Blackout) darurat', category: 'Keamanan' },
  { key: '?', desc: 'Buka bantuan daftar shortcut keyboard ini', category: 'Bantuan' },
] as const

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pintasan Keyboard Operator"
      eyebrow="Operasional Panggung"
      description="Daftar pintasan tombol cepat untuk memperlancar kendali undian langsung di meja operator."
      footer={
        <Button onClick={onClose} variant="secondary">
          Tutup
        </Button>
      }
    >
      <div className="kc-table-frame" style={{ marginTop: '4px' }}>
        <table className="kc-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: '120px' }}>Tombol</th>
              <th scope="col">Fungsi</th>
              <th scope="col" style={{ width: '110px' }}>Kategori</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUT_LIST.map((item) => (
              <tr key={item.key}>
                <td>
                  <code>{item.key}</code>
                </td>
                <td>{item.desc}</td>
                <td>
                  <span style={{ fontSize: '12px', color: 'var(--kc-text-muted)' }}>
                    {item.category}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '14px 0 0', fontSize: '12.5px', color: 'var(--kc-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Icon name="CircleAlert" size={14} />
        <span>Catatan evaluasi: Pintasan di atas merupakan daftar preview konseptual.</span>
      </p>
    </Modal>
  )
}
