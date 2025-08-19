import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Smartphone } from 'lucide-react'

interface YappyPaymentButtonProps {
  invoiceId: string
  amount: number
  currency: string
  clientId: string
  onSuccess?: () => void
  onError?: (error: string) => void
}

interface YappyOrderResponse {
  status: {
    code: string
    description: string
  }
  body?: {
    transactionId: string
    token: string
    documentName: string
  }
}

declare global {
  interface Window {
    YappyButton?: any
  }
}

export const YappyPaymentButton = ({ 
  invoiceId, 
  amount, 
  currency, 
  clientId,
  onSuccess,
  onError 
}: YappyPaymentButtonProps) => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testPhoneNumber, setTestPhoneNumber] = useState('')
  const [yappyButton, setYappyButton] = useState<any>(null)
  const buttonRef = useRef<HTMLDivElement>(null)

  // Load Yappy script
  useEffect(() => {
    const loadYappyScript = () => {
      if (window.YappyButton) {
        return
      }

      const script = document.createElement('script')
      script.type = 'module'
      script.src = 'https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js'
      script.onload = () => {
        console.log('Yappy script loaded')
      }
      script.onerror = () => {
        console.error('Failed to load Yappy script')
        onError?.('Error al cargar Yappy')
      }
      document.head.appendChild(script)
    }

    loadYappyScript()
  }, [onError])

  // Initialize Yappy button
  useEffect(() => {
    if (!buttonRef.current || !window.YappyButton) return

    const initButton = () => {
      try {
        // Create Yappy button element
        const btnElement = document.createElement('btn-yappy')
        btnElement.setAttribute('theme', 'blue')
        btnElement.setAttribute('rounded', 'true')
        
        buttonRef.current?.appendChild(btnElement)
        
        // Add event listeners
        btnElement.addEventListener('eventClick', handleYappyClick)
        btnElement.addEventListener('eventSuccess', handleYappySuccess)
        btnElement.addEventListener('eventError', handleYappyError)
        
        setYappyButton(btnElement)
      } catch (error) {
        console.error('Error initializing Yappy button:', error)
        onError?.('Error al inicializar Yappy')
      }
    }

    // Wait for script to load
    const checkInterval = setInterval(() => {
      if (window.YappyButton) {
        clearInterval(checkInterval)
        initButton()
      }
    }, 100)

    return () => {
      clearInterval(checkInterval)
      if (yappyButton) {
        yappyButton.removeEventListener('eventClick', handleYappyClick)
        yappyButton.removeEventListener('eventSuccess', handleYappySuccess)
        yappyButton.removeEventListener('eventError', handleYappyError)
      }
    }
  }, [onError])

  const handleYappyClick = async () => {
    if (!user) {
      onError?.('Usuario no autenticado')
      return
    }

    try {
      setLoading(true)

      // Get client Yappy configuration
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('yappy_enabled, yappy_environment')
        .eq('id', clientId)
        .eq('owner_user_id', user.id)
        .single()

      if (clientError || !client) {
        throw new Error('Cliente no encontrado')
      }

      if (!client.yappy_enabled) {
        throw new Error('Yappy no está habilitado para este cliente')
      }

      // For test environment, show phone number dialog
      if (client.yappy_environment === 'test') {
        setShowTestDialog(true)
        return
      }

      // For production, create order directly
      await createYappyOrder()
    } catch (error: any) {
      console.error('Error in Yappy click:', error)
      onError?.(error.message || 'Error al procesar pago')
    } finally {
      setLoading(false)
    }
  }

  const createYappyOrder = async (aliasYappy?: string) => {
    try {
      const response = await fetch('/api/yappy-create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          invoiceId,
          aliasYappy
        })
      })

      const result: YappyOrderResponse = await response.json()

      if (!response.ok) {
        throw new Error(result.status?.description || 'Error al crear orden')
      }

      if (!result.body?.transactionId || !result.body?.token || !result.body?.documentName) {
        throw new Error('Respuesta inválida de Yappy')
      }

      // Trigger Yappy payment
      if (yappyButton && yappyButton.eventPayment) {
        yappyButton.eventPayment({
          transactionId: result.body.transactionId,
          token: result.body.token,
          documentName: result.body.documentName
        })
      }

      toast({
        title: 'Orden creada',
        description: 'Procesando pago con Yappy...',
      })

    } catch (error: any) {
      console.error('Error creating Yappy order:', error)
      onError?.(error.message || 'Error al crear orden')
    }
  }

  const handleYappySuccess = (event: any) => {
    console.log('Yappy payment success:', event.detail)
    toast({
      title: 'Pago exitoso',
      description: 'El pago se ha procesado correctamente',
    })
    onSuccess?.()
  }

  const handleYappyError = (event: any) => {
    console.error('Yappy payment error:', event.detail)
    const errorMessage = event.detail?.message || 'Error en el pago'
    onError?.(errorMessage)
  }

  const handleTestPayment = async () => {
    if (!testPhoneNumber) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa un número de teléfono',
        variant: 'destructive'
      })
      return
    }

    setShowTestDialog(false)
    await createYappyOrder(testPhoneNumber)
  }

  return (
    <>
      <div className="space-y-2">
        <Label>Pagar con Yappy</Label>
        <div ref={buttonRef} className="flex justify-center">
          {/* Yappy button will be inserted here */}
        </div>
        {loading && (
          <p className="text-sm text-muted-foreground text-center">
            Procesando pago...
          </p>
        )}
      </div>

      {/* Test Phone Number Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Número de Teléfono de Prueba</DialogTitle>
            <DialogDescription>
              Para el ambiente de pruebas, ingresa un número de teléfono panameño registrado en Yappy
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="testPhone">Número de Teléfono</Label>
              <Input
                id="testPhone"
                type="tel"
                placeholder="61234567"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleTestPayment} className="flex-1">
                Continuar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowTestDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
