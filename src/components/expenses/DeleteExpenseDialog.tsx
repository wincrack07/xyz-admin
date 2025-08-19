import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
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

interface Expense {
  id: string
  spend_date: string
  category: string
  description: string | null
  amount: number
  currency: string
  payment_method: string | null
  attachment_urls: string[] | null
  created_at: string
}

interface DeleteExpenseDialogProps {
  expense: Expense | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export const DeleteExpenseDialog = ({ expense, open, onOpenChange, onDeleted }: DeleteExpenseDialogProps) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!expense) return

    try {
      setLoading(true)

      // Delete attachments from storage if they exist
      if (expense.attachment_urls && expense.attachment_urls.length > 0) {
        const filePaths = expense.attachment_urls.map(url => {
          const path = url.split('/').slice(-2).join('/') // Get user_id/filename
          return path
        })

        const { error: storageError } = await supabase.storage
          .from('expenses_attachments')
          .remove(filePaths)

        if (storageError) {
          console.warn('Error deleting attachments:', storageError)
          // Continue with expense deletion even if attachment deletion fails
        }
      }

      // Delete expense record
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id)

      if (error) throw error

      toast({
        title: 'Gasto eliminado',
        description: `El gasto de ${expense.category} se ha eliminado correctamente.`,
      })

      onDeleted()
    } catch (error: any) {
      console.error('Error deleting expense:', error)
      toast({
        title: 'Error',
        description: error.message || 'Ocurrió un error al eliminar el gasto.',
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-PA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Se eliminará permanentemente el gasto{' '}
            <strong>{expense?.category}</strong> por{' '}
            <strong>{expense ? formatCurrency(expense.amount, expense.currency) : ''}</strong>{' '}
            del {expense ? formatDate(expense.spend_date) : ''}.
            {expense?.attachment_urls && expense.attachment_urls.length > 0 && (
              <span>
                {' '}También se eliminarán {expense.attachment_urls.length} archivo(s) adjunto(s).
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Eliminando...' : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}


