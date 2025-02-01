import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { indexDBService } from '@/services/indexdb'
import { useRef, useState } from 'react'
import { eventBus } from '@/services/eventBus'
import { Loader2, Upload } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { createImageEmbedding } from '@/services/replicate'
import { processInBatches } from '@/utils/batch'

interface UploadProgress {
  total: number
  completed: number
  current: number
  processing: string
}

export const ImageInput = () => {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>()
  const inputRef = useRef<HTMLInputElement>(null)

  const BATCH_SIZE = 1 // Process 3 images at a time

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    try {
      setIsUploading(true)
      setProgress({
        total: files.length,
        completed: 0,
        current: 0,
        processing: 'Uploading images...',
      })

      // First, quickly save all images without embeddings and collect their IDs
      const savedImageIds = await Promise.all(
        files.map(async (file) => {
          const id = await indexDBService.saveImage(file)
          eventBus.emit('imageUploaded')
          return { id, file }
        }),
      )

      // Process embeddings in batches
      setProgress((prev) => ({
        ...prev!,
        processing: 'Generating embeddings...',
      }))

      await processInBatches(
        savedImageIds,
        BATCH_SIZE,
        async ({ id, file }) => {
          try {
            const embeddings = await createImageEmbedding(file)
            await indexDBService.updateImageEmbeddings(id, embeddings)

            setProgress((prev) => ({
              ...prev!,
              completed: prev!.completed + 1,
            }))

            eventBus.emit('imageProcessed')
          } catch (error) {
            console.error(`Failed to process ${file.name}:`, error)
          }
        },
      )

      if (inputRef.current) {
        inputRef.current.value = ''
      }
    } catch (error) {
      console.error('Failed to process files:', error)
    } finally {
      setIsUploading(false)
      setProgress(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="picture">Images</Label>
        <div className="relative">
          <Input
            ref={inputRef}
            id="picture"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={isUploading}
            className={isUploading ? 'pr-10' : ''}
          />
          {isUploading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {progress && (
        <div className="space-y-2">
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex justify-between text-xs">
              <span>{progress.completed} images embedded</span>
              <span>
                {((progress.completed / progress.total) * 100).toFixed(0)}%
                complete
              </span>
            </div>
          </div>
          <Progress
            value={(progress.completed / progress.total) * 100}
            className="h-2"
          />
        </div>
      )}

      {/* Drag and Drop Area */}
      <div
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 ${
          isUploading ? 'opacity-50' : 'cursor-pointer hover:border-primary'
        }`}
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (isUploading) return

          const files = Array.from(e.dataTransfer.files)
          if (files.length > 0 && inputRef.current) {
            const dataTransfer = new DataTransfer()
            files.forEach((file) => dataTransfer.items.add(file))
            inputRef.current.files = dataTransfer.files
            inputRef.current.dispatchEvent(
              new Event('change', { bubbles: true }),
            )
          }
        }}
      >
        <Upload className="mb-4 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag and drop images here or click to select
        </p>
        {isUploading && (
          <p className="mt-2 text-xs text-muted-foreground">
            Images will appear as they are processed
          </p>
        )}
      </div>
    </div>
  )
}
