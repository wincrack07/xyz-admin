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

interface Invoice {
  id: string
  series: string
  number: number
  status: string
  total: number
  currency: string
  client: {
    display_name: string
  }
}

interface DeleteInvoiceDialogProps {
  invoice: Invoice | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const DeleteInvoiceDialog = ({
  invoice,
  open,
  onOpenChange,
  onSuccess
}: DeleteInvoiceDialogProps) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!invoice) return

    // Prevent deletion of paid or partially paid invoices
    if (['paid', 'partial'].includes(invoice.status)) {
      toast({
        title: 'No se puede eliminar',
        description: 'No se pueden eliminar facturas que han sido pagadas.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      // Delete invoice items first (due to foreign key constraint)
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoice.id)

      if (itemsError) throw itemsError

      // Delete the invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id)

      if (invoiceError) throw invoiceError

      toast({
        title: 'Factura eliminada',
        description: `La factura ${invoice.series}-${invoice.number.toString().padStart(4, '0')} ha sido eliminada.`,
      })

      onSuccess()
      onOpenChange(false)

    } catch (error) {
      console.error('Error deleting invoice:', error)
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la factura.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  if (!invoice) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Eliminar Factura
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                ¿Estás seguro de que quieres eliminar esta factura? Esta acción no se puede deshacer.
              </p>
              
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="font-medium">
                  Factura: {invoice.series}-{invoice.number.toString().padStart(4, '0')}
                </div>
                <div className="text-sm text-muted-foreground">
                  Cliente: {invoice.client.display_name}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: {formatCurrency(invoice.total, invoice.currency)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Estado: {invoice.status}
                </div>
              </div>

              {['paid', 'partial'].includes(invoice.status) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm font-medium">
                    ⚠️ Esta factura no se puede eliminar porque ya ha sido pagada.
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading || ['paid', 'partial'].includes(invoice.status)}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Eliminando...' : 'Eliminar Factura'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}


