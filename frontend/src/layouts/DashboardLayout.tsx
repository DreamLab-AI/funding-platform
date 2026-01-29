// =============================================================================
// DashboardLayout - Funding Application Platform
// Layout for coordinator/assessor dashboard pages
// =============================================================================

import {
  ReactNode,
  useState,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface DashboardLayoutProps {
  children: ReactNode;
  /** Current user information */
  user?: {
    name: string;
    email: string;
    role: 'coordinator' | 'assessor' | 'admin';
    avatar?: string;
  };
  /** Page title for header */
  pageTitle?: string;
  /** Page description */
  pageDescription?: string;
  /** Header actions (buttons, etc.) */
  headerActions?: ReactNode;
}

interface SidebarItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: number;
  children?: SidebarItem[];
}

interface SidebarContextValue {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleCollapse: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const SidebarContext = createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within DashboardLayout');
  }
  return context;
}

// -----------------------------------------------------------------------------
// Navigation Data
// -----------------------------------------------------------------------------

const coordinatorNavItems: SidebarItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Funding Calls',
    href: '/dashboard/calls',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
    badge: 3,
  },
  {
    label: 'Applications',
    href: '/dashboard/applications',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    badge: 12,
  },
  {
    label: 'Assessments',
    href: '/dashboard/assessments',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Assessors',
    href: '/dashboard/assessors',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    href: '/dashboard/reports',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const assessorNavItems: SidebarItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'My Assignments',
    href: '/dashboard/assignments',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    badge: 5,
  },
  {
    label: 'Completed Reviews',
    href: '/dashboard/completed',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Profile',
    href: '/dashboard/profile',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

// -----------------------------------------------------------------------------
// Sidebar Component
// -----------------------------------------------------------------------------

interface SidebarProps {
  navItems: SidebarItem[];
  user?: DashboardLayoutProps['user'];
}

function Sidebar({ navItems, user }: SidebarProps) {
  const { isCollapsed, isMobileOpen, closeMobile } = useSidebar();
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200',
          'transform transition-all duration-200 ease-in-out',
          'lg:translate-x-0 lg:static lg:z-auto',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
          isCollapsed ? 'lg:w-20' : 'lg:w-64',
          'w-64'
        )}
      >
        {/* Logo */}
        <div className={clsx(
          'flex items-center h-16 px-4 border-b border-gray-200',
          isCollapsed && 'lg:justify-center'
        )}>
          <Link
            to="/dashboard"
            className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md"
          >
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {!isCollapsed && (
              <span className="font-bold text-lg text-gray-900 lg:block hidden">
                Funding
              </span>
            )}
            <span className="font-bold text-lg text-gray-900 lg:hidden">
              Funding Platform
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4" aria-label="Dashboard navigation">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href ||
                location.pathname.startsWith(item.href + '/');

              return (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    onClick={closeMobile}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg',
                      'text-sm font-medium transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100',
                      isCollapsed && 'lg:justify-center lg:px-2'
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span className={clsx(
                      'flex-shrink-0',
                      isActive ? 'text-primary-600' : 'text-gray-500'
                    )}>
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 lg:block hidden">{item.label}</span>
                        {item.badge && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full lg:block hidden">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    <span className="lg:hidden flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="lg:hidden px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        {user && (
          <div className={clsx(
            'p-4 border-t border-gray-200',
            isCollapsed && 'lg:flex lg:justify-center'
          )}>
            <div className={clsx(
              'flex items-center gap-3',
              isCollapsed && 'lg:flex-col'
            )}>
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-primary-700">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0 lg:block hidden">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate capitalize">
                    {user.role}
                  </p>
                </div>
              )}
              <div className="lg:hidden flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {user.role}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

// -----------------------------------------------------------------------------
// Header Component
// -----------------------------------------------------------------------------

interface HeaderProps {
  pageTitle?: string;
  pageDescription?: string;
  headerActions?: ReactNode;
  user?: DashboardLayoutProps['user'];
}

function Header({ pageTitle, pageDescription, headerActions, user }: HeaderProps) {
  const { toggleMobile, toggleCollapse, isCollapsed } = useSidebar();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={toggleMobile}
            className={clsx(
              'lg:hidden p-2 -ml-2 rounded-md',
              'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
              'focus:outline-none focus:ring-2 focus:ring-primary-500'
            )}
            aria-label="Open sidebar"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Collapse button (desktop) */}
          <button
            type="button"
            onClick={toggleCollapse}
            className={clsx(
              'hidden lg:flex p-2 -ml-2 rounded-md',
              'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
              'focus:outline-none focus:ring-2 focus:ring-primary-500'
            )}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={clsx('w-5 h-5 transition-transform', isCollapsed && 'rotate-180')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          {/* Page title */}
          {pageTitle && (
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
              {pageDescription && (
                <p className="text-sm text-gray-500 hidden sm:block">{pageDescription}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Header actions */}
          {headerActions}

          {/* Notifications */}
          <button
            type="button"
            className={clsx(
              'relative p-2 rounded-md',
              'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
              'focus:outline-none focus:ring-2 focus:ring-primary-500'
            )}
            aria-label="View notifications"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={clsx(
                'flex items-center gap-2 p-1.5 rounded-md',
                'hover:bg-gray-100',
                'focus:outline-none focus:ring-2 focus:ring-primary-500'
              )}
              aria-expanded={isUserMenuOpen}
              aria-haspopup="true"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-medium text-primary-700">
                    {user?.name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <svg className="w-4 h-4 text-gray-500 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* User dropdown */}
            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 z-50 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <Link
                    to="/dashboard/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Your Profile
                  </Link>
                  <Link
                    to="/dashboard/settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <hr className="my-1 border-gray-100" />
                  <Link
                    to="/logout"
                    className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Sign out
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// -----------------------------------------------------------------------------
// Main DashboardLayout Component
// -----------------------------------------------------------------------------

export function DashboardLayout({
  children,
  user,
  pageTitle,
  pageDescription,
  headerActions,
}: DashboardLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const toggleMobile = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const contextValue = useMemo(
    () => ({
      isCollapsed,
      isMobileOpen,
      toggleCollapse,
      toggleMobile,
      closeMobile,
    }),
    [isCollapsed, isMobileOpen, toggleCollapse, toggleMobile, closeMobile]
  );

  // Determine nav items based on user role
  const navItems = user?.role === 'assessor' ? assessorNavItems : coordinatorNavItems;

  return (
    <SidebarContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-50">
        {/* Skip link */}
        <a
          href="#main-content"
          className={clsx(
            'sr-only focus:not-sr-only',
            'focus:fixed focus:top-0 focus:left-0 focus:z-[9999]',
            'focus:bg-yellow-400 focus:text-black',
            'focus:px-4 focus:py-3 focus:font-semibold',
            'focus:outline-none'
          )}
        >
          Skip to main content
        </a>

        <div className="flex">
          <Sidebar navItems={navItems} user={user} />

          <div className="flex-1 flex flex-col min-w-0">
            <Header
              pageTitle={pageTitle}
              pageDescription={pageDescription}
              headerActions={headerActions}
              user={user}
            />

            <main
              id="main-content"
              className="flex-1 p-4 sm:p-6 lg:p-8"
              tabIndex={-1}
            >
              {children}
            </main>
          </div>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

export default DashboardLayout;
