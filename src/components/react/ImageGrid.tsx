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

interface ImageData {
  id: number
  url: string
  embeddings: number[]
}

interface PreviewImage {
  id: number
  url: string
}

export function ImageGrid() {
  const [images, setImages] = useState<ImageData[]>([])
  const [filteredImages, setFilteredImages] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null)
  const debouncedSearch = useDebounce(searchQuery, 500)

  useEffect(() => {
    const loadImages = async () => {
      try {
        const records = await indexDBService.getAllImages()
        const imagePromises = records.map(async (record) => {
          if (!record?.id) return
          const blob = await indexDBService.getImage(record.id)
          return {
            id: record.id,
            url: URL.createObjectURL(blob),
            embeddings: record.embeddings,
          }
        })

        const loadedImages = (await Promise.all(imagePromises)).filter(
          (img): img is ImageData =>
            img !== undefined && Array.isArray(img.embeddings),
        )
        setImages(loadedImages.sort((a, b) => b.id - a.id))
      } catch (error) {
        console.error('Failed to load images:', error)
      } finally {
        setLoading(false)
      }
    }

    indexDBService.init().then(() => loadImages())
    const unsubscribe = eventBus.subscribe('imageUploaded', loadImages)

    return () => {
      unsubscribe()
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
