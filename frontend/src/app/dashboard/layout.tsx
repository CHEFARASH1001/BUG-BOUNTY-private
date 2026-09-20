'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  Globe,
  Server,
  AlertTriangle,
  Scan,
  FileText,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  Terminal,
  LogOut,
  Search,
  Shield,
  BookOpen,
  ChevronDown,
  Clock,
  CheckCircle,
  Info,
  X,
  Target,
  Zap,
  Database,
  Brain,
  Loader2,
  Menu,
} from 'lucide-react';
import { clsx } from 'clsx';
import { cronApi, authApi } from '@/lib/api';
import { useIsMobile, useIsSmallMobile, useMobileNav } from '@/hooks';
import { MobileSidebar } from '@/components/MobileSidebar';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Checklist', href: '/dashboard/checklist', icon: CheckCircle },
  { name: 'Programs', href: '/dashboard/programs', icon: FolderKanban },
  { name: 'Scores', href: '/dashboard/scores', icon: Target },
  { name: 'Domains', href: '/dashboard/domains', icon: Globe },
  { name: 'Subdomains', href: '/dashboard/subdomains', icon: Server },
  { name: 'Vulnerabilities', href: '/dashboard/vulnerabilities', icon: AlertTriangle },
  { name: 'Scans', href: '/dashboard/scans', icon: Scan },
  { name: 'Tools', href: '/dashboard/tools', icon: Terminal },
  { name: 'HexStrike AI', href: '/dashboard/hexstrike', icon: Brain },
  { name: 'XSS Scanner', href: '/dashboard/xss', icon: Shield },
  { name: 'Fuzzing', href: '/dashboard/fuzzing', icon: Zap },
  { name: 'DNS Brute', href: '/dashboard/dns-brute', icon: Database },
  { name: 'Cron Jobs', href: '/dashboard/cron', icon: Clock },
  { name: 'Alerts', href: '/dashboard/alerts', icon: Bell },
  { name: 'Reports', href: '/dashboard/reports', icon: FileText },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

// Reserved for future documentation links. Keep the section hidden until it
// contains a maintained, user-facing document.
const documentsSection = {
  name: 'Documents',
  icon: BookOpen,
  items: [] as Array<{ name: string; href: string; icon: typeof Shield }>,
};

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  time: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [documentsExpanded, setDocumentsExpanded] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Mobile navigation state
  const isMobile = useIsMobile();
  const isSmallMobile = useIsSmallMobile();
  const { isOpen: isMobileMenuOpen, openMobileMenu, closeMobileMenu } = useMobileNav();

  // Mobile search expansion state
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle search expansion toggle
  const toggleSearch = useCallback(() => {
    setIsSearchExpanded(prev => !prev);
  }, []);

  // Auto-focus search input when expanded on mobile
  useEffect(() => {
    if (isSearchExpanded && isMobile && searchInputRef.current) {
      // Small delay to ensure the input is visible before focusing
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSearchExpanded, isMobile]);

  // Close search when clicking outside on mobile
  const searchContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isMobile || !isSearchExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isSearchExpanded]);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        await authApi.me();
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  // Fetch recent job executions as notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchNotifications = async () => {
      try {
        const response = await cronApi.getExecutions({ limit: 5 });
        const executions = response.data || [];
        const notifs: Notification[] = executions.map((exec: any) => ({
          id: exec._id,
          title: exec.jobName.replace('watch_', '').replace(/_/g, ' '),
          message: `Status: ${exec.status}${exec.duration ? ` (${(exec.duration / 1000).toFixed(1)}s)` : ''}`,
          type: exec.status === 'completed' ? 'success' : exec.status === 'failed' ? 'error' : 'info',
          time: new Date(exec.startedAt).toLocaleString(),
        }));
        setNotifications(notifs);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };
    fetchNotifications();
  }, [isAuthenticated]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    // Clear any stored tokens
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      sessionStorage.clear();
    }
    // Redirect to login
    router.push('/login');
  };

  // Check if any document item is active
  const isDocumentsActive = documentsSection.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href)
  );

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Mobile Sidebar Overlay */}
      <MobileSidebar
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        navigation={navigation}
        documentsSection={documentsSection}
      />

      {/* Desktop Sidebar - iOS style */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 80 : 260 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="fixed left-0 top-0 h-screen bg-[#1c1c1e]/95 backdrop-blur-[20px] border-r border-[rgba(84,84,88,0.65)] z-40 flex-col hidden md:flex"
      >
        {/* Logo - iOS style */}
        <div className="p-4 border-b border-[rgba(84,84,88,0.65)]">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-500/20 rounded-xl shrink-0">
              <Terminal className="w-5 h-5 text-primary-400" />
            </div>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-lg font-semibold text-white tracking-tight"
              >
                BB<span className="text-primary-400">.</span>AUTO
              </motion.span>
            )}
          </Link>
        </div>

        {/* Navigation - iOS style */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group',
                    isActive
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white'
                  )}
                >
                  <item.icon className={clsx(
                    'w-5 h-5 shrink-0',
                    isActive ? 'text-primary-400' : 'text-[#8e8e93] group-hover:text-white'
                  )} />
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[15px] font-medium"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Documents Section - iOS style */}
          {documentsSection.items.length > 0 && (
          <div className="p-3 border-t border-[rgba(84,84,88,0.65)] shrink-0">
            {!sidebarCollapsed ? (
              <div>
                <button
                  onClick={() => setDocumentsExpanded(!documentsExpanded)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group',
                    isDocumentsActive
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white'
                  )}
                >
                  <documentsSection.icon className={clsx(
                    'w-5 h-5 shrink-0',
                    isDocumentsActive ? 'text-primary-400' : 'text-[#8e8e93] group-hover:text-white'
                  )} />
                  <span className="text-[15px] font-medium flex-1 text-left">{documentsSection.name}</span>
                  <motion.div
                    animate={{ rotate: documentsExpanded ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  </motion.div>
                </button>

                <motion.div
                  initial={false}
                  animate={{
                    height: documentsExpanded ? 'auto' : 0,
                    opacity: documentsExpanded ? 1 : 0
                  }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 ml-4 space-y-1 pl-4 border-l border-[rgba(84,84,88,0.65)]">
                    {documentsSection.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href);

                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={clsx(
                            'flex items-center gap-3 px-3 py-2 rounded-xl transition-all group',
                            isActive
                              ? 'bg-primary-500/20 text-primary-400'
                              : 'text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white'
                          )}
                        >
                          <item.icon className={clsx(
                            'w-4 h-4 shrink-0',
                            isActive ? 'text-primary-400' : 'text-[#8e8e93] group-hover:text-white'
                          )} />
                          <span className="text-[15px] font-medium">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className={clsx(
                  'flex items-center justify-center p-2 rounded-xl',
                  isDocumentsActive
                    ? 'bg-primary-500/20'
                    : 'text-[#8e8e93]'
                )}>
                  <documentsSection.icon className={clsx(
                    'w-5 h-5',
                    isDocumentsActive ? 'text-primary-400' : 'text-[#8e8e93]'
                  )} />
                </div>
                {documentsSection.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={clsx(
                        'flex items-center justify-center p-2 rounded-xl transition-all',
                        isActive
                          ? 'bg-primary-500/20'
                          : 'text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white'
                      )}
                      title={item.name}
                    >
                      <item.icon className={clsx(
                        'w-4 h-4',
                        isActive ? 'text-primary-400' : 'text-[#8e8e93]'
                      )} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </div>

        {/* Collapse button - iOS style */}
        <div className="p-3 border-t border-[rgba(84,84,88,0.65)]">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-white transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span className="text-[15px] font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className={clsx(
        'flex-1 transition-all duration-200',
        'ml-0 md:ml-64',
        !isMobile && sidebarCollapsed && 'md:ml-20',
        !isMobile && !sidebarCollapsed && 'md:ml-64'
      )}>
        {/* Top bar - iOS style */}
        <header
          className="sticky top-0 z-30 bg-[rgba(28,28,30,0.72)] backdrop-blur-[20px] border-b border-[rgba(84,84,88,0.65)]"
          data-testid="dashboard-header"
        >
          <div className={clsx(
            "flex items-center justify-between py-3 transition-all",
            // Responsive padding: smaller on mobile, larger on desktop
            "px-3 sm:px-4 md:px-6"
          )}>
            {/* Mobile hamburger menu button - iOS style */}
            <button
              onClick={openMobileMenu}
              className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] rounded-xl transition-colors touch-manipulation mr-2"
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
              data-testid="hamburger-menu-button"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Search - Responsive: icon on mobile, full input on desktop */}
            <div
              ref={searchContainerRef}
              className={clsx(
                "relative transition-all duration-200",
                // On mobile: show icon button or expanded full-width input
                isMobile ? (
                  isSearchExpanded
                    ? "flex-1 max-w-full"
                    : "flex-shrink-0"
                ) : "max-w-md flex-1"
              )}
              data-testid="search-container"
            >
              {/* Mobile: Search icon button (when collapsed) - iOS style */}
              {isMobile && !isSearchExpanded && (
                <button
                  onClick={toggleSearch}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] rounded-xl transition-colors touch-manipulation"
                  aria-label="Open search"
                  data-testid="search-icon-button"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}

              {/* Search input - iOS style */}
              {(!isMobile || isSearchExpanded) && (
                <motion.div
                  initial={isMobile ? { opacity: 0, width: 0 } : false}
                  animate={{ opacity: 1, width: '100%' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  className="relative w-full"
                  data-testid="search-input-container"
                >
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636366]" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={isSmallMobile ? "Search..." : "Search domains, vulnerabilities..."}
                    className={clsx(
                      "w-full pl-10 pr-4 bg-[#2c2c2e] border-none rounded-xl text-[15px] text-white placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all",
                      "py-2.5 sm:py-2.5"
                    )}
                    data-testid="search-input"
                  />
                  {/* Close button for mobile expanded search */}
                  {isMobile && isSearchExpanded && (
                    <button
                      onClick={() => setIsSearchExpanded(false)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#8e8e93] hover:text-white transition-colors"
                      aria-label="Close search"
                      data-testid="search-close-button"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              )}
            </div>

            {/* Actions - iOS style */}
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className={clsx(
                    "relative text-[#8e8e93] hover:text-white transition-colors touch-manipulation",
                    "p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[#2c2c2e]"
                  )}
                  aria-label="Notifications"
                  data-testid="notifications-button"
                >
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#ff453a] rounded-full" />
                  )}
                </button>

                <AnimatePresence>
                  {notificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                      className={clsx(
                        "absolute right-0 top-full mt-2 bg-[#2c2c2e] border border-[rgba(84,84,88,0.65)] rounded-2xl shadow-ios-xl z-50 overflow-hidden",
                        "w-80 sm:w-96"
                      )}
                    >
                      <div className="p-4 border-b border-[rgba(84,84,88,0.65)] flex items-center justify-between">
                        <h3 className="text-[17px] font-semibold text-white">Recent Activity</h3>
                        <button
                          onClick={() => setNotificationsOpen(false)}
                          className="p-1.5 text-[#8e8e93] hover:text-white rounded-lg hover:bg-[#3c3c3e]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-[#8e8e93]">
                            No recent activity
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className="p-4 border-b border-[rgba(84,84,88,0.65)] last:border-b-0 hover:bg-[#3c3c3e] transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                {getNotificationIcon(notif.type)}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[15px] font-medium text-white capitalize">
                                    {notif.title}
                                  </p>
                                  <p className="text-[13px] text-[#8e8e93] mt-0.5">
                                    {notif.message}
                                  </p>
                                  <p className="text-[12px] text-[#636366] mt-1">
                                    {notif.time}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-3 border-t border-[rgba(84,84,88,0.65)]">
                        <Link
                          href="/dashboard/cron"
                          onClick={() => setNotificationsOpen(false)}
                          className="block w-full text-center py-2.5 text-[15px] font-medium text-primary-400 hover:text-primary-300 rounded-xl hover:bg-primary-500/10"
                        >
                          View all activity
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Divider - hide on small mobile */}
              <div className="h-8 w-px bg-[rgba(84,84,88,0.65)] hidden sm:block" />

              {/* User profile and logout - iOS style */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* User avatar - hide on small mobile */}
                <div className="w-9 h-9 bg-primary-500/20 rounded-full items-center justify-center hidden sm:flex">
                  <span className="text-[15px] font-semibold text-primary-400">U</span>
                </div>
                <button
                  onClick={handleLogout}
                  className={clsx(
                    "text-[#8e8e93] hover:text-[#ff453a] transition-colors touch-manipulation",
                    "p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[#2c2c2e]"
                  )}
                  title="Logout"
                  aria-label="Logout"
                  data-testid="logout-button"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
