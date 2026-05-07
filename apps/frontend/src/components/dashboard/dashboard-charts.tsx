"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function DashboardCharts({
  data,
}: {
  data: Array<{ hour: string; events: number; entries: number; exits: number; alerts: number }>;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!mounted) {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-80 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" />
        <div className="h-80 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="h-80 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Events by hour</h2>
          <p className="text-sm text-slate-500">Mock recognition volume across the workday.</p>
        </div>
        <ResponsiveContainer width="100%" height="78%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="events" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip />
            <Area type="monotone" dataKey="events" stroke="#0f766e" fill="url(#events)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="h-80 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Entry / Exit / Alerts</h2>
          <p className="text-sm text-slate-500">Operational split used by attendance review.</p>
        </div>
        <ResponsiveContainer width="100%" height="78%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip />
            <Legend />
            <Bar dataKey="entries" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="exits" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="alerts" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
