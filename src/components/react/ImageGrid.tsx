import { useEffect, useRef, useState } from 'react'
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
import { embeddingsService } from '@/services/embeddings'

interface ImageData {
  id: number
  url: string
  embeddings: number[]
  isProcessing?: boolean
  name: string
}

interface PreviewImage {
  id: number
  url: string
}

export function ImageGrid() {
  const [images, setImages] = useState<ImageData[]>([])
  const [loading, setLoading] = useState(true)
  const [filteredImages, setFilteredImages] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null)
  const debouncedSearch = useDebounce(searchQuery, 500)
  const blobUrlsRef = useRef<Set<string>>(new Set())

  const loadImages = async () => {
    try {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      blobUrlsRef.current.clear()

      const records = await indexDBService.getAllImages()
      const imagePromises = records.map(async (record) => {
        if (!record?.id) return undefined
        const blob = await indexDBService.getImage(record.id)
        const url = URL.createObjectURL(blob)
        blobUrlsRef.current.add(url)

        return {
          id: record.id,
          name: record.name,
          url,
          embeddings: record.embeddings || [],
          isProcessing: false, // Force it to false since we're loading fresh data
        } as ImageData
      })

      const loadedImages = (await Promise.all(imagePromises))
        .filter((img): img is NonNullable<typeof img> => img !== undefined)
        .sort((a, b) => b.id - a.id)

      setImages(loadedImages)
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
    }

    initializeGallery()

    const unsubscribe1 = eventBus.subscribe('imageUploaded', loadImages)
    const unsubscribe2 = eventBus.subscribe('imageProcessed', loadImages)
    const unsubscribe3 = eventBus.subscribe('imageDeleted', loadImages)

    return () => {
      unsubscribe1()
      unsubscribe2()
      unsubscribe3()
      images.forEach((img) => URL.revokeObjectURL(img.url))
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      blobUrlsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const handleMemoryPressure = () => {
      console.log('Memory warning received')
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      blobUrlsRef.current.clear()
      loadImages() // Reload images when memory is critical
    }

    window.addEventListener('memorywarning', handleMemoryPressure)
    return () =>
      window.removeEventListener('memorywarning', handleMemoryPressure)
  }, [])

  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearch) {
        setFilteredImages([])
        return
      }

      try {
        setSearching(true)
        // Ensure models are loaded before searching
        await embeddingsService.loadTextModel()
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
      eventBus.emit('imageDeleted')
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
