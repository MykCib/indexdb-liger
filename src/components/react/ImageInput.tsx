import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { indexDBService } from '@/services/indexdb'
import { useRef, useState } from 'react'
import { eventBus } from '@/services/eventBus'
import { Loader2, Upload } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { createImageEmbedding } from '@/services/replicate'

interface UploadProgress {
  total: number
  current: number
  processing: string
}

export const ImageInput = () => {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    try {
      setIsUploading(true)
      setProgress({
        total: files.length,
        current: 0,
        processing: files[0].name,
      })

      // Process files sequentially
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setProgress((prev) => ({
          total: prev!.total,
          current: i,
          processing: file.name,
        }))

        try {
          // Generate embeddings for current file
          const embeddings = await createImageEmbedding(file)

          // Save image with embeddings
          await indexDBService.saveImage(file, embeddings)
        } catch (error) {
          console.error(`Failed to process ${file.name}:`, error)
          // Continue with next file even if current fails
          continue
        }
      }

      // Notify about completion
      eventBus.emit('imageUploaded')

      // Clear input
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
            multiple // Enable multiple file selection
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
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Processing: {progress.processing}</span>
            <span>
              {progress.current + 1} of {progress.total}
            </span>
          </div>
          <Progress value={(progress.current / progress.total) * 100} />
        </div>
      )}

      {/* Drag and Drop Area */}
      <div
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 ${isUploading ? 'opacity-50' : 'cursor-pointer hover:border-primary'} `}
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
            // Create a new FileList-like object
            const dataTransfer = new DataTransfer()
            files.forEach((file) => dataTransfer.items.add(file))
            inputRef.current.files = dataTransfer.files

            // Trigger onChange
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
      </div>
    </div>
  )
}
