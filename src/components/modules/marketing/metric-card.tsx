import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  subtitle?: string;
}

export function MetricCard({ title, value, icon: Icon, subtitle }: MetricCardProps) {
  return (
    <Card className="flex items-start justify-between">
      <div>
        <h3 className="text-sm font-medium text-[#9a9a9a] mb-1">{title}</h3>
        <p className="text-3xl font-bold text-[#ffffff]">{value}</p>
        {subtitle && <p className="text-xs text-[#9a9a9a] mt-2">{subtitle}</p>}
      </div>
      <div className="p-3 rounded-xl bg-[#1a1a1a]">
        <Icon className="h-6 w-6 text-[#9a9a9a]" />
      </div>
    </Card>
  );
}
