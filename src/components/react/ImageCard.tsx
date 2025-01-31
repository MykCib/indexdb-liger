import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'

interface ImageCardProps {
  id: number
  url: string
  onDelete: (id: number, e: React.MouseEvent) => Promise<void>
  onPreview: (image: { id: number; url: string }) => void
  isDeleting: boolean
}

export function ImageCard({
  id,
  url,
  onDelete,
  onPreview,
  isDeleting,
}: ImageCardProps) {
  return (
    <div
      onClick={() => onPreview({ id, url })}
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-border"
    >
      <img
        src={url}
        alt={`Image ${id}`}
        className="h-full w-full object-cover"
      />
      <Button
        variant="destructive"
        size="icon"
        onClick={(e) => onDelete(id, e)}
        disabled={isDeleting}
        className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        {isDeleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
