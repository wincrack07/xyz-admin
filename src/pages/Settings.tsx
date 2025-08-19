import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Save, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

interface Profile {
  id: string
  full_name: string | null
  company_name: string | null
  default_currency: string
  timezone: string
  email_from: string | null
  nmi_security_key: string | null
  nmi_sandbox_mode: boolean
  email_provider_api_key: string | null
  preferences: any
  // Yappy fields
  yappy_enabled?: boolean
  yappy_merchant_id?: string | null
  yappy_secret_key?: string | null
  yappy_domain_url?: string | null
  yappy_environment?: 'test' | 'production'
}

const currencies = [
  { code: 'USD', name: 'Dólar Estadounidense' },
  { code: 'PAB', name: 'Balboa Panameño' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'Libra Esterlina' },
  { code: 'CAD', name: 'Dólar Canadiense' },
]

const timezones = [
  { value: 'America/Panama', name: 'América/Panamá (UTC-5)' },
  { value: 'America/New_York', name: 'América/Nueva_York (UTC-5/-4)' },
  { value: 'America/Los_Angeles', name: 'América/Los_Ángeles (UTC-8/-7)' },
  { value: 'Europe/Madrid', name: 'Europa/Madrid (UTC+1/+2)' },
]

export const Settings = () => {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showNmiSecurityKey, setShowNmiSecurityKey] = useState(false)
  const [showNmiPassword, setShowNmiPassword] = useState(false)
  const [showEmailKey, setShowEmailKey] = useState(false)
  const [showYappySecretKey, setShowYappySecretKey] = useState(false)

  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        setProfile(data)
      } else {
        // Create initial profile if it doesn't exist
        const newProfile = {
          id: user?.id!,
          full_name: user?.user_metadata?.full_name || '',
          company_name: user?.user_metadata?.company_name || '',
          default_currency: 'USD',
          timezone: 'America/Panama',
          email_from: user?.email || '',
          nmi_security_key: null,
          nmi_sandbox_mode: true,
          email_provider_api_key: null,
          preferences: {},
          // Yappy fields with default values
          yappy_enabled: false,
          yappy_merchant_id: null,
          yappy_secret_key: null,
          yappy_domain_url: null,
          yappy_environment: 'test'
        }
        
        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert([newProfile])
          .select()
          .single()

        if (createError) throw createError
        setProfile(createdProfile as Profile)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      setMessage('Error al cargar el perfil')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    try {
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          company_name: profile.company_name,
          default_currency: profile.default_currency,
          timezone: profile.timezone,
          email_from: profile.email_from,
          nmi_security_key: profile.nmi_security_key,
          nmi_sandbox_mode: profile.nmi_sandbox_mode,
          email_provider_api_key: profile.email_provider_api_key,
          // Yappy fields
          yappy_enabled: profile.yappy_enabled,
          yappy_merchant_id: profile.yappy_merchant_id,
          yappy_secret_key: profile.yappy_secret_key,
          yappy_domain_url: profile.yappy_domain_url,
          yappy_environment: profile.yappy_environment,
        })
        .eq('id', user?.id!)

      if (error) throw error

      setMessage('Configuración guardada exitosamente')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error saving profile:', error)
      setMessage('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return <div>Error al cargar el perfil</div>
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configura tu información personal y preferencias del sistema
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nombre Completo</Label>
                <Input
                  id="full_name"
                  value={profile.full_name || ''}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Nombre de la Empresa</Label>
                <Input
                  id="company_name"
                  value={profile.company_name || ''}
                  onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_from">Email Remitente</Label>
                <Input
                  id="email_from"
                  type="email"
                  value={profile.email_from || ''}
                  onChange={(e) => setProfile({ ...profile, email_from: e.target.value })}
                  placeholder="noreply@tuempresa.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferencias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="default_currency">Moneda por Defecto</Label>
                <Select
                  value={profile.default_currency}
                  onValueChange={(v) => setProfile({ ...profile, default_currency: v })}
                >
                  <SelectTrigger id="default_currency">
                    <SelectValue placeholder="Selecciona moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Zona Horaria</Label>
                <Select
                  value={profile.timezone}
                  onValueChange={(v) => setProfile({ ...profile, timezone: v })}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Selecciona zona horaria" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integraciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nmi_security_key">NMI Security Key</Label>
                <div className="relative">
                  <Input
                    id="nmi_security_key"
                    type={showNmiSecurityKey ? 'text' : 'password'}
                    value={profile.nmi_security_key || ''}
                    onChange={(e) => setProfile({ ...profile, nmi_security_key: e.target.value })}
                    placeholder="Ingresa tu NMI Security Key"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNmiSecurityKey(!showNmiSecurityKey)}
                  >
                    {showNmiSecurityKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Clave de seguridad para procesar pagos con NMI</p>
              </div>
              

              
              <div className="space-y-2">
                <Label htmlFor="nmi_sandbox_mode">Modo Sandbox</Label>
                <Select
                  value={profile.nmi_sandbox_mode ? 'true' : 'false'}
                  onValueChange={(v) => setProfile({ ...profile, nmi_sandbox_mode: v === 'true' })}
                >
                  <SelectTrigger id="nmi_sandbox_mode">
                    <SelectValue placeholder="Selecciona modo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sandbox (Pruebas)</SelectItem>
                    <SelectItem value="false">Producción</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Usar modo sandbox para pruebas</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_provider_api_key">Email Provider API Key (Resend/SendGrid)</Label>
                <div className="relative">
                  <Input
                    id="email_provider_api_key"
                    type={showEmailKey ? 'text' : 'password'}
                    value={profile.email_provider_api_key || ''}
                    onChange={(e) => setProfile({ ...profile, email_provider_api_key: e.target.value })}
                    placeholder="Ingresa tu API Key del proveedor de email"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowEmailKey(!showEmailKey)}
                  >
                    {showEmailKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Clave API para enviar emails transaccionales</p>
              </div>

              {/* Yappy Configuration */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-medium">Configuración Yappy</h4>
                  <Switch
                    checked={profile.yappy_enabled || false}
                    onCheckedChange={(checked) => setProfile({ ...profile, yappy_enabled: checked })}
                  />
                </div>
                
                {(profile.yappy_enabled) && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="yappy_merchant_id">ID de Comercio Yappy *</Label>
                        <Input
                          id="yappy_merchant_id"
                          value={profile.yappy_merchant_id || ''}
                          onChange={(e) => setProfile({ ...profile, yappy_merchant_id: e.target.value })}
                          placeholder="ID del comercio"
                        />
                        <p className="text-xs text-muted-foreground">ID obtenido en Yappy Comercial</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="yappy_environment">Ambiente</Label>
                        <Select
                          value={profile.yappy_environment || 'test'}
                          onValueChange={(value) => setProfile({ ...profile, yappy_environment: value as 'test' | 'production' })}
                        >
                          <SelectTrigger id="yappy_environment">
                            <SelectValue placeholder="Seleccionar ambiente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="test">Pruebas</SelectItem>
                            <SelectItem value="production">Producción</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Ambiente de Yappy a utilizar</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="yappy_domain_url">URL del Dominio *</Label>
                      <Input
                        id="yappy_domain_url"
                        value={profile.yappy_domain_url || ''}
                        onChange={(e) => setProfile({ ...profile, yappy_domain_url: e.target.value })}
                        placeholder="https://miempresa.com"
                      />
                      <p className="text-xs text-muted-foreground">URL configurada en Yappy Comercial</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="yappy_secret_key">Clave Secreta *</Label>
                      <div className="relative">
                        <Input
                          id="yappy_secret_key"
                          type={showYappySecretKey ? 'text' : 'password'}
                          value={profile.yappy_secret_key || ''}
                          onChange={(e) => setProfile({ ...profile, yappy_secret_key: e.target.value })}
                          placeholder="Clave secreta de Yappy"
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowYappySecretKey(!showYappySecretKey)}
                        >
                          {showYappySecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Clave secreta obtenida en Yappy Comercial</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {message && (
          <Card>
            <CardContent className={`mt-4 ${message.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </div>
  )
}
