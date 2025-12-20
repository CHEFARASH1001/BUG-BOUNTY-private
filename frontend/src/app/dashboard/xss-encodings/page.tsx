'use client';

import { motion } from 'framer-motion';
import TreeDocument from '@/components/TreeDocument';
import { Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// XSS Encodings Tree Data
const xssEncodingsTree = {
  label: 'Cross-Site Scripting',
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
              ],
            },
            {
              label: 'unicode',
              children: [
                { label: 'encoding multilingual plain tex' },
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
            {
              label: '%HEX',
              children: [
                { label: 'It doesn\'t work in JSON' },
              ],
            },
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
  ],
};

export default function XSSEncodingsPage() {
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
              XSS Encodings Reference
            </h1>
            <p className="text-slate-400 mt-1">Cross-Site Scripting encoding techniques and methods</p>
          </div>
        </div>
      </motion.div>

      {/* Tree Document */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <TreeDocument data={xssEncodingsTree} />
      </motion.div>

      {/* Additional Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-400" />
          About XSS Encodings
        </h2>
        <div className="space-y-3 text-slate-300 text-sm">
          <p>
            Cross-Site Scripting (XSS) attacks often rely on various encoding techniques to bypass
            security filters and input validation. Understanding these encoding methods is crucial
            for both attackers and defenders.
          </p>
          <div className="mt-4 p-4 bg-dark-800/50 rounded-lg border border-dark-700">
            <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">Key Points:</p>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-primary-400 mt-1">•</span>
                <span>HTML attributes are automatically decoded by browsers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400 mt-1">•</span>
                <span>Unicode characters are decoded in JavaScript contexts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400 mt-1">•</span>
                <span>URL encoding uses %HEX format but doesn't work in JSON</span>
              </li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}









