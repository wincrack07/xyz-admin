import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Plus, Search, MoreHorizontal, Edit, Trash2, Mail } from 'lucide-react'
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
import { ClientDialog } from '@/components/clients/ClientDialog'
import { DeleteClientDialog } from '@/components/clients/DeleteClientDialog'

interface Client {
  id: string
  display_name: string
  legal_name: string | null
  tax_id: string | null
  emails: string[]
  payment_terms_days: number
  preferred_currency: string | null
  billing_notes: string | null
  created_at: string
}

export const Clients = () => {
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const loadClients = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('owner_user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadClients()
    }
  }, [user, loadClients])

  const filteredClients = clients.filter(client =>
    client.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.emails.some(email => email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleCreateClient = () => {
    setSelectedClient(null)
    setIsCreateDialogOpen(true)
  }

  const handleEditClient = (client: Client) => {
    setSelectedClient(client)
    setIsEditDialogOpen(true)
  }

  const handleDeleteClient = (client: Client) => {
    setSelectedClient(client)
    setIsDeleteDialogOpen(true)
  }

  const handleClientSaved = () => {
    loadClients()
    setIsCreateDialogOpen(false)
    setIsEditDialogOpen(false)
  }

  const handleClientDeleted = () => {
    loadClients()
    setIsDeleteDialogOpen(false)
  }

  const getPaymentTermsBadge = (days: number) => {
    if (days === 0) return <Badge variant="secondary">Inmediato</Badge>
    if (days <= 15) return <Badge variant="default">{days} días</Badge>
    if (days <= 30) return <Badge variant="secondary">{days} días</Badge>
    return <Badge variant="destructive">{days} días</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            Gestiona tu cartera de clientes y sus datos de facturación
          </p>
        </div>
        <Button onClick={handleCreateClient}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
              </p>
              {!searchTerm && (
                <Button variant="outline" className="mt-4" onClick={handleCreateClient}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar primer cliente
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Términos de Pago</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{client.display_name}</div>
                        {client.legal_name && (
                          <div className="text-sm text-muted-foreground">
                            {client.legal_name}
                          </div>
                        )}
                        {client.tax_id && (
                          <div className="text-xs text-muted-foreground">
                            RUC: {client.tax_id}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {client.emails.map((email, index) => (
                          <div key={index} className="flex items-center text-sm">
                            <Mail className="mr-1 h-3 w-3" />
                            {email}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getPaymentTermsBadge(client.payment_terms_days)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {client.preferred_currency || 'USD'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditClient(client)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteClient(client)}
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

      <ClientDialog
        client={selectedClient}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSaved={handleClientSaved}
      />

      <ClientDialog
        client={selectedClient}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSaved={handleClientSaved}
      />

      <DeleteClientDialog
        client={selectedClient}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={handleClientDeleted}
      />
    </div>
  )
}
