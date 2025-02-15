import {
  pipeline,
  env,
  AutoTokenizer,
  CLIPTextModelWithProjection,
} from '@xenova/transformers'

const MODEL_ID = 'Xenova/clip-vit-base-patch32'

export interface ProgressState {
  status: string
  progress: number
}

class EmbeddingsService {
  private static instance: EmbeddingsService
  private extractor: any = null
  private tokenizer: any = null
  private textModel: any = null
  private imageModelLoading = false
  private textModelLoading = false
  private imageProgressCallbacks: ((progress: ProgressState) => void)[] = []
  private textProgressCallbacks: ((progress: ProgressState) => void)[] = []

  onImageProgress(callback: (progress: ProgressState) => void) {
    this.imageProgressCallbacks.push(callback)
  }

  onTextProgress(callback: (progress: ProgressState) => void) {
    this.textProgressCallbacks.push(callback)
  }

  private notifyImageProgress(status: string, progress: number) {
    this.imageProgressCallbacks.forEach((callback) =>
      callback({ status, progress }),
    )
  }

  private notifyTextProgress(status: string, progress: number) {
    this.textProgressCallbacks.forEach((callback) =>
      callback({ status, progress }),
    )
  }

  async loadImageModel() {
    if (this.extractor) return
    if (this.imageModelLoading) return

    this.imageModelLoading = true
    try {
      this.notifyImageProgress('Loading image model...', 0)
      this.extractor = await pipeline('image-feature-extraction', MODEL_ID, {
        progress_callback: (progress: any) => {
          this.notifyImageProgress(
            'Downloading image model...',
            progress.progress,
          )
        },
      })
      this.notifyImageProgress('Image model ready', 100)
    } catch (error) {
      console.error('Failed to load image model:', error)
      throw error
    } finally {
      this.imageModelLoading = false
    }
  }

  async loadTextModel() {
    if (this.tokenizer && this.textModel) return
    if (this.textModelLoading) return

    this.textModelLoading = true
    try {
      this.notifyTextProgress('Loading text model...', 0)
      this.tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, {
        progress_callback: (progress: any) => {
          this.notifyTextProgress('Loading tokenizer...', progress.progress)
        },
      })
      this.textModel = await CLIPTextModelWithProjection.from_pretrained(
        MODEL_ID,
        {
          progress_callback: (progress: any) => {
            this.notifyTextProgress('Loading text model...', progress.progress)
          },
        },
      )
      this.notifyTextProgress('Text model ready', 100)
    } catch (error) {
      console.error('Failed to load text model:', error)
      throw error
    } finally {
      this.textModelLoading = false
    }
  }

  static async getInstance() {
    if (!this.instance) {
      this.instance = new EmbeddingsService()
    }
    return this.instance
  }

  async createImageEmbedding(file: File): Promise<number[]> {
    await this.loadImageModel()
    const imageUrl = URL.createObjectURL(file)
    try {
      const embeddings = await this.extractor(imageUrl, {
        pooling: 'mean',
        normalize: true,
      })
      // Extract first (and only) embedding array
      return embeddings[0].tolist()
    } finally {
      URL.revokeObjectURL(imageUrl)
    }
  }

  async createTextEmbedding(text: string): Promise<number[]> {
    await this.loadTextModel()
    const text_inputs = this.tokenizer(text, {
      padding: true,
      truncation: true,
    })
    const { text_embeds } = await this.textModel(text_inputs)
    const embeddings = text_embeds.data

    // Normalize and convert to regular array
    let sum = 0
    const values = Array.from(embeddings) as number[]
    for (const val of values) {
      sum += val * val
    }
    const norm = Math.sqrt(sum)
    return values.map((v) => v / norm)
  }
}

export const embeddingsService = await EmbeddingsService.getInstance()
