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
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden px-4 sm:px-6 py-8 sm:py-0">
      {/* Background effects - subtle for iOS */}
      <div className="absolute inset-0 bg-gradient-radial from-primary-900/10 via-transparent to-transparent" />

      {/* Animated particles - reduced on mobile for performance, disabled for reduced motion */}
      {particleCount > 0 && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(particleCount)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary-500/20 rounded-full"
              initial={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
                y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
              }}
              animate={{
                y: [null, -30, 30],
                opacity: [0.1, 0.4, 0.1],
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
        transition={{ duration: animationDuration, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10 w-full max-w-md px-0 sm:px-6"
      >
        {/* Logo - iOS style */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <div className="p-3.5 bg-primary-500/20 rounded-2xl">
              <Terminal className="w-8 h-8 text-primary-400" />
            </div>
          </Link>
          <h1 className="text-[28px] font-bold text-white tracking-tight">
            BB<span className="text-primary-400">.</span>AUTO
          </h1>
          <p className="text-[#8e8e93] mt-2 text-[15px]">Sign in to your account</p>
        </div>

        {/* Login Form - iOS style */}
        <div className="relative">
          <div className="relative bg-[#1c1c1e] rounded-2xl p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              {error && (
                <div className="p-3 bg-[#ff453a]/15 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#ff453a] flex-shrink-0" />
                  <p className="text-[15px] text-[#ff453a]">{error}</p>
                </div>
              )}
              {/* Email */}
              <div>
                <label className="block text-[13px] text-[#8e8e93] mb-2 font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#636366]" />
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3.5 min-h-[50px] bg-[#2c2c2e] border-none rounded-xl text-white placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all touch-manipulation text-[17px]"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[13px] text-[#8e8e93] mb-2 font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#636366]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-14 py-3.5 min-h-[50px] bg-[#2c2c2e] border-none rounded-xl text-white placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all touch-manipulation text-[17px]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#636366] hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation rounded-lg"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 text-[15px]">
                <label className="flex items-center gap-2.5 text-[#8e8e93] cursor-pointer touch-manipulation">
                  <input type="checkbox" className="w-5 h-5 rounded-md border-none bg-[#2c2c2e] text-primary-500 focus:ring-primary-500 focus:ring-offset-0" />
                  Remember me
                </label>
                <Link href="/forgot-password" className="text-primary-400 hover:text-primary-300 transition-colors touch-manipulation font-medium">
                  Forgot password?
                </Link>
              </div>

              {/* Submit - iOS style button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 min-h-[50px] bg-primary-500 hover:bg-primary-600 active:scale-[0.98] disabled:bg-primary-500/50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all touch-manipulation text-[17px]"
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
              <div className="flex-1 h-px bg-[rgba(84,84,88,0.65)]" />
              <span className="text-[13px] text-[#636366]">or continue with</span>
              <div className="flex-1 h-px bg-[rgba(84,84,88,0.65)]" />
            </div>

            {/* Social Login - iOS style */}
            <button className="w-full py-3.5 min-h-[50px] bg-[#2c2c2e] hover:bg-[#3c3c3e] active:scale-[0.98] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all touch-manipulation text-[17px]">
              <Github className="w-5 h-5" />
              GitHub
            </button>

            {/* Sign Up Link */}
            <p className="text-center text-[15px] text-[#8e8e93] mt-6">
              Don't have an account?{' '}
              <Link href="/register" className="text-primary-400 hover:text-primary-300 transition-colors touch-manipulation font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

