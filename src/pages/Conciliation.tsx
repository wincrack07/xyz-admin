import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { 
  Link2, 
  Unlink, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  DollarSign,
  FileText,
  Receipt,
  TrendingUp,
  Search,
  Filter
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface PendingConciliation {
  id: string
  type: 'invoice' | 'expense' | 'manual_income'
  date: string
  description: string
  amount: number
  currency: string
  status: 'pending' | 'partial' | 'complete'
  client_name?: string
  category?: string
  merchant_name?: string
}

interface BankTransaction {
  id: string
  posted_at: string
  description: string
  merchant_name?: string
  amount: number
  currency: string
  is_conciliated: boolean
}

interface ConciliationStats {
  pending_invoices: number
  pending_expenses: number
  pending_manual_income: number
  pending_invoice_amount: number
  pending_expense_amount: number
  pending_manual_income_amount: number
}

export const Conciliation = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [pendingItems, setPendingItems] = useState<PendingConciliation[]>([])
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([])
  const [stats, setStats] = useState<ConciliationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedItem, setSelectedItem] = useState<PendingConciliation | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null)
  const [isManualConciliationOpen, setIsManualConciliationOpen] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      
      // Cargar facturas pendientes
      const { data: invoices } = await supabase
        .from('invoices')
        .select(`
          id,
          issue_date,
          total,
          currency,
          status,
          conciliation_status,
          clients(display_name)
        `)
        .eq('owner_user_id', user.id)
        .eq('status', 'sent')
        .in('conciliation_status', ['pending', 'partial'])

      // Cargar gastos pendientes
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .eq('owner_user_id', user.id)
        .in('conciliation_status', ['pending', 'partial'])

      // Cargar ingresos manuales pendientes
      const { data: manualIncome } = await supabase
        .from('manual_income')
        .select('*')
        .eq('owner_id', user.id)
        .in('conciliation_status', ['pending', 'partial'])

      // Cargar transacciones bancarias no conciliadas
      const { data: transactions } = await supabase
        .from('transactions')
        .select(`
          id,
          posted_at,
          description,
          merchant_name,
          amount,
          currency
        `)
        .eq('owner_id', user.id)
        .not('merchant_name', 'eq', 'Transferencia Entre Cuentas')
        .order('posted_at', { ascending: false })
        .limit(50)

      // Transformar datos
      const transformedItems: PendingConciliation[] = [
        ...(invoices || []).map(inv => ({
          id: inv.id,
          type: 'invoice' as const,
          date: inv.issue_date,
          description: `Factura para ${inv.clients?.display_name}`,
          amount: parseFloat(inv.total.toString()),
          currency: inv.currency,
          status: inv.conciliation_status as any,
          client_name: inv.clients?.display_name
        })),
        ...(expenses || []).map(exp => ({
          id: exp.id,
          type: 'expense' as const,
          date: exp.spend_date,
          description: exp.description || 'Sin descripción',
          amount: parseFloat(exp.amount.toString()),
          currency: exp.currency,
          status: exp.conciliation_status as any,
          category: exp.category
        })),
        ...(manualIncome || []).map(inc => ({
          id: inc.id,
          type: 'manual_income' as const,
          date: inc.income_date,
          description: inc.description,
          amount: parseFloat(inc.amount.toString()),
          currency: inc.currency,
          status: inc.conciliation_status as any,
          category: inc.category
        }))
      ]

      // Verificar qué transacciones ya están conciliadas
      const { data: existingConciliations } = await supabase
        .from('conciliations')
        .select('transaction_id')
        .eq('owner_id', user.id)

      const conciliatedTransactionIds = new Set(
        existingConciliations?.map(c => c.transaction_id) || []
      )

      const transformedTransactions: BankTransaction[] = (transactions || []).map(t => ({
        id: t.id,
        posted_at: t.posted_at,
        description: t.description,
        merchant_name: t.merchant_name,
        amount: parseFloat(t.amount.toString()),
        currency: t.currency,
        is_conciliated: conciliatedTransactionIds.has(t.id)
      }))

      setPendingItems(transformedItems)
      setBankTransactions(transformedTransactions)

      // Calcular estadísticas
      const stats: ConciliationStats = {
        pending_invoices: transformedItems.filter(i => i.type === 'invoice').length,
        pending_expenses: transformedItems.filter(i => i.type === 'expense').length,
        pending_manual_income: transformedItems.filter(i => i.type === 'manual_income').length,
        pending_invoice_amount: transformedItems
          .filter(i => i.type === 'invoice')
          .reduce((sum, i) => sum + i.amount, 0),
        pending_expense_amount: transformedItems
          .filter(i => i.type === 'expense')
          .reduce((sum, i) => sum + i.amount, 0),
        pending_manual_income_amount: transformedItems
          .filter(i => i.type === 'manual_income')
          .reduce((sum, i) => sum + i.amount, 0)
      }
      setStats(stats)

    } catch (error) {
      console.error('Error loading conciliation data:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos de conciliación.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleManualConciliation = async () => {
    if (!selectedItem || !selectedTransaction) return

    try {
      // Crear conciliación manual
      const conciliationType = 
        selectedItem.type === 'invoice' ? 'invoice_payment' :
        selectedItem.type === 'expense' ? 'expense_payment' : 'manual_income'

      const { error: conciliationError } = await supabase
        .from('conciliations')
        .insert({
          owner_id: user!.id,
          conciliation_type: conciliationType,
          status: 'complete',
          [`${selectedItem.type}_id`]: selectedItem.id,
          transaction_id: selectedTransaction.id,
          expected_amount: selectedItem.amount,
          conciliated_amount: Math.abs(selectedTransaction.amount),
          expected_date: selectedItem.date,
          conciliated_date: selectedTransaction.posted_at,
          auto_conciliated: false,
          notes: 'Conciliación manual'
        })

      if (conciliationError) throw conciliationError

      // Actualizar el registro original
      const tableName = selectedItem.type === 'manual_income' ? 'manual_income' : 
                       selectedItem.type === 'invoice' ? 'invoices' : 'expenses'
      
      const updateData = {
        conciliation_status: 'complete',
        conciliated_amount: Math.abs(selectedTransaction.amount),
        last_conciliated_at: new Date().toISOString()
      }

      if (selectedItem.type === 'invoice') {
        Object.assign(updateData, { status: 'paid' })
      }

      const { error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', selectedItem.id)

      if (updateError) throw updateError

      toast({
        title: 'Conciliación exitosa',
        description: 'Los registros han sido conciliados correctamente.',
      })

      setIsManualConciliationOpen(false)
      setSelectedItem(null)
      setSelectedTransaction(null)
      loadData()

    } catch (error) {
      console.error('Error in manual conciliation:', error)
      toast({
        title: 'Error',
        description: 'No se pudo completar la conciliación.',
        variant: 'destructive',
      })
    }
  }

  const filteredItems = pendingItems.filter(item => {
    const matchesSearch = 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = typeFilter === 'all' || item.type === typeFilter
    
    return matchesSearch && matchesType
  })

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'invoice': return <FileText className="h-4 w-4" />
      case 'expense': return <Receipt className="h-4 w-4" />
      case 'manual_income': return <TrendingUp className="h-4 w-4" />
      default: return <DollarSign className="h-4 w-4" />
    }
  }

  const getTypeBadge = (type: string) => {
    const config = {
      invoice: { label: 'Factura', className: 'bg-blue-100 text-blue-800' },
      expense: { label: 'Gasto', className: 'bg-red-100 text-red-800' },
      manual_income: { label: 'Ingreso', className: 'bg-green-100 text-green-800' }
    }
    const { label, className } = config[type as keyof typeof config] || config.invoice
    
    return <Badge className={className}>{label}</Badge>
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conciliación Bancaria</h1>
        <p className="text-muted-foreground">
          Concilia facturas, gastos e ingresos con transacciones bancarias
        </p>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Facturas Pendientes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.pending_invoices}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.pending_invoice_amount, 'PAB')} por cobrar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gastos Pendientes</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.pending_expenses}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.pending_expense_amount, 'PAB')} por conciliar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Pendientes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.pending_manual_income}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.pending_manual_income_amount, 'PAB')} por conciliar
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla de elementos pendientes */}
      <Card>
        <CardHeader>
          <CardTitle>Elementos Pendientes de Conciliación</CardTitle>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar elementos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="invoice">Facturas</SelectItem>
                <SelectItem value="expense">Gastos</SelectItem>
                <SelectItem value="manual_income">Ingresos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Cliente/Categoría</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(item.type)}
                      {getTypeBadge(item.type)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(item.date).toLocaleDateString('es-PA')}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={item.description}>
                      {item.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.client_name || item.category || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.amount, item.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'pending' ? 'secondary' : 'outline'}>
                      {item.status === 'pending' ? 'Pendiente' : 'Parcial'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Dialog 
                      open={isManualConciliationOpen && selectedItem?.id === item.id}
                      onOpenChange={(open) => {
                        setIsManualConciliationOpen(open)
                        if (!open) {
                          setSelectedItem(null)
                          setSelectedTransaction(null)
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedItem(item)}
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Conciliar
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Conciliación Manual</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-6">
                          {/* Elemento seleccionado */}
                          <div>
                            <h3 className="font-medium mb-3">Elemento a Conciliar</h3>
                            {selectedItem && (
                              <Card>
                                <CardContent className="pt-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      {getTypeBadge(selectedItem.type)}
                                      <span className="font-medium">
                                        {formatCurrency(selectedItem.amount, selectedItem.currency)}
                                      </span>
                                    </div>
                                    <p className="text-sm">{selectedItem.description}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Fecha: {new Date(selectedItem.date).toLocaleDateString('es-PA')}
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </div>

                          {/* Transacciones bancarias */}
                          <div>
                            <h3 className="font-medium mb-3">Seleccionar Transacción Bancaria</h3>
                            <div className="max-h-96 overflow-y-auto space-y-2">
                              {bankTransactions
                                .filter(t => !t.is_conciliated)
                                .filter(t => selectedItem?.type === 'invoice' ? t.amount > 0 : t.amount < 0)
                                .map((transaction) => (
                                <Card 
                                  key={transaction.id}
                                  className={`cursor-pointer transition-colors ${
                                    selectedTransaction?.id === transaction.id 
                                      ? 'ring-2 ring-primary' 
                                      : 'hover:bg-muted/50'
                                  }`}
                                  onClick={() => setSelectedTransaction(transaction)}
                                >
                                  <CardContent className="pt-4">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">
                                          {transaction.merchant_name || 'Sin comercio'}
                                        </span>
                                        <span className={`font-medium ${
                                          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                          {formatCurrency(transaction.amount, transaction.currency)}
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {transaction.description}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(transaction.posted_at).toLocaleDateString('es-PA')}
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex justify-end space-x-2 mt-6">
                          <Button 
                            variant="outline" 
                            onClick={() => setIsManualConciliationOpen(false)}
                          >
                            Cancelar
                          </Button>
                          <Button 
                            onClick={handleManualConciliation}
                            disabled={!selectedItem || !selectedTransaction}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Conciliar
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <p className="text-muted-foreground">
                      No hay elementos pendientes de conciliación
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}


