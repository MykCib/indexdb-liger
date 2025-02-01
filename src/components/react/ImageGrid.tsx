import { useEffect, useState } from 'react'
import { indexDBService } from '@/services/indexdb'
import { eventBus } from '@/services/eventBus'
import { Loader2 } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import {
  getTextEmbeddings,
  rankImagesBySimilarity,
  type SearchResult,
} from '@/services/search'
import { ImageSearch } from './ImageSearch'
import { ImagePreview } from './ImagePreview'
import { ImageCard } from './ImageCard'
import { createImageEmbedding } from '@/services/replicate'

interface ImageData {
  id: number
  url: string
  embeddings?: number[]
  isProcessing?: boolean
}

interface PreviewImage {
  id: number
  url: string
}

export function ImageGrid() {
  const [images, setImages] = useState<ImageData[]>([])
  const [loading, setLoading] = useState(true)
  const [isRecovering, setIsRecovering] = useState(false)
  const [filteredImages, setFilteredImages] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null)
  const debouncedSearch = useDebounce(searchQuery, 500)

  const recoverInterruptedEmbeddings = async (images: ImageData[]) => {
    const imagesWithoutEmbeddings = images.filter(
      (img) => img.isProcessing || !img.embeddings,
    )

    if (imagesWithoutEmbeddings.length === 0 || isRecovering) return

    try {
      setIsRecovering(true)
      console.log(
        `Recovering ${imagesWithoutEmbeddings.length} interrupted embeddings...`,
      )

      for (const image of imagesWithoutEmbeddings) {
        try {
          const blob = await indexDBService.getImage(image.id)
          const file = new File([blob], image.name || 'image.jpg', {
            type: blob.type,
          })

          const embeddings = await createImageEmbedding(file)
          await indexDBService.updateImageEmbeddings(image.id, embeddings)
          eventBus.emit('imageProcessed')
        } catch (error) {
          console.error(
            `Failed to recover embeddings for image ${image.id}:`,
            error,
          )
        }
      }
    } finally {
      setIsRecovering(false)
    }
  }

  const loadImages = async () => {
    try {
      const records = await indexDBService.getAllImages()
      const imagePromises = records.map(async (record) => {
        if (!record?.id) return
        const blob = await indexDBService.getImage(record.id)
        return {
          id: record.id,
          name: record.name,
          url: URL.createObjectURL(blob),
          embeddings: record.embeddings,
          isProcessing: record.isProcessing,
        }
      })

      const loadedImages = (await Promise.all(imagePromises)).filter(
        (img): img is ImageData => img !== undefined,
      )

      setImages(loadedImages.sort((a, b) => b.id - a.id))
    } catch (error) {
      console.error('Failed to load images:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initializeGallery = async () => {
      await indexDBService.init()
      await loadImages()
      // Only try to recover embeddings on initial load
      const records = await indexDBService.getAllImages()
      recoverInterruptedEmbeddings(records)
    }

    initializeGallery()

    // Regular update subscriptions
    const unsubscribe1 = eventBus.subscribe('imageUploaded', loadImages)
    const unsubscribe2 = eventBus.subscribe('imageProcessed', loadImages)

    return () => {
      unsubscribe1()
      unsubscribe2()
      images.forEach((img) => URL.revokeObjectURL(img.url))
    }
  }, [])

  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearch) {
        setFilteredImages([])
        return
      }

      try {
        setSearching(true)
        const searchEmbeddings = await getTextEmbeddings(debouncedSearch)
        const results = rankImagesBySimilarity(searchEmbeddings, images)
        setFilteredImages(results)
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setSearching(false)
      }
    }

    performSearch()
  }, [debouncedSearch, images])

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      setDeletingId(id)
      await indexDBService.deleteImage(id)
      setImages((current) => {
        const updatedImages = current.filter((img) => img.id !== id)
        const deletedImage = current.find((img) => img.id === id)
        if (deletedImage) {
          URL.revokeObjectURL(deletedImage.url)
        }
        return updatedImages
      })
    } catch (error) {
      console.error('Failed to delete image:', error)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isSearchComplete =
    searchQuery !== '' && !searching && debouncedSearch === searchQuery
  const displayedImages =
    filteredImages.length > 0 ? filteredImages : isSearchComplete ? [] : images

  return (
    <>
      <ImageSearch
        value={searchQuery}
        onChange={setSearchQuery}
        isSearching={searching}
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {displayedImages.map((image) => (
          <ImageCard
            key={image.id}
            {...image}
            onDelete={handleDelete}
            onPreview={setPreviewImage}
            isDeleting={deletingId === image.id}
          />
        ))}
        {images.length === 0 && (
          <div className="col-span-full p-8 text-center text-muted-foreground">
            No images uploaded yet
          </div>
        )}
        {images.length > 0 &&
          isSearchComplete &&
          displayedImages.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground">
              No images found matching "{searchQuery}"
            </div>
          )}
      </div>
      <ImagePreview
        image={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </>
  )
}
