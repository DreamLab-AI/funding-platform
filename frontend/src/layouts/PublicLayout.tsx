// =============================================================================
// PublicLayout - Funding Application Platform
// Layout for public/applicant-facing pages
// =============================================================================

import { ReactNode, useState, useCallback } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PublicLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

// -----------------------------------------------------------------------------
// Navigation Data
// -----------------------------------------------------------------------------

const mainNavItems: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Funding Calls', href: '/calls' },
  { label: 'Dashboard', href: '/dashboard' },
];

const footerNavSections = [
  {
    title: 'Funding',
    links: [
      { label: 'Browse Opportunities', href: '/opportunities' },
      { label: 'Application Process', href: '/help/application-process' },
      { label: 'Eligibility', href: '/help/eligibility' },
      { label: 'FAQs', href: '/help/faqs' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Centre', href: '/help' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'Technical Support', href: '/help/technical' },
      { label: 'Accessibility', href: '/accessibility' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
      { label: 'Data Protection', href: '/data-protection' },
    ],
  },
];

// -----------------------------------------------------------------------------
// Skip Link Component
// -----------------------------------------------------------------------------

function SkipLink() {
  return (
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
  );
}

// -----------------------------------------------------------------------------
// Header Component
// -----------------------------------------------------------------------------

interface HeaderProps {
  onMenuToggle: () => void;
  isMenuOpen: boolean;
}

function Header({ onMenuToggle, isMenuOpen }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      {/* Government banner */}
      <div className="bg-primary-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10 text-sm">
            <span className="flex items-center gap-2">
              <svg className="w-6 h-6" viewBox="0 0 36 32" fill="currentColor">
                <path d="M18 0L0 8v16l18 8 18-8V8L18 0zm0 2.5L32.5 9v6.5L18 22 3.5 15.5V9L18 2.5z" />
              </svg>
              <span className="hidden sm:inline">UK Funding Platform</span>
            </span>
            <a
              href="https://www.gov.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline focus:outline-none focus:ring-2 focus:ring-yellow-400"
            >
              GOV.UK
            </a>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 font-bold text-xl text-gray-900 hover:text-primary-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-md"
          >
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="hidden md:block">Funding Platform</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {mainNavItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User actions */}
          <div className="flex items-center gap-3">
            <Link
              to="/auth/login"
              className={clsx(
                'hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium',
                'text-gray-700 hover:text-gray-900',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-md'
              )}
            >
              Sign in
            </Link>
            <Link
              to="/auth/register"
              className={clsx(
                'inline-flex items-center px-4 py-2 text-sm font-medium',
                'text-white bg-primary-600 hover:bg-primary-700',
                'rounded-md shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                'transition-colors'
              )}
            >
              Register
            </Link>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={onMenuToggle}
              className={clsx(
                'md:hidden p-2 rounded-md',
                'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
              )}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav
            id="mobile-menu"
            className="md:hidden py-4 border-t border-gray-200"
            aria-label="Mobile navigation"
          >
            <div className="space-y-1">
              {mainNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    clsx(
                      'block px-4 py-3 rounded-md text-base font-medium',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="pt-4 mt-4 border-t border-gray-200">
                <Link
                  to="/auth/login"
                  className="block px-4 py-3 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

// -----------------------------------------------------------------------------
// Breadcrumb Component
// -----------------------------------------------------------------------------

function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  if (pathSegments.length === 0) return null;

  const breadcrumbs = pathSegments.map((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/');
    const label = segment
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return { label, href };
  });

  return (
    <nav aria-label="Breadcrumb" className="bg-gray-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ol className="flex items-center gap-2 py-3 text-sm">
          <li>
            <Link
              to="/"
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            >
              Home
            </Link>
          </li>
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.href} className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {index === breadcrumbs.length - 1 ? (
                <span className="font-medium text-gray-900" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.href}
                  className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

// -----------------------------------------------------------------------------
// Footer Component
// -----------------------------------------------------------------------------

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300" role="contentinfo">
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand section */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="font-bold text-lg text-white">Funding Platform</span>
            </Link>
            <p className="text-sm text-gray-400 mb-4">
              Supporting innovation and research through accessible funding opportunities.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                aria-label="Twitter"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                aria-label="LinkedIn"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Navigation sections */}
          {footerNavSections.map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold text-white mb-4">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">
              &copy; {currentYear} UK Funding Platform. All rights reserved.
            </p>
            <p className="text-sm text-gray-500">
              Built with accessibility in mind. WCAG 2.1 AA compliant.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// -----------------------------------------------------------------------------
// Main PublicLayout Component
// -----------------------------------------------------------------------------

export function PublicLayout({ children }: PublicLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <SkipLink />
      <Header onMenuToggle={handleMenuToggle} isMenuOpen={isMenuOpen} />
      <Breadcrumbs />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </div>
  );
}

export default PublicLayout;
