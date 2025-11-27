import axios from 'axios'

const PRINTIFY_API_BASE = 'https://api.printify.com/v1'

class PrintifyService {
  private apiKey: string
  private shopId: string
  private client: any

  constructor() {
    this.apiKey = process.env.PRINTIFY_API_KEY || ''
    this.shopId = process.env.PRINTIFY_SHOP_ID || ''
    
    this.client = axios.create({
      baseURL: PRINTIFY_API_BASE,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
  }

  async getProducts(page = 1, limit = 50) {
    try {
      const response = await this.client.get(`/shops/${this.shopId}/products.json`, {
        params: { page, limit }
      })
      return response.data.data || response.data || []
    } catch (error: any) {
      console.error('Error fetching products from Printify:', error.response?.data || error.message)
      throw new Error('Failed to fetch products from Printify')
    }
  }

  async getProduct(productId: string) {
    try {
      const response = await this.client.get(`/shops/${this.shopId}/products/${productId}.json`)
      return response.data
    } catch (error: any) {
      console.error('Error fetching product from Printify:', error.response?.data || error.message)
      throw new Error('Failed to fetch product from Printify')
    }
  }
}

export const printifyService = new PrintifyService()
