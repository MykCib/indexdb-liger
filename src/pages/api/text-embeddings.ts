import type { APIRoute } from 'astro'

const REPLICATE_API_TOKEN = import.meta.env.REPLICATE_API_TOKEN

export const POST: APIRoute = async ({ request }) => {
  try {
    const { searchText } = await request.json()

    // Convert text to base64 and create a data URI
    const textBytes = new TextEncoder().encode(searchText)
    const base64String = Buffer.from(textBytes).toString('base64')
    const dataUrl = `data:text/plain;base64,${base64String}`

    const predictionResponse = await fetch(
      'https://api.replicate.com/v1/predictions',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version:
            '0383f62e173dc821ec52663ed22a076d9c970549c209666ac3db181618b7a304',
          input: {
            input: dataUrl,
            modality: 'text',
          },
        }),
      },
    )

    const prediction = await predictionResponse.json()

    if (prediction.error || prediction.detail) {
      return new Response(
        JSON.stringify({
          error: prediction.error || prediction.detail,
        }),
        {
          status: 400,
        },
      )
    }

    // Poll for results
    const predictionId = prediction.id
    let embeddings = null
    let attempts = 0
    const maxAttempts = 30

    while (!embeddings && attempts < maxAttempts) {
      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Token ${REPLICATE_API_TOKEN}`,
          },
        },
      )

      const status = await statusResponse.json()

      if (status.status === 'succeeded') {
        embeddings = status.output
        break
      } else if (status.status === 'failed') {
        return new Response(
          JSON.stringify({ error: 'Embedding generation failed' }),
          {
            status: 400,
          },
        )
      }

      attempts++
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return new Response(JSON.stringify({ embeddings }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('API Error:', error)
    return new Response(JSON.stringify({ error }), {
      status: 500,
    })
  }
}
