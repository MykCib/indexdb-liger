import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { indexDBService } from '@/services/indexdb'
import { useEffect, useRef, useState } from 'react'
import { eventBus } from '@/services/eventBus'
import { Loader2 } from 'lucide-react'
import { createImageEmbedding } from '@/services/replicate'

export const ImageInput = () => {
  const [isReady, setIsReady] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    indexDBService
      .init()
      .then(() => setIsReady(true))
      .catch(console.error)
  }, [])

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)

      // Generate embeddings
      const embeddings = await createImageEmbedding(file)

      // Save image with embeddings
      const id = await indexDBService.saveImage(file, embeddings)

      eventBus.emit('imageUploaded')

      if (inputRef.current) {
        inputRef.current.value = ''
      }
    } catch (error) {
      console.error('Failed to save image:', error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="picture">Picture</Label>
      <div className="relative">
        <Input
          ref={inputRef}
          id="picture"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={!isReady || isUploading}
          className={isUploading ? 'pr-10' : ''}
        />
        {isUploading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}
