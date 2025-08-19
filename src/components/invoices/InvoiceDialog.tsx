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
import { useToast } from '@/hooks/use-toast'
import { useNMI } from '@/hooks/useNMI'
import { FileText, Plus, Trash2, User, Calendar, DollarSign, CreditCard, Link, Mail, ExternalLink, Copy } from 'lucide-react'
import { InvoiceItemRow } from './InvoiceItemRow'

interface Client {
  id: string
  display_name: string
  legal_name?: string
  preferred_currency?: string
  payment_terms_days: number
}

interface Product {
  id: string
  name: string
  description?: string
  unit_price: number
  tax_rate: number
}

interface InvoiceItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_total: number
}

interface Invoice {
  id: string
  series: string
  number: number
  client_id: string
  issue_date: string
  due_date: string
  status: 'cotizacion' | 'sent' | 'pending' | 'paid' | 'partial' | 'failed' | 'refunded' | 'void' | 'chargeback' | 'payment_review' | 'payment_approved'
  currency: string
  subtotal: number
  tax: number
  total: number
  payment_link_url?: string
  notes?: string
  client: {
    display_name: string
    legal_name?: string
  }
  conciliation_status?: 'pending' | 'partial' | 'complete' | 'cancelled'
  conciliated_amount?: number
  created_at: string
}

interface InvoiceDialogProps {
  invoice: Invoice | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const InvoiceDialog = ({
  invoice,
  open,
  onOpenChange,
  onSuccess
}: InvoiceDialogProps) => {
  const { user } = useAuth()
  const { toast } = useToast()
  const { generatePaymentLink, copyPaymentLink, openPaymentLink, loading: nmiLoading } = useNMI()
  
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)

  // Form state
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [currency, setCurrency] = useState('PAB')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>([{
    description: '',
    quantity: 1,
    unit_price: 0,
    tax_rate: 0,
    line_total: 0
  }])

  // Calculations
  const [subtotal, setSubtotal] = useState(0)
  const [totalTax, setTotalTax] = useState(0)
  const [total, setTotal] = useState(0)

  // Load data when dialog opens
  useEffect(() => {
    if (open && user) {
      loadData()
      if (invoice) {
        populateForm(invoice)
      } else {
        resetForm()
      }
    }
  }, [open, user, invoice])

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

      // Load products/services
      const { data: productsData, error: productsError } = await supabase
        .from('products_services')
        .select('id, name, description, unit_price, tax_rate')
        .eq('owner_user_id', user!.id)
        .order('name')

      if (productsError) throw productsError
      setProducts(productsData || [])

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

  const populateForm = async (invoiceData: Invoice) => {
    try {
      // Set basic invoice fields
      setSelectedClientId(invoiceData.client_id)
      setIssueDate(invoiceData.issue_date)
      setDueDate(invoiceData.due_date)
      setCurrency(invoiceData.currency)
      setNotes(invoiceData.notes || '')

      // Load invoice items
      const { data: itemsData, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceData.id)

      if (itemsError) {
        console.error('Error loading invoice items:', itemsError)
        throw itemsError
      }

      // Convert invoice items to form items
      if (itemsData && itemsData.length > 0) {
        const formItems = itemsData.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          line_total: item.quantity * item.unit_price
        }))
        setItems(formItems)
      } else {
        // If no items, set default empty item
        setItems([{
          description: '',
          quantity: 1,
          unit_price: 0,
          tax_rate: 0,
          line_total: 0
        }])
      }

    } catch (error) {
      console.error('Error populating form:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos de la factura.',
        variant: 'destructive',
      })
      // Set default values in case of error
      resetForm()
    }
  }

  const resetForm = () => {
    setSelectedClientId('')
    setIssueDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setCurrency('PAB')
    setNotes('')
    setItems([{
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 0,
      line_total: 0
    }])
  }

  const calculateTotals = () => {
    const calculatedSubtotal = items.reduce((sum, item) => sum + item.line_total, 0)
    const calculatedTax = items.reduce((sum, item) => {
      const itemTax = (item.unit_price * item.quantity) * (item.tax_rate / 100)
      return sum + itemTax
    }, 0)
    const calculatedTotal = calculatedSubtotal + calculatedTax

    setSubtotal(calculatedSubtotal)
    setTotalTax(calculatedTax)
    setTotal(calculatedTotal)
  }

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId)
    const selectedClient = clients.find(c => c.id === clientId)
    if (selectedClient) {
      // Set currency from client preference
      if (selectedClient.preferred_currency) {
        setCurrency(selectedClient.preferred_currency)
      }
      // Calculate due date based on payment terms
      const issueDateTime = new Date(issueDate)
      const dueDateTime = new Date(issueDateTime)
      dueDateTime.setDate(dueDateTime.getDate() + selectedClient.payment_terms_days)
      setDueDate(dueDateTime.toISOString().split('T')[0])
    }
  }

  const handleItemChange = (index: number, updatedItem: InvoiceItem) => {
    const newItems = [...items]
    newItems[index] = updatedItem
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

  const handleSubmit = async () => {
    if (!user || !selectedClientId || items.length === 0) {
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

      if (invoice) {
        // Update existing invoice
        await updateInvoice()
      } else {
        // Create new invoice
        await createInvoice()
      }
    } catch (error) {
      console.error('Error saving invoice:', error)
      toast({
        title: 'Error',
        description: 'No se pudo guardar la factura.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const createInvoice = async () => {
    // Get next invoice number
    const { data: nextNumberData, error: numberError } = await supabase
      .rpc('get_next_invoice_number', {
        p_owner_user_id: user!.id,
        p_series: 'A'
      })

    if (numberError) throw numberError

    // Create invoice
    const invoiceData = {
      owner_user_id: user!.id,
      client_id: selectedClientId,
      series: 'A',
      number: nextNumberData,
      issue_date: issueDate,
      due_date: dueDate,
      currency: currency,
      subtotal: subtotal,
      tax: totalTax,
      total: total,
              status: 'cotizacion' as const,
      notes: notes.trim() || null
    }

    const { data: invoiceResult, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single()

    if (invoiceError) throw invoiceError

    // Create invoice items
    const itemsData = items.map(item => ({
      invoice_id: invoiceResult.id,
      owner_user_id: user!.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      line_total: item.line_total
    }))

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemsData)

    if (itemsError) throw itemsError

    toast({
      title: 'Éxito',
      description: `Factura ${invoiceResult.series}-${invoiceResult.number.toString().padStart(4, '0')} creada correctamente.`,
    })

    onSuccess()
    onOpenChange(false)
    resetForm()
  }

  const updateInvoice = async () => {
    if (!invoice) return

    // Update invoice
    const invoiceData = {
      client_id: selectedClientId,
      issue_date: issueDate,
      due_date: dueDate,
      currency: currency,
      subtotal: subtotal,
      tax: totalTax,
      total: total,
      notes: notes.trim() || null
    }

    const { error: invoiceError } = await supabase
      .from('invoices')
      .update(invoiceData)
      .eq('id', invoice.id)

    if (invoiceError) throw invoiceError

    // Delete existing invoice items
    const { error: deleteItemsError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoice.id)

    if (deleteItemsError) throw deleteItemsError

    // Create new invoice items
    const itemsData = items.map(item => ({
      invoice_id: invoice.id,
      owner_user_id: user!.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      line_total: item.line_total
    }))

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemsData)

    if (itemsError) throw itemsError

    toast({
      title: 'Éxito',
      description: `Factura ${invoice.series}-${invoice.number.toString().padStart(4, '0')} actualizada correctamente.`,
    })

    onSuccess()
    onOpenChange(false)
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

  const handleGeneratePaymentLink = async () => {
    if (!invoice || !selectedClientId) {
      toast({
        title: 'Error',
        description: 'La factura debe estar guardada antes de generar el link de pago.',
        variant: 'destructive',
      })
      return
    }

    const selectedClient = clients.find(c => c.id === selectedClientId)
    if (!selectedClient) {
      toast({
        title: 'Error',
        description: 'Cliente no encontrado.',
        variant: 'destructive',
      })
      return
    }

    const result = await generatePaymentLink({
      invoice_id: invoice.id,
      amount: total,
      currency: currency,
      customer: {
        first_name: selectedClient.display_name.split(' ')[0] || 'Cliente',
        last_name: selectedClient.display_name.split(' ').slice(1).join(' ') || '',
        email: 'cliente@ejemplo.com', // This should come from client data
        phone: '', // This should come from client data
      },
      description: `Factura ${invoice.series}-${invoice.number.toString().padStart(4, '0')}`
    })

    if (result.success && result.payment_url) {
      // Update local state or refresh invoice data
      onSuccess()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {invoice ? 'Editar Factura' : 'Nueva Factura'}
          </DialogTitle>
          <DialogDescription>
            {invoice ? 'Modifica los detalles de la factura.' : 'Crea una nueva factura para tu cliente.'}
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

              <div className="space-y-2">
                <Label htmlFor="issue_date">Fecha de Emisión *</Label>
                <Input
                  id="issue_date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Fecha de Vencimiento *</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Invoice Items */}
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
                  <InvoiceItemRow
                    key={index}
                    item={item}
                    products={products}
                    currency={currency}
                    onItemChange={(updatedItem) => handleItemChange(index, updatedItem)}
                    onRemove={() => handleRemoveItem(index)}
                    canRemove={items.length > 1}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Totals */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Impuestos:</span>
                    <span className="font-medium">{formatCurrency(totalTax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales para la factura"
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Payment Link Actions - Only show for existing invoices */}
          {invoice && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={handleGeneratePaymentLink}
                disabled={nmiLoading || !selectedClientId}
                className="flex-1 sm:flex-none"
              >
                {nmiLoading ? (
                  'Generando...'
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Generar Link de Pago
                  </>
                )}
              </Button>
              
              {invoice.payment_link_url && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => copyPaymentLink(invoice.payment_link_url!)}
                    size="sm"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openPaymentLink(invoice.payment_link_url!)}
                    size="sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
          
          {/* Main Actions */}
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || loadingData || !selectedClientId}
            >
              {loading ? 'Guardando...' : invoice ? 'Actualizar Factura' : 'Crear Factura'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

