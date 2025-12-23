'use client';

import { useState, useEffect, useRef } from 'react';
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
  Activity,
  CheckCircle,
  Info,
  X,
  Target,
  Zap,
  Database,
} from 'lucide-react';
import { clsx } from 'clsx';
import { cronApi } from '@/lib/api';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Programs', href: '/dashboard/programs', icon: FolderKanban },
  { name: 'Scores', href: '/dashboard/scores', icon: Target },
  { name: 'Domains', href: '/dashboard/domains', icon: Globe },
  { name: 'Subdomains', href: '/dashboard/subdomains', icon: Server },
  { name: 'Vulnerabilities', href: '/dashboard/vulnerabilities', icon: AlertTriangle },
  { name: 'Scans', href: '/dashboard/scans', icon: Scan },
  { name: 'Tools', href: '/dashboard/tools', icon: Terminal },
  { name: 'Fuzzing', href: '/dashboard/fuzzing', icon: Zap },
  { name: 'DNS Brute', href: '/dashboard/dns-brute', icon: Database },
  { name: 'Chaos Sync', href: '/dashboard/chaos', icon: Activity },
  { name: 'Cron Jobs', href: '/dashboard/cron', icon: Clock },
  { name: 'Alerts', href: '/dashboard/alerts', icon: Bell },
  { name: 'Reports', href: '/dashboard/reports', icon: FileText },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

const documentsSection = {
  name: 'Documents',
  icon: BookOpen,
  items: [
    { name: 'XSS Encodings', href: '/dashboard/xss-encodings', icon: Shield },
  ],
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
  const notificationRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  
  // Fetch recent job executions as notifications
  useEffect(() => {
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
  }, []);

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

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 80 : 256 }}
        transition={{ duration: 0.2 }}
        className="fixed left-0 top-0 h-screen bg-dark-900/50 backdrop-blur-xl border-r border-dark-800 z-40 flex flex-col"
      >
        {/* Logo */}
        <div className="p-4 border-b border-dark-800">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg border border-primary-500/30 shrink-0">
              <Terminal className="w-5 h-5 text-primary-400" />
            </div>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-display text-lg font-bold text-primary-400 tracking-wide"
              >
                BB<span className="text-accent-cyan">.</span>AUTO
              </motion.span>
            )}
          </Link>
        </div>

        {/* Navigation */}
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
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group',
                    isActive
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                      : 'text-slate-400 hover:bg-dark-800 hover:text-white'
                  )}
                >
                  <item.icon className={clsx(
                    'w-5 h-5 shrink-0',
                    isActive ? 'text-primary-400' : 'text-slate-500 group-hover:text-white'
                  )} />
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm font-medium"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </Link>
              );
            })}
          </nav>
          
          {/* Documents Section - Always visible at bottom */}
          <div className="p-3 border-t border-dark-800 shrink-0">
            {!sidebarCollapsed ? (
              <div>
                <button
                  onClick={() => setDocumentsExpanded(!documentsExpanded)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group',
                    isDocumentsActive
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                      : 'text-slate-400 hover:bg-dark-800 hover:text-white'
                  )}
                >
                  <documentsSection.icon className={clsx(
                    'w-5 h-5 shrink-0',
                    isDocumentsActive ? 'text-primary-400' : 'text-slate-500 group-hover:text-white'
                  )} />
                  <span className="text-sm font-medium flex-1 text-left">{documentsSection.name}</span>
                  <motion.div
                    animate={{ rotate: documentsExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
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
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 ml-4 space-y-1 pl-4 border-l border-dark-700">
                    {documentsSection.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href);
                      
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={clsx(
                            'flex items-center gap-3 px-3 py-2 rounded-lg transition-all group',
                            isActive
                              ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                              : 'text-slate-400 hover:bg-dark-800 hover:text-white'
                          )}
                        >
                          <item.icon className={clsx(
                            'w-4 h-4 shrink-0',
                            isActive ? 'text-primary-400' : 'text-slate-500 group-hover:text-white'
                          )} />
                          <span className="text-sm font-medium">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className={clsx(
                  'flex items-center justify-center p-2 rounded-lg',
                  isDocumentsActive
                    ? 'bg-primary-500/20 border border-primary-500/30'
                    : 'text-slate-400'
                )}>
                  <documentsSection.icon className={clsx(
                    'w-5 h-5',
                    isDocumentsActive ? 'text-primary-400' : 'text-slate-500'
                  )} />
                </div>
                {documentsSection.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={clsx(
                        'flex items-center justify-center p-2 rounded-lg transition-all',
                        isActive
                          ? 'bg-primary-500/20 border border-primary-500/30'
                          : 'text-slate-400 hover:bg-dark-800 hover:text-white'
                      )}
                      title={item.name}
                    >
                      <item.icon className={clsx(
                        'w-4 h-4',
                        isActive ? 'text-primary-400' : 'text-slate-500'
                      )} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Collapse button */}
        <div className="p-3 border-t border-dark-800">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-dark-800 hover:text-white transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className={clsx(
        'flex-1 transition-all duration-200',
        sidebarCollapsed ? 'ml-20' : 'ml-64'
      )}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Search */}
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search domains, vulnerabilities..."
                className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <div className="relative" ref={notificationRef}>
                <button 
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>
                
                <AnimatePresence>
                  {notificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 top-full mt-2 w-80 bg-dark-900 border border-dark-700 rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-3 border-b border-dark-700 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-white">Recent Activity</h3>
                        <button
                          onClick={() => setNotificationsOpen(false)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center text-slate-500">
                            No recent activity
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className="p-3 border-b border-dark-800 last:border-b-0 hover:bg-dark-800/50 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                {getNotificationIcon(notif.type)}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white capitalize">
                                    {notif.title}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {notif.message}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {notif.time}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-2 border-t border-dark-700">
                        <Link
                          href="/dashboard/cron"
                          onClick={() => setNotificationsOpen(false)}
                          className="block w-full text-center py-2 text-sm text-primary-400 hover:text-primary-300"
                        >
                          View all activity
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="h-8 w-px bg-dark-700" />
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-400">U</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

