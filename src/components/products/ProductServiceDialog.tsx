import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Package } from 'lucide-react'

interface ProductService {
  id: string
  name: string
  description?: string
  unit_price: number
  tax_rate: number
  created_at: string
}

interface ProductServiceDialogProps {
  product: ProductService | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const ProductServiceDialog = ({
  product,
  open,
  onOpenChange,
  onSuccess
}: ProductServiceDialogProps) => {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [taxRate, setTaxRate] = useState('7') // Default ITBMS rate in Panama

  useEffect(() => {
    if (open) {
      if (product) {
        setName(product.name)
        setDescription(product.description || '')
        setUnitPrice(product.unit_price.toString())
        setTaxRate(product.tax_rate.toString())
      } else {
        resetForm()
      }
    }
  }, [open, product])

  const resetForm = () => {
    setName('')
    setDescription('')
    setUnitPrice('')
    setTaxRate('7')
  }

  const handleSubmit = async () => {
    if (!user || !name.trim() || !unitPrice || parseFloat(unitPrice) < 0) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      const productData = {
        name: name.trim(),
        description: description.trim() || null,
        unit_price: parseFloat(unitPrice),
        tax_rate: parseFloat(taxRate) || 0,
        owner_user_id: user.id
      }

      if (product) {
        // Update existing product
        const { error } = await supabase
          .from('products_services')
          .update(productData)
          .eq('id', product.id)

        if (error) throw error

        toast({
          title: 'Éxito',
          description: 'Producto/servicio actualizado correctamente.',
        })
      } else {
        // Create new product
        const { error } = await supabase
          .from('products_services')
          .insert(productData)

        if (error) throw error

        toast({
          title: 'Éxito',
          description: 'Producto/servicio creado correctamente.',
        })
      }

      onSuccess()
      onOpenChange(false)
      resetForm()

    } catch (error) {
      console.error('Error saving product/service:', error)
      toast({
        title: 'Error',
        description: 'No se pudo guardar el producto/servicio.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {product ? 'Editar Producto/Servicio' : 'Nuevo Producto/Servicio'}
          </DialogTitle>
          <DialogDescription>
            {product 
              ? 'Modifica los detalles del producto o servicio.'
              : 'Crea un nuevo producto o servicio para tus facturas.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del producto o servicio"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción detallada (opcional)"
              rows={3}
            />
          </div>

          {/* Unit Price and Tax Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit_price">Precio Unitario *</Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_rate">ITBMS (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="7.00"
              />
            </div>
          </div>

          {/* Tax Rate Helper */}
          <div className="text-xs text-muted-foreground">
            <p>Tasas comunes de ITBMS en Panamá:</p>
            <ul className="list-disc list-inside mt-1">
              <li>7% - Tasa general</li>
              <li>10% - Servicios específicos</li>
              <li>15% - Licores y cigarrillos</li>
              <li>0% - Productos exentos</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !name.trim() || !unitPrice || parseFloat(unitPrice) < 0}
          >
            {loading ? 'Guardando...' : product ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


