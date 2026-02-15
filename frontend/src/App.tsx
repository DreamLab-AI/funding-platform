import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Auth
import { AuthProvider } from './hooks/useAuth';

// Layouts - Using wrapper components to provide children via Outlet
import { DashboardLayout, PublicLayout, AuthLayout } from './layouts';

// Pages - Auth
import { LoginPage } from './pages/Auth/LoginPage';
import { RegisterPage } from './pages/Auth/RegisterPage';

// Pages - Applicant
import { CallsList } from './pages/Applicant/CallsList';
import { ApplicationForm } from './pages/Applicant/ApplicationForm';
import { SubmissionConfirmation } from './pages/Applicant/SubmissionConfirmation';

// Pages - Coordinator
import { CoordinatorDashboard } from './pages/Coordinator/Dashboard';
import { CallSetup } from './pages/Coordinator/CallSetup';
import { ApplicationsView } from './pages/Coordinator/ApplicationsView';
import { AssignmentTool } from './pages/Coordinator/AssignmentTool';
import { MasterResults } from './pages/Coordinator/MasterResults';

// Pages - Admin
import { AISettingsPage as AISettings } from './pages/Admin/AISettings';

// Styles
import './styles/index.css';
import './styles/design-tokens.css';
import './styles/animations.css';
import './styles/components.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// Layout wrappers that provide children via Outlet
function PublicLayoutWrapper() {
  return (
    <PublicLayout>
      <Outlet />
    </PublicLayout>
  );
}

function AuthLayoutWrapper() {
  return (
    <AuthLayout title="Authentication">
      <Outlet />
    </AuthLayout>
  );
}

function DashboardLayoutWrapper() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayoutWrapper />}>
              <Route path="/" element={<Navigate to="/calls" replace />} />
              <Route path="/calls" element={<CallsList />} />
            </Route>

            {/* Legacy redirects */}
            <Route path="/login" element={<Navigate to="/auth/login" replace />} />
            <Route path="/register" element={<Navigate to="/auth/register" replace />} />

            {/* Auth Routes */}
            <Route path="/auth" element={<AuthLayoutWrapper />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
            </Route>

            {/* Dashboard Routes */}
            <Route path="/dashboard" element={<DashboardLayoutWrapper />}>
              {/* Default dashboard route redirects to coordinator */}
              <Route index element={<Navigate to="/dashboard/coordinator" replace />} />

              {/* Applicant */}
              <Route path="applications" element={<ApplicationForm />} />
              <Route path="applications/:id" element={<ApplicationForm />} />
              <Route path="confirmation/:id" element={<SubmissionConfirmation />} />

              {/* Coordinator */}
              <Route path="coordinator" element={<CoordinatorDashboard />} />
              <Route path="coordinator/calls/new" element={<CallSetup />} />
              <Route path="coordinator/calls/:id" element={<CallSetup />} />
              <Route path="coordinator/applications" element={<ApplicationsView />} />
              <Route path="coordinator/assignments" element={<AssignmentTool />} />
              <Route path="coordinator/results" element={<MasterResults />} />

              {/* Admin */}
              <Route path="admin/ai-settings" element={<AISettings />} />

              {/* Settings redirect */}
              <Route path="settings" element={<Navigate to="/dashboard/admin/ai-settings" replace />} />
            </Route>

            {/* Legacy routes */}
            <Route path="/applications" element={<Navigate to="/dashboard/applications" replace />} />
            <Route path="/settings" element={<Navigate to="/dashboard/admin/ai-settings" replace />} />

            {/* 404 */}
            <Route path="*" element={<div className="p-8 text-center">Page Not Found</div>} />
          </Routes>
          <Toaster position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
