'use client';

import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';

export default function WeeklyReport({ dailyData }) {
    // Helper to get ISO Week string from date
    const getWeekVal = (d) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
    };

    const [selectedWeek, setSelectedWeek] = useState(getWeekVal(new Date()));

    const fmt = (val, decimals = 0) => (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    // Helper to get dates from Week String (YYYY-Www)
    const getDateRangeFromWeek = (weekStr) => {
        const [year, week] = weekStr.split('-W');
        const d = new Date(Date.UTC(year, 0, 4)); // Jan 4th is always in week 1
        // Adjust to Monday of Week 1
        d.setUTCDate(d.getUTCDate() - (d.getUTCDay() || 7) + 1);
        // Add (week - 1) weeks
        d.setUTCDate(d.getUTCDate() + (parseInt(week) - 1) * 7);

        const dates = [];
        for (let i = 0; i < 7; i++) {
            const current = new Date(d);
            current.setUTCDate(d.getUTCDate() + i);
            dates.push(current.toISOString().split('T')[0]);
        }
        return dates;
    };

    const weeklyStats = useMemo(() => {
        if (!selectedWeek) return [];
        const weekDates = getDateRangeFromWeek(selectedWeek);
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        return weekDates.map((dateStr, i) => {
            const dayData = dailyData.find(d => d.date === dateStr);

            if (!dayData) {
                return {
                    date: dateStr,
                    dayName: dayNames[i],
                    displayDate: new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
                    spend: 0,
                    impressions: 0,
                    clicks: 0,
                    revenue: 0,
                    conversions: 0,
                    ctr: 0,
                    cpc: 0,
                    roas: 0,
                    activeAds: 0
                };
            }

            const purchaseTypes = ['purchase', 'onsite_conversion.purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'];
            const revenue = dayData.action_values?.filter(a => purchaseTypes.includes(a.action_type)).reduce((sum, a) => sum + parseFloat(a.value || 0), 0) || 0;
            const conversions = dayData.actions?.filter(a => purchaseTypes.includes(a.action_type)).reduce((sum, a) => sum + parseInt(a.value || 0), 0) || 0;

            const activeAds = dayData.campaigns?.reduce((sum, c) => sum + (c.ads?.filter(a => (a.impressions || 0) > 0).length || 0), 0) || 0;

            const ctr = dayData.ctr || (dayData.impressions > 0 ? (dayData.clicks / dayData.impressions * 100) : 0);
            const cpc = dayData.cpc || (dayData.clicks > 0 ? (dayData.spend / dayData.clicks) : 0);
            const roas = dayData.spend > 0 ? (revenue / dayData.spend) : 0;

            return {
                date: dateStr,
                dayName: dayNames[i],
                displayDate: new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
                spend: dayData.spend || 0,
                impressions: dayData.impressions || 0,
                clicks: dayData.clicks || 0,
                revenue,
                conversions,
                ctr,
                cpc,
                roas: parseFloat(roas.toFixed(2)),
                activeAds
            };
        });
    }, [selectedWeek, dailyData]);

    const totals = useMemo(() => {
        return weeklyStats.reduce((acc, curr) => ({
            spend: acc.spend + curr.spend,
            impressions: acc.impressions + curr.impressions,
            clicks: acc.clicks + curr.clicks,
            revenue: acc.revenue + curr.revenue,
            conversions: acc.conversions + curr.conversions
        }), { spend: 0, impressions: 0, clicks: 0, revenue: 0, conversions: 0 });
    }, [weeklyStats]);

    const MetricHeader = ({ label, description, align = 'right' }) => (
        <th className={`p-4 ${align === 'right' ? 'text-right' : 'pl-6'} relative cursor-help hover:z-50`}>
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
            {/* Header */}
            <div className="flex flex-col items-center justify-center text-center space-y-4 mb-8">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <i className="fas fa-calendar-week text-white text-xl"></i>
                    </div>
                    <div className="text-left">
                        <h1 className="text-4xl font-black text-white tracking-widest uppercase">Weekly Report</h1>
                        <p className="text-indigo-400 font-bold text-sm tracking-[0.2em]">DAILY BREAKDOWN (MON-SUN)</p>
                    </div>
                </div>

                {/* Week Picker */}
                <div className="relative group">
                    <div className="flex items-center gap-3 bg-[#0A1A2F] border border-white/20 rounded-xl px-4 py-2 transition-all group-hover:border-indigo-500">
                        <i className="fas fa-calendar-alt text-indigo-400"></i>
                        <input
                            type="date"
                            onChange={(e) => {
                                if (e.target.value) {
                                    const date = new Date(e.target.value);
                                    setSelectedWeek(getWeekVal(date));
                                }
                            }}
                            className="bg-transparent text-white font-bold uppercase tracking-wider focus:outline-none w-32 cursor-pointer"
                        />
                        <div className="text-white/40 text-xs font-bold border-l border-white/10 pl-3">
                            {selectedWeek ? (() => {
                                const dates = getDateRangeFromWeek(selectedWeek);
                                const start = new Date(dates[0]);
                                const end = new Date(dates[6]);
                                return `${start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`;
                            })() : 'Select a date'}
                        </div>
                    </div>
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-[10px] text-white/30 font-bold uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Select any date in the desired week
                    </div>
                </div>
            </div>

            {/* Performance Analytics Charts */}
            <div className="grid grid-cols-1 gap-12 mb-12">
                {/* Combined Financial Performance Chart */}
                <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] p-6 lg:p-10 flex flex-col h-[600px]">
                    <h3 className="text-center font-black text-white text-xs uppercase tracking-[0.2em] mb-10">Financial Multi-Axis Performance (Spend, Revenue & ROAS)</h3>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={weeklyStats} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis
                                    dataKey="displayDate"
                                    stroke="rgba(255,255,255,0.3)"
                                    fontSize={10}
                                    tick={{ fill: 'rgba(255,255,255,0.5)' }}
                                    dy={10}
                                />
                                <YAxis
                                    yAxisId="left"
                                    stroke="rgba(255,255,255,0.3)"
                                    fontSize={10}
                                    tickFormatter={(val) => `฿${fmt(val)}`}
                                    label={{ value: 'Currency (฿)', angle: -90, position: 'insideLeft', style: { fill: 'rgba(255,255,255,0.2)', fontSize: '10px', fontWeight: 'bold' } }}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="rgba(255,255,255,0.3)"
                                    fontSize={10}
                                    tickFormatter={(val) => `${fmt(val, 1)}x`}
                                    label={{ value: 'Performance (ROAS)', angle: 90, position: 'insideRight', style: { fill: 'rgba(255,255,255,0.2)', fontSize: '10px', fontWeight: 'bold' } }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0A1A2F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '12px' }}
                                    itemStyle={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 0' }}
                                    labelStyle={{ color: 'white', marginBottom: '8px', fontSize: '12px', fontWeight: 'black' }}
                                    formatter={(value, name) => {
                                        if (name === 'ROAS') return [`${fmt(value, 2)}x`, name];
                                        return [`฿${fmt(value)}`, name];
                                    }}
                                />
                                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', paddingBottom: '30px' }} />
                                <Bar yAxisId="left" dataKey="spend" name="Ad Spent" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={40} />
                                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#0EA5E9" radius={[4, 4, 0, 0]} barSize={40} />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="roas"
                                    name="ROAS"
                                    stroke="#C9A34E"
                                    strokeWidth={4}
                                    dot={{ fill: '#C9A34E', r: 5, strokeWidth: 2, stroke: 'white' }}
                                    activeDot={{ r: 8, stroke: 'white', strokeWidth: 2 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Conversion Funnel: Clicks vs Conversions */}
                <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] p-6 lg:p-10 flex flex-col h-[500px]">
                    <h3 className="text-center font-black text-white text-xs uppercase tracking-[0.2em] mb-8">Conversion Funnel (Clicks vs Conv)</h3>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={weeklyStats} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis
                                    dataKey="dayName"
                                    stroke="rgba(255,255,255,0.3)"
                                    fontSize={9}
                                />
                                <YAxis yAxisId="left" stroke="rgba(255,255,255,0.3)" fontSize={9} />
                                <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.3)" fontSize={9} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0A1A2F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                    labelStyle={{ color: 'white', marginBottom: '4px', fontSize: '11px' }}
                                />
                                <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', paddingTop: '20px' }} />
                                <Bar yAxisId="left" dataKey="clicks" name="Clicks" fill="rgba(255,255,255,0.1)" radius={[4, 4, 0, 0]} barSize={40} />
                                <Line yAxisId="right" type="monotone" dataKey="conversions" name="Conversions" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 4 }} activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] overflow-hidden mt-8">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-indigo-900/20 text-[10px] font-black text-white uppercase tracking-[0.1em]">
                                <th className="p-5 pl-8">Day</th>
                                <MetricHeader label="Active Ads" description="จำนวนโฆษณาที่ทำงาน" />
                                <MetricHeader label="Ad Spent" description="งบโฆษณา" />
                                <MetricHeader label="Clicks" description="จำนวนคลิก" />
                                <MetricHeader label="CTR" description="อัตราการคลิก" />
                                <MetricHeader label="CPC" description="ต้นทุนต่อคลิก" />
                                <MetricHeader label="Conversions" description="จำนวนการซื้อ" />
                                <MetricHeader label="Revenue" description="ยอดขาย" />
                                <MetricHeader label="ROAS" description="ผลตอบแทน" align="right" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-[11px] font-bold text-white/80">
                            {weeklyStats.map((d, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4 pl-8 text-white font-black whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span>{d.displayDate}</span>
                                            <span className="text-[9px] text-white/30 uppercase tracking-widest">{d.dayName}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right text-indigo-400 font-bold">{d.activeAds}</td>
                                    <td className="p-4 text-right">฿{fmt(d.spend, 0)}</td>
                                    <td className="p-4 text-right text-white/60">{fmt(d.clicks)}</td>
                                    <td className="p-4 text-right text-white/60">{fmt(d.ctr, 2)}%</td>
                                    <td className="p-4 text-right text-white/60">฿{fmt(d.cpc, 2)}</td>
                                    <td className="p-4 text-right text-emerald-400">{fmt(d.conversions)}</td>
                                    <td className="p-4 text-right font-black">฿{fmt(d.revenue, 0)}</td>
                                    <td className="p-4 text-right pr-8 font-black text-[#C9A34E]">{fmt(d.roas, 2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-white/5 font-black text-white text-xs">
                            <tr>
                                <td className="p-4 pl-8 text-indigo-400 uppercase tracking-widest">Total</td>
                                <td className="p-4 text-right">-</td>
                                <td className="p-4 text-right">฿{fmt(totals.spend, 0)}</td>
                                <td className="p-4 text-right">{fmt(totals.clicks)}</td>
                                <td className="p-4 text-right">-</td>
                                <td className="p-4 text-right">-</td>
                                <td className="p-4 text-right text-emerald-400">{fmt(totals.conversions)}</td>
                                <td className="p-4 text-right">฿{fmt(totals.revenue, 0)}</td>
                                <td className="p-4 text-right pr-8 text-[#C9A34E]">
                                    {fmt(totals.spend > 0 ? totals.revenue / totals.spend : 0, 2)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
