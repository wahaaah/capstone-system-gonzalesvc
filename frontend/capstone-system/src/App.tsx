import { useState } from 'react';
import {Users, Calendar, Receipt, Layers, Package, ShieldCheck, FileText, Activity, type LucideIcon, LogOut, Menu, X,} from 'lucide-react';
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
// - Admin runs the entire day-to-day operation: patients, scheduling, POS, and inventory.
// - Super-Admin is scoped to account maintenance and system monitoring.
// - Staff is limited to scheduling + frame inventory.
const ADMIN_NAV: NavigationItem[] = [
  {
    id: 'patient-info',
    name: 'Patient information',
    icon: Users,
  },
  {
    id: 'scheduling',
    name: 'Appointment scheduling',
    icon: Calendar,
  },
  {
    id: 'pos',
    name: 'Point of Sale (POS)',
    icon: Receipt,
  },
  {
    id: 'transaction-history',
    name: 'Transaction history',
    icon: FileText,
  },
  {
    id: 'frame-conversion',
    name: 'Frames inventory',
    icon: Layers,
  },
  {
    id: 'product-inventory',
    name: 'Medical products inventory',
    icon: Package,
  },
];

const SUPER_ADMIN_NAV: NavigationItem[] = [
  {
    id: 'accounts',
    name: 'Account management',
    icon: ShieldCheck,
  },
  {
    id: 'monitoring',
    name: 'System monitoring',
    icon: Activity,
  },
];

const STAFF_NAV: NavigationItem[] = [
  {
    id: 'scheduling',
    name: 'Appointment scheduling',
    icon: Calendar,
  },
  {
    id: 'frame-conversion',
    name: 'Frames inventory',
    icon: Layers,
  },
];

function navForRole(role: AuthUser['role']): NavigationItem[] {
  if (role === 'super_admin') {
    return SUPER_ADMIN_NAV;
  }

  if (role === 'staff') {
    return STAFF_NAV;
  }

  return ADMIN_NAV;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(
    () => authService.getCurrentUser()
  );

  const [currentView, setCurrentView] = useState<string>(() => {
    const u = authService.getCurrentUser();

    return navForRole(u?.role ?? 'admin')[0].id;
  });

  const [activePatientId, setActivePatientId] =
    useState<string | null>(null);

  // =========================================================
  // MOBILE SIDEBAR
  // =========================================================

  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false);

  // =========================================================
  // LOGIN
  // =========================================================

  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setCurrentView(
            navForRole(user.role)[0].id
          );
        }}
      />
    );
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setIsMobileMenuOpen(false);
  };

  // =========================================================
  // NAVIGATION FROM SCHEDULER
  // =========================================================

  const handleNavigate = (
    viewId: string,
    patientId: string
  ) => {
    setActivePatientId(patientId);
    setCurrentView(viewId);

    // Close mobile sidebar after navigation
    setIsMobileMenuOpen(false);
  };

  // =========================================================
  // SIDEBAR NAVIGATION
  // =========================================================

  const handleSidebarClick = (itemId: string) => {
    setCurrentView(itemId);
    setActivePatientId(null);

    // Close mobile sidebar
    setIsMobileMenuOpen(false);
  };

  const navigationItems =
    navForRole(currentUser.role);

  const currentPageName =
    navigationItems.find(
      item => item.id === currentView
    )?.name || 'Management';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-800">

      {/* =====================================================
          MOBILE SIDEBAR OVERLAY
      ===================================================== */}

      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
          onClick={() =>
            setIsMobileMenuOpen(false)
          }
        />
      )}

      {/* =====================================================
          SIDEBAR
          
          Desktop:
          - Always visible
          - 256px wide

          Mobile:
          - Hidden by default
          - Slides in when menu opens
      ===================================================== */}

      <aside
        className={`
          fixed
          inset-y-0
          left-0
          z-50
          flex
          w-64
          flex-col
          bg-white
          border-r
          border-slate-200
          shadow-xl
          transition-transform
          duration-300
          ease-in-out

          lg:static
          lg:z-auto
          lg:translate-x-0
          lg:shadow-none

          ${
            isMobileMenuOpen
              ? 'translate-x-0'
              : '-translate-x-full'
          }
        `}
      >

        {/* =================================================
            SIDEBAR HEADER
        ================================================= */}

        <div className="h-16 min-h-16 flex items-center justify-between px-5 sm:px-6 border-b border-slate-200">

          <h1 className="text-base sm:text-lg font-bold text-blue-600 whitespace-nowrap">
            Gonzales Vision Clinic
          </h1>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() =>
              setIsMobileMenuOpen(false)
            }
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>

        </div>

        {/* =================================================
            NAVIGATION
        ================================================= */}

        <nav className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1">

          {navigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() =>
                  handleSidebarClick(item.id)
                }
                className={`
                  w-full
                  flex
                  items-center
                  gap-3
                  px-3
                  sm:px-4
                  py-2.5
                  rounded-lg
                  text-sm
                  font-medium
                  transition-colors
                  text-left

                  ${
                    currentView === item.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-500 hover:bg-blue-50 hover:text-slate-900'
                  }
                `}
              >
                <Icon
                  size={18}
                  className="shrink-0"
                />

                <span>
                  {item.name}
                </span>
              </button>
            );
          })}

        </nav>

        {/* =================================================
            SIDEBAR FOOTER
        ================================================= */}

        <div className="p-3 sm:p-4 border-t border-slate-200 text-xs text-slate-400 text-center">

          {currentUser.role === 'super_admin'
            ? 'Super-Admin Portal'
            : currentUser.role === 'staff'
              ? 'Staff Portal'
              : 'Admin Portal'}{' '}

          v1.3 (TS)

        </div>

      </aside>

      {/* =====================================================
          MAIN AREA
      ===================================================== */}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* =================================================
            TOP HEADER
        ================================================= */}

        <header className="h-16 min-h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-5 lg:px-8">

          {/* LEFT SIDE */}

          <div className="flex min-w-0 items-center gap-3">

            {/* Mobile menu button */}

            <button
              type="button"
              onClick={() =>
                setIsMobileMenuOpen(true)
              }
              className="lg:hidden shrink-0 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu size={22} />
            </button>

            {/* Mobile clinic name */}

            <div className="lg:hidden min-w-0">

              <p className="text-sm font-bold text-blue-600 truncate">
                Gonzales Vision Clinic
              </p>

              <p className="text-[10px] text-slate-400 truncate">
                {currentPageName}
              </p>

            </div>

            {/* Desktop breadcrumb */}

            <div className="hidden lg:flex items-center space-x-2 text-sm text-slate-500">

              <span>
                Management
              </span>

              <span>
                /
              </span>

              <span className="text-slate-800 font-medium">
                {currentPageName}
              </span>

            </div>

          </div>

          {/* =================================================
              USER AREA
          ================================================= */}

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">

            {/* User avatar */}

            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {currentUser.username
                .slice(0, 2)
                .toUpperCase()}
            </div>

            {/* User information */}

            <div className="hidden sm:block text-sm">

              <p className="font-medium text-slate-700 leading-tight max-w-[160px] truncate">
                {currentUser.full_name ||
                  currentUser.username}
              </p>

              <p className="text-[10px] text-blue-500 uppercase tracking-wider leading-tight">
                {currentUser.role.replace(
                  '_',
                  ' '
                )}
              </p>

            </div>

            {/* Logout */}

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={16} />
            </button>

          </div>

        </header>

        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">

          {/* =================================================
              ADMIN-ONLY OPERATIONAL VIEWS
          ================================================= */}

          {currentView === 'patient-info' &&
            currentUser.role === 'admin' && (
              <PatientInfoPage
                selectedPatientId={
                  activePatientId
                }
                onBack={() =>
                  setActivePatientId(null)
                }
              />
            )}

          {currentView === 'pos' &&
            currentUser.role === 'admin' && (
              <PosPage />
            )}

          {currentView ===
            'transaction-history' &&
            currentUser.role === 'admin' && (
              <TransactionHistoryPage />
            )}

          {currentView ===
            'product-inventory' &&
            currentUser.role === 'admin' && (
              <ProductInventoryPage />
            )}

          {/* =================================================
              SHARED BETWEEN ADMIN AND STAFF
          ================================================= */}

          {currentView === 'scheduling' &&
            (currentUser.role === 'admin' ||
              currentUser.role === 'staff') && (
              <SchedulingPage
                onNavigate={handleNavigate}
              />
            )}

          {currentView ===
            'frame-conversion' &&
            (currentUser.role === 'admin' ||
              currentUser.role === 'staff') && (
              <FrameConversionPage />
            )}

          {/* =================================================
              SUPER ADMIN ONLY
          ================================================= */}

          {currentView === 'accounts' &&
            currentUser.role === 'super_admin' && (
              <AccountManagementPage />
            )}

          {currentView === 'monitoring' &&
            currentUser.role === 'super_admin' && (
              <SystemMonitoringPage />
            )}

        </main>

      </div>

    </div>
  );
}