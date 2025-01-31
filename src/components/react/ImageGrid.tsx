import { useEffect, useState } from 'react'
import { indexDBService } from '@/services/indexdb'
import { eventBus } from '@/services/eventBus'
import { Trash2, Loader2, X, Loader, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDebounce } from '@/hooks/useDebounce'
import {
  getTextEmbeddings,
  rankImagesBySimilarity,
  type SearchResult,
} from '@/services/search'
import { Input } from '../ui/input'

interface PreviewImage {
  id: number
  url: string
  embeddings: number[]
}

export const ImageGrid = () => {
  const [images, setImages] = useState<
    Array<{ id: number; url: string; embeddings: number[] }>
  >([])
  const [filteredImages, setFilteredImages] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 500)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null)

  const loadImages = async () => {
    try {
      const records = await indexDBService.getAllImages()
      const imagePromises = records.map(async (record) => {
        console.log(record)
        if (!record?.id) return
        const blob = await indexDBService.getImage(record.id)
        return {
          id: record.id,
          url: URL.createObjectURL(blob),
          embeddings: record.embeddings, // Include embeddings from the record
        }
      })

      const loadedImages = (await Promise.all(imagePromises)).filter(
        (img): img is { id: number; url: string; embeddings: number[] } =>
          img !== undefined && Array.isArray(img.embeddings),
      )
      setImages(loadedImages.sort((a, b) => b.id - a.id))
    } catch (error) {
      console.error('Failed to load images:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent opening preview when clicking delete
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

  useEffect(() => {
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
        console.log('results', results)
        setFilteredImages(results)
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setSearching(false)
      }
    }

    performSearch()
  }, [debouncedSearch, images])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="relative">
        <Input
          type="text"
          placeholder="Search images..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {(filteredImages.length > 0 ? filteredImages : images).map((image) => (
          <div
            key={image.id}
            className="group relative aspect-square overflow-hidden rounded-lg border border-border"
          >
            <img
              src={image.url}
              alt={`Image ${image.id}`}
              className="h-full w-full object-cover"
            />
            <Button
              variant="destructive"
              size="icon"
              onClick={(e) => handleDelete(image.id, e)}
              disabled={deletingId === image.id}
              className={`absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
            >
              {deletingId === image.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        ))}
        {images.length === 0 && (
          <div className="col-span-full p-8 text-center text-muted-foreground">
            No images uploaded yet
          </div>
        )}
      </div>

      <Dialog
        open={previewImage !== null}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      >
        <DialogContent className="h-[80vh] max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Image Preview
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex-1 overflow-hidden rounded-lg">
            {previewImage && (
              <img
                src={previewImage.url}
                alt={`Preview ${previewImage.id}`}
                className="h-full w-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
