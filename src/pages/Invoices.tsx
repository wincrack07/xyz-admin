import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Plus, Search, FileText, Calendar, DollarSign, Edit, Trash2, MoreHorizontal, Send, Link as LinkIcon, Download, Copy, ExternalLink, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useToast } from '@/hooks/use-toast'

import { InvoiceDialog } from '@/components/invoices/InvoiceDialog'
import { DeleteInvoiceDialog } from '@/components/invoices/DeleteInvoiceDialog'
import { PaymentStatusBadge } from '@/components/invoices/PaymentStatusBadge'

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
  payment_method?: 'credit_card' | 'ach'
  down_payment_amount?: number
  ach_screenshot_url?: string
  payment_review_notes?: string
  notes?: string
  client: {
    display_name: string
    legal_name?: string
  }
  conciliation_status?: 'pending' | 'partial' | 'complete' | 'cancelled'
  conciliated_amount?: number
  created_at: string
  // Editability info
  can_edit?: boolean
  can_revert_to_cotizacion?: boolean
  requires_credit_note?: boolean
  payment_count?: number
  total_paid?: number
}

export const Invoices = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedPeriod, setSelectedPeriod] = useState('30')

  // Statistics
  const [totalInvoiced, setTotalInvoiced] = useState(0)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [invoiceCount, setInvoiceCount] = useState(0)

  // Dialog states
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)

  const loadInvoices = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      
      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - parseInt(selectedPeriod))

      let query = supabase
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
          notes,
          conciliation_status,
          conciliated_amount,
          created_at,
          clients!inner(display_name, legal_name)
        `)
        .eq('owner_user_id', user.id)
        .gte('issue_date', startDate.toISOString().split('T')[0])
        .lte('issue_date', endDate.toISOString().split('T')[0])

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as Invoice['status'])
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      // Transform data and get editability info
      const transformedInvoices: Invoice[] = await Promise.all((data || []).map(async (inv) => {
        // Get editability info for each invoice
        const { data: editabilityData } = await supabase
          .rpc('get_invoice_editability', { p_invoice_id: inv.id })

        const editability = (editabilityData as any)?.[0] || {
          can_edit: false,
          can_revert_to_cotizacion: false,
          requires_credit_note: false,
          current_status: inv.status,
          payment_count: 0,
          total_paid: 0
        }

        return {
          id: inv.id,
          series: inv.series,
          number: inv.number,
          client_id: inv.client_id,
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          status: inv.status as Invoice['status'],
          currency: inv.currency,
          subtotal: parseFloat(inv.subtotal.toString()),
          tax: parseFloat(inv.tax.toString()),
          total: parseFloat(inv.total.toString()),
          payment_method: inv.payment_method as 'credit_card' | 'ach' | undefined,
          down_payment_amount: inv.down_payment_amount ? parseFloat(inv.down_payment_amount.toString()) : undefined,
          ach_screenshot_url: inv.ach_screenshot_url || undefined,
          payment_review_notes: inv.payment_review_notes || undefined,
          notes: inv.notes || undefined,
          conciliation_status: inv.conciliation_status || undefined,
          conciliated_amount: inv.conciliated_amount ? parseFloat(inv.conciliated_amount.toString()) : undefined,
          created_at: inv.created_at,
          client: {
            display_name: inv.clients?.display_name || '',
            legal_name: inv.clients?.legal_name || undefined
          },
          // Editability info
          can_edit: editability.can_edit,
          can_revert_to_cotizacion: editability.can_revert_to_cotizacion,
          requires_credit_note: editability.requires_credit_note,
          payment_count: editability.payment_count,
          total_paid: parseFloat(editability.total_paid.toString())
        }
      }))

      // Filter by search term if provided
      let filteredInvoices = transformedInvoices
      if (searchTerm) {
        filteredInvoices = transformedInvoices.filter(invoice =>
          invoice.client.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.client.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          `${invoice.series}-${invoice.number.toString().padStart(4, '0')}`.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      setInvoices(filteredInvoices)
      
      // Calculate statistics
      const total = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0)
      const pending = filteredInvoices.filter(inv => ['sent', 'pending'].includes(inv.status)).reduce((sum, inv) => sum + inv.total, 0)
      const paid = filteredInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0)
      
      setTotalInvoiced(total)
      setPendingAmount(pending)
      setPaidAmount(paid)
      setInvoiceCount(filteredInvoices.length)

    } catch (error) {
      console.error('Error loading invoices:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las facturas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [user, selectedPeriod, statusFilter, searchTerm, toast])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }



  const handleNewInvoice = () => {
    setSelectedInvoice(null)
    setInvoiceDialogOpen(true)
  }

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setInvoiceDialogOpen(true)
  }

  const handleDeleteInvoice = (invoice: Invoice) => {
    setInvoiceToDelete(invoice)
    setDeleteDialogOpen(true)
  }

  const handleInvoiceSuccess = () => {
    loadInvoices()
  }

  const handleRevertToCotizacion = async (invoice: Invoice) => {
    try {
      const { data, error } = await supabase
        .rpc('revert_invoice_to_cotizacion', { p_invoice_id: invoice.id })

      if (error) throw error

      if (data) {
        toast({
          title: 'Estado actualizado',
          description: 'La factura ha sido revertida a cotización.',
        })
        loadInvoices()
      } else {
        toast({
          title: 'Error',
          description: 'No se puede revertir una factura que tiene pagos.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error reverting invoice:', error)
      toast({
        title: 'Error',
        description: 'No se pudo revertir la factura.',
        variant: 'destructive',
      })
    }
  }

  const handleCreateCreditNote = (_invoice: Invoice) => {
    // TODO: Implement credit note creation
    toast({
      title: 'Funcionalidad pendiente',
      description: 'La creación de notas de crédito se implementará próximamente.',
    })
  }

  const handleViewInvoice = (invoice: Invoice) => {
    navigate(`/invoices/${invoice.id}`)
  }

  const handleSendInvoice = async () => {
    // TODO: Implement email sending
    toast({
      title: 'Funcionalidad pendiente',
      description: 'El envío de facturas por email se implementará próximamente.',
    })
  }

  const handleCopyPaymentLink = async (invoice: Invoice) => {
    const publicUrl = `${window.location.origin}/invoice/${invoice.id}`
    
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast({
        title: 'Enlace copiado',
        description: 'El enlace público se copió al portapapeles.',
      })
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el enlace.',
        variant: 'destructive',
      })
    }
  }

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation
    toast({
      title: 'Funcionalidad pendiente',
      description: 'La descarga de PDFs se implementará próximamente.',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Facturas</h1>
          <p className="text-muted-foreground">
            Gestiona y controla todas tus facturas
          </p>
        </div>
        <Button onClick={handleNewInvoice}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Factura
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Facturado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalInvoiced, 'PAB')}
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos {selectedPeriod} días
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Cobrar</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(pendingAmount, 'PAB')}
            </div>
            <p className="text-xs text-muted-foreground">
              Facturas pendientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobrado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(paidAmount, 'PAB')}
            </div>
            <p className="text-xs text-muted-foreground">
              Facturas pagadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Facturas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoiceCount}</div>
            <p className="text-xs text-muted-foreground">
              Facturas emitidas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Facturas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar facturas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="cotizacion">Cotización</SelectItem>
                <SelectItem value="sent">Enviada</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="paid">Pagada</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
                <SelectItem value="failed">Fallida</SelectItem>
                <SelectItem value="void">Anulada</SelectItem>
                <SelectItem value="payment_review">En Revisión</SelectItem>
                <SelectItem value="payment_approved">Aprobada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="90">Últimos 90 días</SelectItem>
                <SelectItem value="365">Último año</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando facturas...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Enlace Público</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[50px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.series}-{invoice.number.toString().padStart(4, '0')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.client.display_name}</div>
                        {invoice.client.legal_name && invoice.client.legal_name !== invoice.client.display_name && (
                          <div className="text-sm text-muted-foreground">{invoice.client.legal_name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.issue_date).toLocaleDateString('es-PA')}
                    </TableCell>
                    <TableCell>
                      <div className={`${new Date(invoice.due_date) < new Date() && !['paid', 'void'].includes(invoice.status) ? 'text-red-600 font-medium' : ''}`}>
                        {new Date(invoice.due_date).toLocaleDateString('es-PA')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={invoice.status as any} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const publicUrl = `${window.location.origin}/invoice/${invoice.id}`
                            navigator.clipboard.writeText(publicUrl)
                            toast({
                              title: 'Enlace copiado',
                              description: 'Enlace público copiado al portapapeles.',
                            })
                          }}
                          className="h-8 w-8 p-0"
                          title="Copiar enlace público"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const publicUrl = `${window.location.origin}/invoice/${invoice.id}`
                            window.open(publicUrl, '_blank')
                          }}
                          className="h-8 w-8 p-0"
                          title="Abrir enlace público"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </div>
                      {invoice.conciliated_amount && invoice.conciliated_amount !== invoice.total && (
                        <div className="text-sm text-muted-foreground">
                          Conciliado: {formatCurrency(invoice.conciliated_amount, invoice.currency)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* View details - always available */}
                          <DropdownMenuItem onClick={() => handleViewInvoice(invoice)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalles
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          {/* Edit option - only if can_edit is true */}
                          {invoice.can_edit && (
                            <DropdownMenuItem onClick={() => handleEditInvoice(invoice)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          
                          {/* Revert to cotizacion option */}
                          {invoice.can_revert_to_cotizacion && (
                            <DropdownMenuItem onClick={() => handleRevertToCotizacion(invoice)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Revertir a Cotización
                            </DropdownMenuItem>
                          )}
                          
                          {/* Credit note option - if requires_credit_note */}
                          {invoice.requires_credit_note && (
                            <DropdownMenuItem onClick={() => handleCreateCreditNote(invoice)}>
                              <FileText className="mr-2 h-4 w-4" />
                              Crear Nota de Crédito
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem onClick={() => handleSendInvoice()}>
                            <Send className="mr-2 h-4 w-4" />
                            Enviar por Email
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyPaymentLink(invoice)}>
                            <LinkIcon className="mr-2 h-4 w-4" />
                            Copiar Enlace Público
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPDF()}>
                            <Download className="mr-2 h-4 w-4" />
                            Descargar PDF
                          </DropdownMenuItem>
                          
                          {/* Show payment info if has payments */}
                          {invoice.payment_count && invoice.payment_count > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem disabled>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Pagos: {invoice.payment_count} (${invoice.total_paid?.toFixed(2)})
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteInvoice(invoice)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <p className="text-muted-foreground">
                        No se encontraron facturas en el período seleccionado
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoice Dialog */}
      <InvoiceDialog
        invoice={selectedInvoice}
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        onSuccess={handleInvoiceSuccess}
      />

      {/* Delete Invoice Dialog */}
      <DeleteInvoiceDialog
        invoice={invoiceToDelete}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleInvoiceSuccess}
      />
    </div>
  )
}

