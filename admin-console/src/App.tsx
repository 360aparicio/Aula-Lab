/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Root App Component for Independent Admin Repository (allin-studio-admin).
 */

import React from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { getLabAppUrl } from './lib/planCatalog';

interface BoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AdminErrorBoundary extends React.Component<{ children: React.ReactNode }, BoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Error inesperado al cargar Consola Admin.'
    };
  }

  render() {
    if (this.state.hasError) {
      const labUrl = getLabAppUrl();
      return (
        <div className="min-h-screen bg-black text-neutral-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Error cargando Consola Admin</span>
            </div>
            <p className="text-xs text-neutral-400 font-mono break-words">{this.state.errorMessage}</p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar</span>
              </button>
              <a
                href={labUrl}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-xs font-semibold"
              >
                <span>Volver al Aula</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AdminShell: React.FC = () => {
  const { isAuthReady, isAuthorizedAdmin } = useAdminAuth();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-black text-neutral-300 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-xs font-mono">
          <div className="p-3 bg-blue-600/20 border border-blue-500/40 rounded-2xl text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span>Verificando credenciales Zero-Trust de Administración...</span>
        </div>
      </div>
    );
  }

  if (!isAuthorizedAdmin) {
    return <AdminLoginScreen />;
  }

  return <AdminDashboard />;
};

export default function App() {
  return (
    <AdminErrorBoundary>
      <AdminAuthProvider>
        <AdminShell />
      </AdminAuthProvider>
    </AdminErrorBoundary>
  );
}
