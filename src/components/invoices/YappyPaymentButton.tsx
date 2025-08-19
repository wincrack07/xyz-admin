import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

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

// Yappy icon component
const YappyIcon = () => (
  <div className="flex items-center mr-2">
    <div className="w-4 h-4 bg-blue-500 rounded-full mr-1"></div>
    <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
  </div>
)

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
  const [showPhoneDialog, setShowPhoneDialog] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [yappyButton, setYappyButton] = useState<any>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)

  // Load Yappy script
  useEffect(() => {
    const loadYappyScript = () => {
      // Check if script is already loaded
      if (document.querySelector('script[src*="yappy.cloud"]')) {
        setScriptLoaded(true)
        return
      }

      const script = document.createElement('script')
      script.type = 'module'
      script.src = 'https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js'
      script.onload = () => {
        console.log('Yappy script loaded successfully')
        setScriptLoaded(true)
      }
      script.onerror = (error) => {
        console.error('Failed to load Yappy script:', error)
        onError?.('Error al cargar Yappy')
      }
      document.head.appendChild(script)
    }

    loadYappyScript()
  }, [onError])

  // Initialize Yappy button when script is loaded
  useEffect(() => {
    if (!scriptLoaded || !buttonRef.current) return

    const initButton = () => {
      try {
        // Clear any existing content
        if (buttonRef.current) {
          buttonRef.current.innerHTML = ''
        }

        // Create Yappy button element
        const btnElement = document.createElement('btn-yappy')
        btnElement.setAttribute('theme', 'blue')
        btnElement.setAttribute('rounded', 'true')
        
        // Add to DOM
        buttonRef.current?.appendChild(btnElement)
        
        // Add event listeners
        btnElement.addEventListener('eventClick', handleYappyClick)
        btnElement.addEventListener('eventSuccess', handleYappySuccess)
        btnElement.addEventListener('eventError', handleYappyError)
        
        setYappyButton(btnElement)
        console.log('Yappy button initialized successfully')
      } catch (error) {
        console.error('Error initializing Yappy button:', error)
        onError?.('Error al inicializar Yappy')
      }
    }

    // Wait a bit for the script to fully initialize
    const timer = setTimeout(initButton, 500)

    return () => {
      clearTimeout(timer)
      if (yappyButton) {
        yappyButton.removeEventListener('eventClick', handleYappyClick)
        yappyButton.removeEventListener('eventSuccess', handleYappySuccess)
        yappyButton.removeEventListener('eventError', handleYappyError)
      }
    }
  }, [scriptLoaded, onError])

  const handleYappyClick = async () => {
    if (!user) {
      onError?.('Usuario no autenticado')
      return
    }

    try {
      setLoading(true)

      // Get user's Yappy configuration from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('yappy_enabled, yappy_environment, yappy_merchant_id, yappy_domain_url, yappy_secret_key')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        throw new Error('Perfil de usuario no encontrado')
      }

      if (!profile.yappy_enabled) {
        throw new Error('Yappy no está habilitado en tu configuración')
      }

      if (!profile.yappy_merchant_id || !profile.yappy_domain_url || !profile.yappy_secret_key) {
        throw new Error('Configuración de Yappy incompleta. Ve a Configuración > Integraciones')
      }

      // Create order (test environment will use default phone number)
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
      // Call the edge function to create Yappy order
      const { data, error } = await supabase.functions.invoke('yappy-create-order', {
        body: {
          invoiceId,
          aliasYappy
        }
      })

      if (error) {
        // Check if phone number is required
        if (error.code === 'YAPPY-PHONE-REQUIRED' || (error as any).needsPhone) {
          setShowPhoneDialog(true)
          return
        }
        throw new Error(error.message || 'Error al crear orden')
      }

      if (!data || !data.body?.transactionId || !data.body?.token || !data.body?.documentName) {
        throw new Error('Respuesta inválida de Yappy')
      }

      // Trigger Yappy payment
      if (yappyButton && yappyButton.eventPayment) {
        yappyButton.eventPayment({
          transactionId: data.body.transactionId,
          token: data.body.token,
          documentName: data.body.documentName
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

  const handlePhonePayment = async () => {
    if (!phoneNumber) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa un número de teléfono',
        variant: 'destructive'
      })
      return
    }

    setShowPhoneDialog(false)
    await createYappyOrder(phoneNumber)
  }

  return (
    <>
      <Button 
        onClick={handleYappyClick}
        disabled={loading || !scriptLoaded}
        className="w-full"
        variant="outline"
        size="lg"
      >
        <YappyIcon />
        {loading ? 'Procesando...' : 'Pagar con Yappy'}
      </Button>

      {/* Hidden div for Yappy script to inject the custom button */}
      <div ref={buttonRef} className="hidden">
        {!scriptLoaded && (
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            Cargando Yappy...
          </div>
        )}
      </div>

      {/* Phone Number Dialog */}
      <Dialog open={showPhoneDialog} onOpenChange={setShowPhoneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Número de Teléfono para Yappy</DialogTitle>
            <DialogDescription>
              Ingresa el número de teléfono del cliente para procesar el pago con Yappy
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clientPhone">Número de Teléfono</Label>
              <Input
                id="clientPhone"
                type="tel"
                placeholder="61234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Número de teléfono panameño registrado en Yappy (sin prefijo)
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePhonePayment} className="flex-1">
                Continuar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowPhoneDialog(false)}
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
