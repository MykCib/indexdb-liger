import { cosineSimilarity } from '@/utils/similarity'
import { embeddingsService } from './embeddings'

export async function getTextEmbeddings(searchText: string): Promise<number[]> {
  const result = await embeddingsService.createTextEmbedding(searchText)
  return result
}

export interface SearchResult {
  id: number
  similarity: number
  url: string
}

export function rankImagesBySimilarity(
  searchEmbeddings: number[],
  images: { id: number; url: string; embeddings: number[] }[],
  threshold = 0.235,
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
