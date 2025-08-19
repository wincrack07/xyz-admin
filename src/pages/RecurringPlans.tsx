import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Calendar, Edit, Trash2, MoreHorizontal, Users, DollarSign, Clock, Pause, Play, StopCircle } from 'lucide-react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { RecurringPlanDialog } from '@/components/recurring-plans/RecurringPlanDialog'
import { DeleteRecurringPlanDialog } from '@/components/recurring-plans/DeleteRecurringPlanDialog'

interface Client {
  id: string
  display_name: string
  legal_name?: string
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
  last_invoice_generated_at?: string
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
  client: Client
  created_at: string
}

export const RecurringPlans = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [plans, setPlans] = useState<RecurringPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Dialog states
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<RecurringPlan | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [planToDelete, setPlanToDelete] = useState<RecurringPlan | null>(null)

  const loadPlans = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      
      let query = supabase
        .from('recurring_plans')
        .select(`
          *,
          client:clients(id, display_name, legal_name)
        `)
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) throw error

      // Filter by search term if provided
      let filteredPlans = data || []
      if (searchTerm) {
        filteredPlans = (data || []).filter(plan =>
          plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          plan.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          plan.client.display_name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      setPlans(filteredPlans)

    } catch (error) {
      console.error('Error loading recurring plans:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los planes recurrentes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [user, searchTerm, toast])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const formatFrequency = (frequency: string) => {
    const frequencies = {
      weekly: 'Semanal',
      monthly: 'Mensual',
      quarterly: 'Trimestral',
      yearly: 'Anual'
    }
    return frequencies[frequency as keyof typeof frequencies] || frequency
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Activo', variant: 'default' as const, className: 'bg-green-100 text-green-800' },
      paused: { label: 'Pausado', variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800' },
      cancelled: { label: 'Cancelado', variant: 'destructive' as const, className: 'bg-red-100 text-red-800' },
      expired: { label: 'Expirado', variant: 'outline' as const, className: 'bg-gray-100 text-gray-800' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    )
  }

  const handleNewPlan = () => {
    setSelectedPlan(null)
    setPlanDialogOpen(true)
  }

  const handleEditPlan = (plan: RecurringPlan) => {
    setSelectedPlan(plan)
    setPlanDialogOpen(true)
  }

  const handleDeletePlan = (plan: RecurringPlan) => {
    setPlanToDelete(plan)
    setDeleteDialogOpen(true)
  }

  const handleToggleStatus = async (plan: RecurringPlan) => {
    const newStatus = plan.status === 'active' ? 'paused' : 'active'
    
    try {
      const { error } = await supabase
        .from('recurring_plans')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', plan.id)

      if (error) throw error

      toast({
        title: 'Éxito',
        description: `Plan ${newStatus === 'active' ? 'activado' : 'pausado'} correctamente.`,
      })

      loadPlans()

    } catch (error) {
      console.error('Error updating plan status:', error)
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del plan.',
        variant: 'destructive',
      })
    }
  }

  const handlePlanSuccess = () => {
    loadPlans()
  }

  // Calculate statistics
  const totalPlans = plans.length
  const activePlans = plans.filter(p => p.status === 'active').length
  const totalMonthlyRevenue = plans
    .filter(p => p.status === 'active')
    .reduce((sum, plan) => {
      // Convert all frequencies to monthly equivalent
      let monthlyAmount = plan.billing_amount
      switch (plan.billing_frequency) {
        case 'weekly':
          monthlyAmount = plan.billing_amount * 4.33 // Average weeks per month
          break
        case 'quarterly':
          monthlyAmount = plan.billing_amount / 3
          break
        case 'yearly':
          monthlyAmount = plan.billing_amount / 12
          break
      }
      return sum + monthlyAmount
    }, 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Planes Recurrentes</h1>
          <p className="text-muted-foreground">
            Gestiona tus suscripciones y facturación automática
          </p>
        </div>
        <Button onClick={handleNewPlan}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Plan
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Planes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPlans}</div>
            <p className="text-xs text-muted-foreground">
              {activePlans} activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Mensuales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalMonthlyRevenue, 'PAB')}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimado mensual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximas Facturas</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plans.filter(p => 
                p.status === 'active' && 
                new Date(p.next_billing_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">
              En los próximos 7 días
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Planes Recurrentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar planes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando planes...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Próxima Factura</TableHead>
                  <TableHead className="w-[50px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{plan.name}</div>
                        {plan.description && (
                          <div className="text-sm text-muted-foreground">{plan.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{plan.client.display_name}</div>
                        {plan.client.legal_name && plan.client.legal_name !== plan.client.display_name && (
                          <div className="text-sm text-muted-foreground">{plan.client.legal_name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatFrequency(plan.billing_frequency)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(plan.billing_amount, plan.currency)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(plan.status)}
                    </TableCell>
                    <TableCell>
                      <div className={`${new Date(plan.next_billing_date) <= new Date() && plan.status === 'active' ? 'text-red-600 font-medium' : ''}`}>
                        {new Date(plan.next_billing_date).toLocaleDateString('es-PA')}
                      </div>
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
                          <DropdownMenuItem onClick={() => handleEditPlan(plan)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(plan)}>
                            {plan.status === 'active' ? (
                              <>
                                <Pause className="mr-2 h-4 w-4" />
                                Pausar
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 h-4 w-4" />
                                Activar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeletePlan(plan)}
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
                {plans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-muted-foreground">
                        No se encontraron planes recurrentes
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recurring Plan Dialog */}
      <RecurringPlanDialog
        plan={selectedPlan}
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        onSuccess={handlePlanSuccess}
      />

      {/* Delete Recurring Plan Dialog */}
      <DeleteRecurringPlanDialog
        plan={planToDelete}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handlePlanSuccess}
      />
    </div>
  )
}

