import { cosineSimilarity } from '@/utils/similarity'

export async function getTextEmbeddings(searchText: string): Promise<number[]> {
  const response = await fetch('/api/text-embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ searchText }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate text embeddings')
  }

  const { embeddings } = await response.json()
  return embeddings
}

export interface SearchResult {
  id: number
  similarity: number
  url: string
}

export function rankImagesBySimilarity(
  searchEmbeddings: number[],
  images: { id: number; url: string; embeddings: number[] }[],
  threshold = 0,
): SearchResult[] {
  return images
    .map((image) => ({
      id: image.id,
      url: image.url,
      similarity: cosineSimilarity(searchEmbeddings, image.embeddings),
    }))
    .filter((result) => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
}
