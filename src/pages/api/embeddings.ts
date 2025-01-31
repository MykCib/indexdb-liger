import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request, locals }) => {
  const REPLICATE_API_TOKEN = locals.runtime.env.REPLICATE_API_TOKEN

  try {
    // Log token existence (not the actual token)
    console.log('Token exists:', !!REPLICATE_API_TOKEN)

    const formData = await request.formData()
    const file = formData.get('file') as File

    // Log file details
    console.log('File received:', {
      name: file?.name,
      type: file?.type,
      size: file?.size,
    })

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64String = Buffer.from(arrayBuffer).toString('base64')
    const dataUrl = `data:${file.type};base64,${base64String}`

    // Log prediction request
    console.log('Making prediction request to Replicate')

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
            modality: 'vision',
          },
        }),
      },
    )

    const prediction = await predictionResponse.json()

    // Log prediction response
    console.log('Prediction response:', {
      status: predictionResponse.status,
      ok: predictionResponse.ok,
      prediction: prediction,
    })

    if (!predictionResponse.ok) {
      return new Response(
        JSON.stringify({
          error: 'Prediction request failed',
          details: prediction,
        }),
        {
          status: predictionResponse.status,
        },
      )
    }

    if (prediction.error) {
      return new Response(JSON.stringify({ error: prediction.error }), {
        status: 400,
      })
    }

    // Poll for results
    const predictionId = prediction.id
    let embeddings = null
    let attempts = 0
    const maxAttempts = 30 // 30 seconds timeout

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

    if (!embeddings) {
      return new Response(
        JSON.stringify({ error: 'Timeout waiting for embeddings' }),
        {
          status: 408,
        },
      )
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
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }
}
