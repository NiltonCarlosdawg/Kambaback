"use client";

import {
  AreaChart,
  Area,
  ResponsiveContainer
} from "recharts";
import { Button } from "@/components/ui/button";
import CountUp from "react-countup";

interface RuixenStatsChartPoint {
  name: string;
  value: number;
}

interface RuixenStatsChartProps {
  data: RuixenStatsChartPoint[];
  heroValue: number;
  heroLabel: string;
  sideStats: { value: string; label: string }[];
  accentColor?: string;
}

export function RuixenStatsChart({
  data,
  heroValue,
  heroLabel,
  sideStats,
  accentColor = "#3b82f6",
}: RuixenStatsChartProps) {
  const gradientId = "ruixenBlueDynamic";

  return (
    <div className="relative w-full h-[400px] bg-white dark:bg-black rounded-2xl overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={accentColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="natural"
            dataKey="value"
            stroke={accentColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <h3 className="text-6xl font-extrabold text-gray-900 dark:text-white drop-shadow-md">
          <CountUp end={heroValue} duration={2.5} separator="." />
        </h3>
        <p className="text-gray-500 dark:text-gray-400">{heroLabel}</p>
      </div>

      <div className="absolute right-4 top-4 bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 flex flex-col gap-4">
        {sideStats.map((stat, idx) => (
          <div key={idx}>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
 

