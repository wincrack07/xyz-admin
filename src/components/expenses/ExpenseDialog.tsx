import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Upload, FileText, Image, Paperclip } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const expenseSchema = z.object({
  spend_date: z.string().min(1, 'La fecha es requerida'),
  category: z.string().min(1, 'La categoría es requerida'),
  description: z.string().optional(),
  amount: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  currency: z.string().min(1, 'La moneda es requerida'),
  payment_method: z.string().optional(),
})

type ExpenseFormData = z.infer<typeof expenseSchema>

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
}

interface ExpenseDialogProps {
  expense?: Expense | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
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
  { value: 'USD', label: 'USD - Dólar Estadounidense' },
  { value: 'PAB', label: 'PAB - Balboa Panameño' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - Libra Esterlina' }
]

const paymentMethods = [
  'Efectivo',
  'Tarjeta de Crédito',
  'Tarjeta de Débito',
  'Transferencia Bancaria',
  'PayPal',
  'Otro'
]

export const ExpenseDialog = ({ expense, open, onOpenChange, onSaved }: ExpenseDialogProps) => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<string[]>([])

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      spend_date: new Date().toISOString().split('T')[0],
      category: '',
      description: '',
      amount: 0,
      currency: 'USD',
      payment_method: '',
    },
  })

  useEffect(() => {
    if (expense) {
      form.reset({
        spend_date: expense.spend_date.split('T')[0],
        category: expense.category,
        description: expense.description || '',
        amount: expense.amount,
        currency: expense.currency,
        payment_method: expense.payment_method || '',
      })
      setExistingAttachments(expense.attachment_urls || [])
    } else {
      form.reset({
        spend_date: new Date().toISOString().split('T')[0],
        category: '',
        description: '',
        amount: 0,
        currency: 'USD',
        payment_method: '',
      })
      setExistingAttachments([])
    }
    setAttachments([])
  }, [expense, form])

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return []

    const uploadedUrls: string[] = []
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${user?.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('expenses_attachments')
        .upload(filePath, file)

      if (uploadError) {
        throw new Error(`Error uploading ${file.name}: ${uploadError.message}`)
      }

      const { data: { publicUrl } } = supabase.storage
        .from('expenses_attachments')
        .getPublicUrl(filePath)

      uploadedUrls.push(publicUrl)
    }

    return uploadedUrls
  }

  const onSubmit = async (data: ExpenseFormData) => {
    if (!user) return

    try {
      setLoading(true)
      
      // Upload new attachments
      let newAttachmentUrls: string[] = []
      if (attachments.length > 0) {
        setUploading(true)
        newAttachmentUrls = await uploadFiles(attachments)
        setUploading(false)
      }

      // Combine existing and new attachments
      const allAttachmentUrls = [...existingAttachments, ...newAttachmentUrls]

      const expenseData = {
        owner_user_id: user.id,
        spend_date: data.spend_date,
        category: data.category,
        description: data.description || null,
        amount: data.amount,
        currency: data.currency,
        payment_method: data.payment_method || null,
        attachment_urls: allAttachmentUrls.length > 0 ? allAttachmentUrls : null,
      }

      if (expense) {
        // Update existing expense
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', expense.id)

        if (error) throw error

        toast({
          title: 'Gasto actualizado',
          description: 'El gasto se ha actualizado correctamente.',
        })
      } else {
        // Create new expense
        const { error } = await supabase
          .from('expenses')
          .insert([expenseData])

        if (error) throw error

        toast({
          title: 'Gasto creado',
          description: 'El nuevo gasto se ha creado correctamente.',
        })
      }

      onSaved()
    } catch (error: any) {
      console.error('Error saving expense:', error)
      toast({
        title: 'Error',
        description: error.message || 'Ocurrió un error al guardar el gasto.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setAttachments(prev => [...prev, ...files])
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingAttachment = (index: number) => {
    setExistingAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image className="h-4 w-4" />
    }
    return <FileText className="h-4 w-4" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {expense ? 'Editar Gasto' : 'Nuevo Gasto'}
          </DialogTitle>
          <DialogDescription>
            {expense 
              ? 'Actualiza los datos del gasto.' 
              : 'Registra un nuevo gasto personal o de negocio.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="spend_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha del Gasto *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona moneda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método de Pago</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona método de pago" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe el gasto..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Adjuntos</FormLabel>
              <div className="space-y-2">
                {/* File Upload */}
                <div className="flex items-center space-x-2">
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileUpload}
                    className="flex-1"
                  />
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* New Attachments */}
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Archivos nuevos:</p>
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <div className="flex items-center space-x-2">
                          {getFileIcon(file.name)}
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({formatFileSize(file.size)})
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Existing Attachments */}
                {existingAttachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Archivos existentes:</p>
                    {existingAttachments.map((url, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">
                            {url.split('/').pop() || 'Archivo'}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExistingAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || uploading}>
                {uploading ? 'Subiendo archivos...' : loading ? 'Guardando...' : expense ? 'Actualizar' : 'Crear Gasto'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}


