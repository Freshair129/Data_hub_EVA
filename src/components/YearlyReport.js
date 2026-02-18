'use client';

import React, { useMemo } from 'react';

export default function YearlyReport({ dailyData }) {
    const fmt = (val, decimals = 0) => (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    // Process Yearly Stats
    const yearlyStats = useMemo(() => {
        const stats = {};

        dailyData.forEach(day => {
            const year = new Date(day.date).getFullYear();
            if (!year) return;

            if (!stats[year]) {
                stats[year] = {
                    year,
                    spend: 0,
                    reach: 0,
                    clicks: 0,
                    impressions: 0,
                    conversions: 0,
                    revenue: 0,
                    ctr: 0,
                    cpc: 0,
                    days: 0
                };
            }

            const s = stats[year];
            s.spend += day.spend || 0;
            s.reach += day.reach || 0;
            s.clicks += day.clicks || 0;
            s.impressions += day.impressions || 0;
            s.days += 1;

            // Deep conversions logic
            const purchaseTypes = ['purchase'];
            const purchaseValue = day.action_values?.filter(a => purchaseTypes.includes(a.action_type)).reduce((sum, a) => sum + parseFloat(a.value || 0), 0) || 0;
            const purchaseCount = day.actions?.filter(a => purchaseTypes.includes(a.action_type)).reduce((sum, a) => sum + parseInt(a.value || 0), 0) || 0;

            s.conversions += purchaseCount;
            s.revenue += purchaseValue;
        });

        // Calculate averages
        return Object.values(stats)
            .sort((a, b) => b.year - a.year) // Newest year first
            .map(y => {
                const ctr = y.impressions > 0 ? (y.clicks / y.impressions * 100) : 0;
                const cpc = y.clicks > 0 ? (y.spend / y.clicks) : 0;
                const roas = y.spend > 0 ? (y.revenue / y.spend) : 0;
                const costPerConv = y.conversions > 0 ? (y.spend / y.conversions) : 0;

                return { ...y, ctr, cpc, roas, costPerConv };
            });
    }, [dailyData]);

    const maxRevenue = Math.max(...yearlyStats.map(y => y.revenue), 1);

    const MetricHeader = ({ label, description, align = 'right' }) => (
        <th className={`p-5 ${align === 'right' ? 'text-right' : 'pl-8'} relative cursor-help hover:z-50`}>
            <div className={`inline-flex flex-col ${align === 'right' ? 'items-end' : 'items-start'} group relative`}>
                <span className="border-b border-white/20 border-dotted group-hover:border-white/60 transition-colors py-1">
                    {label}
                </span>
                <div className="absolute z-[100] top-full mt-2 left-1/2 -translate-x-1/2 w-56 p-4 bg-[#0A1A2F] backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 -translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                    <p className="text-[11px] font-bold leading-relaxed normal-case tracking-normal text-white/90 text-center">
                        {description}
                    </p>
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0A1A2F] border-l border-t border-white/10 rotate-45"></div>
                </div>
            </div>
        </th>
    );

    return (
        <div className="space-y-12 animate-fade-in pb-10">
            {/* Header Section */}
            <div className="flex flex-col items-center justify-center text-center space-y-4 mb-8">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <i className="fas fa-layer-group text-white text-xl"></i>
                    </div>
                    <div className="text-left">
                        <h1 className="text-4xl font-black text-white tracking-widest uppercase">ตาราง Performance รายปี</h1>
                        <p className="text-purple-400 font-bold text-sm tracking-[0.2em]">YEARLY AD PERFORMANCE SUMMARY</p>
                    </div>
                </div>
                <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </div>

            {/* Yearly Trend Chart */}
            <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] p-8">
                <h3 className="text-center font-black text-white text-md uppercase tracking-widest mb-8">Year-over-Year Revenue Comparison</h3>
                <div className="space-y-6">
                    {yearlyStats.map((y, i) => (
                        <div key={i} className="flex items-center gap-4 group">
                            <div className="w-12 text-right text-[11px] font-black text-white">{y.year}</div>
                            <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                                <div
                                    style={{ width: `${(y.revenue / maxRevenue) * 100}%` }}
                                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-400 rounded-full transition-all duration-1000 group-hover:brightness-125"
                                ></div>
                            </div>
                            <div className="w-24 text-[11px] font-black text-[#C9A34E]">฿{fmt(y.revenue)}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-purple-900/20 text-[10px] font-black text-white uppercase tracking-[0.1em]">
                                <th className="p-5 pl-8">Year</th>
                                <MetricHeader label="Ad Spent" description="งบโฆษณาที่ใช้ไปทั้งปี" />
                                <MetricHeader label="Reach" description="จำนวนผู้เห็นโฆษณา (Aggregate)" />
                                <MetricHeader label="Clicks" description="จำนวนคลิกทั้งหมด" />
                                <MetricHeader label="Conversions" description="จำนวนการซื้อทั้งหมด" />
                                <MetricHeader label="Revenue" description="ยอดขายรวม" />
                                <MetricHeader label="Cost/Conv" description="ต้นทุนเฉลี่ยต่อการซื้อ" />
                                <MetricHeader label="ROAS" description="ผลตอบแทนเฉลี่ยทั้งปี" align="right" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-[11px] font-bold text-white/80">
                            {yearlyStats.map((y, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-5 pl-8 text-white font-black text-lg">{y.year}</td>
                                    <td className="p-5 text-right">฿{fmt(y.spend, 2)}</td>
                                    <td className="p-5 text-right text-white/60">{fmt(y.reach)}</td>
                                    <td className="p-5 text-right text-white/60">{fmt(y.clicks)}</td>
                                    <td className="p-5 text-right text-emerald-400">{fmt(y.conversions)}</td>
                                    <td className="p-5 text-right font-black">฿{fmt(y.revenue, 2)}</td>
                                    <td className="p-5 text-right text-red-400">฿{fmt(y.costPerConv, 2)}</td>
                                    <td className="p-5 text-right pr-8 font-black text-[#C9A34E] text-sm">{fmt(y.roas, 2)}x</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
