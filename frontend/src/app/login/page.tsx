'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Terminal, Mail, Lock, Eye, EyeOff, ArrowRight, Github, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useIsMobile, useReducedMotion, useAnimationConfig } from '@/hooks';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const animationConfig = useAnimationConfig(isMobile);

  // Reduce particle count on mobile for better performance
  // Disable particles entirely if user prefers reduced motion
  const particleCount = prefersReducedMotion ? 0 : (isMobile ? 6 : 15);

  // Animation duration based on preferences
  const animationDuration = prefersReducedMotion ? 0.01 : (isMobile ? 0.3 : 0.5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authApi.login(email, password);
      const { accessToken } = response.data;
      localStorage.setItem('token', accessToken);
      // Redirect to the original destination or dashboard
      window.location.href = redirectUrl || '/dashboard';
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.response?.data?.message || 'Invalid credentials');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center relative overflow-hidden px-4 sm:px-6 py-8 sm:py-0">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-gradient-radial from-primary-900/20 via-transparent to-transparent" />

      {/* Animated particles - reduced on mobile for performance, disabled for reduced motion */}
      {particleCount > 0 && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(particleCount)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary-500/30 rounded-full"
              initial={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
                y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
              }}
              animate={{
                y: [null, -30, 30],
                opacity: [0.1, 0.6, 0.1],
              }}
              transition={{
                duration: isMobile ? 6 + Math.random() * 2 : 4 + Math.random() * 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: animationDuration }}
        className="relative z-10 w-full max-w-md px-0 sm:px-6"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary-500/20 rounded-xl border border-primary-500/30">
              <Terminal className="w-8 h-8 text-primary-400" />
            </div>
          </Link>
          <h1 className="font-display text-2xl font-bold text-white">
            BB<span className="text-accent-cyan">.</span>AUTO
          </h1>
          <p className="text-slate-400 mt-2">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary-600/50 to-accent-cyan/50 rounded-2xl blur opacity-30" />
          <div className="relative bg-dark-900/90 backdrop-blur-xl rounded-2xl border border-dark-800 p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
              {/* Email */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-11 pr-4 py-3 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors touch-manipulation text-base"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-12 py-3 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors touch-manipulation text-base"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -mr-3 touch-manipulation"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 text-sm">
                <label className="flex items-center gap-2 text-slate-400 cursor-pointer touch-manipulation">
                  <input type="checkbox" className="w-5 h-5 sm:w-4 sm:h-4 rounded border-dark-700 bg-dark-800 text-primary-500 focus:ring-primary-500" />
                  Remember me
                </label>
                <Link href="/forgot-password" className="text-primary-400 hover:text-primary-300 transition-colors touch-manipulation">
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 min-h-[44px] bg-primary-600 hover:bg-primary-500 active:bg-primary-700 disabled:bg-primary-600/50 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors touch-manipulation"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-dark-700" />
              <span className="text-xs text-slate-500">or continue with</span>
              <div className="flex-1 h-px bg-dark-700" />
            </div>

            {/* Social Login */}
            <button className="w-full py-3 min-h-[44px] bg-dark-800 hover:bg-dark-700 active:bg-dark-600 border border-dark-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors touch-manipulation">
              <Github className="w-5 h-5" />
              GitHub
            </button>

            {/* Sign Up Link */}
            <p className="text-center text-sm text-slate-400 mt-6">
              Don't have an account?{' '}
              <Link href="/register" className="text-primary-400 hover:text-primary-300 transition-colors touch-manipulation">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

