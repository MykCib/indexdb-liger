import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { indexDBService } from '@/services/indexdb'
import { useEffect, useRef, useState } from 'react'
import { eventBus } from '@/services/eventBus'
import { Loader2, Upload } from 'lucide-react'
import { embeddingsService } from '@/services/embeddings'
import { Progress } from '../ui/progress'
import { Button } from '../ui/button'

interface UploadProgress {
  total: number
  completed: number
  current: number
  processing: string
}

interface ModelStatus {
  isLoaded: boolean
}

interface StorageInfo {
  usedSpace: number
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export const ImageInput = () => {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [imageModelStatus, setImageModelStatus] = useState<ModelStatus>({
    isLoaded: false,
  })
  const [textModelStatus, setTextModelStatus] = useState<ModelStatus>({
    isLoaded: false,
  })
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({ usedSpace: 0 })

  const updateStorageInfo = async () => {
    try {
      const info = await indexDBService.getStorageInfo()
      setStorageInfo(info)
    } catch (error) {
      console.error('Failed to update storage info:', error)
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        await indexDBService.init()
        await updateStorageInfo()

        await embeddingsService.loadTextModel()
        setTextModelStatus({ isLoaded: true })

        await embeddingsService.loadImageModel()
        setImageModelStatus({ isLoaded: true })
      } catch (error) {
        console.error('Failed to initialize:', error)
      }
    }

    init()

    const unsubscribe1 = eventBus.subscribe('imageUploaded', updateStorageInfo)
    const unsubscribe2 = eventBus.subscribe('imageDeleted', updateStorageInfo)

    return () => {
      unsubscribe1()
      unsubscribe2()
    }
  }, [])

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
        processing: 'Processing images...',
      })

      for (const file of files) {
        try {
          const id = await indexDBService.saveImage(file)
          eventBus.emit('imageUploaded')

          const embeddings = await embeddingsService.createImageEmbedding(file)
          await indexDBService.updateImageEmbeddings(id, embeddings)
          eventBus.emit('imageProcessed')

          setProgress(
            (prev) =>
              prev && {
                ...prev,
                completed: prev.completed + 1,
              },
          )
        } catch (error) {
          console.error(`Failed to process ${file.name}:`, error)
        }
      }
    } finally {
      setIsUploading(false)
      setProgress(null)
    }
  }

  const handleDeleteAll = async () => {
    try {
      await indexDBService.deleteAllImages()
      eventBus.emit('imageDeleted')
    } catch (error) {
      console.error('Failed to delete all images:', error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${textModelStatus.isLoaded ? 'bg-green-500' : 'bg-gray-300'}`}
          />
          <span className="text-sm text-muted-foreground">Text Model</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${imageModelStatus.isLoaded ? 'bg-green-500' : 'bg-gray-300'}`}
          />
          <span className="text-sm text-muted-foreground">Image Model</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Storage: {formatBytes(storageInfo.usedSpace)}
          </span>
        </div>
      </div>
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Button onClick={handleDeleteAll} variant="destructive">
          delete all images
        </Button>
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
