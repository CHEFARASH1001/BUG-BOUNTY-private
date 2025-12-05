'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Shield,
  Bell,
  Key,
  Globe,
  Database,
  Webhook,
  Mail,
  MessageSquare,
  Slack,
  Save,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'integrations', label: 'Integrations', icon: Webhook },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="w-7 h-7 text-primary-400" />
          Settings
        </h1>
        <p className="text-slate-400 mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-dark-800'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">Profile Information</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Full Name</label>
                      <input
                        type="text"
                        defaultValue="John Doe"
                        className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Email</label>
                      <input
                        type="email"
                        defaultValue="john@example.com"
                        className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Username</label>
                      <input
                        type="text"
                        defaultValue="johndoe"
                        className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Timezone</label>
                      <select className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500/50">
                        <option>UTC</option>
                        <option>America/New_York</option>
                        <option>Europe/London</option>
                        <option>Asia/Tokyo</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Bio</label>
                  <textarea
                    rows={3}
                    defaultValue="Security researcher focused on web application vulnerabilities."
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 resize-none"
                  />
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">Password</h2>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Current Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">New Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Confirm New Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
                      />
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-dark-800">
                  <h2 className="text-lg font-semibold text-white mb-4">Two-Factor Authentication</h2>
                  <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-yellow-400" />
                      <div>
                        <p className="text-white font-medium">2FA is not enabled</p>
                        <p className="text-sm text-slate-400">Add an extra layer of security to your account</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors">
                      Enable 2FA
                    </button>
                  </div>
                </div>
                <div className="pt-4 border-t border-dark-800">
                  <h2 className="text-lg font-semibold text-white mb-4">Active Sessions</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-green-400" />
                        <div>
                          <p className="text-white font-medium">Chrome on Windows</p>
                          <p className="text-sm text-slate-400">Current session • Last active now</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Active</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-white font-medium">Firefox on macOS</p>
                          <p className="text-sm text-slate-400">Last active 2 days ago</p>
                        </div>
                      </div>
                      <button className="text-red-400 text-sm hover:text-red-300 transition-colors">Revoke</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-white mb-4">Notification Preferences</h2>
                <div className="space-y-4">
                  {[
                    { id: 'scan-complete', label: 'Scan Completed', desc: 'Get notified when a scan finishes' },
                    { id: 'vuln-found', label: 'Vulnerability Found', desc: 'Alert for new vulnerabilities' },
                    { id: 'critical-vuln', label: 'Critical Vulnerabilities', desc: 'Immediate alerts for critical findings' },
                    { id: 'weekly-report', label: 'Weekly Summary', desc: 'Receive weekly activity reports' },
                    { id: 'system-updates', label: 'System Updates', desc: 'Platform updates and maintenance' },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{item.label}</p>
                        <p className="text-sm text-slate-400">{item.desc}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-dark-700 bg-dark-800 text-primary-500 focus:ring-primary-500" />
                          <span className="text-sm text-slate-400">Email</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-dark-700 bg-dark-800 text-primary-500 focus:ring-primary-500" />
                          <span className="text-sm text-slate-400">Push</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'api-keys' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">External API Keys</h2>
                  <div className="flex items-center gap-2 text-sm text-yellow-400">
                    <AlertTriangle className="w-4 h-4" />
                    Keys are encrypted at rest
                  </div>
                </div>
                <p className="text-slate-400 text-sm">Configure API keys for external services to enhance reconnaissance capabilities.</p>
                
                <div className="space-y-4">
                  {[
                    { id: 'shodan', label: 'Shodan API Key', icon: Database, hasKey: true },
                    { id: 'securitytrails', label: 'SecurityTrails API Key', icon: Shield, hasKey: true },
                    { id: 'virustotal', label: 'VirusTotal API Key', icon: Shield, hasKey: false },
                    { id: 'censys', label: 'Censys API Key', icon: Globe, hasKey: false },
                    { id: 'hunter', label: 'Hunter.io API Key', icon: Mail, hasKey: false },
                  ].map((api) => (
                    <div key={api.id} className="p-4 bg-dark-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <api.icon className="w-5 h-5 text-primary-400" />
                          <span className="text-white font-medium">{api.label}</span>
                          {api.hasKey && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Configured</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          placeholder={api.hasKey ? '••••••••••••••••' : 'Enter API key'}
                          defaultValue={api.hasKey ? 'sk-xxxx-xxxx-xxxx' : ''}
                          className="flex-1 px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 font-mono text-sm"
                        />
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="p-2 text-slate-400 hover:text-white transition-colors"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'integrations' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-white">Notification Integrations</h2>
                <p className="text-slate-400 text-sm">Connect external services to receive notifications.</p>
                
                <div className="space-y-4">
                  <div className="p-4 bg-dark-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#4A154B]/20 rounded-lg">
                          <Slack className="w-5 h-5 text-[#4A154B]" />
                        </div>
                        <div>
                          <p className="text-white font-medium">Slack</p>
                          <p className="text-sm text-slate-400">Send notifications to Slack channels</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Connected</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Webhook URL"
                      defaultValue="https://hooks.slack.com/services/xxx"
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 font-mono text-sm"
                    />
                  </div>

                  <div className="p-4 bg-dark-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#5865F2]/20 rounded-lg">
                          <MessageSquare className="w-5 h-5 text-[#5865F2]" />
                        </div>
                        <div>
                          <p className="text-white font-medium">Discord</p>
                          <p className="text-sm text-slate-400">Send notifications to Discord channels</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-slate-500/20 text-slate-400 text-xs rounded">Not connected</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Webhook URL"
                      className="w-full px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 font-mono text-sm"
                    />
                  </div>

                  <div className="p-4 bg-dark-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Mail className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">Email</p>
                          <p className="text-sm text-slate-400">Configure SMTP for email notifications</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Configured</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="SMTP Host"
                        defaultValue="smtp.gmail.com"
                        className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="SMTP Port"
                        defaultValue="587"
                        className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex items-center justify-end gap-4 pt-6 mt-6 border-t border-dark-800">
              {saved && (
                <span className="flex items-center gap-2 text-green-400 text-sm">
                  <Check className="w-4 h-4" />
                  Settings saved
                </span>
              )}
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

