import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CartItem {
  product: any
  variant: any
  quantity: number
}

interface CartStore {
  items: CartItem[]
  addItem: (product: any, variant: any, quantity: number) => void
  removeItem: (variantId: number) => void
  updateQuantity: (variantId: number, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (product, variant, quantity) => {
        const items = get().items
        const existingIndex = items.findIndex(item => item.variant.id === variant.id)
        
        if (existingIndex >= 0) {
          const newItems = [...items]
          newItems[existingIndex].quantity += quantity
          set({ items: newItems })
        } else {
          set({ items: [...items, { product, variant, quantity }] })
        }
      },
      
      removeItem: (variantId) => {
        set({ items: get().items.filter(item => item.variant.id !== variantId) })
      },
      
      updateQuantity: (variantId, quantity) => {
        const items = get().items
        const index = items.findIndex(item => item.variant.id === variantId)
        if (index >= 0) {
          const newItems = [...items]
          newItems[index].quantity = quantity
          set({ items: newItems })
        }
      },
      
      clearCart: () => set({ items: [] }),
      
      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },
      
      getTotalPrice: () => {
        return get().items.reduce((total, item) => {
          const price = (item.variant.price || 0) / 100
          return total + (price * item.quantity)
        }, 0)
      },
    }),
    {
      name: 'cart-storage',
    }
  )
)
