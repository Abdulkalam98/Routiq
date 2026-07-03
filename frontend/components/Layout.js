import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ChartBarIcon,
  KeyIcon,
  CreditCardIcon,
  ChatBubbleLeftRightIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import { getToken, logout } from '../lib/auth';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: ChartBarIcon },
  { name: 'Playground', href: '/playground', icon: ChatBubbleLeftRightIcon },
  { name: 'API Keys', href: '/keys', icon: KeyIcon },
  { name: 'Billing', href: '/billing', icon: CreditCardIcon },
];

function TopBarUser({ isDark }) {
  const router = useRouter();
  const [email, setEmail] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setEmail(payload.email || '');
    } catch {}
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="flex items-center gap-4">
      {email && <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{email}</span>}
      <button
        onClick={handleLogout}
        className={`text-sm font-medium ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
      >
        Logout
      </button>
    </div>
  );
}

export default function Layout({ children, dark = false }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // All authenticated pages use dark theme
  const isDark = true;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-dark-900' : 'bg-gray-50'}`}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className={`relative flex w-64 flex-col h-full shadow-xl ${isDark ? 'bg-dark-800' : 'bg-white'}`}>
            <SidebarContent
              currentPath={router.pathname}
              onClose={() => setSidebarOpen(false)}
              isDark={isDark}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className={`flex flex-col flex-grow ${isDark ? 'bg-dark-800 border-r border-dark-600' : 'bg-white border-r border-gray-200'}`}>
          <SidebarContent currentPath={router.pathname} isDark={isDark} />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className={`sticky top-0 z-30 ${isDark ? 'bg-dark-800 border-b border-dark-600' : 'bg-white border-b border-gray-200'}`}>
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`lg:hidden p-2 ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Bars3Icon className="w-6 h-6" />
            </button>

            <div className="flex-1" />

            <TopBarUser isDark={isDark} />
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({ currentPath, onClose, isDark }) {
  return (
    <>
      {/* Logo */}
      <div className={`flex items-center justify-between h-16 px-6 border-b ${isDark ? 'border-dark-600' : 'border-gray-200'}`}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Routiq</span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className={`lg:hidden p-1 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? isDark
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-primary-50 text-primary-700'
                  : isDark
                    ? 'text-gray-400 hover:bg-dark-700 hover:text-gray-200'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <item.icon
                className={`w-5 h-5 ${
                  isActive
                    ? isDark ? 'text-red-400' : 'text-primary-500'
                    : isDark ? 'text-gray-500' : 'text-gray-400'
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className={`p-3 border-t ${isDark ? 'border-dark-600' : 'border-gray-200'}`}>
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isDark
              ? 'text-gray-400 hover:bg-dark-700 hover:text-gray-200'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <ArrowLeftOnRectangleIcon className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          Back to Home
        </Link>
      </div>
    </>
  );
}
