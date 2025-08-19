import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, Package } from 'lucide-react'

interface Product {
  id: string
  name: string
  description?: string
  unit_price: number
  tax_rate: number
}

interface InvoiceItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_total: number
}

interface InvoiceItemRowProps {
  item: InvoiceItem
  products: Product[]
  currency: string
  onItemChange: (item: InvoiceItem) => void
  onRemove: () => void
  canRemove: boolean
}

export const InvoiceItemRow = ({
  item,
  products,
  currency,
  onItemChange,
  onRemove,
  canRemove
}: InvoiceItemRowProps) => {
  const [localItem, setLocalItem] = useState<InvoiceItem>(item)

  useEffect(() => {
    setLocalItem(item)
  }, [item])

  useEffect(() => {
    // Recalculate line total when quantity or unit_price changes
    const newLineTotal = localItem.quantity * localItem.unit_price
    if (newLineTotal !== localItem.line_total) {
      const updatedItem = { ...localItem, line_total: newLineTotal }
      setLocalItem(updatedItem)
      onItemChange(updatedItem)
    }
  }, [localItem.quantity, localItem.unit_price])

  const handleProductSelect = (productId: string) => {
    const selectedProduct = products.find(p => p.id === productId)
    if (selectedProduct) {
      const updatedItem: InvoiceItem = {
        ...localItem,
        description: selectedProduct.name + (selectedProduct.description ? ` - ${selectedProduct.description}` : ''),
        unit_price: selectedProduct.unit_price,
        tax_rate: selectedProduct.tax_rate,
        line_total: localItem.quantity * selectedProduct.unit_price
      }
      setLocalItem(updatedItem)
      onItemChange(updatedItem)
    }
  }

  const handleFieldChange = (field: keyof InvoiceItem, value: string | number) => {
    const updatedItem = { ...localItem, [field]: value }
    setLocalItem(updatedItem)
    onItemChange(updatedItem)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-end p-4 border rounded-lg">
      {/* Product Selector */}
      <div className="col-span-12 md:col-span-3">
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Producto/Servicio
        </label>
        <Select onValueChange={handleProductSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar..." />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{product.name}</div>
                    {product.description && (
                      <div className="text-xs text-muted-foreground">{product.description}</div>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="col-span-12 md:col-span-3">
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Descripción *
        </label>
        <Input
          value={localItem.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          placeholder="Descripción del item"
        />
      </div>

      {/* Quantity */}
      <div className="col-span-6 md:col-span-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Cant.
        </label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={localItem.quantity}
          onChange={(e) => handleFieldChange('quantity', parseFloat(e.target.value) || 0)}
          className="text-center"
        />
      </div>

      {/* Unit Price */}
      <div className="col-span-6 md:col-span-2">
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Precio Unit.
        </label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={localItem.unit_price}
          onChange={(e) => handleFieldChange('unit_price', parseFloat(e.target.value) || 0)}
        />
      </div>

      {/* Tax Rate */}
      <div className="col-span-6 md:col-span-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          ITBMS %
        </label>
        <Input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={localItem.tax_rate}
          onChange={(e) => handleFieldChange('tax_rate', parseFloat(e.target.value) || 0)}
          className="text-center"
        />
      </div>

      {/* Line Total */}
      <div className="col-span-6 md:col-span-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Total
        </label>
        <div className="h-10 px-3 py-2 border border-gray-200 rounded-md bg-gray-50 flex items-center justify-end text-sm font-medium">
          {formatCurrency(localItem.line_total)}
        </div>
      </div>

      {/* Remove Button */}
      <div className="col-span-12 md:col-span-1 flex justify-center">
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}


