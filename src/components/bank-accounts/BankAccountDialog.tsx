import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

const bankAccountSchema = z.object({
  bank_name: z.string().min(1, 'El banco es requerido'),
  account_alias: z.string().min(1, 'El alias es requerido').max(50, 'Máximo 50 caracteres'),
  account_number_mask: z.string().min(1, 'El número de cuenta es requerido').max(20, 'Máximo 20 caracteres'),
  currency: z.string().min(1, 'La moneda es requerida'),
})

type BankAccountFormData = z.infer<typeof bankAccountSchema>

interface BankAccount {
  id: string
  bank_name: string
  account_alias: string
  account_number_mask: string
  currency: string
  created_at: string
}

interface BankAccountDialogProps {
  bankAccount?: BankAccount | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const banks = [
  { value: 'banco_general', label: 'Banco General de Panamá' },
  { value: 'banesco', label: 'Banco Banesco' },
  { value: 'bac_credomatic', label: 'BAC Credomatic' },
  { value: 'global_bank', label: 'Global Bank' },
  { value: 'other', label: 'Otro Banco' }
]

const currencies = [
  { value: 'PAB', label: 'PAB - Balboa Panameño' },
  { value: 'USD', label: 'USD - Dólar Estadounidense' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - Libra Esterlina' }
]

export const BankAccountDialog = ({ bankAccount, open, onOpenChange, onSaved }: BankAccountDialogProps) => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const form = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      bank_name: '',
      account_alias: '',
      account_number_mask: '',
      currency: 'PAB',
    },
  })

  useEffect(() => {
    if (bankAccount) {
      form.reset({
        bank_name: bankAccount.bank_name,
        account_alias: bankAccount.account_alias,
        account_number_mask: bankAccount.account_number_mask,
        currency: bankAccount.currency,
      })
    } else {
      form.reset({
        bank_name: '',
        account_alias: '',
        account_number_mask: '',
        currency: 'PAB',
      })
    }
  }, [bankAccount, form])

  const onSubmit = async (data: BankAccountFormData) => {
    if (!user) return

    try {
      setLoading(true)
      
      const bankAccountData = {
        owner_id: user.id,
        bank_name: data.bank_name,
        account_alias: data.account_alias,
        account_number_mask: data.account_number_mask,
        currency: data.currency,
      }

      if (bankAccount) {
        // Update existing bank account
        const { error } = await supabase
          .from('bank_accounts')
          .update(bankAccountData)
          .eq('id', bankAccount.id)

        if (error) throw error

        toast({
          title: 'Cuenta actualizada',
          description: 'La cuenta bancaria se ha actualizado correctamente.',
        })
      } else {
        // Create new bank account
        const { error } = await supabase
          .from('bank_accounts')
          .insert([bankAccountData])

        if (error) throw error

        toast({
          title: 'Cuenta creada',
          description: 'La nueva cuenta bancaria se ha creado correctamente.',
        })
      }

      onSaved()
    } catch (error: any) {
      console.error('Error saving bank account:', error)
      toast({
        title: 'Error',
        description: error.message || 'Ocurrió un error al guardar la cuenta bancaria.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {bankAccount ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
          </DialogTitle>
          <DialogDescription>
            {bankAccount 
              ? 'Actualiza los datos de la cuenta bancaria.' 
              : 'Agrega una nueva cuenta bancaria para importar estados de cuenta.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="bank_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Banco *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el banco" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {banks.map((bank) => (
                        <SelectItem key={bank.value} value={bank.value}>
                          {bank.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="account_alias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alias de la Cuenta *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Cuenta Principal, Ahorros, etc." {...field} />
                  </FormControl>
                  <FormDescription>
                    Un nombre descriptivo para identificar esta cuenta
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="account_number_mask"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Cuenta *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: ****1234, 1234-5678-9012-3456" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Puedes usar una máscara (****1234) o el número completo
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona la moneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : bankAccount ? 'Actualizar' : 'Crear Cuenta'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}


