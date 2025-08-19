import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Plus, Search, MoreHorizontal, Edit, Trash2, Download, Calendar, DollarSign, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ExpenseDialog } from '@/components/expenses/ExpenseDialog'
import { DeleteExpenseDialog } from '@/components/expenses/DeleteExpenseDialog'

interface Expense {
  id: string
  spend_date: string
  category: string
  description: string | null
  amount: number
  currency: string
  payment_method: string | null
  attachment_urls: string[] | null
  created_at: string
  source_type?: 'manual' | 'bank_import'
  merchant_name?: string
  account_alias?: string
}

const categories = [
  'Alimentación',
  'Transporte',
  'Servicios',
  'Equipos',
  'Marketing',
  'Software',
  'Consultoría',
  'Viajes',
  'Otros'
]

const currencies = [
  { value: 'USD', label: 'USD' },
  { value: 'PAB', label: 'PAB' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' }
]

export const Expenses = () => {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const loadExpenses = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      
      // Load manual expenses
      const { data: manualExpenses, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('spend_date', { ascending: false })

      if (expensesError) throw expensesError

      // Load bank transactions (negative amounts = expenses)
      const { data: bankTransactions, error: bankError } = await supabase
        .from('transactions')
        .select(`
          id,
          posted_at,
          description,
          merchant_name,
          amount,
          currency,
          bank_accounts!inner(account_alias)
        `)
        .eq('owner_id', user.id)
        .lt('amount', 0) // Only negative amounts (expenses)
        .not('merchant_name', 'eq', 'Transferencia Entre Cuentas') // Exclude internal transfers
        .order('posted_at', { ascending: false })

      if (bankError) throw bankError

      // Transform manual expenses
      const transformedManualExpenses: Expense[] = (manualExpenses || []).map(e => ({
        ...e,
        source_type: 'manual' as const
      }))

      // Transform bank transactions to expense format
      const transformedBankExpenses: Expense[] = (bankTransactions || []).map(t => ({
        id: t.id,
        spend_date: t.posted_at,
        category: 'Bancario',
        description: t.description,
        amount: Math.abs(parseFloat(t.amount.toString())), // Convert to positive for display
        currency: t.currency,
        payment_method: 'Transferencia Bancaria',
        attachment_urls: null,
        created_at: t.posted_at,
        source_type: 'bank_import' as const,
        merchant_name: t.merchant_name,
        account_alias: t.bank_accounts?.account_alias
      }))

      // Combine and sort by date
      const allExpenses = [...transformedManualExpenses, ...transformedBankExpenses]
      allExpenses.sort((a, b) => new Date(b.spend_date).getTime() - new Date(a.spend_date).getTime())
      
      setExpenses(allExpenses)
    } catch (error) {
      console.error('Error loading expenses:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadExpenses()
    }
  }, [user, loadExpenses])

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = 
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.payment_method?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter
    
    return matchesSearch && matchesCategory
  })

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  const handleCreateExpense = () => {
    setSelectedExpense(null)
    setIsCreateDialogOpen(true)
  }

  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense)
    setIsEditDialogOpen(true)
  }

  const handleDeleteExpense = (expense: Expense) => {
    setSelectedExpense(expense)
    setIsDeleteDialogOpen(true)
  }

  const handleExpenseSaved = () => {
    loadExpenses()
    setIsCreateDialogOpen(false)
    setIsEditDialogOpen(false)
  }

  const handleExpenseDeleted = () => {
    loadExpenses()
    setIsDeleteDialogOpen(false)
  }

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      'Alimentación': 'bg-orange-100 text-orange-800',
      'Transporte': 'bg-blue-100 text-blue-800',
      'Servicios': 'bg-green-100 text-green-800',
      'Equipos': 'bg-purple-100 text-purple-800',
      'Marketing': 'bg-pink-100 text-pink-800',
      'Software': 'bg-indigo-100 text-indigo-800',
      'Consultoría': 'bg-yellow-100 text-yellow-800',
      'Viajes': 'bg-red-100 text-red-800',
      'Otros': 'bg-gray-100 text-gray-800'
    }
    
    return (
      <Badge className={colors[category] || colors['Otros']}>
        {category}
      </Badge>
    )
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-PA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Gastos</h1>
          <p className="text-muted-foreground">
            Gestiona tus gastos personales y de negocio
          </p>
        </div>
        <Button onClick={handleCreateExpense}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Gasto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalAmount, 'USD')}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredExpenses.length} gastos registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Gasto</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredExpenses.length > 0 
                ? formatCurrency(totalAmount / filteredExpenses.length, 'USD')
                : formatCurrency(0, 'USD')
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Promedio mensual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último Gasto</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {expenses.length > 0 ? formatDate(expenses[0].spend_date) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {expenses.length > 0 ? expenses[0].category : 'Sin gastos'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Gastos</CardTitle>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar gastos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm || categoryFilter !== 'all' 
                  ? 'No se encontraron gastos' 
                  : 'No hay gastos registrados'
                }
              </p>
              {!searchTerm && categoryFilter === 'all' && (
                <Button variant="outline" className="mt-4" onClick={handleCreateExpense}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar primer gasto
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Comercio</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Adjuntos</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                        {formatDate(expense.spend_date)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getCategoryBadge(expense.category)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate">
                        {expense.description || 'Sin descripción'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {expense.merchant_name || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(expense.amount, expense.currency)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {expense.source_type === 'bank_import' ? (
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                          {expense.account_alias || 'Banco'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Manual
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {expense.attachment_urls && expense.attachment_urls.length > 0 ? (
                        <Badge variant="secondary">
                          {expense.attachment_urls.length} archivo(s)
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Sin adjuntos</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditExpense(expense)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          {expense.attachment_urls && expense.attachment_urls.length > 0 && (
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Descargar Adjuntos
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteExpense(expense)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExpenseDialog
        expense={selectedExpense}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSaved={handleExpenseSaved}
      />

      <ExpenseDialog
        expense={selectedExpense}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSaved={handleExpenseSaved}
      />

      <DeleteExpenseDialog
        expense={selectedExpense}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={handleExpenseDeleted}
      />
    </div>
  )
}
