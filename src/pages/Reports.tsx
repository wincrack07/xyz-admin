import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Calendar,
  Download,
  Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface ExpenseReport {
  category: string
  count: number
  totalAmount: number
  percentage: number
}

interface ClientReport {
  totalClients: number
  activeClients: number
  newClientsThisMonth: number
  averagePaymentTerms: number
}

interface MonthlyExpense {
  month: string
  total: number
  count: number
}

export const Reports = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [expenseReport, setExpenseReport] = useState<ExpenseReport[]>([])
  const [clientReport, setClientReport] = useState<ClientReport>({
    totalClients: 0,
    activeClients: 0,
    newClientsThisMonth: 0,
    averagePaymentTerms: 0
  })
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([])
  const [totalExpenses, setTotalExpenses] = useState(0)

  const loadReports = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - parseInt(period))

      // Load expenses for the period
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .eq('owner_user_id', user.id)
        .gte('spend_date', daysAgo.toISOString())
        .order('spend_date', { ascending: false })

      // Calculate expense report by category
      const categoryMap = new Map<string, { count: number; total: number }>()
      let totalAmount = 0

      expenses?.forEach(expense => {
        const category = expense.category
        const current = categoryMap.get(category) || { count: 0, total: 0 }
        categoryMap.set(category, {
          count: current.count + 1,
          total: current.total + expense.amount
        })
        totalAmount += expense.amount
      })

      const expenseReportData: ExpenseReport[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        count: data.count,
        totalAmount: data.total,
        percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0
      })).sort((a, b) => b.totalAmount - a.totalAmount)

      setExpenseReport(expenseReportData)
      setTotalExpenses(totalAmount)

      // Load client report
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('owner_user_id', user.id)

      const now = new Date()
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      const clientReportData: ClientReport = {
        totalClients: clients?.length || 0,
        activeClients: clients?.length || 0, // Simplified - all clients are considered active
        newClientsThisMonth: clients?.filter(client => 
          new Date(client.created_at) >= thisMonth
        ).length || 0,
        averagePaymentTerms: clients?.length > 0 
          ? clients.reduce((sum, client) => sum + client.payment_terms_days, 0) / clients.length
          : 0
      }

      setClientReport(clientReportData)

      // Calculate monthly expenses (last 6 months)
      const monthlyData: MonthlyExpense[] = []
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1)
        
        const monthExpenses = expenses?.filter(expense => {
          const expenseDate = new Date(expense.spend_date)
          return expenseDate >= month && expenseDate < nextMonth
        }) || []

        monthlyData.push({
          month: month.toLocaleDateString('es-PA', { month: 'short', year: 'numeric' }),
          total: monthExpenses.reduce((sum, exp) => sum + exp.amount, 0),
          count: monthExpenses.length
        })
      }

      setMonthlyExpenses(monthlyData)

    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setLoading(false)
    }
  }, [user, period])

  useEffect(() => {
    if (user) {
      loadReports()
    }
  }, [user, loadReports])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Alimentación': 'bg-orange-500',
      'Transporte': 'bg-blue-500',
      'Servicios': 'bg-green-500',
      'Equipos': 'bg-purple-500',
      'Marketing': 'bg-pink-500',
      'Software': 'bg-indigo-500',
      'Consultoría': 'bg-yellow-500',
      'Viajes': 'bg-red-500',
      'Otros': 'bg-gray-500'
    }
    return colors[category] || colors['Otros']
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">
            Análisis de tus datos financieros
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
              <SelectItem value="365">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">
              En los últimos {period} días
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientReport.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              Clientes registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nuevos Clientes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientReport.newClientsThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              Este mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio Términos</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(clientReport.averagePaymentTerms)}</div>
            <p className="text-xs text-muted-foreground">
              Días de pago
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expense Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Gastos por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseReport.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No hay gastos en este período
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {expenseReport.map((item, index) => (
                  <div key={item.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div 
                          className={`w-3 h-3 rounded-full ${getCategoryColor(item.category)}`}
                        />
                        <span className="text-sm font-medium">{item.category}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                      <span className="text-sm font-medium">
                        {formatCurrency(item.totalAmount)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${getCategoryColor(item.category)}`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.percentage.toFixed(1)}% del total
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia Mensual</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyExpenses.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No hay datos suficientes
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {monthlyExpenses.map((month, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium w-20">{month.month}</span>
                      <Badge variant="outline">{month.count} gastos</Badge>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(month.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Reporte Detallado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Resumen de Gastos</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Total de gastos: {expenseReport.reduce((sum, item) => sum + item.count, 0)}</li>
                  <li>• Categorías utilizadas: {expenseReport.length}</li>
                  <li>• Promedio por gasto: {expenseReport.length > 0 ? formatCurrency(totalExpenses / expenseReport.reduce((sum, item) => sum + item.count, 0)) : formatCurrency(0)}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Resumen de Clientes</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Total de clientes: {clientReport.totalClients}</li>
                  <li>• Clientes activos: {clientReport.activeClients}</li>
                  <li>• Nuevos este mes: {clientReport.newClientsThisMonth}</li>
                  <li>• Promedio términos: {Math.round(clientReport.averagePaymentTerms)} días</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


