import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

interface PaymentLinkOptions {
  invoice_id: string
  amount: number
  currency: string
  customer: {
    first_name: string
    last_name: string
    email: string
    phone?: string
    address?: {
      line1?: string
      city?: string
      state?: string
      zip?: string
      country?: string
    }
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

  const generatePaymentLink = async (options: PaymentLinkOptions): Promise<PaymentLinkResponse> => {
    try {
      setLoading(true)

      // Get the current app URL for redirect and webhook URLs
      const baseUrl = window.location.origin
      const redirectUrl = `${baseUrl}/invoices/${options.invoice_id}/payment-success`
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || 'https://ohpzqbcgajugxwlbtnmp.supabase.co'}/functions/v1/nmi-webhook`

      const { data, error } = await supabase.functions.invoke('generate-nmi-payment-link', {
        body: {
          ...options,
          redirect_url: redirectUrl,
          webhook_url: webhookUrl,
        },
      })

      if (error) {
        throw error
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate payment link')
      }

      // Update invoice with payment link URL
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          payment_link_url: data.payment_url,
          nmi_payment_id: data.transaction_id,
          status: 'sent',
          updated_at: new Date().toISOString()
        })
        .eq('id', options.invoice_id)

      if (updateError) {
        console.error('Error updating invoice with payment link:', updateError)
        // Don't throw here as the payment link was created successfully
        toast({
          title: 'Advertencia',
          description: 'Link de pago creado, pero no se pudo actualizar la factura.',
          variant: 'destructive',
        })
      }

      toast({
        title: 'Éxito',
        description: 'Link de pago generado correctamente.',
      })

      return {
        success: true,
        payment_url: data.payment_url,
        transaction_id: data.transaction_id
      }

    } catch (error) {
      console.error('Error generating payment link:', error)
      
      const errorMessage = error.message || 'Error al generar el link de pago'
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
    generatePaymentLink,
    copyPaymentLink,
    openPaymentLink,
    sendPaymentLinkByEmail
  }
}

