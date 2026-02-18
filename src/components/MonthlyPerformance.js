'use client';

import React, { useState, useMemo } from 'react';

export default function MonthlyPerformance({ dailyData }) {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const fmt = (val, decimals = 0) => (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    // Detect available years from data
    const availableYears = useMemo(() => {
        const years = new Set();
        dailyData.forEach(day => {
            const y = new Date(day.date).getFullYear();
            if (y) years.add(y);
        });
        // Default to current year if no data
        if (years.size === 0) years.add(new Date().getFullYear());
        return Array.from(years).sort((a, b) => b - a);
    }, [dailyData]);

    const monthlyStats = useMemo(() => {
        const thaiMonths = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];

        const stats = thaiMonths.map((name, index) => ({
            name,
            monthIndex: index,
            spend: 0,
            reach: 0,
            clicks: 0,
            conversions: 0,
            revenue: 0,
            actions: [],
            hasData: false
        }));

        console.log(`[MonthlyPerformance] Processing ${dailyData.length} records for year ${selectedYear}`);
        dailyData.forEach(day => {
            const [y, m, d] = day.date.split('-').map(Number);
            if (y === selectedYear) {
                const monthIdx = m - 1;
                const mObj = stats[monthIdx];
                if (mObj) {
                    mObj.spend += day.spend || 0;
                    mObj.reach += day.reach || 0;
                    mObj.clicks += day.clicks || 0;
                    mObj.hasData = true;

                    // Conversions logic (Purchases)
                    const purchaseTypes = ['purchase', 'onsite_conversion.purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'];
                    const purchaseValue = day.action_values?.filter(a => purchaseTypes.includes(a.action_type)).reduce((sum, a) => sum + parseFloat(a.value || 0), 0) || 0;
                    const purchaseCount = day.actions?.filter(a => purchaseTypes.includes(a.action_type)).reduce((sum, a) => sum + parseInt(a.value || 0), 0) || 0;

                    mObj.conversions += purchaseCount;
                    mObj.revenue += purchaseValue;
                }
            }
        });
        console.log(`[MonthlyPerformance] Sample Monthly Stat (Jan):`, stats[0]);

        return stats.map(m => {
            const costPerConv = m.conversions > 0 ? (m.spend / m.conversions) : 0;
            const roas = m.spend > 0 ? (m.revenue / m.spend) : 0;
            return { ...m, costPerConv, roas };
        });
    }, [dailyData, selectedYear]);

    const maxSpendRevenue = Math.max(...monthlyStats.map(m => Math.max(m.spend, m.revenue)), 1);
    const maxReach = Math.max(...monthlyStats.map(m => m.reach), 1);
    const maxConversions = Math.max(...monthlyStats.map(m => m.conversions), 1);
    const maxROAS = Math.max(...monthlyStats.map(m => m.roas), 1);

    const MetricHeader = ({ label, description, align = 'right' }) => (
        <th className={`p-5 ${align === 'right' ? 'text-right' : 'pl-8'} relative cursor-help hover:z-50`}>
            <div className={`inline-flex flex-col ${align === 'right' ? 'items-end' : 'items-start'} group relative`}>
                <span className="border-b border-white/20 border-dotted group-hover:border-white/60 transition-colors py-1">
                    {label}
                </span>
                {/* Tooltip */}
                <div className="absolute z-[100] top-full mt-2 left-1/2 -translate-x-1/2 w-56 p-4 bg-[#0A1A2F] backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 -translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                    <p className="text-[11px] font-bold leading-relaxed normal-case tracking-normal text-white/90 text-center">
                        {description}
                    </p>
                    {/* Arrow */}
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
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9A34E] to-amber-600 flex items-center justify-center shadow-lg shadow-[#C9A34E]/20">
                        <i className="fas fa-table text-white text-xl"></i>
                    </div>
                    <div className="text-left">
                        <h1 className="text-4xl font-black text-white tracking-widest uppercase">Monthly Report (Summary)</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-[#C9A34E] font-bold text-sm tracking-[0.2em]">MONTHLY AD PERFORMANCE DASHBOARD •</p>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="bg-[#0A1A2F] text-[#C9A34E] border border-[#C9A34E]/30 rounded-lg px-3 py-1 text-sm font-black focus:outline-none focus:ring-1 focus:ring-[#C9A34E]"
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

            {/* ROAS Summary (Horizontal Bars) & Table View */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* ROAS Bars */}
                <div className="xl:col-span-3 bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] p-6 flex flex-col">
                    <h3 className="text-center font-black text-white text-xl uppercase tracking-widest mb-8">ROAS</h3>
                    <div className="flex-1 space-y-4">
                        {monthlyStats.map((m, i) => (
                            <div key={i} className="flex items-center gap-3 group">
                                <span className="text-[10px] font-black text-white/40 w-16 text-right uppercase">{m.name.slice(0, 3)}</span>
                                <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                                    <div
                                        style={{ width: `${(m.roas / maxROAS) * 100}%` }}
                                        className="h-full bg-gradient-to-r from-amber-600 to-[#C9A34E] rounded-full transition-all duration-1000 group-hover:from-amber-500 group-hover:to-amber-300"
                                    ></div>
                                </div>
                                <span className="text-[10px] font-black text-[#C9A34E] w-8">
                                    {m.roas > 0 ? fmt(m.roas, 2) : '0.00'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Performance Table */}
                <div className="xl:col-span-9 bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem]">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-[#BFA173]/20 text-[10px] font-black text-white uppercase tracking-[0.1em]">
                                <th className="p-5 pl-8">เดือน</th>
                                <MetricHeader label="Ad Spent" description="งบโฆษณาที่ใช้ไปทั้งหมดในเดือนนั้นๆ" />
                                <MetricHeader label="Reach" description="จำนวนคนที่เห็นโฆษณาอย่างน้อย 1 ครั้ง (คนไม่ซ้ำกัน)" />
                                <MetricHeader label="Clicks" description="จำนวนครั้งที่มีการคลิกที่ตัวโฆษณา" />
                                <MetricHeader label="Conversions" description="จำนวนการซื้อ (Purchases) ที่เกิดขึ้นจริง" />
                                <MetricHeader label="Revenue" description="ยอดขายรวมที่เกิดขึ้นจากการโฆษณา" />
                                <MetricHeader label="Cost per Conv." description="ต้นทุนเฉลี่ยต่อการได้มาซึ่งการซื้อ 1 ครั้ง (ยิ่งต่ำยิ่งดี)" />
                                <MetricHeader label="ROAS" description="ผลตอบแทนจากงบโฆษณา (ยอดขาย ÷ งบโฆษณา) ยิ่งสูงยิ่งกำไรดี" align="right" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-[11px] font-bold text-white/80">
                            {monthlyStats.map((m, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4 pl-8 text-white font-black">{m.name}</td>
                                    <td className="p-4 text-right">฿{fmt(m.spend, 2)}</td>
                                    <td className="p-4 text-right text-white/60">{fmt(m.reach)}</td>
                                    <td className="p-4 text-right text-white/60">{fmt(m.clicks)}</td>
                                    <td className="p-4 text-right text-emerald-400">{fmt(m.conversions)}</td>
                                    <td className="p-4 text-right font-black">฿{fmt(m.revenue, 2)}</td>
                                    <td className="p-4 text-right text-red-400">฿{fmt(m.costPerConv, 2)}</td>
                                    <td className="p-4 text-right pr-8 font-black text-[#C9A34E]">{fmt(m.roas, 2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-white/5 text-[11px] font-black text-white uppercase">
                                <td className="p-5 pl-8">Total</td>
                                <td className="p-5 text-right">฿{fmt(monthlyStats.reduce((s, m) => s + m.spend, 0), 2)}</td>
                                <td className="p-5 text-right">{fmt(monthlyStats.reduce((s, m) => s + m.reach, 0))}</td>
                                <td className="p-5 text-right">{fmt(monthlyStats.reduce((s, m) => s + m.clicks, 0))}</td>
                                <td className="p-5 text-right text-emerald-400">{fmt(monthlyStats.reduce((s, m) => s + m.conversions, 0))}</td>
                                <td className="p-5 text-right">฿{fmt(monthlyStats.reduce((s, m) => s + m.revenue, 0), 2)}</td>
                                <td className="p-5 text-right">-</td>
                                <td className="p-5 text-right pr-8 text-[#C9A34E]">
                                    {fmt(monthlyStats.reduce((s, m) => s + m.revenue, 0) / (monthlyStats.reduce((s, m) => s + m.spend, 0) || 1), 2)}x
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Visual Trend Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Revenue vs Ads Spent Area Chart */}
                <div className="xl:col-span-8 bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] p-8">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="font-black text-white text-xl uppercase tracking-widest">รายรับและรายจ่าย</h3>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                                <span className="text-[10px] font-black text-white/50 uppercase">Ad Spent</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#BFA173]"></div>
                                <span className="text-[10px] font-black text-white/50 uppercase">Revenue</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-64 flex items-end gap-2 px-4 relative">
                        {/* Grid Lines */}
                        <div className="absolute inset-x-8 inset-y-0 flex flex-col justify-between pointer-events-none opacity-10">
                            {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-px w-full bg-white"></div>)}
                        </div>

                        {monthlyStats.map((m, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center group gap-1">
                                <div className="flex flex-col gap-1 w-full justify-end h-full">
                                    {/* Revenue Bar */}
                                    <div
                                        style={{ height: `${(m.revenue / maxSpendRevenue) * 100}%` }}
                                        className="w-full bg-[#C9A34E]/60 border-t-2 border-[#C9A34E] rounded-t-lg relative group-hover:bg-[#C9A34E] transition-all"
                                    >
                                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black px-1.5 py-0.5 rounded">฿{fmt(m.revenue)}</span>
                                    </div>
                                    {/* Spent Bar */}
                                    <div
                                        style={{ height: `${(m.spend / maxSpendRevenue) * 100}%` }}
                                        className="w-full bg-slate-700/60 border-t-2 border-slate-500 rounded-t-lg relative group-hover:bg-slate-500 transition-all"
                                    >
                                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white px-1.5 py-0.5 rounded whitespace-nowrap">฿{fmt(m.spend)}</span>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black text-white/20 mt-2 uppercase">{m.name.slice(0, 3)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Reach & Conversions Trends */}
                <div className="xl:col-span-4 space-y-8">
                    {/* Reach Trends */}
                    <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] p-8">
                        <h3 className="text-center font-black text-white text-md uppercase tracking-widest mb-6">Reach</h3>
                        <div className="h-32 flex items-end gap-1.5">
                            {monthlyStats.map((m, i) => (
                                <div key={i} className="flex-1 bg-white/5 hover:bg-white/20 rounded-t-md transition-all relative group h-full justify-end flex flex-col">
                                    <div style={{ height: `${(m.reach / maxReach) * 100}%` }} className="w-full bg-indigo-500/40 border-t-2 border-indigo-400 rounded-t-md"></div>
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[7px] font-black text-white opacity-0 group-hover:opacity-100">{fmt(m.reach)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Conversions Trends */}
                    <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] p-8">
                        <h3 className="text-center font-black text-white text-md uppercase tracking-widest mb-6">Conversions</h3>
                        <div className="h-32 flex items-end gap-1.5">
                            {monthlyStats.map((m, i) => (
                                <div key={i} className="flex-1 bg-white/5 hover:bg-white/20 rounded-t-md transition-all relative group h-full justify-end flex flex-col">
                                    <div style={{ height: `${(m.conversions / maxConversions) * 100}%` }} className="w-full bg-emerald-500/40 border-t-2 border-emerald-400 rounded-t-md"></div>
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[7px] font-black text-white opacity-0 group-hover:opacity-100">{fmt(m.conversions)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
