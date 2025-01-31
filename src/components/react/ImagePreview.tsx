import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ImagePreviewProps {
  image: { id: number; url: string } | null
  onClose: () => void
}

export function ImagePreview({ image, onClose }: ImagePreviewProps) {
  return (
    <Dialog open={image !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[80vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Image Preview
          </DialogTitle>
        </DialogHeader>
        <div className="relative flex-1 overflow-hidden rounded-lg">
          {image && (
            <img
              src={image.url}
              alt={`Preview ${image.id}`}
              className="h-full w-full object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
