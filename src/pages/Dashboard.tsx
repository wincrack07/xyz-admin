import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Plus,
  FileText,
  CreditCard,
  Receipt
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'

interface DashboardStats {
  totalClients: number
  totalExpenses: number
  totalExpensesAmount: number
  recentExpenses: Array<{
    id: string
    category: string
    amount: number
    currency: string
    spend_date: string
  }>
  recentClients: Array<{
    id: string
    display_name: string
    created_at: string
  }>
}

export const Dashboard = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalExpenses: 0,
    totalExpensesAmount: 0,
    recentExpenses: [],
    recentClients: []
  })
  const [loading, setLoading] = useState(true)

  const loadDashboardData = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      // Load clients count
      const { count: clientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', user.id)

      // Load expenses count and total amount
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount, currency')
        .eq('owner_user_id', user.id)

      const totalAmount = expensesData?.reduce((sum, expense) => {
        // Convert all to USD for calculation (simplified)
        return sum + expense.amount
      }, 0) || 0

      // Load recent expenses
      const { data: recentExpenses } = await supabase
        .from('expenses')
        .select('id, category, amount, currency, spend_date')
        .eq('owner_user_id', user.id)
        .order('spend_date', { ascending: false })
        .limit(5)

      // Load recent clients
      const { data: recentClients } = await supabase
        .from('clients')
        .select('id, display_name, created_at')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      setStats({
        totalClients: clientsCount || 0,
        totalExpenses: expensesData?.length || 0,
        totalExpensesAmount: totalAmount,
        recentExpenses: recentExpenses || [],
        recentClients: recentClients || []
      })
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user, loadDashboardData])

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-PA', {
      month: 'short',
      day: 'numeric'
    })
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
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen de tu actividad financiera
          </p>
        </div>
        <div className="flex space-x-2">
          <Button asChild>
            <Link to="/clients">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Cliente
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/expenses">
              <Receipt className="mr-2 h-4 w-4" />
              Nuevo Gasto
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              Clientes registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalExpenses}</div>
            <p className="text-xs text-muted-foreground">
              Gastos registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalExpensesAmount, 'USD')}
            </div>
            <p className="text-xs text-muted-foreground">
              En gastos acumulados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalExpenses > 0 
                ? formatCurrency(stats.totalExpensesAmount / stats.totalExpenses, 'USD')
                : formatCurrency(0, 'USD')
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Por gasto
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Expenses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Receipt className="mr-2 h-5 w-5" />
              Gastos Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentExpenses.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No hay gastos registrados
                </p>
                <Button asChild className="mt-4" size="sm">
                  <Link to="/expenses">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar primer gasto
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                          {getCategoryBadge(expense.category)}
                          <span className="text-sm font-medium">
                            {formatCurrency(expense.amount, expense.currency)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(expense.spend_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/expenses">
                      Ver todos los gastos
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Clientes Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentClients.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No hay clientes registrados
                </p>
                <Button asChild className="mt-4" size="sm">
                  <Link to="/clients">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar primer cliente
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentClients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {client.display_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Agregado {formatDate(client.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/clients">
                      Ver todos los clientes
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button asChild className="h-auto p-4 flex flex-col items-center space-y-2">
              <Link to="/clients">
                <Users className="h-8 w-8" />
                <span>Gestionar Clientes</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
              <Link to="/expenses">
                <Receipt className="h-8 w-8" />
                <span>Gestionar Gastos</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
              <Link to="/invoices">
                <FileText className="h-8 w-8" />
                <span>Crear Factura</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>


    </div>
  )
}
