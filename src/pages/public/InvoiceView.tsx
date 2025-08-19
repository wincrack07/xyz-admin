import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { CreditCard, DollarSign } from 'lucide-react'

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
  payment_method: 'credit_card' | 'ach'
  down_payment_amount: number
  ach_screenshot_url?: string
  payment_review_notes?: string
  notes?: string
  client: {
    display_name: string
    legal_name?: string
    emails: string[]
  }
  invoice_items: {
    description: string
    quantity: number
    unit_price: number
    tax_rate: number
    line_total: number
  }[]
}

interface PaymentForm {
  first_name: string
  last_name: string
  email: string
  phone: string
  payment_method: 'credit_card' | 'ach'
  ccnumber: string
  ccexp: string
  cvv: string
  address1: string
  city: string
  state: string
  zip: string
  country: string
  ach_screenshot?: File
}

export const InvoiceView = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const { toast } = useToast()

  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    payment_method: 'credit_card',
    ccnumber: '',
    ccexp: '',
    cvv: '',
    address1: '',
    city: '',
    state: '',
    zip: '',
    country: ''
  })

  useEffect(() => {
    if (invoiceId && typeof invoiceId === 'string') {
      loadInvoice()
    }
  }, [invoiceId])

  const loadInvoice = async () => {
    try {
      setLoading(true)
      
      // Get invoice with client and items - using public access
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          id,
          series,
          number,
          client_id,
          issue_date,
          due_date,
          status,
          currency,
          subtotal,
          tax,
          total,
          payment_method,
          down_payment_amount,
          ach_screenshot_url,
          payment_review_notes,
          notes
        `)
        .eq('id', invoiceId)
        .single()

      if (invoiceError) {
        throw invoiceError
      }

      // Get client data separately
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('display_name, legal_name, emails')
        .eq('id', invoiceData.client_id!)
        .single()

      if (clientError) {
        console.error('Error loading client:', clientError)
      }

      // Get invoice items separately
      const { data: itemsData, error: itemsError } = await supabase
        .from('invoice_items')
        .select('description, quantity, unit_price, tax_rate, line_total')
        .eq('invoice_id', invoiceId!)

      if (itemsError) {
        console.error('Error loading invoice items:', itemsError)
      }

      // Combine the data
      const combinedInvoice: Invoice = {
        ...invoiceData,
        notes: invoiceData.notes || undefined,
        payment_method: (invoiceData.payment_method as 'credit_card' | 'ach') || 'credit_card',
        down_payment_amount: invoiceData.down_payment_amount || 0,
        ach_screenshot_url: invoiceData.ach_screenshot_url || undefined,
        payment_review_notes: invoiceData.payment_review_notes || undefined,
        client: clientData ? {
          display_name: clientData.display_name,
          legal_name: clientData.legal_name || undefined,
          emails: clientData.emails || []
        } : { display_name: 'Cliente no encontrado', legal_name: undefined, emails: [] },
        invoice_items: itemsData || []
      }

      setInvoice(combinedInvoice)
    } catch (error) {
      console.error('Error loading invoice:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cargar la factura.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoice) return

    try {
      setProcessing(true)

      if (paymentForm.payment_method === 'ach') {
        // For ACH payments, use the dedicated Edge Function
        if (!paymentForm.ach_screenshot) {
          throw new Error('Debes subir una imagen del comprobante de pago')
        }

        // Create form data for the Edge Function
        const formData = new FormData()
        formData.append('invoice_id', invoice.id)
        formData.append('screenshot_file', paymentForm.ach_screenshot)

        const { data, error } = await supabase.functions.invoke('submit-ach-payment', {
          body: formData,
        })

        if (error) {
          throw error
        }

        if (!data.success) {
          throw new Error(data.error || 'Error al procesar el pago ACH')
        }

        toast({
          title: 'Pago ACH Enviado',
          description: 'Tu pago ACH ha sido enviado y está en revisión.',
        })

        // Reload invoice to show updated status
        await loadInvoice()
        setShowPaymentForm(false)
        return
      }

      // For credit card payments, use the existing NMI flow
      let paymentData: any = {
        invoice_id: invoice.id,
        amount: invoice.total - invoice.down_payment_amount, // Amount after down payment
        currency: invoice.currency,
        customer: {
          first_name: paymentForm.first_name,
          last_name: paymentForm.last_name,
          email: paymentForm.email,
          phone: paymentForm.phone,
          address: {
            line1: paymentForm.address1,
            city: paymentForm.city,
            state: paymentForm.state,
            zip: paymentForm.zip,
            country: paymentForm.country
          }
        },
        description: `Factura ${invoice.series}-${invoice.number.toString().padStart(4, '0')}`,
        payment: {
          ccnumber: paymentForm.ccnumber,
          ccexp: paymentForm.ccexp,
          cvv: paymentForm.cvv
        }
      }

      const { data, error } = await supabase.functions.invoke('generate-nmi-payment-link', {
        body: paymentData,
      })

      if (error) {
        throw error
      }

      if (!data.success) {
        throw new Error(data.error || 'Error al procesar el pago')
      }

      // Show appropriate message based on payment result
      if (paymentForm.payment_method === 'ach') {
        toast({
          title: 'Pago ACH Enviado',
          description: 'Tu pago ACH ha sido enviado y está en revisión.',
        })
      } else if (data.status === 'paid') {
        toast({
          title: 'Pago Completado',
          description: `Factura pagada completamente. Transacción: ${data.transaction_id}`,
        })
      } else if (data.status === 'partial') {
        toast({
          title: 'Pago Parcial Exitoso',
          description: `Pagado: ${formatCurrency(data.amount_paid, invoice.currency)}. Restante: ${formatCurrency(data.remaining_balance, invoice.currency)}`,
        })
      } else {
        toast({
          title: 'Pago Exitoso',
          description: `Transacción procesada: ${data.transaction_id}`,
        })
      }

      // Reload invoice to show updated status
      await loadInvoice()
      setShowPaymentForm(false)

    } catch (error) {
      console.error('Error processing payment:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al procesar el pago',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      cotizacion: { label: 'Cotización', variant: 'secondary' as const },
      sent: { label: 'Enviada', variant: 'default' as const },
      pending: { label: 'Pendiente', variant: 'default' as const },
      paid: { label: 'Pagada', variant: 'default' as const },
      partial: { label: 'Pago Parcial', variant: 'secondary' as const },
      failed: { label: 'Fallida', variant: 'destructive' as const },
      refunded: { label: 'Reembolsada', variant: 'secondary' as const },
      void: { label: 'Anulada', variant: 'destructive' as const },
      chargeback: { label: 'Contracargo', variant: 'destructive' as const },
      payment_review: { label: 'En Revisión', variant: 'secondary' as const },
      payment_approved: { label: 'Pago Aprobado', variant: 'default' as const }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.cotizacion
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-PA')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">Factura no encontrada</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Factura {invoice.series}-{invoice.number.toString().padStart(4, '0')}
              </h1>
              <p className="text-gray-600 mt-2">
                {invoice.client.display_name}
              </p>
            </div>
            <div className="text-right">
              {getStatusBadge(invoice.status)}
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(invoice.total, invoice.currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Invoice Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Detalles de la Factura</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-600">Fecha de Emisión</p>
                    <p className="font-medium">{formatDate(invoice.issue_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Fecha de Vencimiento</p>
                    <p className="font-medium">{formatDate(invoice.due_date)}</p>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Invoice Items */}
                <div className="space-y-4">
                  {invoice.invoice_items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-gray-600">
                          {item.quantity} x {formatCurrency(item.unit_price, invoice.currency)}
                          {item.tax_rate > 0 && ` (${item.tax_rate}% impuesto)`}
                        </p>
                      </div>
                      <p className="font-medium">
                        {formatCurrency(item.line_total, invoice.currency)}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator className="my-6" />

                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Impuestos:</span>
                    <span>{formatCurrency(invoice.tax, invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(invoice.total, invoice.currency)}</span>
                  </div>
                </div>

                {invoice.notes && (
                  <>
                    <Separator className="my-6" />
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Notas:</p>
                      <p className="text-sm">{invoice.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Section */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Pago</CardTitle>
              </CardHeader>
              <CardContent>
                                 {invoice.status === 'paid' ? (
                   <div className="text-center py-8">
                     <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                       <DollarSign className="w-8 h-8 text-green-600" />
                     </div>
                     <h3 className="text-lg font-semibold text-green-600 mb-2">Factura Pagada</h3>
                     <p className="text-sm text-gray-600">Esta factura ya ha sido pagada.</p>
                   </div>
                 ) : invoice.status === 'payment_review' ? (
                   <div className="text-center py-8">
                     <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                       <DollarSign className="w-8 h-8 text-yellow-600" />
                     </div>
                     <h3 className="text-lg font-semibold text-yellow-600 mb-2">Pago en Revisión</h3>
                     <p className="text-sm text-gray-600">Tu pago está siendo revisado por nuestro equipo.</p>
                     {invoice.payment_review_notes && (
                       <p className="text-sm text-gray-500 mt-2">{invoice.payment_review_notes}</p>
                     )}
                   </div>
                 ) : invoice.status === 'partial' ? (
                   <div className="text-center py-8">
                     <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                       <DollarSign className="w-8 h-8 text-orange-600" />
                     </div>
                     <h3 className="text-lg font-semibold text-orange-600 mb-2">Pago Parcial Realizado</h3>
                     <p className="text-sm text-gray-600 mb-4">
                       Has realizado un pago parcial de {formatCurrency(invoice.down_payment_amount || 0, invoice.currency)}.
                     </p>
                     <div className="bg-gray-50 p-4 rounded-lg mb-4">
                       <p className="text-sm text-gray-600">Deuda restante:</p>
                       <p className="text-xl font-bold text-red-600">
                         {formatCurrency(invoice.total - (invoice.down_payment_amount || 0), invoice.currency)}
                       </p>
                     </div>
                     <div className="space-y-3">
                       <Button 
                         onClick={() => {
                           setPaymentForm({...paymentForm, payment_method: 'credit_card'})
                           setShowPaymentForm(true)
                         }}
                         className="w-full"
                         size="lg"
                       >
                         <CreditCard className="w-4 h-4 mr-2" />
                         Pagar Restante con Tarjeta
                       </Button>
                       <Button 
                         onClick={() => {
                           setPaymentForm({...paymentForm, payment_method: 'ach'})
                           setShowPaymentForm(true)
                         }}
                         variant="outline"
                         className="w-full"
                         size="lg"
                       >
                         <DollarSign className="w-4 h-4 mr-2" />
                         Pagar Restante con ACH
                       </Button>
                     </div>
                   </div>
                 ) : (
                   <div>
                     <div className="mb-6">
                       {invoice.down_payment_amount > 0 ? (
                         <>
                           <p className="text-sm text-gray-600 mb-2">Monto restante a pagar:</p>
                           <p className="text-2xl font-bold text-red-600">
                             {formatCurrency(invoice.total - invoice.down_payment_amount, invoice.currency)}
                           </p>
                           <div className="mt-2 text-sm text-gray-600">
                             <p>Total de la factura: {formatCurrency(invoice.total, invoice.currency)}</p>
                             <p>Ya pagado: {formatCurrency(invoice.down_payment_amount, invoice.currency)}</p>
                           </div>
                         </>
                       ) : (
                         <>
                           <p className="text-sm text-gray-600 mb-2">Monto a pagar:</p>
                           <p className="text-2xl font-bold">{formatCurrency(invoice.total, invoice.currency)}</p>
                         </>
                       )}
                     </div>

                     {!showPaymentForm ? (
                       <div className="space-y-3">
                         <Button 
                           onClick={() => {
                             setPaymentForm({...paymentForm, payment_method: 'credit_card'})
                             setShowPaymentForm(true)
                           }}
                           className="w-full"
                           size="lg"
                         >
                           <CreditCard className="w-4 h-4 mr-2" />
                           Pagar con Tarjeta
                         </Button>
                         <Button 
                           onClick={() => {
                             setPaymentForm({...paymentForm, payment_method: 'ach'})
                             setShowPaymentForm(true)
                           }}
                           variant="outline"
                           className="w-full"
                           size="lg"
                         >
                           <DollarSign className="w-4 h-4 mr-2" />
                           Pagar con ACH
                         </Button>
                       </div>
                     ) : (
                                             <form onSubmit={handlePayment} className="space-y-4">
                         {/* Payment Method Selection */}
                         <div>
                           <label className="block text-sm font-medium mb-2">Método de Pago</label>
                           <div className="flex gap-4">
                             <label className="flex items-center">
                               <input
                                 type="radio"
                                 name="payment_method"
                                 value="credit_card"
                                 checked={paymentForm.payment_method === 'credit_card'}
                                 onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value as 'credit_card' | 'ach'})}
                                 className="mr-2"
                               />
                               Tarjeta de Crédito
                             </label>
                             <label className="flex items-center">
                               <input
                                 type="radio"
                                 name="payment_method"
                                 value="ach"
                                 checked={paymentForm.payment_method === 'ach'}
                                 onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value as 'credit_card' | 'ach'})}
                                 className="mr-2"
                               />
                               ACH (Transferencia Bancaria)
                             </label>
                           </div>
                         </div>

                         {/* Only show customer fields if client doesn't have contact info */}
                         {(!invoice.client.emails || invoice.client.emails.length === 0) && (
                           <>
                             <div className="grid grid-cols-2 gap-4">
                               <div>
                                 <label className="block text-sm font-medium mb-1">Nombre</label>
                                 <input
                                   type="text"
                                   required
                                   value={paymentForm.first_name}
                                   onChange={(e) => setPaymentForm({...paymentForm, first_name: e.target.value})}
                                   className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                 />
                               </div>
                               <div>
                                 <label className="block text-sm font-medium mb-1">Apellido</label>
                                 <input
                                   type="text"
                                   required
                                   value={paymentForm.last_name}
                                   onChange={(e) => setPaymentForm({...paymentForm, last_name: e.target.value})}
                                   className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                 />
                               </div>
                             </div>

                             <div>
                               <label className="block text-sm font-medium mb-1">Email</label>
                               <input
                                 type="email"
                                 required
                                 value={paymentForm.email}
                                 onChange={(e) => setPaymentForm({...paymentForm, email: e.target.value})}
                                 className="w-full px-3 py-2 border border-gray-300 rounded-md"
                               />
                             </div>

                             <div>
                               <label className="block text-sm font-medium mb-1">Teléfono</label>
                               <input
                                 type="tel"
                                 value={paymentForm.phone}
                                 onChange={(e) => setPaymentForm({...paymentForm, phone: e.target.value})}
                                 className="w-full px-3 py-2 border border-gray-300 rounded-md"
                               />
                             </div>
                           </>
                         )}

                         {/* Credit Card Fields */}
                         {paymentForm.payment_method === 'credit_card' && (
                           <>
                             <div>
                               <label className="block text-sm font-medium mb-1">Número de Tarjeta</label>
                               <input
                                 type="text"
                                 required
                                 value={paymentForm.ccnumber}
                                 onChange={(e) => setPaymentForm({...paymentForm, ccnumber: e.target.value})}
                                 className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                 placeholder="1234 5678 9012 3456"
                               />
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                               <div>
                                 <label className="block text-sm font-medium mb-1">Vencimiento</label>
                                 <input
                                   type="text"
                                   required
                                   value={paymentForm.ccexp}
                                   onChange={(e) => setPaymentForm({...paymentForm, ccexp: e.target.value})}
                                   className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                   placeholder="MM/YY"
                                 />
                               </div>
                               <div>
                                 <label className="block text-sm font-medium mb-1">CVV</label>
                                 <input
                                   type="text"
                                   required
                                   value={paymentForm.cvv}
                                   onChange={(e) => setPaymentForm({...paymentForm, cvv: e.target.value})}
                                   className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                   placeholder="123"
                                 />
                               </div>
                             </div>
                           </>
                         )}

                         {/* ACH Fields */}
                         {paymentForm.payment_method === 'ach' && (
                           <div>
                             <label className="block text-sm font-medium mb-1">Screenshot del Pago *</label>
                             <input
                               type="file"
                               accept="image/*"
                               required
                               onChange={(e) => setPaymentForm({...paymentForm, ach_screenshot: e.target.files?.[0]})}
                               className="w-full px-3 py-2 border border-gray-300 rounded-md"
                             />
                             <p className="text-xs text-gray-500 mt-1">Sube una imagen del comprobante de transferencia bancaria</p>
                           </div>
                         )}

                         <div>
                           <label className="block text-sm font-medium mb-1">Dirección</label>
                           <input
                             type="text"
                             value={paymentForm.address1}
                             onChange={(e) => setPaymentForm({...paymentForm, address1: e.target.value})}
                             className="w-full px-3 py-2 border border-gray-300 rounded-md"
                           />
                         </div>

                         <div className="grid grid-cols-3 gap-4">
                           <div>
                             <label className="block text-sm font-medium mb-1">Ciudad</label>
                             <input
                               type="text"
                               value={paymentForm.city}
                               onChange={(e) => setPaymentForm({...paymentForm, city: e.target.value})}
                               className="w-full px-3 py-2 border border-gray-300 rounded-md"
                             />
                           </div>
                           <div>
                             <label className="block text-sm font-medium mb-1">Estado</label>
                             <input
                               type="text"
                               value={paymentForm.state}
                               onChange={(e) => setPaymentForm({...paymentForm, state: e.target.value})}
                               className="w-full px-3 py-2 border border-gray-300 rounded-md"
                             />
                           </div>
                           <div>
                             <label className="block text-sm font-medium mb-1">Código Postal</label>
                             <input
                               type="text"
                               value={paymentForm.zip}
                               onChange={(e) => setPaymentForm({...paymentForm, zip: e.target.value})}
                               className="w-full px-3 py-2 border border-gray-300 rounded-md"
                             />
                           </div>
                         </div>

                         <div className="flex gap-2">
                           <Button
                             type="button"
                             variant="outline"
                             onClick={() => setShowPaymentForm(false)}
                             className="flex-1"
                           >
                             Cancelar
                           </Button>
                           <Button
                             type="submit"
                             disabled={processing}
                             className="flex-1"
                           >
                             {processing ? 'Procesando...' : paymentForm.payment_method === 'ach' ? 'Enviar Pago ACH' : 'Pagar'}
                           </Button>
                         </div>
                       </form>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
