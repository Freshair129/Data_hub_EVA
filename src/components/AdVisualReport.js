'use client';

import React, { useState, useEffect } from 'react';

export default function AdVisualReport({ ad, onClose }) {
    const [daily, setDaily] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metric, setMetric] = useState('spend');

    const fmt = (val, decimals = 0) => (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    useEffect(() => {
        const fetchInsights = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/marketing/ads/insights?ad_id=${ad.id}`);
                const data = await res.json();
                if (data.success) {
                    setDaily(data.data || []);
                } else {
                    setError(data.error || 'Failed to load insights');
                }
            } catch (err) {
                console.error('Ad Insights Fetch Error:', err);
                setError('Connection Error');
            } finally {
                setLoading(false);
            }
        };

        if (ad?.id) fetchInsights();
    }, [ad?.id]);

    if (!ad) return null;

    const chartData = daily.map(d => d[metric] || 0);
    const maxVal = Math.max(...chartData, 1);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 animate-fade-in">
            <div className="absolute inset-0 bg-[#050B18]/90 backdrop-blur-xl" onClick={onClose}></div>

            <div className="relative w-full max-w-5xl bg-[#0A1A2F] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white/5 border border-white/10">
                            {(ad.image || ad.thumbnail) ? (
                                <img src={ad.image || ad.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <i className="fas fa-image text-white/20 text-xl"></i>
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${ad.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/40 border-white/10'
                                    }`}>
                                    {ad.status}
                                </span>
                                <h2 className="text-xl font-black text-white tracking-tight truncate max-w-md">{ad.name}</h2>
                            </div>
                            <p className="text-xs text-white/40 font-bold">Ad Level Visual Intelligence • Last 30 Days</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {loading ? (
                        <div className="h-96 flex flex-col items-center justify-center gap-4">
                            <i className="fas fa-circle-notch animate-spin text-3xl text-blue-500"></i>
                            <p className="text-sm text-white/40 font-black uppercase tracking-widest">Analyzing Ad Performance...</p>
                        </div>
                    ) : error ? (
                        <div className="h-96 flex flex-col items-center justify-center gap-4 text-center">
                            <i className="fas fa-exclamation-triangle text-4xl text-rose-500"></i>
                            <p className="text-white font-bold">{error}</p>
                            <button onClick={() => window.location.reload()} className="text-blue-400 text-xs font-black uppercase tracking-widest underline">Retry</button>
                        </div>
                    ) : (
                        <>
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { label: 'Spend', value: `฿${fmt(ad.spend, 2)}`, icon: 'fa-money-bill-wave', color: 'text-blue-400' },
                                    { label: 'CTR', value: `${fmt(ad.ctr, 2)}%`, icon: 'fa-percentage', color: 'text-emerald-400' },
                                    { label: 'Impressions', value: fmt(ad.impressions), icon: 'fa-eye', color: 'text-purple-400' },
                                    { label: 'Link Clicks', value: fmt(ad.clicks), icon: 'fa-mouse-pointer', color: 'text-indigo-400' },
                                ].map((stat, i) => (
                                    <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-5">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">{stat.label}</p>
                                            <i className={`fas ${stat.icon} ${stat.color} text-xs`}></i>
                                        </div>
                                        <p className="text-2xl font-black text-white">{stat.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Main Chart */}
                            <div className="bg-white/5 border border-white/5 rounded-3xl p-8 relative overflow-hidden">
                                <div className="flex items-center justify-between mb-8 relative z-10">
                                    <div>
                                        <h3 className="text-white font-black uppercase tracking-widest text-xs mb-1">Performance Trend</h3>
                                        <p className="text-white/40 text-[10px] font-bold">Daily {metric} over time</p>
                                    </div>
                                    <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                                        {['spend', 'impressions', 'clicks', 'ctr'].map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setMetric(m)}
                                                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${metric === m ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-white/40 hover:text-white/60'
                                                    }`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-64 flex items-end gap-1.5 pt-10">
                                    {daily.length > 0 ? daily.map((d, i) => {
                                        const h = (d[metric] / maxVal) * 100;
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[9px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-30">
                                                    {metric === 'spend' ? `฿${fmt(d[metric], 2)}` : fmt(d[metric], 2)}
                                                    <p className="text-[7px] text-black/50 font-bold">{d.date}</p>
                                                </div>
                                                <div
                                                    style={{ height: `${Math.max(h, 2)}%` }}
                                                    className={`w-full rounded-t-sm transition-all duration-500 cursor-pointer ${metric === 'spend' ? 'bg-gradient-to-t from-blue-600 to-blue-400 group-hover:from-blue-500' :
                                                        metric === 'ctr' ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:from-emerald-500' :
                                                            'bg-gradient-to-t from-purple-600 to-purple-400 group-hover:from-purple-500'
                                                        }`}
                                                ></div>
                                            </div>
                                        );
                                    }) : (
                                        <div className="w-full flex items-center justify-center text-white/10 text-xs font-black uppercase tracking-widest italic">
                                            No breakdown data available
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-between mt-4">
                                    {daily.length > 0 && (
                                        <>
                                            <span className="text-[8px] font-black text-white/20 uppercase">{daily[0].date}</span>
                                            <span className="text-[8px] font-black text-white/20 uppercase">{daily[daily.length - 1].date}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Actions Table */}
                            <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
                                <div className="p-6 border-b border-white/5">
                                    <h3 className="text-white font-black uppercase tracking-widest text-xs">Conversion Events</h3>
                                </div>
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[9px] font-black text-white/20 uppercase tracking-widest border-b border-white/5 bg-black/20">
                                            <th className="p-4 pl-8">Event Name</th>
                                            <th className="p-4 text-right">Count</th>
                                            <th className="p-4 text-right pr-8">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-xs font-bold text-white/80">
                                        {ad.actions?.length > 0 ? ad.actions.map((act, i) => {
                                            const val = ad.action_values?.find(v => v.action_type === act.action_type)?.value || 0;
                                            return (
                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-4 pl-8 capitalize">{act.action_type.replace(/_/g, ' ')}</td>
                                                    <td className="p-4 text-right font-black text-emerald-400">{fmt(act.value)}</td>
                                                    <td className="p-4 text-right pr-8 font-black text-[#C9A34E]">฿{fmt(val, 2)}</td>
                                                </tr>
                                            );
                                        }) : (
                                            <tr>
                                                <td colSpan={3} className="p-8 text-center text-white/20 italic tracking-widest uppercase text-[10px]">No events recorded</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
