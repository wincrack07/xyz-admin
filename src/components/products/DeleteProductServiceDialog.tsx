import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { AlertTriangle } from 'lucide-react'

interface ProductService {
  id: string
  name: string
  description?: string
  unit_price: number
  tax_rate: number
  created_at: string
}

interface DeleteProductServiceDialogProps {
  product: ProductService | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const DeleteProductServiceDialog = ({
  product,
  open,
  onOpenChange,
  onSuccess
}: DeleteProductServiceDialogProps) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!product) return

    try {
      setLoading(true)

      // Check if product is used in any invoice items
      const { data: usageData, error: usageError } = await supabase
        .from('invoice_items')
        .select('id')
        .eq('description', product.name)
        .limit(1)

      if (usageError) throw usageError

      if (usageData && usageData.length > 0) {
        toast({
          title: 'No se puede eliminar',
          description: 'Este producto/servicio está siendo usado en facturas existentes.',
          variant: 'destructive',
        })
        return
      }

      // Delete the product/service
      const { error } = await supabase
        .from('products_services')
        .delete()
        .eq('id', product.id)

      if (error) throw error

      toast({
        title: 'Producto/servicio eliminado',
        description: `${product.name} ha sido eliminado correctamente.`,
      })

      onSuccess()
      onOpenChange(false)

    } catch (error) {
      console.error('Error deleting product/service:', error)
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el producto/servicio.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: 'PAB'
    }).format(amount)
  }

  if (!product) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Eliminar Producto/Servicio
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                ¿Estás seguro de que quieres eliminar este producto/servicio? Esta acción no se puede deshacer.
              </p>
              
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="font-medium">
                  {product.name}
                </div>
                {product.description && (
                  <div className="text-sm text-muted-foreground">
                    {product.description}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  Precio: {formatCurrency(product.unit_price)}
                </div>
                <div className="text-sm text-muted-foreground">
                  ITBMS: {product.tax_rate}%
                </div>
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  ⚠️ Si este producto/servicio está siendo usado en facturas existentes, no se podrá eliminar.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Eliminando...' : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}


