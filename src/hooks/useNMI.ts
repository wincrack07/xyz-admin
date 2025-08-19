import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

interface PaymentOptions {
  invoice_id: string
  amount: number
  currency: string
  customer: {
    first_name: string
    last_name: string
    email: string
    phone: string
    address?: {
      line1?: string
      city?: string
      state?: string
      zip?: string
      country?: string
    }
  }
  payment: {
    ccnumber: string
    ccexp: string
    cvv: string
  }
  description: string
}

interface PaymentLinkResponse {
  success: boolean
  payment_url?: string
  transaction_id?: string
  error?: string
}

export const useNMI = () => {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const processPayment = async (options: PaymentOptions): Promise<PaymentLinkResponse> => {
    try {
      setLoading(true)

      const { data, error } = await supabase.functions.invoke('generate-nmi-payment-link', {
        body: options,
      })

      if (error) {
        throw error
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to process payment')
      }

      toast({
        title: 'Éxito',
        description: 'Pago procesado correctamente.',
      })

      return {
        success: true,
        transaction_id: data.transaction_id
      }

    } catch (error) {
      console.error('Error processing payment:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Error al procesar el pago'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })

      return {
        success: false,
        error: errorMessage
      }
    } finally {
      setLoading(false)
    }
  }

  const copyPaymentLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast({
        title: 'Copiado',
        description: 'Link de pago copiado al portapapeles.',
      })
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      toast({
        title: 'Error',
        description: 'No se pudo copiar el link.',
        variant: 'destructive',
      })
    }
  }

  const openPaymentLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const sendPaymentLinkByEmail = async (invoiceId: string, email: string) => {
    try {
      setLoading(true)

      // This would integrate with your email service
      // For now, we'll just simulate the API call
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoice_id: invoiceId,
          recipient_email: email,
          type: 'payment_link'
        },
      })

      if (error) {
        throw error
      }

      toast({
        title: 'Éxito',
        description: 'Link de pago enviado por email.',
      })

      return true
    } catch (error) {
      console.error('Error sending payment link email:', error)
      toast({
        title: 'Error',
        description: 'No se pudo enviar el email.',
        variant: 'destructive',
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    processPayment,
    copyPaymentLink,
    openPaymentLink,
    sendPaymentLinkByEmail
  }
}

