// =============================================================================
// Footer Component
// =============================================================================

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex justify-center space-x-6 md:order-2">
            <a
              href="/privacy"
              className="text-gray-400 hover:text-gray-500 text-sm"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              className="text-gray-400 hover:text-gray-500 text-sm"
            >
              Terms of Service
            </a>
            <a
              href="/accessibility"
              className="text-gray-400 hover:text-gray-500 text-sm"
            >
              Accessibility
            </a>
            <a
              href="/contact"
              className="text-gray-400 hover:text-gray-500 text-sm"
            >
              Contact
            </a>
          </div>
          <div className="mt-4 md:mt-0 md:order-1">
            <p className="text-center text-sm text-gray-400">
              &copy; {currentYear} Funding Platform. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
