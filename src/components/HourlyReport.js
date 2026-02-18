'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';

export default function HourlyReport() {
    // Use local date instead of UTC to avoid "missing data" on initial load due to timezone shift
    const getLocalDate = () => {
        const d = new Date();
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    };
    const [selectedDate, setSelectedDate] = useState(getLocalDate());
    const [hourlyData, setHourlyData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fmt = (val, decimals = 0) => (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/marketing/hourly?date=${selectedDate}`);
                const data = await res.json();
                console.log(`[HourlyReport] Fetch for ${selectedDate}:`, data);
                if (data.error) throw new Error(data.error);

                // Ensure 24 hours are present
                const fullDay = Array.from({ length: 24 }, (_, i) => {
                    const hourStr = i.toString().padStart(2, '0');
                    const existing = data.data?.find(h => h.hour === hourStr);
                    return existing || {
                        hour: hourStr,
                        spend: 0,
                        impressions: 0,
                        clicks: 0,
                        actions: [],
                        action_values: []
                    };
                });

                console.log(`[HourlyReport] Processed fullDay data length: ${fullDay.length}`);
                setHourlyData(fullDay);
            } catch (err) {
                console.error('[HourlyReport] Fetch Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [selectedDate]);

    const chartData = useMemo(() => {
        return hourlyData.map(h => {
            const purchaseTypes = ['purchase', 'onsite_conversion.purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'];
            const revenue = h.action_values?.filter(a => purchaseTypes.includes(a.action_type)).reduce((sum, a) => sum + parseFloat(a.value || 0), 0) || 0;
            const conversions = h.actions?.filter(a => purchaseTypes.includes(a.action_type)).reduce((sum, a) => sum + parseInt(a.value || 0), 0) || 0;
            const roas = h.spend > 0 ? (revenue / h.spend) : 0;

            return {
                ...h,
                revenue,
                conversions,
                roas: parseFloat(roas.toFixed(2)),
                displayHour: `${h.hour}:00`
            };
        });
    }, [hourlyData]);

    const totals = useMemo(() => {
        return chartData.reduce((acc, curr) => ({
            spend: acc.spend + curr.spend,
            revenue: acc.revenue + curr.revenue,
            clicks: acc.clicks + curr.clicks,
            conversions: acc.conversions + curr.conversions
        }), { spend: 0, revenue: 0, clicks: 0, conversions: 0 });
    }, [chartData]);

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
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <i className="fas fa-clock text-white text-xl"></i>
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-black text-white tracking-widest uppercase">Daily (Hourly) Report</h1>
                            <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live FB Data</span>
                            </div>
                        </div>
                        <p className="text-amber-400 font-bold text-sm tracking-[0.2em]">HOURLY PERFORMANCE BI</p>
                    </div>
                </div>

                <div className="relative">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-[#0A1A2F] border border-white/20 rounded-xl px-4 py-2 text-white font-bold uppercase tracking-wider focus:outline-none focus:border-amber-500 transition-colors"
                    />
                </div>
            </div>

            {loading ? (
                <div className="h-[400px] flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
                </div>
            ) : error ? (
                <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[2rem] text-center">
                    <p className="text-red-400 font-bold uppercase tracking-widest">{error}</p>
                </div>
            ) : (
                <>
                    {/* Performance Analytics Charts */}
                    <div className="grid grid-cols-1 gap-12 mb-12">
                        {/* Combined Financial Performance Chart */}
                        <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] p-6 lg:p-10 flex flex-col h-[600px]">
                            <h3 className="text-center font-black text-white text-xs uppercase tracking-[0.2em] mb-10">Hourly Financial Overview (Spend, Revenue & ROAS)</h3>
                            <div className="flex-1 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis
                                            dataKey="hour"
                                            stroke="rgba(255,255,255,0.3)"
                                            fontSize={10}
                                            tick={{ fill: 'rgba(255,255,255,0.5)' }}
                                            tickFormatter={(val) => `${val}:00`}
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
                                        <Bar yAxisId="left" dataKey="spend" name="Ad Spent" fill="#6366F1" radius={[2, 2, 0, 0]} />
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
                                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis
                                            dataKey="hour"
                                            stroke="rgba(255,255,255,0.3)"
                                            fontSize={9}
                                            tickFormatter={(val) => `${val}:00`}
                                        />
                                        <YAxis yAxisId="left" stroke="rgba(255,255,255,0.3)" fontSize={9} />
                                        <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.3)" fontSize={9} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0A1A2F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                            itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                            labelStyle={{ color: 'white', marginBottom: '4px', fontSize: '11px' }}
                                        />
                                        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', paddingTop: '20px' }} />
                                        <Bar yAxisId="left" dataKey="clicks" name="Clicks" fill="rgba(255,255,255,0.1)" radius={[4, 4, 0, 0]} barSize={30} />
                                        <Line yAxisId="right" type="monotone" dataKey="conversions" name="Conversions" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 4 }} activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-[#0A1A2F]/80 border border-white/10 rounded-[2.5rem] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-amber-900/20 text-[10px] font-black text-white uppercase tracking-[0.1em]">
                                        <th className="p-5 pl-8">Hour</th>
                                        <MetricHeader label="Ad Spent" description="งบโฆษณา" />
                                        <MetricHeader label="Clicks" description="จำนวนคลิก" />
                                        <MetricHeader label="Conversions" description="จำนวนการซื้อ" />
                                        <MetricHeader label="Revenue" description="ยอดขาย" />
                                        <MetricHeader label="ROAS" description="ผลตอบแทน" align="right" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-[11px] font-bold text-white/80">
                                    {chartData.map((h, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-4 pl-8 text-white font-black">{h.hour}:00</td>
                                            <td className="p-4 text-right">฿{fmt(h.spend, 2)}</td>
                                            <td className="p-4 text-right text-white/60">{fmt(h.clicks)}</td>
                                            <td className="p-4 text-right text-emerald-400">{fmt(h.conversions)}</td>
                                            <td className="p-4 text-right font-black">฿{fmt(h.revenue, 2)}</td>
                                            <td className="p-4 text-right pr-8 font-black text-[#C9A34E]">{fmt(h.roas, 2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-white/5 font-black text-white text-xs">
                                    <tr>
                                        <td className="p-4 pl-8 text-amber-400 uppercase tracking-widest">Total</td>
                                        <td className="p-4 text-right">฿{fmt(totals.spend, 2)}</td>
                                        <td className="p-4 text-right">{fmt(totals.clicks)}</td>
                                        <td className="p-4 text-right text-emerald-400">{fmt(totals.conversions)}</td>
                                        <td className="p-4 text-right">฿{fmt(totals.revenue, 2)}</td>
                                        <td className="p-4 text-right pr-8 text-[#C9A34E]">
                                            {totals.spend > 0 ? (totals.revenue / totals.spend).toFixed(2) : '0.00'}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
