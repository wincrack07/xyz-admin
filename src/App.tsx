import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginForm from './components/auth/LoginForm'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Settings } from './pages/Settings'
import { Clients } from './pages/Clients'
import { Invoices } from './pages/Invoices'
import { ProductsServices } from './pages/ProductsServices'
import { RecurringPlans } from './pages/RecurringPlans'
import { Expenses } from './pages/Expenses'
import { Reports } from './pages/Reports'
import { Income } from './pages/Income'
import { Conciliation } from './pages/Conciliation'
import { BankAccounts } from './pages/BankAccounts'
import { BankImport } from './pages/BankImport'
import { Toaster } from '@/components/ui/toaster'

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />
}

// App content component (needs to be inside AuthProvider)
const AppContent = () => {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/" /> : <LoginForm />} 
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/products-services" element={<ProductsServices />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/income" element={<Income />} />
                <Route path="/conciliation" element={<Conciliation />} />
                <Route path="/recurring-plans" element={<RecurringPlans />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/bank-accounts" element={<BankAccounts />} />
                <Route path="/bank-import" element={<BankImport />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
        <Toaster />
      </Router>
    </AuthProvider>
  )
}

export default App