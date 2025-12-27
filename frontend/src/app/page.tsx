'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Target, 
  Globe, 
  AlertTriangle,
  Scan,
  ArrowRight,
  Terminal,
  Zap,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { programsApi, domainsApi, subdomainsApi, scansApi } from '@/lib/api';

interface Stats {
  programs: number;
  domains: number;
  subdomains: number;
  aliveHosts: number;
}

export default function HomePage() {
  const [domain, setDomain] = useState('');
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<Stats>({ programs: 0, domains: 0, subdomains: 0, aliveHosts: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    
    // Fetch real stats from the backend
    const fetchStats = async () => {
      try {
        const [programsRes, domainsRes, subdomainsRes, aliveRes] = await Promise.all([
          programsApi.getAll({ limit: 1 }).catch(() => ({ data: { pagination: { total: 0 } } })),
          domainsApi.getAll({ limit: 1 }).catch(() => ({ data: { pagination: { total: 0 } } })),
          subdomainsApi.getAll({ limit: 1 }).catch(() => ({ data: { pagination: { total: 0 } } })),
          subdomainsApi.getAll({ limit: 1, isAlive: true }).catch(() => ({ data: { pagination: { total: 0 } } })),
        ]);

        setStats({
          programs: programsRes.data?.pagination?.total ?? 0,
          domains: domainsRes.data?.pagination?.total ?? 0,
          subdomains: subdomainsRes.data?.pagination?.total ?? 0,
          aliveHosts: aliveRes.data?.pagination?.total ?? 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleStartScan = async () => {
    if (!domain.trim()) {
      setScanResult({ success: false, message: 'Please enter a domain' });
      return;
    }

    // Check if user is logged in
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      // Redirect to login with return URL
      router.push(`/login?redirect=/dashboard/scans/new?domain=${encodeURIComponent(domain)}`);
      return;
    }

    setScanning(true);
    setScanResult(null);

    try {
      // Create a new scan for the domain
      const response = await scansApi.create({
        target: domain,
        type: 'full',
        options: {
          subdomain_enum: true,
          dns_resolution: true,
          http_probe: true,
        }
      });
      
      setScanResult({ success: true, message: 'Scan started! Redirecting to dashboard...' });
      
      // Redirect to scans page after a short delay
      setTimeout(() => {
        router.push('/dashboard/scans');
      }, 1500);
    } catch (error: any) {
      console.error('Failed to start scan:', error);
      if (error.response?.status === 401) {
        router.push(`/login?redirect=/dashboard/scans/new?domain=${encodeURIComponent(domain)}`);
      } else {
        setScanResult({ 
          success: false, 
          message: error.response?.data?.message || 'Failed to start scan. Please try again.' 
        });
      }
    } finally {
      setScanning(false);
    }
  };

  const features = [
    {
      icon: Globe,
      title: 'Subdomain Discovery',
      description: 'Enumerate subdomains using multiple sources including SecurityTrails, crt.sh, and passive DNS.',
    },
    {
      icon: Scan,
      title: 'Port Scanning',
      description: 'Fast port scanning with service detection and banner grabbing.',
    },
    {
      icon: AlertTriangle,
      title: 'Vulnerability Detection',
      description: 'Automated vulnerability scanning with Nuclei templates and custom checks.',
    },
    {
      icon: Shield,
      title: 'WAF Detection',
      description: 'Identify WAF and CDN protection with fingerprinting techniques.',
    },
  ];

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid opacity-50" />
      <div className="absolute inset-0 bg-gradient-radial from-primary-900/20 via-transparent to-transparent" />
      
      {/* Floating particles */}
      {mounted && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary-500/50 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -20, 20, 0],
                opacity: [0.2, 0.8, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 border-b border-dark-800/50">
        <div className="container mx-auto px-6 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-500/20 rounded-lg border border-primary-500/30">
                <Terminal className="w-6 h-6 text-primary-400" />
              </div>
              <span className="font-display text-xl font-bold tracking-wider text-primary-400">
                BUGBOUNTY<span className="text-accent-cyan">.AUTO</span>
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard"
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/login"
                className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
              >
                Sign In
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 container mx-auto px-6 pt-20 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6">
            <span className="text-white">AUTOMATE YOUR</span>
            <br />
            <span className="text-primary-400 text-glow">BUG BOUNTY</span>
            <br />
            <span className="text-accent-cyan">RECON</span>
          </h1>
          
          <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
            Submit a domain and let our platform handle subdomain enumeration, 
            port scanning, vulnerability detection, and more. All automated.
          </p>

          {/* Domain input */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="max-w-2xl mx-auto mb-16"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-accent-cyan rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-300" />
              <div className="relative flex items-center bg-dark-900 rounded-xl border border-dark-700">
                <div className="pl-6">
                  <Target className="w-5 h-5 text-primary-500" />
                </div>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStartScan()}
                  placeholder="Enter target domain (e.g., example.com)"
                  className="flex-1 px-4 py-5 bg-transparent text-white placeholder-slate-500 focus:outline-none text-lg"
                  disabled={scanning}
                />
                <button 
                  onClick={handleStartScan}
                  disabled={scanning}
                  className="m-2 px-6 py-3 bg-primary-600 hover:bg-primary-500 disabled:bg-primary-600/50 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Start Scan
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Scan result message */}
            {scanResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                  scanResult.success 
                    ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
                    : 'bg-red-500/20 border border-red-500/30 text-red-400'
                }`}
              >
                {scanResult.success ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <span>{scanResult.message}</span>
              </motion.div>
            )}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mb-20"
          >
            {[
              { label: 'Programs', value: statsLoading ? '...' : stats.programs.toLocaleString() },
              { label: 'Domains', value: statsLoading ? '...' : stats.domains.toLocaleString() },
              { label: 'Subdomains', value: statsLoading ? '...' : stats.subdomains.toLocaleString() },
              { label: 'Alive Hosts', value: statsLoading ? '...' : stats.aliveHosts.toLocaleString() },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary-400 mb-1">{stat.value}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + index * 0.1, duration: 0.5 }}
              className="group relative"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-600 to-accent-cyan rounded-xl blur opacity-0 group-hover:opacity-30 transition duration-300" />
              <div className="relative p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-700 hover:border-primary-500/50 transition-colors h-full">
                <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary-500/30 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-center mt-20"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-semibold rounded-xl transition-all hover:scale-105"
          >
            Go to Dashboard
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-dark-800/50 py-8">
        <div className="container mx-auto px-6 text-center text-slate-500 text-sm">
          <p>Bug Bounty Automation Platform • Built for Security Researchers</p>
        </div>
      </footer>
    </div>
  );
}

