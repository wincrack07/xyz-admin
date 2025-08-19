import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Plus, Search, MoreHorizontal, Edit, Trash2, CreditCard, Building2, Globe, Upload } from 'lucide-react'
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
import { BankAccountDialog } from '@/components/bank-accounts/BankAccountDialog'
import { DeleteBankAccountDialog } from '@/components/bank-accounts/DeleteBankAccountDialog'
import { Link } from 'react-router-dom'

interface BankAccount {
  id: string
  bank_name: string
  account_alias: string
  account_number_mask: string
  currency: string
  created_at: string
}

const banks = [
  { value: 'banco_general', label: 'Banco General de Panamá', icon: Building2 },
  { value: 'banesco', label: 'Banco Banesco', icon: Building2 },
  { value: 'bac_credomatic', label: 'BAC Credomatic', icon: Building2 },
  { value: 'global_bank', label: 'Global Bank', icon: Building2 },
  { value: 'other', label: 'Otro Banco', icon: Building2 }
]

const currencies = [
  { value: 'PAB', label: 'PAB - Balboa Panameño' },
  { value: 'USD', label: 'USD - Dólar Estadounidense' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - Libra Esterlina' }
]

export const BankAccounts = () => {
  const { user } = useAuth()
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBankAccount, setSelectedBankAccount] = useState<BankAccount | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const loadBankAccounts = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setBankAccounts(data || [])
    } catch (error) {
      console.error('Error loading bank accounts:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadBankAccounts()
    }
  }, [user, loadBankAccounts])

  const filteredBankAccounts = bankAccounts.filter(account =>
    account.account_alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.account_number_mask.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreateBankAccount = () => {
    setSelectedBankAccount(null)
    setIsCreateDialogOpen(true)
  }

  const handleEditBankAccount = (account: BankAccount) => {
    setSelectedBankAccount(account)
    setIsEditDialogOpen(true)
  }

  const handleDeleteBankAccount = (account: BankAccount) => {
    setSelectedBankAccount(account)
    setIsDeleteDialogOpen(true)
  }

  const handleBankAccountSaved = () => {
    loadBankAccounts()
    setIsCreateDialogOpen(false)
    setIsEditDialogOpen(false)
  }

  const handleBankAccountDeleted = () => {
    loadBankAccounts()
    setIsDeleteDialogOpen(false)
  }

  const getBankInfo = (bankName: string) => {
    return banks.find(bank => bank.value === bankName) || banks[banks.length - 1]
  }

  const getCurrencyInfo = (currency: string) => {
    return currencies.find(curr => curr.value === currency) || currencies[0]
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
          <h1 className="text-2xl font-bold">Cuentas Bancarias</h1>
          <p className="text-muted-foreground">
            Gestiona tus cuentas bancarias para importar estados de cuenta
          </p>
        </div>
        <div className="flex space-x-2">
          <Button asChild variant="outline">
            <Link to="/bank-import">
              <Upload className="mr-2 h-4 w-4" />
              Importar Estado
            </Link>
          </Button>
          <Button onClick={handleCreateBankAccount}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Cuenta
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Cuentas</CardTitle>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cuentas..."
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
          ) : filteredBankAccounts.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">
                {searchTerm ? 'No se encontraron cuentas' : 'No hay cuentas bancarias registradas'}
              </p>
              {!searchTerm && (
                <Button variant="outline" className="mt-4" onClick={handleCreateBankAccount}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar primera cuenta
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banco</TableHead>
                  <TableHead>Alias</TableHead>
                  <TableHead>Número de Cuenta</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Fecha de Registro</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBankAccounts.map((account) => {
                  const bankInfo = getBankInfo(account.bank_name)
                  const currencyInfo = getCurrencyInfo(account.currency)
                  
                  return (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <bankInfo.icon className="h-4 w-4 text-muted-foreground" />
                          <span>{bankInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{account.account_alias}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {account.account_number_mask}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {currencyInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(account.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditBankAccount(account)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteBankAccount(account)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BankAccountDialog
        bankAccount={selectedBankAccount}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSaved={handleBankAccountSaved}
      />

      <BankAccountDialog
        bankAccount={selectedBankAccount}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSaved={handleBankAccountSaved}
      />

      <DeleteBankAccountDialog
        bankAccount={selectedBankAccount}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onDeleted={handleBankAccountDeleted}
      />
    </div>
  )
}
