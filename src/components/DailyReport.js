'use client';

import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';

export default function DailyReport({ dailyData }) {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
    const fmt = (val, decimals = 0) => (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    // Constants
    // Constants - Standardize to English for internal matching if needed, 
    // but the actual issue is date.getMonth() returns 0-11, which matches the array index.
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Thai labels for UI
    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    // Detect available years
    const availableYears = useMemo(() => {
        const years = new Set();
        dailyData.forEach(day => {
            const y = new Date(day.date).getFullYear();
            if (y) years.add(y);
        });
        if (years.size === 0) years.add(new Date().getFullYear());
        return Array.from(years).sort((a, b) => b - a);
    }, [dailyData]);

    // Process Daily Stats for Selected Month
    const dailyStats = useMemo(() => {
        return dailyData
            .filter(day => {
                const [y, m, d] = day.date.split('-').map(Number);
                const match = y === selectedYear && (m - 1) === selectedMonth;
                if (match) console.log(`[DailyReport] Found match for ${day.date}`);
                return match;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(day => {
                const purchaseTypes = ['purchase', 'onsite_conversion.purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'];
                const purchaseValue = day.action_values?.filter(a => purchaseTypes.includes(a.action_type)).reduce((sum, a) => sum + parseFloat(a.value || 0), 0) || 0;
                const purchaseCount = day.actions?.filter(a => purchaseTypes.includes(a.action_type)).reduce((sum, a) => sum + parseInt(a.value || 0), 0) || 0;
                const costPerConv = purchaseCount > 0 ? (day.spend / purchaseCount) : 0;
                const roas = day.spend > 0 ? (purchaseValue / day.spend) : 0;

                // Count active ads (ads delivering impressions > 0)
                const activeAds = day.campaigns?.reduce((sum, c) => sum + (c.ads?.filter(a => (a.impressions || 0) > 0).length || 0), 0) || 0;

                return {
                    date: day.date,
                    displayDate: new Date(day.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
                    spend: day.spend || 0,
                    reach: day.reach || 0,
                    clicks: day.clicks || 0,
                    impressions: day.impressions || 0,
                    ctr: day.ctr || 0,
                    cpc: day.cpc || 0,
                    conversions: purchaseCount,
                    revenue: purchaseValue,
                    costPerConv,
                    roas: parseFloat(roas.toFixed(2)),
                    activeAds
                };
            });
    }, [dailyData, selectedYear, selectedMonth]);

    // Totals for Footer
    const totals = useMemo(() => {
        return dailyStats.reduce((acc, curr) => ({
            spend: acc.spend + curr.spend,
            reach: acc.reach + curr.reach,
            clicks: acc.clicks + curr.clicks,
            impressions: acc.impressions + curr.impressions,
            conversions: acc.conversions + curr.conversions,
            revenue: acc.revenue + curr.revenue
        }), { spend: 0, reach: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0 });
    }, [dailyStats]);

    const totalROAS = totals.spend > 0 ? (totals.revenue / totals.spend) : 0;
    const totalCPC = totals.clicks > 0 ? (totals.spend / totals.clicks) : 0;
    const totalCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;

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
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <i className="fas fa-calendar-day text-white text-xl"></i>
                    </div>
                    <div className="text-left">
                        <h1 className="text-4xl font-black text-white tracking-widest uppercase">Daily Ad Performance</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-blue-400 font-bold text-sm tracking-[0.2em]">DAILY AD PERFORMANCE •</p>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                className="bg-[#0A1A2F] text-blue-400 border border-blue-500/30 rounded-lg px-3 py-1 text-sm font-black focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {thaiMonths.map((m, i) => (
                                    <option key={i} value={i}>{m}</option>
                                ))}
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="bg-[#0A1A2F] text-blue-400 border border-blue-500/30 rounded-lg px-3 py-1 text-sm font-black focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </div>

            {/* Performance Analytics Charts */}
            {dailyStats.length > 0 && (
                <div className="grid grid-cols-1 gap-12 mb-12">
                    {/* Combined Financial Performance Chart */}
                    <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] p-6 lg:p-10 flex flex-col h-[600px]">
                        <h3 className="text-center font-black text-white text-xs uppercase tracking-[0.2em] mb-10">Monthly Financial Overview (Spend, Revenue & ROAS)</h3>
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={dailyStats} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis
                                        dataKey="displayDate"
                                        stroke="rgba(255,255,255,0.3)"
                                        fontSize={10}
                                        tick={{ fill: 'rgba(255,255,255,0.5)' }}
                                        tickFormatter={(tick, i) => i % 3 === 0 ? tick : ''}
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
                                    <Bar yAxisId="left" dataKey="spend" name="Ad Spent" fill="#2563EB" radius={[2, 2, 0, 0]} />
                                    <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#0EA5E9" radius={[2, 2, 0, 0]} />
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="roas"
                                        name="ROAS"
                                        stroke="#C9A34E"
                                        strokeWidth={3}
                                        dot={{ fill: '#C9A34E', r: 3, strokeWidth: 1.5, stroke: 'white' }}
                                        activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
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
                                <ComposedChart data={dailyStats} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis
                                        dataKey="displayDate"
                                        stroke="rgba(255,255,255,0.3)"
                                        fontSize={9}
                                        tickFormatter={(tick, i) => i % 5 === 0 ? tick : ''}
                                    />
                                    <YAxis yAxisId="left" stroke="rgba(255,255,255,0.3)" fontSize={9} />
                                    <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.3)" fontSize={9} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0A1A2F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                        labelStyle={{ color: 'white', marginBottom: '4px', fontSize: '11px' }}
                                    />
                                    <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', paddingTop: '20px' }} />
                                    <Bar yAxisId="left" dataKey="clicks" name="Clicks" fill="rgba(255,255,255,0.1)" radius={[2, 2, 0, 0]} />
                                    <Line yAxisId="right" type="monotone" dataKey="conversions" name="Conversions" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} activeDot={{ r: 5, stroke: 'white', strokeWidth: 2 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Table */}
            <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-blue-900/20 text-[10px] font-black text-white uppercase tracking-[0.1em]">
                                <th className="p-5 pl-8">วันที่</th>
                                <MetricHeader label="Active Ads" description="จำนวนโฆษณาที่ทำงานในวันนั้น" />
                                <MetricHeader label="Ad Spent" description="งบโฆษณาที่ใช้ไปในวันนั้น" />
                                <MetricHeader label="Reach" description="จำนวนคนที่เห็นโฆษณา (ไม่ซ้ำ)" />
                                <MetricHeader label="Clicks" description="จำนวนคลิกทั้งหมด" />
                                <MetricHeader label="CTR" description="อัตราการคลิกต่อการมองเห็น (%)" />
                                <MetricHeader label="CPC" description="ต้นทุนต่อคลิก (บาท)" />
                                <MetricHeader label="Conversions" description="จำนวนการซื้อ (Purchases)" />
                                <MetricHeader label="Revenue" description="ยอดขายรวมจากโฆษณา" />
                                <MetricHeader label="ROAS" description="ผลตอบแทน (ยอดขาย ÷ งบโฆษณา)" align="right" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-[11px] font-bold text-white/80">
                            {dailyStats.length > 0 ? dailyStats.map((d, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4 pl-8 text-white font-black whitespace-nowrap">{d.displayDate}</td>
                                    <td className="p-4 text-right text-blue-400 font-bold">{d.activeAds}</td>
                                    <td className="p-4 text-right">฿{fmt(d.spend, 2)}</td>
                                    <td className="p-4 text-right text-white/60">{fmt(d.reach)}</td>
                                    <td className="p-4 text-right text-white/60">{fmt(d.clicks)}</td>
                                    <td className="p-4 text-right text-white/60">{fmt(d.ctr, 2)}%</td>
                                    <td className="p-4 text-right text-white/60">฿{fmt(d.cpc, 2)}</td>
                                    <td className="p-4 text-right text-emerald-400">{fmt(d.conversions)}</td>
                                    <td className="p-4 text-right font-black">฿{fmt(d.revenue, 2)}</td>
                                    <td className="p-4 text-right pr-8 font-black text-[#C9A34E]">{fmt(d.roas, 2)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={10} className="p-12 text-center text-white/30 font-bold uppercase tracking-widest">
                                        No data found for {months[selectedMonth]} {selectedYear}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {dailyStats.length > 0 && (
                            <tfoot>
                                <tr className="bg-white/5 text-[11px] font-black text-white uppercase">
                                    <td className="p-5 pl-8">Total</td>
                                    <td className="p-5 text-right font-normal text-white/40">-</td>
                                    <td className="p-5 text-right">฿{fmt(totals.spend, 2)}</td>
                                    <td className="p-5 text-right font-normal text-white/40">(Aggregated)</td>
                                    <td className="p-5 text-right">{fmt(totals.clicks)}</td>
                                    <td className="p-5 text-right">{fmt(totalCTR, 2)}%</td>
                                    <td className="p-5 text-right">฿{fmt(totalCPC, 2)}</td>
                                    <td className="p-5 text-right text-emerald-400">{fmt(totals.conversions)}</td>
                                    <td className="p-5 text-right">฿{fmt(totals.revenue, 2)}</td>
                                    <td className="p-5 text-right pr-8 text-[#C9A34E]">{fmt(totalROAS, 2)}x</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
