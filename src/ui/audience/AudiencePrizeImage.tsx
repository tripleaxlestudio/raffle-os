import { useEffect, useState } from 'react'
import { DexiePrizeImageAssetRepository } from '../../infrastructure/persistence/repositories/prize-image-asset.repository.ts'

/** Optional receiver-local resource; never blocks the presentation clock. */
export function AudiencePrizeImage({ assetId, prizeName }: { readonly assetId: string; readonly prizeName: string }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const repository = new DexiePrizeImageAssetRepository()
    let disposed = false
    let objectUrl: string | undefined
    let image: HTMLImageElement | undefined
    void (async () => {
      try {
        const asset = await repository.findById(assetId)
        if (disposed) return
        if (disposed) return
        let publicBlob: Blob
        if (asset !== null) {
          publicBlob = asset.blob
        } else {
          const response = await fetch(`/display-assets/${encodeURIComponent(assetId)}`)
          if (!response.ok) return
          publicBlob = await response.blob()
          if (!publicBlob.type.startsWith('image/') || publicBlob.size > 5 * 1024 * 1024) return
        }
        if (disposed) return
        objectUrl = URL.createObjectURL(publicBlob)
        image = new Image()
        image.src = objectUrl
        await image.decode()
        if (!disposed) setUrl(objectUrl)
      } catch {
        if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl)
        objectUrl = undefined
      }
    })()
    return () => {
      disposed = true
      if (image !== undefined) image.removeAttribute('src')
      if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl)
      objectUrl = undefined
      repository.close()
    }
  }, [assetId])
  if (url === undefined) return null
  return <img className="audience-prize-image" src={url} alt={`Hadiah: ${prizeName}`} onError={() => { URL.revokeObjectURL(url); setUrl(undefined) }} />
}
