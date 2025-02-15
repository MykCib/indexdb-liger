import type { APIRoute } from 'astro'
import Replicate from 'replicate'

export const prerender = false

export const POST: APIRoute = async ({ request, locals }) => {
  const REPLICATE_API_TOKEN = locals.runtime.env.REPLICATE_API_TOKEN

  try {
    const { searchText } = await request.json()
    const replicate = new Replicate({ auth: REPLICATE_API_TOKEN })

    const input = {
      text: searchText,
      output_format: 'array',
    }

    const output = await replicate.run(
      'nomagick/jina-embeddings:56e621ea4c892c4466d79198982d0df62fcd08fc494cea5de3d8372644108fbe',
      { input },
    )
    return new Response(JSON.stringify({ embeddings: output }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('API Error:', error)
    return new Response(JSON.stringify(error), { status: 500 })
  }
}
