import { Search, Loader2 } from 'lucide-react'
import { Input } from '../ui/input'

interface ImageSearchProps {
  value: string
  onChange: (value: string) => void
  isSearching: boolean
}

export function ImageSearch({
  value,
  onChange,
  isSearching,
}: ImageSearchProps) {
  return (
    <div className="relative">
      <Input
        type="text"
        placeholder="Search images..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10"
      />
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {isSearching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin [&>*]:stroke-foreground" />
        </div>
      )}
    </div>
  )
}
