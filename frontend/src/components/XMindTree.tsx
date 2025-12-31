'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Minus, Plus } from 'lucide-react';

interface TreeNode {
  label: string;
  children?: TreeNode[];
  color?: string;
}

interface XMindTreeProps {
  data: TreeNode;
  title?: string;
}

const levelColors = [
  'from-primary-500 to-primary-600 border-primary-400',
  'from-accent-cyan to-cyan-600 border-cyan-400',
  'from-green-500 to-green-600 border-green-400',
  'from-orange-500 to-orange-600 border-orange-400',
  'from-purple-500 to-purple-600 border-purple-400',
  'from-pink-500 to-pink-600 border-pink-400',
  'from-yellow-500 to-yellow-600 border-yellow-400',
];

const levelBgColors = [
  'bg-primary-500/10 border-primary-500/30 hover:border-primary-400',
  'bg-cyan-500/10 border-cyan-500/30 hover:border-cyan-400',
  'bg-green-500/10 border-green-500/30 hover:border-green-400',
  'bg-orange-500/10 border-orange-500/30 hover:border-orange-400',
  'bg-purple-500/10 border-purple-500/30 hover:border-purple-400',
  'bg-pink-500/10 border-pink-500/30 hover:border-pink-400',
  'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-400',
];

function XMindNode({ node, level = 0, isLast = false, parentExpanded = true }: { 
  node: TreeNode; 
  level?: number;
  isLast?: boolean;
  parentExpanded?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;
  const colorIndex = level % levelColors.length;
  const bgColorClass = levelBgColors[colorIndex];

  return (
    <div className="relative">
      {/* Horizontal connector line */}
      {level > 0 && (
        <div 
          className="absolute left-0 top-1/2 w-6 h-px bg-gradient-to-r from-dark-600 to-dark-500"
          style={{ transform: 'translateX(-24px)' }}
        />
      )}
      
      <div className="flex items-start gap-0">
        {/* Node content */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: level * 0.05 }}
          className={`
            relative flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer
            ${bgColorClass}
            ${hasChildren ? 'pr-2' : ''}
          `}
          onClick={() => hasChildren && setIsOpen(!isOpen)}
        >
          <span className={`text-sm font-mono ${level === 0 ? 'font-semibold text-white' : 'text-slate-200'}`}>
            {node.label}
          </span>
          {hasChildren && (
            <div className="flex items-center justify-center w-5 h-5 rounded bg-dark-700/50 ml-1">
              {isOpen ? (
                <Minus className="w-3 h-3 text-slate-400" />
              ) : (
                <Plus className="w-3 h-3 text-slate-400" />
              )}
            </div>
          )}
        </motion.div>

        {/* Children container */}
        <AnimatePresence>
          {hasChildren && isOpen && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center ml-0"
            >
              {/* Connector to children */}
              <div className="w-6 h-px bg-gradient-to-r from-dark-500 to-dark-600" />
              
              {/* Children vertical stack */}
              <div className="relative flex flex-col gap-2 py-2">
                {/* Vertical line connecting children */}
                {node.children!.length > 1 && (
                  <div 
                    className="absolute left-0 top-4 bottom-4 w-px bg-dark-600"
                    style={{ transform: 'translateX(-1px)' }}
                  />
                )}
                {node.children!.map((child, index) => (
                  <XMindNode 
                    key={index} 
                    node={child} 
                    level={level + 1}
                    isLast={index === node.children!.length - 1}
                    parentExpanded={isOpen}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Vertical tree variant for better space usage
function XMindVerticalNode({ node, level = 0 }: { node: TreeNode; level?: number }) {
  const [isOpen, setIsOpen] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;
  const colorIndex = level % levelColors.length;
  const bgColorClass = levelBgColors[colorIndex];

  return (
    <div className="relative pl-6">
      {/* Vertical connector */}
      {level > 0 && (
        <>
          <div className="absolute left-2 top-0 bottom-0 w-px bg-dark-600" />
          <div className="absolute left-2 top-4 w-4 h-px bg-dark-600" />
        </>
      )}
      
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, delay: level * 0.02 }}
        className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer mb-1
          ${bgColorClass}
        `}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
      >
        {hasChildren && (
          <div className="flex items-center justify-center w-4 h-4">
            {isOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        )}
        <span className={`text-sm font-mono ${level === 0 ? 'font-semibold text-white' : 'text-slate-200'}`}>
          {node.label}
        </span>
        {hasChildren && !isOpen && (
          <span className="text-xs text-slate-500 ml-1">({node.children!.length})</span>
        )}
      </motion.div>

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
              <XMindVerticalNode key={index} node={child} level={level + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function XMindTree({ data, title }: XMindTreeProps) {
  const [viewMode, setViewMode] = useState<'horizontal' | 'vertical'>('vertical');
  const [expandAll, setExpandAll] = useState(false);

  return (
    <div className="w-full">
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <div className="h-1 w-16 bg-gradient-to-r from-primary-500 to-accent-cyan rounded-full mt-1" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'horizontal' ? 'vertical' : 'horizontal')}
              className="px-3 py-1.5 text-xs font-medium bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg border border-dark-700 transition-colors"
            >
              {viewMode === 'horizontal' ? '↕ Vertical' : '↔ Horizontal'}
            </button>
          </div>
        </div>
      )}
      <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6 overflow-auto">
        <div className={viewMode === 'horizontal' ? 'min-w-max' : ''}>
          {viewMode === 'horizontal' ? (
            <XMindNode node={data} />
          ) : (
            <XMindVerticalNode node={data} />
          )}
        </div>
      </div>
    </div>
  );
}
