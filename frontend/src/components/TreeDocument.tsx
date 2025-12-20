'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen } from 'lucide-react';

interface TreeNode {
  label: string;
  children?: TreeNode[];
}

interface TreeDocumentProps {
  data: TreeNode;
  title?: string;
}

function TreeNodeComponent({ node, level = 0 }: { node: TreeNode; level?: number }) {
  const [isOpen, setIsOpen] = useState(level < 2); // Auto-expand first 2 levels
  const hasChildren = node.children && node.children.length > 0;
  const indent = level * 24;

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-dark-800/50 transition-colors"
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
      >
        {hasChildren ? (
          <>
            <div className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-primary-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-primary-400" />
              )}
              {isOpen ? (
                <FolderOpen className="w-4 h-4 text-accent-cyan" />
              ) : (
                <Folder className="w-4 h-4 text-accent-cyan" />
              )}
            </div>
            <span className="text-sm text-slate-300 font-mono cursor-pointer">{node.label}</span>
          </>
        ) : (
          <>
            <div className="w-6 flex items-center justify-center flex-shrink-0">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <span className="text-sm text-slate-300 font-mono">{node.label}</span>
          </>
        )}
      </div>
      <AnimatePresence>
        {hasChildren && isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {node.children!.map((child, index) => (
              <TreeNodeComponent key={index} node={child} level={level + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TreeDocument({ data, title }: TreeDocumentProps) {
  return (
    <div className="w-full">
      {title && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
          <div className="h-1 w-20 bg-gradient-to-r from-primary-500 to-accent-cyan rounded-full" />
        </div>
      )}
      <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6 overflow-auto">
        <div className="min-w-max">
          <TreeNodeComponent node={data} />
        </div>
      </div>
    </div>
  );
}

