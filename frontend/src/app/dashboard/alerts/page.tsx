'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Info,
  Search,
  Filter,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { alertsApi, programsApi } from '@/lib/api';
import { useIsMobile } from '@/hooks';

// Types matching backend schema
type AlertConditionType = 'status_change' | 'title_match' | 'tech_change' | 'favicon_change' | 'abuse_score';
type AlertConditionOperator = 'equals' | 'contains' | 'regex' | 'greater_than' | 'less_than';
type AlertSeverity = 'info' | 'warning' | 'critical';
type AlertChannel = 'discord' | 'slack' | 'telegram' | 'email';

interface AlertCondition {
  type: AlertConditionType;
  operator: AlertConditionOperator;
  value: any;
  previousValue?: any;
}

interface AlertRule {
  _id: string;
  name: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  channels: AlertChannel[];
  enabled: boolean;
  programId?: string;
  createdAt: string;
  updatedAt: string;
}

interface Program {
  _id: string;
  name: string;
}

const conditionTypeLabels: Record<AlertConditionType, string> = {
  status_change: 'Status Code Change',
  title_match: 'Title Match',
  tech_change: 'Technology Change',
  favicon_change: 'Favicon Change',
  abuse_score: 'Abuse Score',
};

const operatorLabels: Record<AlertConditionOperator, string> = {
  equals: 'Equals',
  contains: 'Contains',
  regex: 'Matches Regex',
  greater_than: 'Greater Than',
  less_than: 'Less Than',
};

const severityConfig: Record<AlertSeverity, { icon: any; color: string; bg: string; label: string }> = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Info' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Warning' },
  critical: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Critical' },
};

const channelLabels: Record<AlertChannel, string> = {
  discord: 'Discord',
  slack: 'Slack',
  telegram: 'Telegram',
  email: 'Email',
};

// Form component for creating/editing alert rules
interface AlertRuleFormProps {
  rule?: AlertRule | null;
  programs: Program[];
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  isMobile?: boolean;
}

function AlertRuleForm({ rule, programs, onSave, onCancel, saving, isMobile }: AlertRuleFormProps) {
  const [name, setName] = useState(rule?.name || '');
  const [conditionType, setConditionType] = useState<AlertConditionType>(rule?.condition.type || 'status_change');
  const [operator, setOperator] = useState<AlertConditionOperator>(rule?.condition.operator || 'equals');
  const [value, setValue] = useState(rule?.condition.value?.toString() || '');
  const [severity, setSeverity] = useState<AlertSeverity>(rule?.severity || 'info');
  const [channels, setChannels] = useState<AlertChannel[]>(rule?.channels || []);
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [programId, setProgramId] = useState(rule?.programId || '');

  // Get valid operators for the selected condition type
  const getValidOperators = (type: AlertConditionType): AlertConditionOperator[] => {
    switch (type) {
      case 'status_change':
        return ['equals', 'greater_than', 'less_than'];
      case 'title_match':
        return ['equals', 'contains', 'regex'];
      case 'tech_change':
        return ['contains', 'regex'];
      case 'favicon_change':
        return ['equals'];
      case 'abuse_score':
        return ['greater_than', 'less_than', 'equals'];
      default:
        return ['equals', 'contains', 'regex', 'greater_than', 'less_than'];
    }
  };

  const validOperators = getValidOperators(conditionType);

  // Reset operator if it's not valid for the new condition type
  useEffect(() => {
    if (!validOperators.includes(operator)) {
      setOperator(validOperators[0]);
    }
  }, [conditionType]);

  const toggleChannel = (channel: AlertChannel) => {
    setChannels(prev =>
      prev.includes(channel)
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse value based on condition type
    let parsedValue: any = value;
    if (conditionType === 'status_change' || conditionType === 'abuse_score') {
      parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue)) {
        alert('Please enter a valid number');
        return;
      }
    }

    await onSave({
      name,
      condition: {
        type: conditionType,
        operator,
        value: parsedValue,
      },
      severity,
      channels,
      enabled,
      programId: programId || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rule Name */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Rule Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Alert on 403 to 200 change"
          className="w-full px-3 py-2 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 touch-manipulation"
          required
        />
      </div>

      {/* Condition Type */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Condition Type <span className="text-red-400">*</span>
        </label>
        <select
          value={conditionType}
          onChange={(e) => setConditionType(e.target.value as AlertConditionType)}
          className="w-full px-3 py-2 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500/50 touch-manipulation"
        >
          {Object.entries(conditionTypeLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Operator */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Operator <span className="text-red-400">*</span>
        </label>
        <select
          value={operator}
          onChange={(e) => setOperator(e.target.value as AlertConditionOperator)}
          className="w-full px-3 py-2 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500/50 touch-manipulation"
        >
          {validOperators.map((op) => (
            <option key={op} value={op}>{operatorLabels[op]}</option>
          ))}
        </select>
      </div>

      {/* Value */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Value <span className="text-red-400">*</span>
        </label>
        <input
          type={conditionType === 'status_change' || conditionType === 'abuse_score' ? 'number' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            conditionType === 'status_change' ? 'e.g., 200' :
            conditionType === 'abuse_score' ? 'e.g., 50' :
            conditionType === 'title_match' ? 'e.g., index, welcome' :
            'Enter value'
          }
          className="w-full px-3 py-2 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 touch-manipulation"
          required
        />
        {conditionType === 'title_match' && operator === 'regex' && (
          <p className="text-xs text-slate-500 mt-1">Enter a valid regex pattern</p>
        )}
      </div>

      {/* Severity */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Severity</label>
        <div className="flex flex-col sm:flex-row gap-2">
          {(Object.keys(severityConfig) as AlertSeverity[]).map((sev) => {
            const config = severityConfig[sev];
            return (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverity(sev)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-lg border transition-colors touch-manipulation',
                  severity === sev
                    ? `${config.bg} ${config.color} border-current`
                    : 'bg-dark-800 border-dark-700 text-slate-400 hover:border-dark-600'
                )}
              >
                <config.icon className="w-4 h-4" />
                <span className="text-sm">{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notification Channels */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Notification Channels</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(channelLabels) as AlertChannel[]).map((channel) => (
            <button
              key={channel}
              type="button"
              onClick={() => toggleChannel(channel)}
              className={cn(
                'px-3 py-2 min-h-[44px] rounded-lg border text-sm transition-colors touch-manipulation',
                channels.includes(channel)
                  ? 'bg-primary-500/20 border-primary-500/50 text-primary-400'
                  : 'bg-dark-800 border-dark-700 text-slate-400 hover:border-dark-600'
              )}
            >
              {channelLabels[channel]}
            </button>
          ))}
        </div>
        {channels.length === 0 && (
          <p className="text-xs text-yellow-400 mt-1">Select at least one channel to receive alerts</p>
        )}
      </div>

      {/* Program Scope */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Program Scope (Optional)</label>
        <select
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          className="w-full px-3 py-2 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500/50 touch-manipulation"
        >
          <option value="">All Programs</option>
          {programs.map((program) => (
            <option key={program._id} value={program._id}>{program.name}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">Leave empty to apply rule to all programs</p>
      </div>

      {/* Enabled Toggle */}
      <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg min-h-[44px]">
        <span className="text-sm text-slate-300">Rule Enabled</span>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={cn('transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation', enabled ? 'text-green-400' : 'text-slate-500')}
        >
          {enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
        </button>
      </div>

      {/* Form Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-dark-700">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 min-h-[44px] bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 transition-colors touch-manipulation"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !name || !value || channels.length === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-primary-600 hover:bg-primary-500 disabled:bg-dark-700 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors touch-manipulation"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            rule ? 'Update Rule' : 'Create Rule'
          )}
        </button>
      </div>
    </form>
  );
}

// Main page component
export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  // Fetch rules and programs on mount
  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
      try {
        const [rulesRes, programsRes] = await Promise.all([
          alertsApi.getRules(),
          programsApi.getAll({ limit: 1000 }),
        ]);
        setRules(rulesRes.data || []);
        // Handle paginated response from programsApi
        const programsData = programsRes.data?.data || programsRes.data || [];
        setPrograms(programsData);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      if (editingRule) {
        const response = await alertsApi.updateRule(editingRule._id, data);
        setRules(prev => prev.map(r => r._id === editingRule._id ? response.data : r));
      } else {
        const response = await alertsApi.createRule(data);
        setRules(prev => [response.data, ...prev]);
      }
      setShowForm(false);
      setEditingRule(null);
    } catch (err) {
      console.error('Failed to save rule:', err);
      alert('Failed to save rule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) return;
    
    try {
      await alertsApi.deleteRule(id);
      setRules(prev => prev.filter(r => r._id !== id));
    } catch (err) {
      console.error('Failed to delete rule:', err);
      alert('Failed to delete rule. Please try again.');
    }
  };

  const handleToggleEnabled = async (rule: AlertRule) => {
    try {
      const response = await alertsApi.updateRule(rule._id, { enabled: !rule.enabled });
      setRules(prev => prev.map(r => r._id === rule._id ? response.data : r));
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRule(null);
  };

  // Filter rules
  const filteredRules = rules.filter(rule => {
    if (searchQuery && !rule.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterEnabled !== null && rule.enabled !== filterEnabled) {
      return false;
    }
    return true;
  });

  // Stats
  const stats = {
    total: rules.length,
    enabled: rules.filter(r => r.enabled).length,
    disabled: rules.filter(r => !r.enabled).length,
    critical: rules.filter(r => r.severity === 'critical').length,
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3">
            <Bell className="w-6 h-6 md:w-7 md:h-7 text-primary-400" />
            Alert Rules
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">Configure alerts for HTTP changes and abuse detection</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingRule(null); }}
          className="flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors touch-manipulation w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Total Rules', value: stats.total, icon: Bell, color: 'text-primary-400' },
          { label: 'Enabled', value: stats.enabled, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Disabled', value: stats.disabled, icon: ToggleLeft, color: 'text-slate-400' },
          { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: 'text-red-400' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-3 md:p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs md:text-sm">{stat.label}</p>
                <p className="text-xl md:text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <stat.icon className={cn('w-6 h-6 md:w-8 md:h-8', stat.color)} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Rules List */}
        <div className={cn('lg:col-span-2', showForm && !isMobile && 'lg:col-span-1')}>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rules..."
                className="w-full pl-10 pr-4 py-2 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 touch-manipulation"
              />
            </div>
            <select
              value={filterEnabled === null ? '' : filterEnabled.toString()}
              onChange={(e) => setFilterEnabled(e.target.value === '' ? null : e.target.value === 'true')}
              className="px-3 py-2 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500/50 touch-manipulation"
            >
              <option value="">All Status</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>

          {/* Rules */}
          <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
            {!mounted || loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">
                  {rules.length === 0 ? 'No alert rules yet' : 'No rules match your filters'}
                </p>
                {rules.length === 0 && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 text-primary-400 hover:text-primary-300 text-sm min-h-[44px] touch-manipulation"
                  >
                    Create your first rule
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-dark-800">
                {filteredRules.map((rule) => {
                  const severityConf = severityConfig[rule.severity];
                  const SeverityIcon = severityConf.icon;
                  const programName = programs.find(p => p._id === rule.programId)?.name;

                  return (
                    <div
                      key={rule._id}
                      className={cn(
                        'p-4 hover:bg-dark-800/50 transition-colors',
                        !rule.enabled && 'opacity-60'
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-medium text-white truncate">{rule.name}</h3>
                            <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs', severityConf.bg, severityConf.color)}>
                              <SeverityIcon className="w-3 h-3" />
                              {severityConf.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                            <span>{conditionTypeLabels[rule.condition.type]}</span>
                            <span>•</span>
                            <span>{operatorLabels[rule.condition.operator]}</span>
                            <span>•</span>
                            <span className="text-slate-400">{rule.condition.value}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {rule.channels.map(channel => (
                              <span key={channel} className="px-2 py-0.5 bg-dark-700 rounded text-xs text-slate-400">
                                {channelLabels[channel]}
                              </span>
                            ))}
                            {programName && (
                              <span className="px-2 py-0.5 bg-primary-500/20 rounded text-xs text-primary-400">
                                {programName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-start">
                          <button
                            onClick={() => handleToggleEnabled(rule)}
                            className={cn('min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors touch-manipulation', rule.enabled ? 'text-green-400' : 'text-slate-500')}
                            title={rule.enabled ? 'Disable' : 'Enable'}
                          >
                            {rule.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                          </button>
                          <button
                            onClick={() => handleEdit(rule)}
                            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white transition-colors touch-manipulation"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule._id)}
                            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors touch-manipulation"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Form Panel */}
        <AnimatePresence>
          {showForm && (
            <>
              {/* Mobile: Full screen overlay */}
              {isMobile ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-dark-950"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-4 border-b border-dark-800">
                      <h2 className="text-lg font-semibold text-white">
                        {editingRule ? 'Edit Alert Rule' : 'New Alert Rule'}
                      </h2>
                      <button
                        onClick={handleCancel}
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white transition-colors touch-manipulation"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      <AlertRuleForm
                        rule={editingRule}
                        programs={programs}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        saving={saving}
                        isMobile={isMobile}
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* Desktop: Side panel */
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="lg:col-span-2"
                >
                  <div className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-white">
                        {editingRule ? 'Edit Alert Rule' : 'New Alert Rule'}
                      </h2>
                      <button
                        onClick={handleCancel}
                        className="p-1 text-slate-400 hover:text-white transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <AlertRuleForm
                      rule={editingRule}
                      programs={programs}
                      onSave={handleSave}
                      onCancel={handleCancel}
                      saving={saving}
                    />
                  </div>
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
