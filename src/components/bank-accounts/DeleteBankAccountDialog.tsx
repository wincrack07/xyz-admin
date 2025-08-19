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

interface BankAccount {
  id: string
  bank_name: string
  account_alias: string
  account_number_mask: string
  currency: string
  created_at: string
}

interface DeleteBankAccountDialogProps {
  bankAccount: BankAccount | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export const DeleteBankAccountDialog = ({ bankAccount, open, onOpenChange, onDeleted }: DeleteBankAccountDialogProps) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!bankAccount) return

    try {
      setLoading(true)

      // Check if there are transactions associated with this account
      const { data: transactions, error: checkError } = await supabase
        .from('transactions')
        .select('id')
        .eq('bank_account_id', bankAccount.id)
        .limit(1)

      if (checkError) throw checkError

      if (transactions && transactions.length > 0) {
        toast({
          title: 'No se puede eliminar',
          description: 'Esta cuenta tiene transacciones asociadas. Elimina las transacciones primero.',
          variant: 'destructive',
        })
        return
      }

      // Delete bank account
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', bankAccount.id)

      if (error) throw error

      toast({
        title: 'Cuenta eliminada',
        description: `${bankAccount.account_alias} ha sido eliminada correctamente.`,
      })

      onDeleted()
    } catch (error: any) {
      console.error('Error deleting bank account:', error)
      toast({
        title: 'Error',
        description: error.message || 'Ocurrió un error al eliminar la cuenta bancaria.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getBankDisplayName = (bankName: string) => {
    const bankNames: Record<string, string> = {
      'banco_general': 'Banco General de Panamá',
      'banesco': 'Banco Banesco',
      'bac_credomatic': 'BAC Credomatic',
      'global_bank': 'Global Bank',
      'other': 'Otro Banco'
    }
    return bankNames[bankName] || bankName
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar cuenta bancaria?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Se eliminará permanentemente la cuenta{' '}
            <strong>{bankAccount?.account_alias}</strong> del{' '}
            <strong>{bankAccount ? getBankDisplayName(bankAccount.bank_name) : ''}</strong>.
            <br /><br />
            <strong>Nota:</strong> Solo se puede eliminar si no tiene transacciones asociadas.
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


