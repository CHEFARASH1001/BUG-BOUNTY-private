'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  TooltipProps,
} from 'recharts';
import { useIsMobile, useIsSmallMobile } from '@/hooks';

/**
 * Configuration for chart data series
 */
export interface ChartSeries {
  dataKey: string;
  name: string;
  color: string;
  /** For pie charts, this is the value key */
  valueKey?: string;
}

/**
 * Props for the ResponsiveChart component
 */
export interface ResponsiveChartProps {
  /** Chart type */
  type: 'area' | 'bar' | 'line' | 'pie';
  /** Data array for the chart */
  data: Record<string, unknown>[];
  /** Series configuration */
  series: ChartSeries[];
  /** Key for X-axis data (not used for pie charts) */
  xAxisKey?: string;
  /** Chart height - responsive by default */
  height?: number | 'auto';
  /** Show grid lines */
  showGrid?: boolean;
  /** Show legend */
  showLegend?: boolean;
  /** Custom tooltip formatter */
  tooltipFormatter?: (value: number, name: string) => string;
  /** Additional class names */
  className?: string;
  /** Accessible label for the chart */
  ariaLabel?: string;
}

/**
 * Touch-friendly tooltip configuration
 */
const TOOLTIP_STYLES = {
  contentStyle: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(51, 65, 85, 0.5)',
    borderRadius: '8px',
    padding: '8px 12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    maxWidth: '200px',
  },
  labelStyle: {
    color: '#94a3b8',
    fontSize: '12px',
    marginBottom: '4px',
  },
  itemStyle: {
    color: '#e2e8f0',
    fontSize: '12px',
    padding: '2px 0',
  },
};

/**
 * Custom tooltip component that's touch-friendly and doesn't overflow viewport
 */
function CustomTooltip({
  active,
  payload,
  label,
  formatter,
}: TooltipProps<number, string> & { formatter?: (value: number, name: string) => string }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      className="bg-dark-900/95 border border-dark-700 rounded-lg p-2 sm:p-3 shadow-lg max-w-[180px] sm:max-w-[220px]"
      style={{ touchAction: 'none' }}
    >
      {label && (
        <p className="text-slate-400 text-xs mb-1 truncate">{label}</p>
      )}
      {payload.map((entry, index) => (
        <p
          key={index}
          className="text-xs sm:text-sm truncate"
          style={{ color: entry.color }}
        >
          <span className="text-slate-300">{entry.name}: </span>
          <span className="font-medium">
            {formatter
              ? formatter(entry.value as number, entry.name as string)
              : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * Responsive legend component that adapts to mobile
 */
function ResponsiveLegend({
  series,
  isMobile,
}: {
  series: ChartSeries[];
  isMobile: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap justify-center gap-2 sm:gap-4 ${
        isMobile ? 'mt-3 text-xs' : 'mt-4 text-sm'
      }`}
    >
      {series.map((s) => (
        <div key={s.dataKey} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full"
            style={{ backgroundColor: s.color }}
          />
          <span className="text-slate-400 truncate max-w-[80px] sm:max-w-none">
            {s.name}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * ResponsiveChart - A mobile-friendly chart wrapper component
 * 
 * Features:
 * - Automatically resizes to container width (Requirement 7.1)
 * - Moves legends below chart on mobile (Requirement 7.2)
 * - Touch-friendly tooltips that don't overflow (Requirement 7.3)
 * - Reduced tick counts on mobile for readability
 */
export function ResponsiveChart({
  type,
  data,
  series,
  xAxisKey = 'name',
  height = 'auto',
  showGrid = true,
  showLegend = true,
  tooltipFormatter,
  className = '',
  ariaLabel,
}: ResponsiveChartProps) {
  const isMobile = useIsMobile();
  const isSmallMobile = useIsSmallMobile();

  // Calculate responsive height
  const chartHeight = useMemo(() => {
    if (typeof height === 'number') return height;
    // Auto height based on viewport
    if (isSmallMobile) return 200;
    if (isMobile) return 250;
    return 300;
  }, [height, isMobile, isSmallMobile]);

  // Responsive axis configuration
  const axisConfig = useMemo(() => ({
    tickCount: isSmallMobile ? 3 : isMobile ? 5 : 7,
    fontSize: isMobile ? 10 : 12,
    tickMargin: isMobile ? 4 : 8,
  }), [isMobile, isSmallMobile]);

  // Common chart props
  const commonProps = {
    data,
    margin: {
      top: 10,
      right: isMobile ? 10 : 20,
      left: isMobile ? -10 : 0,
      bottom: 5,
    },
  };

  // Render the appropriate chart type
  const renderChart = () => {
    switch (type) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(51, 65, 85, 0.3)"
                vertical={!isMobile}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fill: '#94a3b8', fontSize: axisConfig.fontSize }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tickMargin={axisConfig.tickMargin}
              interval={isMobile ? 'preserveStartEnd' : 0}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: axisConfig.fontSize }}
              tickLine={false}
              axisLine={false}
              tickCount={axisConfig.tickCount}
              width={isMobile ? 35 : 50}
            />
            <Tooltip
              content={<CustomTooltip formatter={tooltipFormatter} />}
              cursor={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
            />
            {series.map((s) => (
              <Area
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.2}
                strokeWidth={isMobile ? 1.5 : 2}
              />
            ))}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(51, 65, 85, 0.3)"
                vertical={false}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fill: '#94a3b8', fontSize: axisConfig.fontSize }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tickMargin={axisConfig.tickMargin}
              interval={isMobile ? 'preserveStartEnd' : 0}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: axisConfig.fontSize }}
              tickLine={false}
              axisLine={false}
              tickCount={axisConfig.tickCount}
              width={isMobile ? 35 : 50}
            />
            <Tooltip
              content={<CustomTooltip formatter={tooltipFormatter} />}
              cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
            />
            {series.map((s) => (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.name}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={isMobile ? 30 : 50}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(51, 65, 85, 0.3)"
                vertical={!isMobile}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fill: '#94a3b8', fontSize: axisConfig.fontSize }}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tickMargin={axisConfig.tickMargin}
              interval={isMobile ? 'preserveStartEnd' : 0}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: axisConfig.fontSize }}
              tickLine={false}
              axisLine={false}
              tickCount={axisConfig.tickCount}
              width={isMobile ? 35 : 50}
            />
            <Tooltip
              content={<CustomTooltip formatter={tooltipFormatter} />}
              cursor={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
            />
            {series.map((s) => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color}
                strokeWidth={isMobile ? 1.5 : 2}
                dot={!isMobile}
                activeDot={{ r: isMobile ? 4 : 6 }}
              />
            ))}
          </LineChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={series[0]?.dataKey || 'value'}
              nameKey={xAxisKey}
              cx="50%"
              cy="50%"
              outerRadius={isMobile ? '70%' : '80%'}
              innerRadius={isMobile ? '40%' : '50%'}
              paddingAngle={2}
              label={!isMobile}
              labelLine={!isMobile}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={series[index % series.length]?.color || '#6366f1'}
                />
              ))}
            </Pie>
            <Tooltip
              content={<CustomTooltip formatter={tooltipFormatter} />}
            />
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`w-full ${className}`}
      role="img"
      aria-label={ariaLabel || `${type} chart`}
    >
      {/* Chart container with ResponsiveContainer for automatic width */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        {renderChart() as React.ReactElement}
      </ResponsiveContainer>

      {/* Legend below chart on mobile (Requirement 7.2) */}
      {showLegend && type !== 'pie' && (
        <ResponsiveLegend series={series} isMobile={isMobile} />
      )}

      {/* Pie chart legend */}
      {showLegend && type === 'pie' && (
        <div
          className={`flex flex-wrap justify-center gap-2 sm:gap-3 ${
            isMobile ? 'mt-2 text-xs' : 'mt-4 text-sm'
          }`}
        >
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full"
                style={{
                  backgroundColor:
                    series[index % series.length]?.color || '#6366f1',
                }}
              />
              <span className="text-slate-400 truncate max-w-[60px] sm:max-w-none">
                {item[xAxisKey] as string}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ResponsiveChart;
