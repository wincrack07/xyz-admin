import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, XCircle, AlertCircle, DollarSign, RefreshCw } from 'lucide-react'

interface PaymentStatusBadgeProps {
  status: 'cotizacion' | 'sent' | 'pending' | 'paid' | 'partial' | 'failed' | 'refunded' | 'void' | 'chargeback' | 'payment_review' | 'payment_approved'
  className?: string
}

export const PaymentStatusBadge = ({ status, className }: PaymentStatusBadgeProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'cotizacion':
        return {
          label: 'Cotización',
          variant: 'secondary' as const,
          icon: Clock,
          className: 'bg-gray-100 text-gray-800 hover:bg-gray-200'
        }
      case 'sent':
        return {
          label: 'Enviada',
          variant: 'outline' as const,
          icon: Clock,
          className: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
        }
      case 'pending':
        return {
          label: 'Pendiente',
          variant: 'outline' as const,
          icon: Clock,
          className: 'border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-100'
        }
      case 'paid':
        return {
          label: 'Pagada',
          variant: 'default' as const,
          icon: CheckCircle,
          className: 'bg-green-100 text-green-800 hover:bg-green-200'
        }
      case 'partial':
        return {
          label: 'Pago Parcial',
          variant: 'outline' as const,
          icon: DollarSign,
          className: 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100'
        }
      case 'failed':
        return {
          label: 'Fallida',
          variant: 'destructive' as const,
          icon: XCircle,
          className: 'bg-red-100 text-red-800 hover:bg-red-200'
        }
      case 'refunded':
        return {
          label: 'Reembolsada',
          variant: 'outline' as const,
          icon: RefreshCw,
          className: 'border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100'
        }
      case 'void':
        return {
          label: 'Anulada',
          variant: 'secondary' as const,
          icon: XCircle,
          className: 'bg-gray-100 text-gray-800 hover:bg-gray-200'
        }
      case 'chargeback':
        return {
          label: 'Contracargo',
          variant: 'destructive' as const,
          icon: AlertCircle,
          className: 'bg-red-100 text-red-800 hover:bg-red-200'
        }
      case 'payment_review':
        return {
          label: 'En Revisión de Pago',
          variant: 'outline' as const,
          icon: AlertCircle,
          className: 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100'
        }
      case 'payment_approved':
        return {
          label: 'Pago Aprobado',
          variant: 'default' as const,
          icon: CheckCircle,
          className: 'bg-green-100 text-green-800 hover:bg-green-200'
        }
      default:
        return {
          label: status,
          variant: 'secondary' as const,
          icon: Clock,
          className: 'bg-gray-100 text-gray-800 hover:bg-gray-200'
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <Badge 
      variant={config.variant} 
      className={`inline-flex items-center gap-1 ${config.className} ${className || ''}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

