import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Edit, FileText, CreditCard, Clock, DollarSign, User, Calendar, Mail, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { PaymentStatusBadge } from '@/components/invoices/PaymentStatusBadge'
import { YappyPaymentButton } from '@/components/invoices/YappyPaymentButton'
import { InvoiceDialog } from '@/components/invoices/InvoiceDialog'

interface InvoiceDetail {
  id: string
  series: string
  number: number
  client_id: string
  owner_user_id: string
  issue_date: string
  due_date: string
  status: 'cotizacion' | 'sent' | 'pending' | 'paid' | 'partial' | 'failed' | 'refunded' | 'void' | 'chargeback' | 'payment_review' | 'payment_approved'
  currency: string
  subtotal: number
  tax: number
  total: number
  payment_method?: string
  down_payment_amount?: number
  ach_screenshot_url?: string
  payment_review_notes?: string
  notes?: string
  created_at: string
  client: {
    id: string
    display_name: string
    legal_name?: string
    emails?: string[]
  }
  items: Array<{
    id: string
    description: string
    quantity: number
    unit_price: number
    tax_rate: number
    total: number
  }>
  can_edit?: boolean
  can_revert_to_cotizacion?: boolean
  requires_credit_note?: boolean
  payment_count?: number
  total_paid?: number
}

interface Payment {
  id: string
  paid_at: string | null
  amount: number
  currency: string
  method: string | null
  status: string
  nmi_txn_id?: string | null
  raw_payload?: any
  created_at: string
}

interface AuditLog {
  id: number
  event: string
  actor: string | null
  entity: string | null
  payload: any
  created_at: string
}

export const InvoiceDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [statusChanging, setStatusChanging] = useState(false)
  const [newStatus, setNewStatus] = useState<string>('')
  const [statusNotes, setStatusNotes] = useState('')
  const [showEditDialog, setShowEditDialog] = useState(false)

  const loadInvoiceDetail = async () => {
    if (!user || !id) return

    try {
      setLoading(true)

      // Load invoice with client and items
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          clients!inner(
            id,
            display_name,
            legal_name,
            emails
          )
        `)
        .eq('id', id)
        .eq('owner_user_id', user.id)
        .single()

      if (invoiceError) throw invoiceError

      // Load invoice items
      const { data: itemsData, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', id)

      if (itemsError) throw itemsError

      // Get editability info
      const { data: editabilityData } = await supabase
        .rpc('get_invoice_editability', { p_invoice_id: id })

      const editability = (editabilityData as any)?.[0] || {
        can_edit: false,
        can_revert_to_cotizacion: false,
        requires_credit_note: false,
        payment_count: 0,
        total_paid: 0
      }

      // Transform invoice data
      const transformedInvoice: InvoiceDetail = {
        id: invoiceData.id,
        series: invoiceData.series,
        number: invoiceData.number,
        client_id: invoiceData.client_id,
        owner_user_id: invoiceData.owner_user_id,
        issue_date: invoiceData.issue_date,
        due_date: invoiceData.due_date,
        status: invoiceData.status as InvoiceDetail['status'],
        currency: invoiceData.currency,
        subtotal: parseFloat(invoiceData.subtotal.toString()),
        tax: parseFloat(invoiceData.tax.toString()),
        total: parseFloat(invoiceData.total.toString()),
        payment_method: invoiceData.payment_method || undefined,
        down_payment_amount: invoiceData.down_payment_amount ? parseFloat(invoiceData.down_payment_amount.toString()) : undefined,
        ach_screenshot_url: invoiceData.ach_screenshot_url || undefined,
        payment_review_notes: invoiceData.payment_review_notes || undefined,
        notes: invoiceData.notes || undefined,
        created_at: invoiceData.created_at,
        client: {
          id: invoiceData.clients.id,
          display_name: invoiceData.clients.display_name,
          legal_name: invoiceData.clients.legal_name || undefined,
          emails: invoiceData.clients.emails || []
        },
        items: (itemsData || []).map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: parseFloat((item.unit_price || 0).toString()),
          tax_rate: parseFloat((item.tax_rate || 0).toString()),
          total: parseFloat((item.line_total || 0).toString())
        })),
        can_edit: editability.can_edit,
        can_revert_to_cotizacion: editability.can_revert_to_cotizacion,
        requires_credit_note: editability.requires_credit_note,
        payment_count: editability.payment_count,
        total_paid: editability.total_paid ? parseFloat(editability.total_paid.toString()) : 0
      }

      setInvoice(transformedInvoice)
      setNewStatus(transformedInvoice.status)

      // Load payments
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', id)
        .order('created_at', { ascending: false })

      if (paymentsData) {
        const transformedPayments = paymentsData.map(payment => ({
          id: payment.id,
          paid_at: payment.paid_at,
          amount: parseFloat((payment.amount || 0).toString()),
          currency: payment.currency,
          method: payment.method,
          status: payment.status,
          nmi_txn_id: payment.nmi_txn_id,
          raw_payload: payment.raw_payload,
          created_at: payment.created_at
        }))
        setPayments(transformedPayments)
      }

      // Load audit logs
      const { data: logsData } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity', `invoice:${id}`)
        .order('created_at', { ascending: false })

      if (logsData) {
        setLogs(logsData)
      }

    } catch (error) {
      console.error('Error loading invoice detail:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cargar la información de la factura.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async () => {
    if (!invoice || !newStatus || newStatus === invoice.status) return

    try {
      setStatusChanging(true)

      // Update invoice status directly
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoice.id)

      if (updateError) throw updateError

      // Log the status change
      const { error: logError } = await supabase
        .from('audit_logs')
        .insert({
          owner_user_id: invoice.owner_user_id,
          event: 'invoice_status_changed',
          actor: 'user:system',
          entity: `invoice:${invoice.id}`,
          payload: {
            old_status: invoice.status,
            new_status: newStatus,
            notes: statusNotes || null
          }
        })

      if (logError) {
        console.error('Error logging status change:', logError)
      }

      toast({
        title: 'Estado actualizado',
        description: 'El estado de la factura se actualizó correctamente.',
      })
      setStatusNotes('')
      loadInvoiceDetail() // Reload to get updated data

    } catch (error) {
      console.error('Error updating status:', error)
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado.',
        variant: 'destructive',
      })
    } finally {
      setStatusChanging(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'PAB'
    }).format(amount)
  }

  const formatPaymentStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'Pendiente',
      'paid': 'Pagado',
      'partial': 'Pago Parcial',
      'failed': 'Fallido',
      'refunded': 'Reembolsado',
      'void': 'Anulado',
      'chargeback': 'Contracargo'
    }
    return statusMap[status] || status
  }

  const formatPaymentMethod = (method: string | null) => {
    if (!method) return 'No especificado'
    const methodMap: Record<string, string> = {
      'nmi': 'Tarjeta de Crédito',
      'ach': 'Transferencia ACH',
      'wire': 'Transferencia Bancaria',
      'cash': 'Efectivo',
      'check': 'Cheque'
    }
    return methodMap[method] || method
  }

  const copyPublicLink = () => {
    const publicUrl = `${window.location.origin}/invoice/${invoice?.id}`
    navigator.clipboard.writeText(publicUrl)
    toast({
      title: 'Enlace copiado',
      description: 'El enlace público se copió al portapapeles.',
    })
  }

  const openPublicLink = () => {
    const publicUrl = `${window.location.origin}/invoice/${invoice?.id}`
    window.open(publicUrl, '_blank')
  }

  useEffect(() => {
    loadInvoiceDetail()
  }, [user, id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando factura...</p>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-muted-foreground">Factura no encontrada</p>
          <Button onClick={() => navigate('/invoices')} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Facturas
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/invoices')}
            className="flex items-center"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              Factura {invoice.series}-{invoice.number.toString().padStart(4, '0')}
            </h1>
            <p className="text-muted-foreground">
              {invoice.client.display_name} • {formatCurrency(invoice.total, invoice.currency)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <PaymentStatusBadge status={invoice.status as any} />
          {invoice.can_edit && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowEditDialog(true)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copyPublicLink}>
          <Copy className="mr-2 h-4 w-4" />
          Copiar Enlace
        </Button>
        <Button variant="outline" size="sm" onClick={openPublicLink}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Abrir Enlace
        </Button>
        {invoice.requires_credit_note && (
          <Button variant="outline" size="sm">
            <FileText className="mr-2 h-4 w-4" />
            Crear Nota de Crédito
          </Button>
        )}
        
        {/* Yappy Payment Button - Show for pending and partial invoices */}
        {(invoice.status === 'pending' || invoice.status === 'partial') && (
          <div className="flex items-center">
            <YappyPaymentButton
              invoiceId={invoice.id}
              amount={invoice.total}
              currency={invoice.currency}
              clientId={invoice.client_id}
              invoiceStatus={invoice.status}
              totalPaid={invoice.total_paid || 0}
              onSuccess={() => {
                toast({
                  title: 'Pago exitoso',
                  description: 'El pago con Yappy se ha procesado correctamente',
                })
                // Reload invoice to update status
                loadInvoiceDetail()
              }}
              onError={(error) => {
                toast({
                  title: 'Error en el pago',
                  description: error,
                  variant: 'destructive',
                })
              }}
            />
          </div>
        )}
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="payments">
            Pagos
            {invoice.payment_count && invoice.payment_count > 0 && (
              <Badge variant="secondary" className="ml-2">
                {invoice.payment_count}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs">Historial</TabsTrigger>
          <TabsTrigger value="status">Estado</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Invoice Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Información de la Factura
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Número</label>
                    <p className="font-medium">{invoice.series}-{invoice.number.toString().padStart(4, '0')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Estado</label>
                    <div className="mt-1">
                      <PaymentStatusBadge status={invoice.status as any} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fecha de Emisión</label>
                    <p className="flex items-center">
                      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                      {new Date(invoice.issue_date).toLocaleDateString('es-PA')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fecha de Vencimiento</label>
                    <p className={`flex items-center ${new Date(invoice.due_date) < new Date() && !['paid', 'void'].includes(invoice.status) ? 'text-red-600 font-medium' : ''}`}>
                      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                      {new Date(invoice.due_date).toLocaleDateString('es-PA')}
                    </p>
                  </div>
                </div>
                
                {invoice.notes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Notas</label>
                    <p className="text-sm bg-muted p-2 rounded">{invoice.notes}</p>
                  </div>
                )}

                {invoice.payment_review_notes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Notas de Revisión</label>
                    <p className="text-sm bg-yellow-50 border border-yellow-200 p-2 rounded">{invoice.payment_review_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Client Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Información del Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nombre</label>
                  <p className="font-medium">{invoice.client.display_name}</p>
                  {invoice.client.legal_name && invoice.client.legal_name !== invoice.client.display_name && (
                    <p className="text-sm text-muted-foreground">{invoice.client.legal_name}</p>
                  )}
                </div>

                {invoice.client.emails && invoice.client.emails.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    {invoice.client.emails.map((email, index) => (
                      <p key={index} className="flex items-center">
                        <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                        {email}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle>Artículos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoice.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} x {formatCurrency(item.unit_price, invoice.currency)}
                        {item.tax_rate > 0 && ` (${item.tax_rate}% impuesto)`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(item.total, invoice.currency)}</p>
                    </div>
                  </div>
                ))}

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Impuestos:</span>
                    <span>{formatCurrency(invoice.tax, invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>{formatCurrency(invoice.total, invoice.currency)}</span>
                  </div>
                  {invoice.down_payment_amount && invoice.down_payment_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Pagado:</span>
                      <span>{formatCurrency(invoice.down_payment_amount, invoice.currency)}</span>
                    </div>
                  )}
                  {invoice.down_payment_amount && invoice.down_payment_amount < invoice.total && (
                    <div className="flex justify-between text-orange-600 font-medium">
                      <span>Pendiente:</span>
                      <span>{formatCurrency(invoice.total - invoice.down_payment_amount, invoice.currency)}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Pagos Asociados
                {invoice.payment_count && invoice.payment_count > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {invoice.payment_count} pagos • {formatCurrency(invoice.total_paid || 0, invoice.currency)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length > 0 ? (
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div key={payment.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant={payment.status === 'paid' ? 'default' : payment.status === 'pending' ? 'secondary' : 'destructive'}>
                              {formatPaymentStatus(payment.status)}
                            </Badge>
                            <Badge variant="outline">{formatPaymentMethod(payment.method)}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <Clock className="inline mr-1 h-4 w-4" />
                            {new Date(payment.paid_at).toLocaleString('es-PA')}
                          </p>
                          {payment.nmi_txn_id && (
                            <p className="text-sm text-muted-foreground">
                              ID Transacción: {payment.nmi_txn_id}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {formatCurrency(payment.amount, payment.currency)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No hay pagos registrados para esta factura</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                Historial de Cambios
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length > 0 ? (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="border-l-4 border-primary pl-4 py-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{log.event}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(log.created_at).toLocaleString('es-PA')}
                          </p>
                        </div>
                      </div>
                      {log.payload && (
                        <div className="mt-2 text-sm">
                          <p className="text-muted-foreground">Detalles:</p>
                          <div className="bg-muted p-2 rounded text-xs font-mono">
                            <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No hay registros de cambios para esta factura</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5" />
                Gestión de Estado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Estado Actual</label>
                  <div className="mt-1">
                    <PaymentStatusBadge status={invoice.status as any} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Nuevo Estado</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cotizacion">Cotización</SelectItem>
                      <SelectItem value="sent">Enviada</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="paid">Pagada</SelectItem>
                      <SelectItem value="partial">Parcial</SelectItem>
                      <SelectItem value="payment_review">En Revisión</SelectItem>
                      <SelectItem value="payment_approved">Pago Aprobado</SelectItem>
                      <SelectItem value="void">Anulada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notas (opcional)</label>
                <Textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Agregar notas sobre el cambio de estado..."
                  className="mt-1"
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={handleStatusChange}
                  disabled={statusChanging || newStatus === invoice.status}
                  className="flex-1"
                >
                  {statusChanging ? 'Actualizando...' : 'Actualizar Estado'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewStatus(invoice.status)
                    setStatusNotes('')
                  }}
                >
                  Cancelar
                </Button>
              </div>

              {/* Business Rules Info */}
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Reglas de Negocio:</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Solo facturas en "Cotización" sin pagos pueden ser editadas</li>
                  <li>• No se puede cambiar a "Cotización" si hay pagos registrados</li>
                  <li>• Facturas con pagos requieren nota de crédito para modificaciones</li>
                </ul>
              </div>

              {/* Current Status Info */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Puede Editar</p>
                  <p className="font-bold text-blue-600">
                    {invoice.can_edit ? 'Sí' : 'No'}
                  </p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Requiere Nota de Crédito</p>
                  <p className="font-bold text-orange-600">
                    {invoice.requires_credit_note ? 'Sí' : 'No'}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Pagos</p>
                  <p className="font-bold text-green-600">
                    {invoice.payment_count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Invoice Dialog */}
      <InvoiceDialog
        invoice={invoice}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={() => {
          loadInvoiceDetail()
          setShowEditDialog(false)
        }}
      />
    </div>
  )
}
