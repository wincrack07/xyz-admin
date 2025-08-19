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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const clientSchema = z.object({
  display_name: z.string().min(1, 'El nombre es requerido'),
  legal_name: z.string().optional(),
  tax_id: z.string().optional(),
  emails: z.array(z.string().email('Email inválido')).min(1, 'Al menos un email es requerido'),
  payment_terms_days: z.number().min(0, 'Los días deben ser 0 o más'),
  preferred_currency: z.string().optional(),
  billing_notes: z.string().optional(),
})

type ClientFormData = z.infer<typeof clientSchema>

interface Client {
  id: string
  display_name: string
  legal_name: string | null
  tax_id: string | null
  emails: string[]
  payment_terms_days: number
  preferred_currency: string | null
  billing_notes: string | null
  created_at: string
}

interface ClientDialogProps {
  client?: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const currencies = [
  { value: 'USD', label: 'Dólar Estadounidense (USD)' },
  { value: 'PAB', label: 'Balboa Panameño (PAB)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'Libra Esterlina (GBP)' },
]

export const ClientDialog = ({ client, open, onOpenChange, onSaved }: ClientDialogProps) => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      display_name: '',
      legal_name: '',
      tax_id: '',
      emails: [],
      payment_terms_days: 30,
      preferred_currency: 'USD',
      billing_notes: '',
    },
  })

  useEffect(() => {
    if (client) {
      form.reset({
        display_name: client.display_name,
        legal_name: client.legal_name || '',
        tax_id: client.tax_id || '',
        emails: client.emails,
        payment_terms_days: client.payment_terms_days,
        preferred_currency: client.preferred_currency || 'USD',
        billing_notes: client.billing_notes || '',
      })
    } else {
      form.reset({
        display_name: '',
        legal_name: '',
        tax_id: '',
        emails: [],
        payment_terms_days: 30,
        preferred_currency: 'USD',
        billing_notes: '',
      })
    }
  }, [client, form])

  const onSubmit = async (data: ClientFormData) => {
    if (!user) return

    try {
      setLoading(true)
      
      const clientData = {
        owner_user_id: user.id,
        display_name: data.display_name,
        legal_name: data.legal_name || null,
        tax_id: data.tax_id || null,
        emails: data.emails,
        payment_terms_days: data.payment_terms_days,
        preferred_currency: data.preferred_currency || null,
        billing_notes: data.billing_notes || null,
      }

      if (client) {
        // Update existing client
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', client.id)

        if (error) throw error

        toast({
          title: 'Cliente actualizado',
          description: 'Los datos del cliente se han actualizado correctamente.',
        })
      } else {
        // Create new client
        const { error } = await supabase
          .from('clients')
          .insert([clientData])

        if (error) throw error

        toast({
          title: 'Cliente creado',
          description: 'El nuevo cliente se ha creado correctamente.',
        })
      }

      onSaved()
    } catch (error: any) {
      console.error('Error saving client:', error)
      toast({
        title: 'Error',
        description: error.message || 'Ocurrió un error al guardar el cliente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const addEmail = () => {
    if (emailInput && emailInput.includes('@')) {
      const currentEmails = form.getValues('emails')
      if (!currentEmails.includes(emailInput)) {
        form.setValue('emails', [...currentEmails, emailInput])
        setEmailInput('')
      }
    }
  }

  const removeEmail = (emailToRemove: string) => {
    const currentEmails = form.getValues('emails')
    form.setValue('emails', currentEmails.filter(email => email !== emailToRemove))
  }

  const handleEmailKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addEmail()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {client ? 'Editar Cliente' : 'Nuevo Cliente'}
          </DialogTitle>
          <DialogDescription>
            {client 
              ? 'Actualiza los datos del cliente.' 
              : 'Agrega un nuevo cliente a tu cartera.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Cliente *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre comercial" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="legal_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razón Social</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre legal (opcional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RUC/Tax ID</FormLabel>
                    <FormControl>
                      <Input placeholder="123456789-1-DV" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferred_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda Preferida</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona moneda" />
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
            </div>

            <FormField
              control={form.control}
              name="payment_terms_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Términos de Pago (días)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="30" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    Número de días para el pago (0 = inmediato)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emails de Contacto *</FormLabel>
                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <Input
                        type="email"
                        placeholder="cliente@email.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyPress={handleEmailKeyPress}
                      />
                      <Button type="button" variant="outline" onClick={addEmail}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {field.value.map((email, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {email}
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => removeEmail(email)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billing_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas de Facturación</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Notas adicionales para facturación..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : client ? 'Actualizar' : 'Crear Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}


