import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Package, Edit, Trash2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { ProductServiceDialog } from '@/components/products/ProductServiceDialog'
import { DeleteProductServiceDialog } from '@/components/products/DeleteProductServiceDialog'

interface ProductService {
  id: string
  name: string
  description?: string
  unit_price: number
  tax_rate: number
  created_at: string
}

export const ProductsServices = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [products, setProducts] = useState<ProductService[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Dialog states
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductService | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<ProductService | null>(null)

  const loadProducts = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      
      let query = supabase
        .from('products_services')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('name')

      const { data, error } = await query

      if (error) throw error

      // Filter by search term if provided
      let filteredProducts = data || []
      if (searchTerm) {
        filteredProducts = (data || []).filter(product =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      setProducts(filteredProducts)

    } catch (error) {
      console.error('Error loading products/services:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los productos/servicios.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [user, searchTerm, toast])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: 'PAB'
    }).format(amount)
  }

  const formatTaxRate = (rate: number) => {
    return `${rate}%`
  }

  const handleNewProduct = () => {
    setSelectedProduct(null)
    setProductDialogOpen(true)
  }

  const handleEditProduct = (product: ProductService) => {
    setSelectedProduct(product)
    setProductDialogOpen(true)
  }

  const handleDeleteProduct = (product: ProductService) => {
    setProductToDelete(product)
    setDeleteDialogOpen(true)
  }

  const handleProductSuccess = () => {
    loadProducts()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Productos y Servicios</h1>
          <p className="text-muted-foreground">
            Gestiona tu catálogo de productos y servicios para facturas
          </p>
        </div>
        <Button onClick={handleNewProduct}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Producto/Servicio
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">
              Productos y servicios
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precio Promedio</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.length > 0 
                ? formatCurrency(products.reduce((sum, p) => sum + p.unit_price, 0) / products.length)
                : formatCurrency(0)
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Precio unitario promedio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con ITBMS</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.tax_rate > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Items con impuestos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Productos y Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos/servicios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando productos/servicios...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Precio Unitario</TableHead>
                  <TableHead className="text-center">ITBMS</TableHead>
                  <TableHead className="w-[50px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell>
                      {product.description || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(product.unit_price)}
                    </TableCell>
                    <TableCell className="text-center">
                      {product.tax_rate > 0 ? (
                        <Badge variant="secondary">
                          {formatTaxRate(product.tax_rate)}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Exento</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteProduct(product)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">
                        No se encontraron productos/servicios
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Product/Service Dialog */}
      <ProductServiceDialog
        product={selectedProduct}
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        onSuccess={handleProductSuccess}
      />

      {/* Delete Product/Service Dialog */}
      <DeleteProductServiceDialog
        product={productToDelete}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleProductSuccess}
      />
    </div>
  )
}


