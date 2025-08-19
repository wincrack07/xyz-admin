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

interface RecurringPlan {
  id: string
  name: string
  description?: string
  billing_frequency: string
  billing_amount: number
  currency: string
  status: string
  client: {
    display_name: string
  }
}

interface DeleteRecurringPlanDialogProps {
  plan: RecurringPlan | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const DeleteRecurringPlanDialog = ({
  plan,
  open,
  onOpenChange,
  onSuccess
}: DeleteRecurringPlanDialogProps) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!plan) return

    try {
      setLoading(true)

      // Check if plan has generated invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('id')
        .eq('recurring_plan_id', plan.id)
        .limit(1)

      if (invoicesError) throw invoicesError

      if (invoicesData && invoicesData.length > 0) {
        // If plan has invoices, just mark as cancelled instead of deleting
        const { error: updateError } = await supabase
          .from('recurring_plans')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', plan.id)

        if (updateError) throw updateError

        toast({
          title: 'Plan cancelado',
          description: `El plan "${plan.name}" ha sido cancelado. No se eliminó porque tiene facturas asociadas.`,
        })
      } else {
        // If no invoices, safe to delete
        const { error } = await supabase
          .from('recurring_plans')
          .delete()
          .eq('id', plan.id)

        if (error) throw error

        toast({
          title: 'Plan eliminado',
          description: `El plan "${plan.name}" ha sido eliminado correctamente.`,
        })
      }

      onSuccess()
      onOpenChange(false)

    } catch (error) {
      console.error('Error deleting recurring plan:', error)
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el plan recurrente.',
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

  const formatFrequency = (frequency: string) => {
    const frequencies = {
      weekly: 'Semanal',
      monthly: 'Mensual',
      quarterly: 'Trimestral',
      yearly: 'Anual'
    }
    return frequencies[frequency as keyof typeof frequencies] || frequency
  }

  if (!plan) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Eliminar Plan Recurrente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                ¿Estás seguro de que quieres eliminar este plan recurrente? Esta acción no se puede deshacer.
              </p>
              
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="font-medium">
                  {plan.name}
                </div>
                {plan.description && (
                  <div className="text-sm text-muted-foreground">
                    {plan.description}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  Cliente: {plan.client.display_name}
                </div>
                <div className="text-sm text-muted-foreground">
                  Facturación: {formatCurrency(plan.billing_amount, plan.currency)} - {formatFrequency(plan.billing_frequency)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Estado: {plan.status}
                </div>
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  ⚠️ Si este plan ya ha generado facturas, será cancelado en lugar de eliminado para preservar el historial.
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
            {loading ? 'Eliminando...' : 'Eliminar Plan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

