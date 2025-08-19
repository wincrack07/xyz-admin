import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react'
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
import { useToast } from '@/hooks/use-toast'

interface BankAccount {
  id: string
  bank_name: string
  account_alias: string
  account_number_mask: string
  currency: string
}

interface ImportResult {
  summary: {
    total_rows: number
    parsed_rows: number
    inserted: number
    skipped_duplicate: number
    categorized: number
    uncategorized: number
    errors: Array<{
      row: number
      message: string
      data?: any
    }>
  }
  sample: Array<{
    posted_at: string
    description: string
    merchant_name?: string
    amount: number
    balance_after?: number
    currency: string
  }>
}

export const BankImport = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isPreview, setIsPreview] = useState(false)

  // Load bank accounts on component mount
  const loadBankAccounts = useCallback(async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setBankAccounts(data || [])
    } catch (error) {
      console.error('Error loading bank accounts:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las cuentas bancarias.',
        variant: 'destructive',
      })
    }
  }, [user, toast])

  useEffect(() => {
    loadBankAccounts()
  }, [loadBankAccounts])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList } }) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type - now supports Excel and OFX
      const validExtensions = ['.xlsx', '.xls', '.ofx']
      const isValidFile = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
      
      if (!isValidFile) {
        toast({
          title: 'Archivo no válido',
          description: 'Solo se permiten archivos Excel (.xlsx, .xls) o OFX (.ofx)',
          variant: 'destructive',
        })
        return
      }
      setSelectedFile(file)
      setImportResult(null) // Clear previous results
    }
  }

  const handleImport = async (dryRun: boolean = false) => {
    if (!selectedFile || !selectedAccount) {
      toast({
        title: 'Datos incompletos',
        description: 'Selecciona una cuenta bancaria y un archivo.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      setIsPreview(dryRun)

      // Convert file to base64
      const arrayBuffer = await selectedFile.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      // Call the Edge Function
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No hay sesión activa')
      }

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/import_bank_general_excel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bank_account_id: selectedAccount,
            file_base64: base64,
            dry_run: dryRun,
            tz: 'America/Panama'
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error en la importación')
      }

      const result: ImportResult = await response.json()
      setImportResult(result)

      if (dryRun) {
        toast({
          title: 'Vista previa generada',
          description: `Se encontraron ${result.summary.parsed_rows} transacciones para importar.`,
        })
      } else {
        toast({
          title: 'Importación completada',
          description: `Se importaron ${result.summary.inserted} transacciones exitosamente.`,
        })
      }

    } catch (error: any) {
      console.error('Import error:', error)
      toast({
        title: 'Error en la importación',
        description: error.message || 'Ocurrió un error durante la importación.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getBankDisplayName = (bankName: string) => {
    const bankNames: Record<string, string> = {
      'banco_general': 'Banco General de Panamá',
      'banesco': 'Banco Banesco',
      'bac_credomatic': 'BAC Credomatic',
      'global_bank': 'Global Bank',
      'other': 'Otro Banco'
    }
    return bankNames[bankName] || bankName
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importar Estado de Cuenta</h1>
        <p className="text-muted-foreground">
          Sube tu archivo de estado de cuenta (Excel o OFX) para importar transacciones automáticamente
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Subir Archivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bank Account Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Cuenta Bancaria *</label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta bancaria" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{account.account_alias}</span>
                        <span className="text-xs text-muted-foreground">
                          {getBankDisplayName(account.bank_name)} - {account.account_number_mask}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bankAccounts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No tienes cuentas bancarias registradas.{' '}
                  <a href="/bank-accounts" className="text-primary hover:underline">
                    Crear cuenta bancaria
                  </a>
                </p>
              )}
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Archivo de Estado de Cuenta *</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls,.ofx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label 
                  htmlFor="file-upload" 
                  className="cursor-pointer block w-full h-full"
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.currentTarget.closest('div')?.classList.add('border-primary')
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.currentTarget.closest('div')?.classList.remove('border-primary')
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.closest('div')?.classList.remove('border-primary')
                    const files = e.dataTransfer.files
                    if (files.length > 0) {
                      handleFileSelect({ target: { files } } as any)
                    }
                  }}
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    <span className="font-medium text-primary hover:text-primary/80">
                      Haz clic para subir
                    </span>{' '}
                    o arrastra y suelta
                  </p>
                  <p className="text-xs text-gray-500">Archivos Excel (.xlsx, .xls) o OFX (.ofx)</p>
                </label>
              </div>
              {selectedFile && (
                <div className="flex items-center space-x-2 p-2 bg-green-50 rounded-md">
                  <FileText className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800">{selectedFile.name}</span>
                  <span className="text-xs text-green-600">
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <Button
                onClick={() => handleImport(true)}
                disabled={!selectedFile || !selectedAccount || loading}
                variant="outline"
                className="flex-1"
              >
                {loading && isPreview ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Vista Previa
              </Button>
              <Button
                onClick={() => handleImport(false)}
                disabled={!selectedFile || !selectedAccount || loading}
                className="flex-1"
              >
                {loading && !isPreview ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Importar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {importResult && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isPreview ? 'Vista Previa' : 'Resultados de Importación'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {importResult.summary.parsed_rows}
                  </div>
                  <div className="text-sm text-blue-800">Transacciones</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {importResult.summary.inserted}
                  </div>
                  <div className="text-sm text-green-800">Importadas</div>
                </div>
                {importResult.summary.skipped_duplicate > 0 && (
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {importResult.summary.skipped_duplicate}
                    </div>
                    <div className="text-sm text-yellow-800">Duplicadas</div>
                  </div>
                )}
                {importResult.summary.categorized > 0 && (
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {importResult.summary.categorized}
                    </div>
                    <div className="text-sm text-purple-800">Categorizadas</div>
                  </div>
                )}
              </div>

              {/* Errors */}
              {importResult.summary.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-600">Errores encontrados:</h4>
                  <div className="space-y-1">
                    {importResult.summary.errors.slice(0, 3).map((error, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>Fila {error.row}: {error.message}</span>
                      </div>
                    ))}
                    {importResult.summary.errors.length > 3 && (
                      <p className="text-sm text-muted-foreground">
                        ... y {importResult.summary.errors.length - 3} errores más
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Sample Transactions */}
              {importResult.sample.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Ejemplos de transacciones:</h4>
                  <div className="space-y-2">
                    {importResult.sample.map((transaction, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">{transaction.description}</div>
                            {transaction.merchant_name && (
                              <div className="text-sm text-muted-foreground">
                                {transaction.merchant_name}
                              </div>
                            )}
                            <div className="text-sm text-muted-foreground">
                              {new Date(transaction.posted_at).toLocaleDateString('es-PA')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-medium ${
                              transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(transaction.amount, transaction.currency)}
                            </div>
                            {transaction.balance_after && (
                              <div className="text-xs text-muted-foreground">
                                Saldo: {formatCurrency(transaction.balance_after, transaction.currency)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instrucciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Formatos de archivo soportados:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>OFX (.ofx):</strong> Formato recomendado - más preciso y confiable</li>
                <li>• <strong>Excel (.xlsx, .xls):</strong> Formato tradicional de Banco General</li>
                <li>• Detección automática del formato y filtrado de transferencias internas</li>
                <li>• Las transferencias "ENTRE CUENTAS" se detectan automáticamente</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Proceso de importación:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Vista Previa:</strong> Revisa las transacciones antes de importar</li>
                <li>• <strong>Importar:</strong> Guarda las transacciones en la base de datos</li>
                <li>• <strong>Deduplicación:</strong> No se importarán transacciones duplicadas</li>
                <li>• <strong>Categorización:</strong> Se aplicarán reglas de categorización automática</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
