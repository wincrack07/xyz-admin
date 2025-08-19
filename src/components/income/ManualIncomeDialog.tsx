import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, Calendar, DollarSign } from 'lucide-react'

interface ManualIncomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const ManualIncomeDialog = ({
  open,
  onOpenChange,
  onSuccess
}: ManualIncomeDialogProps) => {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('PAB')
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState('')
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!user || !description.trim() || !amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      const incomeData = {
        owner_id: user.id,
        description: description.trim(),
        amount: parseFloat(amount),
        currency: currency,
        income_date: incomeDate,
        category: category.trim() || null,
        source: source.trim() || null,
        notes: notes.trim() || null,
        conciliation_status: 'pending' as const
      }

      const { error } = await supabase
        .from('manual_income')
        .insert(incomeData)

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Ingreso manual creado correctamente.',
      })

      onSuccess()
      onOpenChange(false)
      resetForm()

    } catch (error) {
      console.error('Error creating manual income:', error)
      toast({
        title: 'Error',
        description: 'No se pudo crear el ingreso manual.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setDescription('')
    setAmount('')
    setCurrency('PAB')
    setIncomeDate(new Date().toISOString().split('T')[0])
    setCategory('')
    setSource('')
    setNotes('')
  }

  const handleClose = () => {
    onOpenChange(false)
    resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nuevo Ingreso Manual
          </DialogTitle>
          <DialogDescription>
            Registra un ingreso que recibiste manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del ingreso"
            />
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAB">PAB (Balboa)</SelectItem>
                  <SelectItem value="USD">USD (Dólar)</SelectItem>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Fecha del Ingreso *</Label>
            <Input
              id="date"
              type="date"
              value={incomeDate}
              onChange={(e) => setIncomeDate(e.target.value)}
            />
          </div>

          {/* Category and Source */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ej: Consultoría, Ventas"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Fuente/Origen</Label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Ej: Cliente ABC, Freelance"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales sobre este ingreso"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !description.trim() || !amount || parseFloat(amount) <= 0}
          >
            {loading ? 'Creando...' : 'Crear Ingreso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


