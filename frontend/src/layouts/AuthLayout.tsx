// =============================================================================
// AuthLayout - Funding Application Platform
// Layout for login, register, and password reset pages
// =============================================================================

import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AuthLayoutProps {
  children: ReactNode;
  /** Title displayed above the form */
  title: string;
  /** Subtitle/description */
  subtitle?: string;
  /** Show "back to home" link */
  showBackLink?: boolean;
  /** Custom footer content */
  footer?: ReactNode;
  /** Form variant */
  variant?: 'default' | 'wide';
}

// -----------------------------------------------------------------------------
// Background Pattern Component
// -----------------------------------------------------------------------------

function BackgroundPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600/5 via-transparent to-primary-600/10" />

      {/* Grid pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.02]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="grid-pattern"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
      </svg>

      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary-500/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary-500/5 rounded-full blur-3xl" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Logo Component
// -----------------------------------------------------------------------------

function Logo() {
  return (
    <Link
      to="/"
      className={clsx(
        'flex items-center gap-3',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-lg'
      )}
    >
      <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div>
        <span className="block text-xl font-bold text-gray-900">Funding Platform</span>
        <span className="block text-xs text-gray-500">UK Research & Innovation</span>
      </div>
    </Link>
  );
}

// -----------------------------------------------------------------------------
// Feature Highlight Component (for side panel)
// -----------------------------------------------------------------------------

function FeatureHighlights() {
  const features = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: 'Secure & Compliant',
      description: 'GDPR compliant with end-to-end encryption',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: 'Fast Processing',
      description: 'Streamlined application workflow',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: 'Expert Review',
      description: 'Rigorous peer review process',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Welcome to UK Funding Platform
        </h2>
        <p className="text-primary-100">
          Supporting innovation and research excellence through accessible funding opportunities.
        </p>
      </div>

      <div className="space-y-6">
        {features.map((feature) => (
          <div key={feature.title} className="flex gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center text-white">
              {feature.icon}
            </div>
            <div>
              <h3 className="font-semibold text-white">{feature.title}</h3>
              <p className="text-sm text-primary-100">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-8 border-t border-white/10">
        <blockquote className="text-primary-100 italic">
          "The platform has transformed how we manage research funding applications.
          The streamlined process has reduced our processing time by 40%."
        </blockquote>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white font-semibold">
            JD
          </div>
          <div>
            <p className="text-white font-medium">Dr. Jane Doe</p>
            <p className="text-sm text-primary-200">Research Council</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main AuthLayout Component
// -----------------------------------------------------------------------------

export function AuthLayout({
  children,
  title,
  subtitle,
  showBackLink = true,
  footer,
  variant = 'default',
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Skip link */}
      <a
        href="#auth-form"
        className={clsx(
          'sr-only focus:not-sr-only',
          'focus:fixed focus:top-0 focus:left-0 focus:z-[9999]',
          'focus:bg-yellow-400 focus:text-black',
          'focus:px-4 focus:py-3 focus:font-semibold',
          'focus:outline-none'
        )}
      >
        Skip to form
      </a>

      {/* Left side - Feature panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 bg-primary-600 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-700" />
        <div className="absolute inset-0 bg-[url('/images/pattern.svg')] opacity-10" />
        <div className="relative z-10 flex flex-col justify-center p-12 xl:p-16">
          <FeatureHighlights />
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col bg-gray-50 relative">
        <BackgroundPattern />

        {/* Header */}
        <header className="relative z-10 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <Logo />
            {showBackLink && (
              <Link
                to="/"
                className={clsx(
                  'inline-flex items-center gap-2 text-sm font-medium',
                  'text-gray-600 hover:text-gray-900',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-md'
                )}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to home
              </Link>
            )}
          </div>
        </header>

        {/* Main content */}
        <main
          id="auth-form"
          className="relative z-10 flex-1 flex items-center justify-center p-6 sm:p-8"
          tabIndex={-1}
        >
          <div className={clsx(
            'w-full',
            variant === 'wide' ? 'max-w-xl' : 'max-w-md'
          )}>
            {/* Title section */}
            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 text-gray-600">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Form card */}
            <div className="bg-white rounded-xl shadow-xl shadow-gray-200/50 border border-gray-200 p-6 sm:p-8">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="mt-6 text-center">
                {footer}
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 p-6 sm:p-8 text-center">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} UK Funding Platform. All rights reserved.
          </p>
          <div className="mt-2 flex justify-center gap-4 text-sm">
            <Link
              to="/privacy"
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            >
              Terms of Service
            </Link>
            <Link
              to="/accessibility"
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            >
              Accessibility
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default AuthLayout;
