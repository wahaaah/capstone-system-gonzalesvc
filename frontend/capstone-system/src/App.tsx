import { useState } from 'react';
import { Users, Calendar, Receipt, Layers, Package, ShieldCheck, FileText, Activity, type LucideIcon, LogOut } from 'lucide-react';

import PatientInfoPage from './pages/PatientInfoPage';
import SchedulingPage from './pages/SchedulingPage';
import PosPage from './pages/PosPage';
import FrameConversionPage from './pages/FrameConversionPage';
import ProductInventoryPage from './pages/ProductInventoryPage';
import AccountManagementPage from './pages/AccountManagementPage';
import { TransactionHistoryPage } from './pages/TransactionHistoryPage';
import SystemMonitoringPage from './pages/SystemMonitoringPage';
import LoginPage from './pages/LoginPage';
import { authService, type AuthUser } from './services/authService';

interface NavigationItem {
  id: string;
  name: string;
  icon: LucideIcon;
}

// Role scope:
// - Admin runs the entire day-to-day operation: patients, scheduling, POS, and inventory (frames + products).
// - Super-Admin does NOT touch daily operations — they're scoped to account maintenance and system monitoring only.
// - Staff is limited to scheduling + frame inventory, per the original capstone scope.
const ADMIN_NAV: NavigationItem[] = [
  { id: 'patient-info', name: 'Patient information', icon: Users },
  { id: 'scheduling', name: 'Appointment scheduling', icon: Calendar },
  { id: 'pos', name: 'Point of Sale (POS)', icon: Receipt },
  { id: 'transaction-history', name: 'Transaction history', icon: FileText },
  { id: 'frame-conversion', name: 'Frames inventory', icon: Layers },
  { id: 'product-inventory', name: 'Medical products inventory', icon: Package },
];

const SUPER_ADMIN_NAV: NavigationItem[] = [
  { id: 'accounts', name: 'Account management', icon: ShieldCheck },
  { id: 'monitoring', name: 'System monitoring', icon: Activity },
];

const STAFF_NAV: NavigationItem[] = [
  { id: 'scheduling', name: 'Appointment scheduling', icon: Calendar },
  { id: 'frame-conversion', name: 'Frames inventory', icon: Layers },
];

function navForRole(role: AuthUser['role']): NavigationItem[] {
  if (role === 'super_admin') return SUPER_ADMIN_NAV;
  if (role === 'staff') return STAFF_NAV;
  return ADMIN_NAV;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => authService.getCurrentUser());
  const [currentView, setCurrentView] = useState<string>(() => {
    const u = authService.getCurrentUser();
    return navForRole(u?.role ?? 'admin')[0].id;
  });
  const [activePatientId, setActivePatientId] = useState<string | null>(null);

  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setCurrentView(navForRole(user.role)[0].id);
        }}
      />
    );
  }

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
  };

  // 1. Handles clicks from inside the scheduler
  const handleNavigate = (viewId: string, patientId: string) => {
    setActivePatientId(patientId);
    setCurrentView(viewId);
  };

  // 2. Handles clicks from the sidebar to clear the sticky ID
  const handleSidebarClick = (itemId: string) => {
    setCurrentView(itemId);
    setActivePatientId(null); // This clears the ID so you see the full list again!
  };

  const navigationItems = navForRole(currentUser.role);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Top Header inside Sidebar */}
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <h1 className="text-lg font-bold text-blue-600">
            Gonzales Vision Clinic
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              // 3. Use the sidebar click handler
              onClick={() => handleSidebarClick(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                currentView === item.id
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-500 hover:bg-blue-50 hover:text-slate-900'
              }`}
            >
              <item.icon size={18} />
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-400 text-center">
          {currentUser.role === 'super_admin' ? 'Super-Admin Portal' : currentUser.role === 'staff' ? 'Staff Portal' : 'Admin Portal'} v1.3 (TS)
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
           <div className="flex items-center space-x-2 text-sm text-slate-500">
             <span>Management</span>
             <span>/</span>
             <span className="text-slate-800 font-medium">
               {navigationItems.find(item => item.id === currentView)?.name}
             </span>
           </div>

           <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
               {currentUser.username.slice(0, 2).toUpperCase()}
             </div>
             <div className="text-sm">
               <p className="font-medium text-slate-700 leading-tight">{currentUser.full_name || currentUser.username}</p>
               <p className="text-[10px] text-blue-500 uppercase tracking-wider leading-tight">{currentUser.role.replace('_', ' ')}</p>
             </div>
             <button
               onClick={handleLogout}
               className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
               title="Log out"
             >
               <LogOut size={16} />
             </button>
           </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {/* Admin-only operational views */}
          {currentView === 'patient-info' && currentUser.role === 'admin' && (
            <PatientInfoPage
              selectedPatientId={activePatientId}
              // 4. Pass the clear function to the Back button
              onBack={() => setActivePatientId(null)}
            />
          )}

          {currentView === 'pos' && currentUser.role === 'admin' && <PosPage />}
          {currentView === 'transaction-history' && currentUser.role === 'admin' && <TransactionHistoryPage />}
          {currentView === 'product-inventory' && currentUser.role === 'admin' && <ProductInventoryPage />}

          {/* Shared between Admin and Staff */}
          {currentView === 'scheduling' && (currentUser.role === 'admin' || currentUser.role === 'staff') && (
            <SchedulingPage onNavigate={handleNavigate} />
          )}

          {currentView === 'frame-conversion' && (currentUser.role === 'admin' || currentUser.role === 'staff') && (
            <FrameConversionPage />
          )}

          {/* Super-Admin only: account maintenance + system monitoring */}
          {currentView === 'accounts' && currentUser.role === 'super_admin' && <AccountManagementPage />}
          {currentView === 'monitoring' && currentUser.role === 'super_admin' && <SystemMonitoringPage />}
        </main>
      </div>
    </div>
  );
}
