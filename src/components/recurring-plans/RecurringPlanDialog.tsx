import { useState, useEffect, useCallback } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Calendar, Plus, Trash2, User, Clock, DollarSign } from 'lucide-react'

interface Client {
  id: string
  display_name: string
  legal_name?: string
  preferred_currency?: string
  payment_terms_days: number
}

interface RecurringPlan {
  id: string
  name: string
  description?: string
  billing_frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  billing_amount: number
  currency: string
  status: 'active' | 'paused' | 'cancelled' | 'expired'
  start_date: string
  end_date?: string
  next_billing_date: string
  auto_generate_invoices: boolean
  auto_send_emails: boolean
  payment_terms_days: number
  invoice_template: {
    items: Array<{
      description: string
      quantity: number
      unit_price: number
      tax_rate: number
    }>
  }
  client: {
    id: string
    display_name: string
    legal_name?: string
  }
}

interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_total: number
}

interface RecurringPlanDialogProps {
  plan: RecurringPlan | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const RecurringPlanDialog = ({
  plan,
  open,
  onOpenChange,
  onSuccess
}: RecurringPlanDialogProps) => {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)

  // Form state
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [billingFrequency, setBillingFrequency] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [billingAmount, setBillingAmount] = useState('')
  const [currency, setCurrency] = useState('PAB')
  const [status, setStatus] = useState<'active' | 'paused'>('active')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [autoGenerateInvoices, setAutoGenerateInvoices] = useState(true)
  const [autoSendEmails, setAutoSendEmails] = useState(false)
  const [paymentTermsDays, setPaymentTermsDays] = useState('30')
  const [items, setItems] = useState<InvoiceItem[]>([{
    description: '',
    quantity: 1,
    unit_price: 0,
    tax_rate: 0,
    line_total: 0
  }])

  // Load data when dialog opens
  useEffect(() => {
    if (open && user) {
      loadData()
      if (plan) {
        populateForm(plan)
      } else {
        resetForm()
      }
    }
  }, [open, user, plan])

  // Recalculate totals when items change
  useEffect(() => {
    calculateTotals()
  }, [items])

  const loadData = async () => {
    try {
      setLoadingData(true)
      
      // Load clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, display_name, legal_name, preferred_currency, payment_terms_days')
        .eq('owner_user_id', user!.id)
        .order('display_name')

      if (clientsError) throw clientsError
      setClients(clientsData || [])

    } catch (error) {
      console.error('Error loading data:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos necesarios.',
        variant: 'destructive',
      })
    } finally {
      setLoadingData(false)
    }
  }

  const populateForm = (planData: RecurringPlan) => {
    setSelectedClientId(planData.client.id)
    setName(planData.name)
    setDescription(planData.description || '')
    setBillingFrequency(planData.billing_frequency)
    setBillingAmount(planData.billing_amount.toString())
    setCurrency(planData.currency)
    setStatus(planData.status === 'cancelled' ? 'paused' : planData.status as 'active' | 'paused')
    setStartDate(planData.start_date)
    setEndDate(planData.end_date || '')
    setAutoGenerateInvoices(planData.auto_generate_invoices)
    setAutoSendEmails(planData.auto_send_emails)
    setPaymentTermsDays(planData.payment_terms_days.toString())
    
    // Populate items from template
    if (planData.invoice_template.items.length > 0) {
      setItems(planData.invoice_template.items.map(item => ({
        ...item,
        line_total: item.quantity * item.unit_price
      })))
    }
  }

  const resetForm = () => {
    setSelectedClientId('')
    setName('')
    setDescription('')
    setBillingFrequency('monthly')
    setBillingAmount('')
    setCurrency('PAB')
    setStatus('active')
    setStartDate(new Date().toISOString().split('T')[0])
    setEndDate('')
    setAutoGenerateInvoices(true)
    setAutoSendEmails(false)
    setPaymentTermsDays('30')
    setItems([{
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 0,
      line_total: 0
    }])
  }

  const calculateTotals = () => {
    const newItems = items.map(item => ({
      ...item,
      line_total: item.quantity * item.unit_price
    }))
    
    if (JSON.stringify(newItems) !== JSON.stringify(items)) {
      setItems(newItems)
    }
  }

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId)
    const selectedClient = clients.find(c => c.id === clientId)
    if (selectedClient) {
      if (selectedClient.preferred_currency) {
        setCurrency(selectedClient.preferred_currency)
      }
      setPaymentTermsDays(selectedClient.payment_terms_days.toString())
    }
  }

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Recalculate line total
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].line_total = newItems[index].quantity * newItems[index].unit_price
    }
    
    setItems(newItems)
  }

  const handleAddItem = () => {
    setItems([...items, {
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 0,
      line_total: 0
    }])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index)
      setItems(newItems)
    }
  }

  const calculateNextBillingDate = (startDate: string, frequency: string) => {
    const date = new Date(startDate)
    
    switch (frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7)
        break
      case 'monthly':
        date.setMonth(date.getMonth() + 1)
        break
      case 'quarterly':
        date.setMonth(date.getMonth() + 3)
        break
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1)
        break
    }
    
    return date.toISOString().split('T')[0]
  }

  const handleSubmit = async () => {
    if (!user || !selectedClientId || !name.trim() || !billingAmount || parseFloat(billingAmount) <= 0) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos.',
        variant: 'destructive',
      })
      return
    }

    // Validate items
    const hasInvalidItems = items.some(item => 
      !item.description.trim() || item.quantity <= 0 || item.unit_price < 0
    )
    
    if (hasInvalidItems) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los items correctamente.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      const planData = {
        owner_user_id: user.id,
        client_id: selectedClientId,
        name: name.trim(),
        description: description.trim() || null,
        billing_frequency: billingFrequency,
        billing_amount: parseFloat(billingAmount),
        currency: currency,
        status: status,
        start_date: startDate,
        end_date: endDate || null,
        next_billing_date: plan ? plan.next_billing_date : calculateNextBillingDate(startDate, billingFrequency),
        auto_generate_invoices: autoGenerateInvoices,
        auto_send_emails: autoSendEmails,
        payment_terms_days: parseInt(paymentTermsDays),
        invoice_template: {
          items: items.map(({ line_total, ...item }) => item) // Remove line_total from template
        }
      }

      if (plan) {
        // Update existing plan
        const { error } = await supabase
          .from('recurring_plans')
          .update(planData)
          .eq('id', plan.id)

        if (error) throw error

        toast({
          title: 'Éxito',
          description: 'Plan recurrente actualizado correctamente.',
        })
      } else {
        // Create new plan
        const { error } = await supabase
          .from('recurring_plans')
          .insert(planData)

        if (error) throw error

        toast({
          title: 'Éxito',
          description: 'Plan recurrente creado correctamente.',
        })
      }

      onSuccess()
      onOpenChange(false)
      resetForm()

    } catch (error) {
      console.error('Error saving recurring plan:', error)
      toast({
        title: 'Error',
        description: 'No se pudo guardar el plan recurrente.',
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {plan ? 'Editar Plan Recurrente' : 'Nuevo Plan Recurrente'}
          </DialogTitle>
          <DialogDescription>
            {plan ? 'Modifica los detalles del plan recurrente.' : 'Crea un nuevo plan de facturación automática.'}
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Cargando datos...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client">Cliente *</Label>
                <Select value={selectedClientId} onValueChange={handleClientChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {client.display_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Plan *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Hosting Mensual, Consultoría Semanal"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción detallada del plan"
                  rows={2}
                />
              </div>
            </div>

            {/* Billing Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuración de Facturación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frecuencia *</Label>
                    <Select value={billingFrequency} onValueChange={(value: any) => setBillingFrequency(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensual</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Monto *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={billingAmount}
                      onChange={(e) => setBillingAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Moneda</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PAB">PAB (Balboa)</SelectItem>
                        <SelectItem value="USD">USD (Dólar)</SelectItem>
                        <SelectItem value="EUR">EUR (Euro)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Fecha de Inicio *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_date">Fecha de Fin (Opcional)</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_terms">Términos de Pago (días)</Label>
                    <Input
                      id="payment_terms"
                      type="number"
                      min="0"
                      value={paymentTermsDays}
                      onChange={(e) => setPaymentTermsDays(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="paused">Pausado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Template Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Items de la Factura</CardTitle>
                <Button onClick={handleAddItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Item
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end p-4 border rounded-lg">
                    <div className="col-span-12 md:col-span-4">
                      <Label className="text-sm font-medium text-gray-700 mb-1 block">
                        Descripción *
                      </Label>
                      <Input
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder="Descripción del item"
                      />
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <Label className="text-sm font-medium text-gray-700 mb-1 block">
                        Cant.
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="text-center"
                      />
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <Label className="text-sm font-medium text-gray-700 mb-1 block">
                        Precio Unit.
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <Label className="text-sm font-medium text-gray-700 mb-1 block">
                        ITBMS %
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={item.tax_rate}
                        onChange={(e) => handleItemChange(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                        className="text-center"
                      />
                    </div>

                    <div className="col-span-6 md:col-span-1">
                      <Label className="text-sm font-medium text-gray-700 mb-1 block">
                        Total
                      </Label>
                      <div className="h-10 px-3 py-2 border border-gray-200 rounded-md bg-gray-50 flex items-center justify-end text-sm font-medium">
                        {formatCurrency(item.line_total)}
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-1 flex justify-center">
                      {items.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className="flex justify-end">
                  <div className="w-48 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total del Template:</span>
                      <span>{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Automation Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuración de Automatización</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto_generate">Generar Facturas Automáticamente</Label>
                    <p className="text-sm text-muted-foreground">
                      Las facturas se crearán automáticamente en la fecha de facturación
                    </p>
                  </div>
                  <Switch
                    id="auto_generate"
                    checked={autoGenerateInvoices}
                    onCheckedChange={setAutoGenerateInvoices}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto_send">Enviar Emails Automáticamente</Label>
                    <p className="text-sm text-muted-foreground">
                      Se enviará un email al cliente cuando se genere la factura
                    </p>
                  </div>
                  <Switch
                    id="auto_send"
                    checked={autoSendEmails}
                    onCheckedChange={setAutoSendEmails}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || loadingData || !selectedClientId || !name.trim()}
          >
            {loading ? 'Guardando...' : plan ? 'Actualizar Plan' : 'Crear Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

