export interface ImageData {
  id?: number
  name: string
  type: string
  data: ArrayBuffer
  embeddings?: number[]
  isProcessing?: boolean
  timestamp: number
}

export class IndexDBService {
  private db: IDBDatabase | null = null
  private readonly DB_NAME = 'imageStorage'
  private readonly STORE_NAME = 'images'
  private readonly DB_VERSION = 1

  async init(): Promise<void> {
    if (this.db) return // Already initialized

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          })
        }
      }
    })
  }

  async saveImage(file: File): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    const arrayBuffer = await file.arrayBuffer()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)

      const request = store.add({
        name: file.name,
        type: file.type,
        data: arrayBuffer,
        isProcessing: false, // Set to false by default
        timestamp: Date.now(),
      })

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result as number)
    })
  }

  async updateImageEmbeddings(id: number, embeddings: number[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)

      const getRequest = store.get(id)
      getRequest.onsuccess = () => {
        const imageData = getRequest.result
        if (!imageData) {
          reject(new Error('Image not found'))
          return
        }

        imageData.embeddings = embeddings
        imageData.isProcessing = false // Ensure this is set to false

        const updateRequest = store.put(imageData)
        updateRequest.onerror = () => reject(updateRequest.error)
        updateRequest.onsuccess = () => resolve()
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }
  async getImage(id: number): Promise<Blob> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.get(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const { data, type } = request.result
        resolve(new Blob([data], { type }))
      }
    })
  }

  async getAllImages(): Promise<ImageData[]> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async deleteImage(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.delete(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async deleteAllImages(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.clear()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getStorageInfo(): Promise<{ usedSpace: number }> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const totalBytes = request.result.reduce(
          (acc, img) => acc + (img.data as ArrayBuffer).byteLength,
          0,
        )
        resolve({ usedSpace: totalBytes })
      }
    })
  }
}

export const indexDBService = new IndexDBService()
