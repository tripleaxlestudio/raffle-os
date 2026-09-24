import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, ButtonLink, Card, Icon, Input } from '../../shared/ui/index.ts'
import { PageHeader } from '../../shared/components/PageHeader.tsx'
import { useUiClass } from '../../shared/ui/ui-theme.ts'
import { StatusBanner } from '../../shared/components/StatusBanner.tsx'
import {
  createEventSetupProductionServices,
  type EventSetupProductionServices,
} from '../../infrastructure/composition/event-setup-production.ts'
import {
  signalProductionWorkspaceChanged,
  useProductionWorkspace,
} from '../../app/workspace/ProductionWorkspaceContext.tsx'
import {
  validatePrizeImageFile,
  type PrizeCategory,
} from '../../domain/prizes/prize.types.ts'
import type { PrizeImageAssetRepository } from '../../application/persistence/repositories/prize-image-asset-repository.interface.ts'

const empty = {
  name: '',
  prizeName: '',
  description: '',
  sponsorName: '',
  displayOrder: '0',
}

function formatFileTypeAndSize(type?: string, size?: number): string | null {
  const parts: string[] = []
  if (type) {
    if (type === 'image/png') parts.push('PNG')
    else if (type === 'image/jpeg' || type === 'image/jpg') parts.push('JPG')
    else if (type === 'image/webp') parts.push('WebP')
    else parts.push(type.replace(/^image\//, '').toUpperCase())
  }
  if (size !== undefined && size > 0) {
    if (size < 1024 * 1024) {
      parts.push(`${(size / 1024).toFixed(0)} KB`)
    } else {
      parts.push(`${(size / (1024 * 1024)).toFixed(1)} MB`)
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

interface PrizeCategoryThumbnailProps {
  readonly assetId: string
  readonly prizeName: string
  readonly prizeImages: PrizeImageAssetRepository
}

function PrizeCategoryThumbnail({
  assetId,
  prizeName,
  prizeImages,
}: PrizeCategoryThumbnailProps) {
  const ui = useUiClass()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let isMounted = true
    let createdUrl: string | null = null

    void prizeImages
      .findById(assetId)
      .then((asset) => {
        if (!isMounted) return
        if (asset && asset.blob) {
          createdUrl = URL.createObjectURL(asset.blob)
          setImageUrl(createdUrl)
        } else {
          setLoadFailed(true)
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoadFailed(true)
        }
      })

    return () => {
      isMounted = false
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [assetId, prizeImages])

  if (loadFailed || !imageUrl) {
    return null
  }

  return (
    <div className={ui('prize-categories-page__category-thumb')}>
      <img
        src={imageUrl}
        alt={`Thumbnail ${prizeName}`}
        className={ui('prize-categories-page__category-thumb-img')}
        style={{ maxWidth: '48px', maxHeight: '48px', objectFit: 'contain' }}
        onError={() => setLoadFailed(true)}
      />
    </div>
  )
}

type ImageUploadState =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'existing'
      readonly assetId: string
      readonly name: string
      readonly type: string
      readonly size: number
      readonly url: string
    }
  | {
      readonly kind: 'new'
      readonly file: File
      readonly url: string
      readonly existingAssetIdToDelete?: string
    }
  | { readonly kind: 'removed'; readonly existingAssetIdToDelete: string }

export interface PrizeCategoriesPageProps {
  readonly services?: EventSetupProductionServices
}

export function PrizeCategoriesPage({
  services: injectedServices,
}: PrizeCategoriesPageProps = {}) {
  const ui = useUiClass()
  const services = useMemo(
    () => injectedServices ?? createEventSetupProductionServices(),
    [injectedServices],
  )
  const workspace = useProductionWorkspace()
  const selectedEvent = workspace.status === 'ready' ? workspace.event : null
  const [items, setItems] = useState<PrizeCategory[]>([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<PrizeCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [imageState, setImageState] = useState<ImageUploadState>({ kind: 'none' })
  const [imageError, setImageError] = useState<string | null>(null)
  const activePreviewUrlRef = useRef<string | null>(null)

  const updatePreviewUrl = useCallback((url: string | null) => {
    if (activePreviewUrlRef.current && activePreviewUrlRef.current !== url) {
      URL.revokeObjectURL(activePreviewUrlRef.current)
    }
    activePreviewUrlRef.current = url
  }, [])

  useEffect(() => {
    return () => {
      if (activePreviewUrlRef.current) {
        URL.revokeObjectURL(activePreviewUrlRef.current)
        activePreviewUrlRef.current = null
      }
    }
  }, [])

  const load = useCallback(async () => {
    if (selectedEvent === null) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await services.open()
      setItems(await services.categories.findByEventId(selectedEvent.id))
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Kategori hadiah tidak dapat dibaca.',
      )
    } finally {
      setLoading(false)
    }
  }, [selectedEvent, services])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  function reset() {
    setEditing(null)
    setForm(empty)
    setImageError(null)
    updatePreviewUrl(null)
    setImageState({ kind: 'none' })
  }

  function beginEdit(category: PrizeCategory) {
    setEditing(category)
    setForm({
      name: category.name,
      prizeName: category.prizeName,
      description: category.description ?? '',
      sponsorName: category.sponsorName ?? '',
      displayOrder: String(category.displayOrder),
    })
    setSaved(false)
    setImageError(null)
    updatePreviewUrl(null)

    if (category.prizeImageAssetId) {
      void services.prizeImages
        .findById(category.prizeImageAssetId)
        .then((asset) => {
          if (asset) {
            const url = URL.createObjectURL(asset.blob)
            updatePreviewUrl(url)
            setImageState({
              kind: 'existing',
              assetId: asset.id,
              name: asset.name,
              type: asset.type,
              size: asset.size,
              url,
            })
          } else {
            setImageState({ kind: 'none' })
          }
        })
        .catch(() => {
          setImageState({ kind: 'none' })
        })
    } else {
      setImageState({ kind: 'none' })
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const validationError = validatePrizeImageFile(file)
    if (validationError) {
      setImageError(validationError)
      return
    }

    setImageError(null)
    const url = URL.createObjectURL(file)
    updatePreviewUrl(url)

    const existingAssetIdToDelete =
      imageState.kind === 'existing'
        ? imageState.assetId
        : imageState.kind === 'new'
          ? imageState.existingAssetIdToDelete
          : undefined

    setImageState({
      kind: 'new',
      file,
      url,
      existingAssetIdToDelete,
    })
  }

  function handleRemoveImage() {
    setImageError(null)
    updatePreviewUrl(null)

    const existingAssetIdToDelete =
      imageState.kind === 'existing'
        ? imageState.assetId
        : imageState.kind === 'new'
          ? imageState.existingAssetIdToDelete
          : undefined

    if (existingAssetIdToDelete) {
      setImageState({ kind: 'removed', existingAssetIdToDelete })
    } else {
      setImageState({ kind: 'none' })
    }
  }

  async function submit() {
    if (submitting || selectedEvent === null) return
    setSubmitting(true)
    setError(null)
    setSaved(false)
    try {
      let finalAssetId: string | undefined

      if (imageState.kind === 'new') {
        const savedAsset = await services.prizeImages.save({
          name: imageState.file.name,
          type: imageState.file.type,
          size: imageState.file.size,
          blob: imageState.file,
        })
        finalAssetId = savedAsset.id
        if (imageState.existingAssetIdToDelete) {
          await services.prizeImages.delete(imageState.existingAssetIdToDelete)
        }
      } else if (imageState.kind === 'existing') {
        finalAssetId = imageState.assetId
      } else if (imageState.kind === 'removed') {
        await services.prizeImages.delete(imageState.existingAssetIdToDelete)
        finalAssetId = undefined
      } else {
        finalAssetId = undefined
      }

      const draft = {
        name: form.name,
        prizeName: form.prizeName,
        description: form.description,
        sponsorName: form.sponsorName,
        displayOrder: Number(form.displayOrder),
        prizeImageAssetId: finalAssetId,
      }

      if (editing === null) {
        await services.service.createCategory({
          eventId: selectedEvent.id,
          ...draft,
        })
      } else {
        await services.service.updateCategory(editing, draft)
      }

      reset()
      setSaved(true)
      signalProductionWorkspaceChanged()
      await load()
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Kategori hadiah tidak dapat disimpan.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (workspace.status === 'loading') {
    return (
      <section aria-busy="true" aria-labelledby="categories-title">
        <PageHeader
          eyebrow="Pengaturan produksi"
          headingId="categories-title"
          title="Kategori Hadiah"
          description="Membaca Acara yang dipilih…"
        />
        <p role="status">Memuat konteks Acara…</p>
      </section>
    )
  }

  if (selectedEvent === null) {
    return (
      <section aria-labelledby="categories-title">
        <PageHeader
          eyebrow="Pengaturan produksi"
          headingId="categories-title"
          title="Kategori Hadiah"
          description="Kategori hadiah terikat pada Acara yang dipilih secara eksplisit."
        />
        <StatusBanner
          badge="Acara diperlukan"
          title="Pilih Acara terlebih dahulu"
          tone="warning"
        >
          Pilih Acara tersimpan sebelum membuat atau melihat kategori hadiah.
        </StatusBanner>
        <ButtonLink icon={<Icon name="Trophy" />} to="/events">
          Buka pengelolaan Acara
        </ButtonLink>
      </section>
    )
  }

  const isReadOnly = selectedEvent.status === 'archived'
  const isFormValid =
    form.name.trim().length > 0 &&
    form.prizeName.trim().length > 0 &&
    /^(0|[1-9]\d*)$/.test(form.displayOrder)

  const hasImage =
    imageState.kind === 'existing' || imageState.kind === 'new'
  const currentImageUrl =
    imageState.kind === 'existing' || imageState.kind === 'new'
      ? imageState.url
      : undefined
  const currentImageName =
    imageState.kind === 'existing'
      ? imageState.name
      : imageState.kind === 'new'
        ? imageState.file.name
        : ''
  const currentImageMeta =
    imageState.kind === 'existing'
      ? formatFileTypeAndSize(imageState.type, imageState.size)
      : imageState.kind === 'new'
        ? formatFileTypeAndSize(imageState.file.type, imageState.file.size)
        : null

  return (
    <section
      className={ui('prize-categories-page')}
      aria-labelledby="categories-title"
    >
      <div className={ui('page-header')}>
        <div className={ui('page-header__copy')}>
          <p className={ui('page-header__eyebrow')}>Pengaturan produksi</p>
          <h1 id="categories-title">Kategori Hadiah</h1>
          <p className={ui('page-header__description')}>
            Kelola kategori hadiah untuk {selectedEvent.name}.
          </p>
          <p className={ui('prize-categories-page__info')}>
            Perubahan hadiah berlaku untuk undian berikutnya. Record undian
            yang sudah ada tidak berubah.
          </p>
        </div>
      </div>
      {saved ? (
        <StatusBanner
          badge="Tersimpan"
          className={ui('prize-categories-page__success-banner')}
          icon={<Icon name="CircleCheck" size={20} />}
          title="Kategori hadiah tersimpan"
          tone="success"
        >
          Kategori berhasil dibaca kembali dari IndexedDB dan tersedia di
          Pengaturan Undian.
        </StatusBanner>
      ) : null}
      {error ? (
        <StatusBanner
          badge="Kesalahan penyimpanan atau validasi"
          title="Tindakan kategori hadiah tidak dapat diselesaikan"
          tone="warning"
        >
          {error}
        </StatusBanner>
      ) : null}
      <div className={ui('prize-categories-page__layout')}>
        <Card
          padding="md"
          tone="raised"
          className={ui('prize-categories-page__form-card')}
        >
          <div className={ui('prize-categories-page__card-heading')}>
            <div>
              <p className={ui('prize-categories-page__eyebrow')}>
                {editing === null ? 'Kategori hadiah baru' : 'Edit record'}
              </p>
              <h2>
                {editing === null
                  ? 'Buat Kategori Hadiah'
                  : 'Edit Kategori Hadiah'}
              </h2>
            </div>
          </div>
          <form
            className={ui('prize-categories-page__form')}
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <fieldset className={ui('preparation__group')}>
              <legend>Identitas hadiah</legend>
              <Input
                label="Nama kategori"
                required
                maxLength={120}
                disabled={isReadOnly}
                value={form.name}
                placeholder="contoh: Door Prize"
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
              <div className={ui('prize-categories-page__two-column')}>
                <Input
                  label="Nama hadiah"
                  required
                  maxLength={160}
                  disabled={isReadOnly}
                  value={form.prizeName}
                  placeholder="contoh: Sepeda"
                  onChange={(event) =>
                    setForm({ ...form, prizeName: event.target.value })
                  }
                />
                <Input
                  label="Nama sponsor"
                  maxLength={120}
                  disabled={isReadOnly}
                  value={form.sponsorName}
                  placeholder="Opsional"
                  onChange={(event) =>
                    setForm({ ...form, sponsorName: event.target.value })
                  }
                />
              </div>
            </fieldset>

            <fieldset className={ui('preparation__group')}>
              <legend>Detail tambahan</legend>
              <label className={ui('ui-field')}>
                <span className={ui('ui-field__label')}>Deskripsi</span>
                <textarea
                  className={ui('ui-input')}
                  maxLength={500}
                  disabled={isReadOnly}
                  value={form.description}
                  placeholder="Keterangan opsional tentang hadiah ini"
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </label>

              <div className={ui('prize-image-upload')}>
                <div className={ui('prize-image-upload__header')}>
                  <span className={ui('ui-field__label')}>Gambar hadiah</span>
                  <span className={ui('ui-field__description')}>
                    Opsional. PNG, JPG, atau WebP. Maks. 5 MB.
                  </span>
                </div>
                {hasImage ? (
                  <div className={ui('prize-image-upload__card')}>
                    <div className={ui('prize-image-upload__thumbnail')}>
                      <img
                        src={currentImageUrl}
                        alt={`Pratinjau ${currentImageName}`}
                        className={ui('prize-image-upload__img')}
                        style={{ maxWidth: '88px', maxHeight: '88px', objectFit: 'contain' }}
                      />
                    </div>
                    <div className={ui('prize-image-upload__details')}>
                      <div className={ui('prize-image-upload__meta-group')}>
                        <span
                          className={ui('prize-image-upload__filename')}
                          title={currentImageName}
                        >
                          {currentImageName}
                        </span>
                        {currentImageMeta ? (
                          <span className={ui('prize-image-upload__meta')}>
                            {currentImageMeta}
                          </span>
                        ) : null}
                      </div>
                      <div className={ui('prize-image-upload__actions')}>
                        <label
                          className={ui(
                            'ui-button ui-button--secondary ui-button--sm prize-image-upload__action-btn',
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={ui('ui-button__icon')}
                          >
                            <Icon name="Upload" size={16} />
                          </span>
                          <span>Ganti</span>
                          <input
                            aria-label="Ganti gambar hadiah"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={handleFileChange}
                            disabled={isReadOnly}
                          />
                        </label>
                        <Button
                          icon={<Icon name="Trash2" size={16} />}
                          type="button"
                          variant="secondary"
                          size="sm"
                          className={ui('prize-image-upload__delete-btn')}
                          onClick={handleRemoveImage}
                          disabled={isReadOnly}
                        >
                          Hapus
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={ui('prize-image-upload__control')}>
                    <label
                      className={ui(
                        'ui-button ui-button--secondary ui-button--sm prize-image-upload__action-btn',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={ui('ui-button__icon')}
                      >
                        <Icon name="Upload" size={16} />
                      </span>
                      <span>Pilih gambar</span>
                      <input
                        aria-label="Pilih gambar hadiah"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={handleFileChange}
                        disabled={isReadOnly}
                      />
                    </label>
                  </div>
                )}
                {imageError ? (
                  <span className={ui('ui-field__error')} role="alert">
                    {imageError}
                  </span>
                ) : null}
              </div>

              <Input
                label="Urutan tampilan"
                description="Nomor lebih kecil ditampilkan lebih dahulu."
                containerClassName="prize-categories-page__order-field"
                type="number"
                min={0}
                step={1}
                required
                disabled={isReadOnly}
                value={form.displayOrder}
                onChange={(event) =>
                  setForm({ ...form, displayOrder: event.target.value })
                }
              />
            </fieldset>

            <div className={ui('prize-categories-page__form-actions')}>
              <Button
                icon={<Icon name={editing === null ? 'Plus' : 'Save'} />}
                type="submit"
                disabled={!isFormValid || isReadOnly}
                isLoading={submitting}
              >
                {editing === null
                  ? 'Buat Kategori Hadiah'
                  : 'Simpan perubahan'}
              </Button>
              {editing !== null ? (
                <Button
                  icon={<Icon name="X" />}
                  type="button"
                  variant="secondary"
                  onClick={reset}
                >
                  Batal
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card
          padding="md"
          tone="raised"
          className={ui('prize-categories-page__list-card')}
        >
          <div className={ui('prize-categories-page__card-heading')}>
            <div>
              <p className={ui('prize-categories-page__eyebrow')}>
                {items.length === 0
                  ? 'Pengaturan hadiah'
                  : 'Hadiah yang sudah diatur'}
              </p>
              <h2>Kategori Hadiah</h2>
            </div>
            <span className={ui('prize-categories-page__record-count')}>
              {items.length} kategori
            </span>
          </div>
          {loading ? (
            <p role="status">Memuat kategori hadiah…</p>
          ) : items.length === 0 ? (
            <div className={ui('prize-categories-page__empty')} role="status">
              <strong>Belum ada kategori hadiah</strong>
              <p>Buat kategori pertama sebelum mengatur undian.</p>
            </div>
          ) : (
            <ul className={ui('prize-categories-page__list')}>
              {items.map((category) => (
                <li
                  className={ui('prize-categories-page__category-card')}
                  key={category.id}
                >
                  {category.prizeImageAssetId ? (
                    <PrizeCategoryThumbnail
                      assetId={category.prizeImageAssetId}
                      prizeName={category.prizeName}
                      prizeImages={services.prizeImages}
                    />
                  ) : null}
                  <div className={ui('prize-categories-page__category-main')}>
                    <div
                      className={ui('prize-categories-page__category-heading')}
                    >
                      <div>
                        <h3>{category.name}</h3>
                        <p>{category.prizeName}</p>
                      </div>
                      <span className={ui('prize-categories-page__order')}>
                        Urutan {category.displayOrder}
                      </span>
                    </div>
                    {category.sponsorName ? (
                      <p className={ui('prize-categories-page__sponsor')}>
                        Disponsori oleh {category.sponsorName}
                      </p>
                    ) : null}
                    {category.description ? (
                      <p className={ui('prize-categories-page__description')}>
                        {category.description}
                      </p>
                    ) : null}
                  </div>
                  <div className={ui('prize-categories-page__category-actions')}>
                    <Button
                      icon={<Icon name="Pencil" />}
                      size="sm"
                      variant="quiet"
                      disabled={isReadOnly}
                      onClick={() => beginEdit(category)}
                    >
                      Edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  )
}
