'use client';

import React, { useState, useMemo } from 'react';

export default function ActiveAdsDashboard({ dailyData }) {
    // Default to show data ending at the latest available date
    const lastDate = useMemo(() => {
        if (!dailyData || dailyData.length === 0) return new Date();
        // Find max date
        return dailyData.reduce((max, d) => {
            const date = new Date(d.date);
            return date > max ? date : max;
        }, new Date(0));
    }, [dailyData]);

    const [endDate, setEndDate] = useState(lastDate);

    // Generate 7 days window
    const dateRange = useMemo(() => {
        const dates = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(endDate);
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        return dates;
    }, [endDate]);

    // Process Data
    const { matrix, summary, timelineData } = useMemo(() => {
        const adActivity = {}; // { adName: { date: boolean } }
        const allAds = new Set();

        // Map dates to easy lookup
        const dateSet = new Set(dateRange);

        dailyData.filter(d => dateSet.has(d.date)).forEach(day => {
            (day.campaigns || []).forEach(c => {
                (c.ads || []).forEach(a => {
                    if ((a.impressions || 0) > 0) {
                        const name = a.name;
                        allAds.add(name);
                        if (!adActivity[name]) adActivity[name] = {};
                        adActivity[name][day.date] = true;
                    }
                });
            });
        });

        // Convert to Array for rendering
        const sortedAds = Array.from(allAds).sort();

        // Calculate Changes
        const startDay = dateRange[0];
        const endDay = dateRange[activeDayIndex(dateRange, endDate) || 6]; // usually last day

        const activeAtStart = new Set(sortedAds.filter(name => adActivity[name]?.[startDay]));
        const activeAtEnd = new Set(sortedAds.filter(name => adActivity[name]?.[dateRange[6]]));

        const newAds = sortedAds.filter(name => !activeAtStart.has(name) && activeAtEnd.has(name));
        const stoppedAds = sortedAds.filter(name => activeAtStart.has(name) && !activeAtEnd.has(name));

        // Daily Change Logic (Today vs Yesterday)
        const yesterday = dateRange[5]; // Day before last
        const activeYesterday = new Set(sortedAds.filter(name => adActivity[name]?.[yesterday]));

        const newToday = sortedAds.filter(name => !activeYesterday.has(name) && activeAtEnd.has(name));
        const stoppedToday = sortedAds.filter(name => activeYesterday.has(name) && !activeAtEnd.has(name));

        return {
            matrix: sortedAds.map(name => ({
                name,
                days: dateRange.map(date => ({
                    date,
                    isActive: !!adActivity[name]?.[date]
                }))
            })),
            summary: {
                totalActiveToday: activeAtEnd.size,
                newCount: newAds.length,
                stoppedCount: stoppedAds.length,
                newTodayCount: newToday.length,
                stoppedTodayCount: stoppedToday.length,
                newAds,
                stoppedAds,
                newToday,
                stoppedToday
            }
        };
    }, [dailyData, dateRange]);

    function activeDayIndex(range, target) {
        return range.length - 1; // Simplification
    }

    const formatDate = (dStr) => {
        const d = new Date(dStr);
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="space-y-12 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col items-center justify-center text-center space-y-4 mb-8">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <i className="fas fa-toggle-on text-white text-xl"></i>
                    </div>
                    <div className="text-left">
                        <h1 className="text-4xl font-black text-white tracking-widest uppercase">Active Ads Monitor</h1>
                        <p className="text-emerald-400 font-bold text-sm tracking-[0.2em]">WEEKLY AD STATUS TRACKER</p>
                    </div>
                </div>
                <div className="w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-2xl p-4 flex flex-col items-center relative overflow-hidden group md:col-span-1 col-span-2">
                    <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors"></div>
                    <h3 className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1 z-10">Active Today</h3>
                    <div className="text-4xl font-black text-white z-10">{summary.totalActiveToday}</div>
                    <div className="text-white/40 text-[9px] mt-1 z-10 text-center">Ads running on {formatDate(dateRange[6])}</div>
                </div>

                <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-2xl p-4 flex flex-col items-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-cyan-400/5 group-hover:bg-cyan-400/10 transition-colors"></div>
                    <h3 className="text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-1 z-10">New Today</h3>
                    <div className="text-4xl font-black text-white z-10 flex items-center">
                        {summary.newTodayCount > 0 ? '+' : ''}{summary.newTodayCount}
                    </div>
                    <div className="text-white/40 text-[9px] mt-1 z-10 text-center">Started today</div>
                </div>

                <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-2xl p-4 flex flex-col items-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-rose-400/5 group-hover:bg-rose-400/10 transition-colors"></div>
                    <h3 className="text-rose-400 text-[10px] font-black uppercase tracking-widest mb-1 z-10">Stop Today</h3>
                    <div className="text-4xl font-black text-white z-10 flex items-center">
                        {summary.stoppedTodayCount > 0 ? '-' : ''}{summary.stoppedTodayCount}
                    </div>
                    <div className="text-white/40 text-[9px] mt-1 z-10 text-center">Stopped today</div>
                </div>

                <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-2xl p-4 flex flex-col items-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
                    <h3 className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1 z-10">New This Week</h3>
                    <div className="text-4xl font-black text-white z-10">+{summary.newCount}</div>
                    <div className="text-white/40 text-[9px] mt-1 z-10 text-center">vs 7 days ago</div>
                </div>

                <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-2xl p-4 flex flex-col items-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors"></div>
                    <h3 className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-1 z-10">Stop This Week</h3>
                    <div className="text-4xl font-black text-white z-10">-{summary.stoppedCount}</div>
                    <div className="text-white/40 text-[9px] mt-1 z-10 text-center">vs 7 days ago</div>
                </div>
            </div>

            {/* Timeline Matrix */}
            <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] overflow-hidden p-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-white text-xl uppercase tracking-widest">Ad Status Timeline</h3>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            <span className="text-xs text-white/50">Active</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                            <span className="text-xs text-white/50">Inactive</span>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="p-4 text-xs font-black text-white uppercase tracking-widest border-b border-white/10 w-1/3">Ad Name</th>
                                {dateRange.map(date => (
                                    <th key={date} className="p-4 text-center text-[10px] font-black text-white/60 uppercase tracking-widest border-b border-white/10">
                                        {formatDate(date)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {matrix.map((row, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group border-b border-white/5 last:border-0">
                                    <td className="p-4 font-bold text-white truncate max-w-xs" title={row.name}>
                                        {row.name}
                                        {summary.newToday.includes(row.name) && <span className="ml-2 text-[9px] bg-cyan-400/20 text-cyan-400 px-1.5 py-0.5 rounded uppercase font-black">New Today</span>}
                                        {summary.stoppedToday.includes(row.name) && <span className="ml-2 text-[9px] bg-rose-400/20 text-rose-400 px-1.5 py-0.5 rounded uppercase font-black">Stop Today</span>}
                                        {!summary.newToday.includes(row.name) && summary.newAds.includes(row.name) && <span className="ml-2 text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-black">New Wk</span>}
                                        {!summary.stoppedToday.includes(row.name) && summary.stoppedAds.includes(row.name) && <span className="ml-2 text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase font-black">Stop Wk</span>}
                                    </td>
                                    {row.days.map((day, j) => (
                                        <td key={j} className="p-2 text-center">
                                            <div className="flex justify-center">
                                                <div
                                                    className={`w-3 h-3 rounded-full transition-all duration-300 ${day.isActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-110' : 'bg-slate-800 opacity-30 scale-90'}`}
                                                    title={day.isActive ? `Active on ${formatDate(day.date)}` : `Inactive on ${formatDate(day.date)}`}
                                                ></div>
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
