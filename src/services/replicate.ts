export async function createImageEmbedding(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/embeddings', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate embeddings')
  }

  const { embeddings } = await response.json()
  return embeddings
}
