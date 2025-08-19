import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Filter, TrendingUp, Calendar, DollarSign, FileText, MoreHorizontal } from 'lucide-react'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { ConvertToInvoiceDialog } from '@/components/income/ConvertToInvoiceDialog'
import { ManualIncomeDialog } from '@/components/income/ManualIncomeDialog'

interface IncomeTransaction {
  id: string
  posted_at: string
  description: string
  merchant_name?: string
  amount: number
  currency: string
  bank_account_id?: string
  account_alias?: string
  bank_name?: string
  source_type: 'manual' | 'bank_import' | 'invoice'
}

export const Income = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [incomeTransactions, setIncomeTransactions] = useState<IncomeTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('30')

  // Statistics
  const [totalIncome, setTotalIncome] = useState(0)
  const [averageIncome, setAverageIncome] = useState(0)
  const [transactionCount, setTransactionCount] = useState(0)

  // Conversion dialog state
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [selectedIncomeForConversion, setSelectedIncomeForConversion] = useState<IncomeTransaction | null>(null)

  // Manual income dialog state
  const [manualIncomeDialogOpen, setManualIncomeDialogOpen] = useState(false)

  const loadIncomeTransactions = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      
      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - parseInt(selectedPeriod))

      // Query bank transactions (positive amounts)
      const { data: bankTransactions, error: bankError } = await supabase
        .from('transactions')
        .select(`
          id,
          posted_at,
          description,
          merchant_name,
          amount,
          currency,
          bank_account_id,
          bank_accounts!inner(account_alias, bank_name)
        `)
        .eq('owner_id', user.id)
        .gt('amount', 0) // Only positive amounts (income)
        .gte('posted_at', startDate.toISOString().split('T')[0])
        .lte('posted_at', endDate.toISOString().split('T')[0])
        .order('posted_at', { ascending: false })

      if (bankError) throw bankError

      // Query manual income
      const { data: manualIncome, error: manualError } = await supabase
        .from('manual_income')
        .select('*')
        .eq('owner_id', user.id)
        .gte('income_date', startDate.toISOString().split('T')[0])
        .lte('income_date', endDate.toISOString().split('T')[0])
        .order('income_date', { ascending: false })

      if (manualError) throw manualError

      // Query paid invoices (also income)
      const { data: paidInvoices, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          id,
          issue_date,
          total,
          currency,
          clients(display_name)
        `)
        .eq('owner_user_id', user.id)
        .eq('status', 'paid')
        .gte('issue_date', startDate.toISOString().split('T')[0])
        .lte('issue_date', endDate.toISOString().split('T')[0])
        .order('issue_date', { ascending: false })

      if (invoiceError) throw invoiceError

      // Transform all income sources
      const transformedBankTransactions: IncomeTransaction[] = (bankTransactions || []).map(t => ({
        id: t.id,
        posted_at: t.posted_at,
        description: t.description,
        merchant_name: t.merchant_name,
        amount: parseFloat(t.amount.toString()),
        currency: t.currency,
        bank_account_id: t.bank_account_id,
        account_alias: t.bank_accounts?.account_alias,
        bank_name: t.bank_accounts?.bank_name,
        source_type: 'bank_import' as const
      }))

      const transformedManualIncome: IncomeTransaction[] = (manualIncome || []).map(i => ({
        id: i.id,
        posted_at: i.income_date,
        description: i.description,
        merchant_name: i.source,
        amount: parseFloat(i.amount.toString()),
        currency: i.currency,
        source_type: 'manual' as const
      }))

      const transformedInvoices: IncomeTransaction[] = (paidInvoices || []).map(inv => ({
        id: inv.id,
        posted_at: inv.issue_date,
        description: `Factura - ${inv.clients?.display_name}`,
        merchant_name: inv.clients?.display_name,
        amount: parseFloat(inv.total.toString()),
        currency: inv.currency,
        source_type: 'invoice' as const
      }))

      // Combine all income sources
      const allIncomeTransactions = [
        ...transformedBankTransactions,
        ...transformedManualIncome,
        ...transformedInvoices
      ]

      // Sort by date (most recent first)
      allIncomeTransactions.sort((a, b) => 
        new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
      )

      // Filter by search term if provided
      let filteredTransactions = allIncomeTransactions
      if (searchTerm) {
        filteredTransactions = allIncomeTransactions.filter(transaction =>
          transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          transaction.merchant_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      setIncomeTransactions(filteredTransactions)
      
      // Calculate statistics
      const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0)
      setTotalIncome(total)
      setTransactionCount(filteredTransactions.length)
      setAverageIncome(filteredTransactions.length > 0 ? total / filteredTransactions.length : 0)

    } catch (error) {
      console.error('Error loading income transactions:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los ingresos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [user, selectedPeriod, searchTerm, toast])

  useEffect(() => {
    loadIncomeTransactions()
  }, [loadIncomeTransactions])

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const getBankDisplayName = (bankName: string) => {
    const bankNames: Record<string, string> = {
      'banco_general': 'Banco General',
      'banesco': 'Banesco',
      'bac_credomatic': 'BAC Credomatic',
      'global_bank': 'Global Bank',
      'other': 'Otro Banco'
    }
    return bankNames[bankName] || bankName
  }

  const getSourceBadge = (transaction: IncomeTransaction) => {
    switch (transaction.source_type) {
      case 'bank_import':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-200">
            {transaction.account_alias || 'Banco'}
          </Badge>
        )
      case 'invoice':
        return (
          <Badge variant="outline" className="text-purple-600 border-purple-200">
            Factura
          </Badge>
        )
      case 'manual':
      default:
        return (
          <Badge variant="outline" className="text-green-600 border-green-200">
            Manual
          </Badge>
        )
    }
  }

  const handleConvertToInvoice = (transaction: IncomeTransaction) => {
    setSelectedIncomeForConversion(transaction)
    setConvertDialogOpen(true)
  }

  const handleConversionSuccess = () => {
    // Reload the income transactions to reflect the changes
    loadIncomeTransactions()
  }

  const handleNewIncomeClick = () => {
    setManualIncomeDialogOpen(true)
  }

  const handleManualIncomeSuccess = () => {
    // Reload the income transactions to include the new manual income
    loadIncomeTransactions()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Ingresos</h1>
          <p className="text-muted-foreground">
            Gestiona y visualiza todos tus ingresos
          </p>
        </div>
        <Button onClick={handleNewIncomeClick}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Ingreso
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalIncome, 'PAB')}
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos {selectedPeriod} días
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Ingreso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(averageIncome, 'PAB')}
            </div>
            <p className="text-xs text-muted-foreground">
              Basado en {transactionCount} transacciones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactionCount}</div>
            <p className="text-xs text-muted-foreground">
              Ingresos registrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Ingresos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ingresos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
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
              <p className="text-muted-foreground">Cargando ingresos...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Comercio/Origen</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-[50px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {new Date(transaction.posted_at).toLocaleDateString('es-PA')}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={transaction.description}>
                        {transaction.description}
                      </div>
                    </TableCell>
                    <TableCell>
                      {transaction.merchant_name || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getSourceBadge(transaction)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-green-600">
                        +{formatCurrency(transaction.amount, transaction.currency)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {transaction.source_type === 'manual' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleConvertToInvoice(transaction)}
                              className="cursor-pointer"
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Convertir a Factura
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {incomeTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-muted-foreground">
                        No se encontraron ingresos en el período seleccionado
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Manual Income Dialog */}
      <ManualIncomeDialog
        open={manualIncomeDialogOpen}
        onOpenChange={setManualIncomeDialogOpen}
        onSuccess={handleManualIncomeSuccess}
      />

      {/* Convert to Invoice Dialog */}
      <ConvertToInvoiceDialog
        income={selectedIncomeForConversion}
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        onSuccess={handleConversionSuccess}
      />
    </div>
  )
}
