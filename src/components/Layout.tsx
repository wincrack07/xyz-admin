import { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Home, 
  Users, 
  FileText, 
  DollarSign, 
  Calendar,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  CreditCard,
  TrendingUp,
  Link2,
  Package,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface LayoutProps { children: ReactNode }

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Clientes', href: '/clients', icon: Users },
  { name: 'Facturas', href: '/invoices', icon: FileText },
  { name: 'Productos/Servicios', href: '/products-services', icon: Package },
  { name: 'Gastos', href: '/expenses', icon: DollarSign },
  { name: 'Ingresos', href: '/income', icon: TrendingUp },
  { name: 'Conciliación', href: '/conciliation', icon: Link2 },
  { name: 'Cuentas Bancarias', href: '/bank-accounts', icon: CreditCard },
  { name: 'Planes Recurrentes', href: '/recurring-plans', icon: Calendar },
  { name: 'Reportes', href: '/reports', icon: BarChart3 },
  { name: 'Ajustes', href: '/settings', icon: SettingsIcon },
]

export const Layout = ({ children }: LayoutProps) => {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const pageTitle = navigation.find((nav) => nav.href === location.pathname)?.name || 'Dashboard'

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <div className="px-2 py-2 text-base font-semibold">XYZ Admin</div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navegación</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link to={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start">
                  {user?.email}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <div className="flex flex-1 flex-col">
          <header className="flex h-16 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-6" />
            <h2 className="text-lg font-medium">{pageTitle}</h2>
          </header>
          <main className="flex-1 p-4">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
