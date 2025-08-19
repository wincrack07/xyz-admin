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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { FileText, User, Calendar, DollarSign } from 'lucide-react'

interface Client {
  id: string
  display_name: string
  legal_name?: string
  preferred_currency?: string
}

interface IncomeTransaction {
  id: string
  posted_at: string
  description: string
  merchant_name?: string
  amount: number
  currency: string
  source_type: 'manual' | 'bank_import' | 'invoice'
}

interface ConvertToInvoiceDialogProps {
  income: IncomeTransaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const ConvertToInvoiceDialog = ({
  income,
  open,
  onOpenChange,
  onSuccess
}: ConvertToInvoiceDialogProps) => {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [invoiceDescription, setInvoiceDescription] = useState('')
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingClients, setLoadingClients] = useState(false)

  // Load clients when dialog opens
  useEffect(() => {
    if (open && user) {
      loadClients()
      // Pre-fill description from income
      if (income) {
        setInvoiceDescription(income.description)
        setInvoiceNotes(`Convertido desde ingreso: ${income.merchant_name || income.description}`)
      }
    }
  }, [open, user, income])

  const loadClients = async () => {
    if (!user) return

    try {
      setLoadingClients(true)
      const { data, error } = await supabase
        .from('clients')
        .select('id, display_name, legal_name, preferred_currency')
        .eq('owner_user_id', user.id)
        .order('display_name')

      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Error loading clients:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los clientes.',
        variant: 'destructive',
      })
    } finally {
      setLoadingClients(false)
    }
  }

  const handleConvert = async () => {
    if (!income || !user || !selectedClientId || !invoiceDescription.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      // Get next invoice number
      const { data: nextNumberData, error: numberError } = await supabase
        .rpc('get_next_invoice_number', {
          p_owner_user_id: user.id,
          p_series: 'A'
        })

      if (numberError) throw numberError

      const selectedClient = clients.find(c => c.id === selectedClientId)
      const invoiceCurrency = selectedClient?.preferred_currency || income.currency

      // Create invoice
      const invoiceData = {
        owner_user_id: user.id,
        client_id: selectedClientId,
        series: 'A',
        number: nextNumberData,
        issue_date: income.posted_at,
        due_date: income.posted_at, // Same date since it's already paid
        currency: invoiceCurrency,
        subtotal: income.amount,
        tax: 0, // No tax for converted income
        total: income.amount,
        status: 'paid' as const, // Mark as paid since income was already received
        notes: invoiceNotes,
        conciliation_status: 'complete' as const, // Already conciliated with the income
        conciliated_amount: income.amount,
        last_conciliated_at: new Date().toISOString()
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Create invoice item
      const invoiceItemData = {
        invoice_id: invoice.id,
        owner_user_id: user.id,
        description: invoiceDescription,
        quantity: 1,
        unit_price: income.amount,
        tax_rate: 0,
        line_total: income.amount
      }

      const { error: itemError } = await supabase
        .from('invoice_items')
        .insert(invoiceItemData)

      if (itemError) throw itemError

      // Create conciliation record if the income was manual
      if (income.source_type === 'manual') {
        const conciliationData = {
          owner_id: user.id,
          conciliation_type: 'invoice_payment' as const,
          invoice_id: invoice.id,
          expected_amount: income.amount,
          conciliated_amount: income.amount,
          expected_date: income.posted_at,
          conciliated_date: income.posted_at,
          status: 'complete' as const,
          auto_conciliated: false,
          notes: `Convertido desde ingreso manual: ${income.description}`
        }

        const { error: conciliationError } = await supabase
          .from('conciliations')
          .insert(conciliationData)

        if (conciliationError) throw conciliationError

        // Delete the manual income record
        const { error: deleteError } = await supabase
          .from('manual_income')
          .delete()
          .eq('id', income.id)

        if (deleteError) throw deleteError
      }

      toast({
        title: 'Éxito',
        description: `Ingreso convertido a factura ${invoice.series}-${invoice.number.toString().padStart(4, '0')}`,
      })

      onSuccess()
      onOpenChange(false)
      resetForm()

    } catch (error) {
      console.error('Error converting income to invoice:', error)
      toast({
        title: 'Error',
        description: 'No se pudo convertir el ingreso a factura.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedClientId('')
    setInvoiceDescription('')
    setInvoiceNotes('')
  }

  const handleClose = () => {
    onOpenChange(false)
    resetForm()
  }

  if (!income) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Convertir a Factura
          </DialogTitle>
          <DialogDescription>
            Convierte este ingreso en una factura formal vinculada a un cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Income Details */}
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Detalles del Ingreso
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Fecha:</span>
                <p>{new Date(income.posted_at).toLocaleDateString('es-PA')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Monto:</span>
                <p className="font-medium text-green-600">
                  {new Intl.NumberFormat('es-PA', {
                    style: 'currency',
                    currency: income.currency
                  }).format(income.amount)}
                </p>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Descripción:</span>
              <p className="text-sm">{income.description}</p>
            </div>
          </div>

          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client">Cliente *</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {loadingClients ? (
                  <SelectItem value="" disabled>
                    Cargando clientes...
                  </SelectItem>
                ) : clients.length === 0 ? (
                  <SelectItem value="" disabled>
                    No hay clientes disponibles
                  </SelectItem>
                ) : (
                  clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {client.display_name}
                        {client.legal_name && client.legal_name !== client.display_name && (
                          <span className="text-xs text-muted-foreground">
                            ({client.legal_name})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Invoice Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción de la Factura *</Label>
            <Input
              id="description"
              value={invoiceDescription}
              onChange={(e) => setInvoiceDescription(e.target.value)}
              placeholder="Descripción del servicio o producto"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              placeholder="Notas adicionales para la factura"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConvert} 
            disabled={loading || !selectedClientId || !invoiceDescription.trim()}
          >
            {loading ? 'Convirtiendo...' : 'Convertir a Factura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


