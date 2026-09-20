'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Search,
  FileText,
  Terminal,
  BookOpen,
  Play,
  X,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { toolsApi } from '@/lib/api';
import { checklistData, ChecklistItem, ChecklistSection } from './checklistData';

// Map of tool names to their IDs in the database (will be fetched)
const toolAliases: Record<string, string[]> = {
  'subfinder': ['subfinder'],
  'amass': ['amass'],
  'assetfinder': ['assetfinder'],
  'findomain': ['findomain'],
  'chaos': ['chaos'],
  'dig': ['dig'],
  'dnsx': ['dnsx'],
  'dnsrecon': ['dnsrecon'],
  'fierce': ['fierce'],
  'nmap': ['nmap'],
  'masscan': ['masscan'],
  'naabu': ['naabu'],
  'rustscan': ['rustscan'],
  'wappalyzer': ['wappalyzer'],
  'whatweb': ['whatweb'],
  'builtwith': ['builtwith'],
  'httpx': ['httpx'],
  'waybackurls': ['waybackurls'],
  'gau': ['gau'],
  'waymore': ['waymore'],
  'ffuf': ['ffuf'],
  'gobuster': ['gobuster'],
  'dirsearch': ['dirsearch'],
  'feroxbuster': ['feroxbuster'],
  'arjun': ['arjun'],
  'paramspider': ['paramspider'],
  'x8': ['x8'],
  'param-miner': ['param-miner'],
  'linkfinder': ['linkfinder'],
  'secretfinder': ['secretfinder'],
  'katana': ['katana'],
  'gospider': ['gospider'],
  'hakrawler': ['hakrawler'],
  'sqlmap': ['sqlmap'],
  'ghauri': ['ghauri'],
  'dalfox': ['dalfox'],
  'xsstrike': ['xsstrike'],
  'kxss': ['kxss'],
  'nuclei': ['nuclei'],
  'wafw00f': ['wafw00f'],
  'trufflehog': ['trufflehog'],
  'gitleaks': ['gitleaks'],
  'unfurl': ['unfurl'],
  'qsreplace': ['qsreplace'],
  'gf': ['gf'],
  'uro': ['uro'],
  'whois': ['whois'],
};

interface Tool {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  installation?: {
    isInstalled?: boolean;
  };
}

// Tool Execution Modal Component
interface ToolModalProps {
  tool: Tool | null;
  toolName: string;
  isOpen: boolean;
  onClose: () => void;
}

function ToolModal({ tool, toolName, isOpen, onClose }: ToolModalProps) {
  const [target, setTarget] = useState('');
  const [args, setArgs] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Default arguments for common tools
  const getDefaultArgs = (name: string): string => {
    const defaults: Record<string, string> = {
      subfinder: '-silent',
      httpx: '-silent -status-code -title -tech-detect',
      nmap: '-sV -sC',
      nuclei: '-silent',
      ffuf: '-w /usr/share/wordlists/dirb/common.txt -mc 200,301,302,403',
      dirsearch: '-e php,html,js,txt',
      waybackurls: '',
      gau: '--threads 5',
      katana: '-silent -jc',
      dnsx: '-silent -a -resp',
      arjun: '--stable',
      dalfox: 'url',
      sqlmap: '--batch --random-agent',
      wafw00f: '',
      linkfinder: '-o cli',
      secretfinder: '-o cli',
      paramspider: '',
      unfurl: 'keys',
      qsreplace: 'FUZZ',
      gf: 'xss',
      uro: '',
      trufflehog: 'git',
      amass: 'enum -passive',
      assetfinder: '--subs-only',
      findomain: '-q',
      hakrawler: '-plain',
      feroxbuster: '-w /usr/share/wordlists/dirb/common.txt',
      naabu: '-silent',
      whois: '',
    };
    return defaults[name] || '';
  };

  useEffect(() => {
    if (isOpen && toolName) {
      setArgs(getDefaultArgs(toolName));
      setOutput('');
      setError('');
    }
  }, [isOpen, toolName]);

  const runTool = async () => {
    if (!tool || !target.trim()) {
      setError('Please enter a target');
      return;
    }

    setIsRunning(true);
    setOutput('');
    setError('');

    try {
      // Build arguments array
      const argArray = args.trim() ? args.trim().split(/\s+/) : [];

      // Add target based on tool type
      const toolsWithDashD = ['subfinder', 'amass', 'findomain', 'dnsx', 'katana', 'paramspider'];
      const toolsWithDashU = ['httpx', 'nuclei', 'dalfox', 'waybackurls', 'gau', 'hakrawler', 'arjun', 'ffuf', 'dirsearch', 'feroxbuster', 'wafw00f', 'linkfinder', 'secretfinder'];
      const toolsWithDashTarget = ['nmap', 'naabu', 'sqlmap'];

      if (toolsWithDashD.includes(toolName)) {
        argArray.push('-d', target);
      } else if (toolsWithDashU.includes(toolName)) {
        argArray.push('-u', target);
      } else if (toolsWithDashTarget.includes(toolName)) {
        argArray.push(target);
      } else {
        // Default: append target at the end
        argArray.push(target);
      }

      const response = await toolsApi.execute(tool._id, {
        arguments: argArray,
        timeout: 120000, // 2 minutes
      });

      const execution = response.data;

      if (execution.status === 'completed') {
        setOutput(execution.stdout || 'No output');
      } else {
        setError(execution.errorMessage || execution.stderr || 'Tool execution failed');
        if (execution.stdout) {
          setOutput(execution.stdout);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to execute tool');
    } finally {
      setIsRunning(false);
    }
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const isInstalled = tool?.installation?.isInstalled;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className="bg-[#1c1c1e] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-[rgba(84,84,88,0.65)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary-500/20 rounded-xl">
                <Terminal className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-white">{toolName}</h2>
                <p className="text-[13px] text-[#8e8e93]">
                  {tool ? tool.description : 'Loading...'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!tool ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
              </div>
            ) : !isInstalled ? (
              <div className="p-4 bg-[#ff9f0a]/15 rounded-xl">
                <div className="flex items-center gap-2 text-[#ff9f0a] mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Tool Not Installed</span>
                </div>
                <p className="text-[13px] text-[#8e8e93] mb-3">
                  This tool is not installed in the system. Go to the Tools page to install it.
                </p>
                <Link
                  href={`/dashboard/tools/${tool._id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-xl text-white text-[15px] font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Go to Tool Page
                </Link>
              </div>
            ) : (
              <>
                {/* Target Input */}
                <div>
                  <label className="block text-[13px] text-[#8e8e93] mb-2 font-medium">
                    Target (domain/URL)
                  </label>
                  <input
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="example.com or https://example.com"
                    className="w-full px-4 py-3 bg-[#2c2c2e] border-none rounded-xl text-[15px] text-white placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  />
                </div>

                {/* Arguments Input */}
                <div>
                  <label className="block text-[13px] text-[#8e8e93] mb-2 font-medium">
                    Arguments (optional)
                  </label>
                  <input
                    type="text"
                    value={args}
                    onChange={(e) => setArgs(e.target.value)}
                    placeholder="Additional arguments..."
                    className="w-full px-4 py-3 bg-[#2c2c2e] border-none rounded-xl text-[15px] text-white placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500/50 font-mono text-[13px]"
                  />
                </div>

                {/* Run Button */}
                <button
                  onClick={runTool}
                  disabled={isRunning || !target.trim()}
                  className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50 rounded-xl text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Run {toolName}
                    </>
                  )}
                </button>

                {/* Error */}
                {error && (
                  <div className="p-3 bg-[#ff453a]/15 rounded-xl">
                    <p className="text-[13px] text-[#ff453a]">{error}</p>
                  </div>
                )}

                {/* Output */}
                {output && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[13px] text-[#8e8e93] font-medium">Output</label>
                      <button
                        onClick={copyOutput}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] rounded-lg transition-colors"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-primary-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-4 bg-[#0d0d0d] rounded-xl text-[13px] text-[#30d158] font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">
                      {output}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[rgba(84,84,88,0.65)] flex items-center justify-between">
            <Link
              href="/dashboard/tools"
              className="text-[13px] text-primary-400 hover:text-primary-300 flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" />
              View All Tools
            </Link>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#2c2c2e] hover:bg-[#3c3c3e] rounded-xl text-[15px] text-white font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function ChecklistPage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['recon']));
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTool, setSelectedTool] = useState<{ tool: Tool | null; name: string } | null>(null);

  // Fetch tools from API
  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await toolsApi.getAll();
        setTools(response.data || []);
      } catch (error) {
        console.error('Failed to fetch tools:', error);
      }
    };
    fetchTools();
  }, []);

  // Load completed items from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('bb-checklist-completed');
    if (saved) {
      setCompletedItems(new Set(JSON.parse(saved)));
    }
  }, []);

  // Load notes from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem('bb-checklist-notes');
    if (savedNotes) {
      setItemNotes(JSON.parse(savedNotes));
    }
  }, []);

  // Save completed items to localStorage
  useEffect(() => {
    localStorage.setItem('bb-checklist-completed', JSON.stringify(Array.from(completedItems)));
  }, [completedItems]);

  // Save notes to localStorage
  useEffect(() => {
    localStorage.setItem('bb-checklist-notes', JSON.stringify(itemNotes));
  }, [itemNotes]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const toggleItem = (itemId: string) => {
    setCompletedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const updateNotes = (itemId: string, notes: string) => {
    setItemNotes((prev) => ({
      ...prev,
      [itemId]: notes,
    }));
  };

  const openTool = (toolName: string) => {
    const normalizedName = toolName.toLowerCase();
    const tool = tools.find((t) => t.name.toLowerCase() === normalizedName);
    setSelectedTool({ tool: tool || null, name: toolName });
  };

  const getProgress = (section: ChecklistSection) => {
    const completed = section.items.filter((item) => completedItems.has(item.id)).length;
    return { completed, total: section.items.length };
  };

  const getTotalProgress = () => {
    const total = checklistData.reduce((acc, section) => acc + section.items.length, 0);
    const completed = checklistData.reduce(
      (acc, section) => acc + section.items.filter((item) => completedItems.has(item.id)).length,
      0
    );
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  };

  const getTotalNotesCount = () => {
    return Object.values(itemNotes).filter((note) => note.trim().length > 0).length;
  };

  const resetProgress = () => {
    if (confirm('Are you sure you want to reset all progress and notes?')) {
      setCompletedItems(new Set());
      setItemNotes({});
    }
  };

  const exportNotes = () => {
    const notesContent = checklistData
      .map((section) => {
        const sectionNotes = section.items
          .filter((item) => itemNotes[item.id]?.trim())
          .map((item) => `### ${item.title}\n${itemNotes[item.id]}`)
          .join('\n\n');
        return sectionNotes ? `## ${section.title}\n\n${sectionNotes}` : '';
      })
      .filter(Boolean)
      .join('\n\n---\n\n');

    if (!notesContent) {
      alert('No notes to export');
      return;
    }

    const blob = new Blob([`# Bug Bounty Notes\n\nExported: ${new Date().toLocaleString()}\n\n---\n\n${notesContent}`], {
      type: 'text/markdown',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bug-bounty-notes-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isToolInstalled = (toolName: string): boolean => {
    const normalizedName = toolName.toLowerCase();
    const tool = tools.find((t) => t.name.toLowerCase() === normalizedName);
    return tool?.installation?.isInstalled || false;
  };

  const filteredSections = searchQuery
    ? checklistData.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.tools?.some((tool) => tool.toLowerCase().includes(searchQuery.toLowerCase())) ||
            itemNotes[item.id]?.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((section) => section.items.length > 0)
    : checklistData;

  const totalProgress = getTotalProgress();
  const totalNotes = getTotalNotesCount();

  return (
    <div className="space-y-6">
      {/* Tool Modal */}
      <ToolModal
        tool={selectedTool?.tool || null}
        toolName={selectedTool?.name || ''}
        isOpen={!!selectedTool}
        onClose={() => setSelectedTool(null)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[22px] sm:text-[28px] font-bold text-white tracking-tight flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-primary-400" />
            Bug Bounty Checklist
          </h1>
          <p className="text-[15px] text-[#8e8e93] mt-1">
            Step-by-step methodology • Click on tools to run them
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalNotes > 0 && (
            <button
              onClick={exportNotes}
              className="px-4 py-2.5 bg-primary-500/20 hover:bg-primary-500/30 rounded-xl text-[15px] text-primary-400 font-medium transition-all active:scale-[0.97] flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Export Notes ({totalNotes})
            </button>
          )}
          <button
            onClick={resetProgress}
            className="px-4 py-2.5 bg-[#2c2c2e] hover:bg-[#3c3c3e] rounded-xl text-[15px] text-[#ff453a] font-medium transition-all active:scale-[0.97]"
          >
            Reset Progress
          </button>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="p-5 bg-[#1c1c1e] rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[17px] font-semibold text-white">Overall Progress</span>
          <div className="flex items-center gap-4">
            {totalNotes > 0 && (
              <span className="text-[13px] text-[#8e8e93] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary-400" />
                {totalNotes} notes
              </span>
            )}
            <span className="text-[15px] text-primary-400 font-medium">
              {totalProgress.completed}/{totalProgress.total} ({totalProgress.percentage}%)
            </span>
          </div>
        </div>
        <div className="h-3 bg-[#2c2c2e] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${totalProgress.percentage}%` }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            className="h-full bg-primary-500 rounded-full"
          />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#636366]" />
        <input
          type="text"
          placeholder="Search checklist items, tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-[#1c1c1e] border-none rounded-xl text-[17px] text-white placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        />
      </div>

      {/* Checklist Sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => {
          const progress = getProgress(section);
          const isExpanded = expandedSections.has(section.id);
          const Icon = section.icon;

          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#1c1c1e] rounded-2xl overflow-hidden"
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-[#2c2c2e] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl bg-[#2c2c2e]`}>
                    <Icon className={`w-5 h-5 ${section.color}`} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-[17px] font-semibold text-white">{section.title}</h2>
                    <p className="text-[13px] text-[#8e8e93]">
                      {progress.completed}/{progress.total} completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-[#2c2c2e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                    />
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-[#8e8e93]" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-[#8e8e93]" />
                  )}
                </div>
              </button>

              {/* Section Items */}
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  className="border-t border-[rgba(84,84,88,0.65)]"
                >
                  {section.items.map((item, index) => (
                    <ChecklistItemComponent
                      key={item.id}
                      item={item}
                      isCompleted={completedItems.has(item.id)}
                      onToggle={() => toggleItem(item.id)}
                      onToolClick={openTool}
                      isToolInstalled={isToolInstalled}
                      isLast={index === section.items.length - 1}
                      notes={itemNotes[item.id] || ''}
                      onNotesChange={(notes) => updateNotes(item.id, notes)}
                    />
                  ))}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

interface ChecklistItemComponentProps {
  item: ChecklistItem;
  isCompleted: boolean;
  onToggle: () => void;
  onToolClick: (toolName: string) => void;
  isToolInstalled: (toolName: string) => boolean;
  isLast: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
}

function ChecklistItemComponent({
  item,
  isCompleted,
  onToggle,
  onToolClick,
  isToolInstalled,
  isLast,
  notes,
  onNotesChange,
}: ChecklistItemComponentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localNotes, setLocalNotes] = useState(notes);

  // Sync local notes with props
  useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);

  // Debounced save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localNotes !== notes) {
        onNotesChange(localNotes);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localNotes, notes, onNotesChange]);

  return (
    <div className={`${!isLast ? 'border-b border-[rgba(84,84,88,0.65)]' : ''}`}>
      <div
        className="p-4 flex items-start gap-3 hover:bg-[#2c2c2e]/50 transition-colors cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="mt-0.5 flex-shrink-0"
        >
          {isCompleted ? (
            <CheckCircle2 className="w-6 h-6 text-primary-400" />
          ) : (
            <Circle className="w-6 h-6 text-[#636366]" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className={`text-[15px] font-medium ${
                isCompleted ? 'text-[#8e8e93] line-through' : 'text-white'
              }`}
            >
              {item.title}
            </h3>
            {notes && (
              <span className="px-1.5 py-0.5 bg-primary-500/20 rounded text-[10px] text-primary-400 font-medium">
                Has notes
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#636366] mt-0.5">{item.description}</p>

          {/* Tools, Tips & Notes (expanded) */}
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-3 space-y-4"
            >
              {/* Tools */}
              {item.tools && item.tools.length > 0 && (
                <div>
                  <span className="text-[12px] font-medium text-[#8e8e93] uppercase tracking-wide">
                    Tools (click to run)
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {item.tools.map((tool) => {
                      const installed = isToolInstalled(tool);
                      return (
                        <button
                          key={tool}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToolClick(tool);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-all active:scale-[0.97] ${
                            installed
                              ? 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'
                              : 'bg-[#2c2c2e] text-[#8e8e93] hover:bg-[#3c3c3e]'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5" />
                          {tool}
                          {!installed && (
                            <span className="text-[10px] text-[#ff9f0a]">(not installed)</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tips */}
              {item.tips && item.tips.length > 0 && (
                <div>
                  <span className="text-[12px] font-medium text-[#8e8e93] uppercase tracking-wide">
                    Tips
                  </span>
                  <ul className="mt-1.5 space-y-1">
                    {item.tips.map((tip, i) => (
                      <li key={i} className="text-[13px] text-[#8e8e93] flex items-start gap-2">
                        <span className="text-primary-400 mt-1">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes Section */}
              <div>
                <span className="text-[12px] font-medium text-[#8e8e93] uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Notes
                </span>
                <textarea
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Add your notes here... (findings, URLs, payloads, etc.)"
                  className="w-full mt-1.5 px-3 py-2.5 bg-[#2c2c2e] border-none rounded-xl text-[13px] text-white placeholder-[#636366] focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none min-h-[80px]"
                  rows={3}
                />
                {localNotes && (
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] text-[#636366]">
                      {localNotes.length} characters • Auto-saved
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocalNotes('');
                        onNotesChange('');
                      }}
                      className="text-[11px] text-[#ff453a] hover:text-[#ff6961]"
                    >
                      Clear notes
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
        <ChevronRight
          className={`w-5 h-5 text-[#636366] transition-transform flex-shrink-0 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </div>
    </div>
  );
}
