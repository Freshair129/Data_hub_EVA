'use client';

import React, { useState, useEffect } from 'react';

export default function Dashboard({ customers, products, onRefresh }) {
    const [insights, setInsights] = useState({ spend: 0, reach: 0, impressions: 0 });
    const [loadingInsights, setLoadingInsights] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [isTokenExpired, setIsTokenExpired] = useState(false);

    useEffect(() => {
        const fetchInsights = async () => {
            setLoadingInsights(true);
            try {
                const res = await fetch('/api/marketing/insights');
                const result = await res.json();
                if (result.success) {
                    setInsights(result.insights);
                    setIsTokenExpired(false);
                } else if (result.errorType === 'TOKEN_EXPIRED') {
                    setIsTokenExpired(true);
                }
            } catch (err) {
                console.error('Failed to fetch insights:', err);
            } finally {
                setLoadingInsights(false);
            }
        };
        fetchInsights();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/customers/sync', { method: 'POST' });
            const result = await res.json();
            if (result.success) {
                alert(`Successfully synced! Created: ${result.created}, Skipped: ${result.skipped}`);
                if (onRefresh) onRefresh();
            } else {
                alert(`Sync failed: ${result.error}`);
            }
        } catch (err) {
            console.error('Sync error:', err);
            alert('Failed to connect to sync API');
        } finally {
            setSyncing(false);
        }
    };

    // Generate some metrics based on data
    const totalCustomers = customers.length;
    const totalPoints = customers.reduce((sum, c) => sum + (c.wallet?.points || 0), 0);
    const totalRevenue = customers.reduce((sum, c) => sum + (c.intelligence?.metrics?.total_spend || 0), 0);

    // Calculate Average Lifespan
    const now = new Date();
    let totalLifespanMonths = 0;
    let customerWithHistory = 0;

    customers.forEach(c => {
        const joinDateStr = c.profile?.join_date || (c.timeline && c.timeline.length > 0 ? c.timeline[c.timeline.length - 1].date : null);
        if (joinDateStr) {
            const joinDate = new Date(joinDateStr);
            const months = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
            totalLifespanMonths += Math.max(1, months); // Minimum 1 month
            customerWithHistory++;
        }
    });

    const avgLifespanMonths = customerWithHistory > 0 ? totalLifespanMonths / customerWithHistory : 1;
    const avgLifespanText = avgLifespanMonths >= 12
        ? `${(avgLifespanMonths / 12).toFixed(1)} Years`
        : `${Math.round(avgLifespanMonths)} Months`;

    const avgLTV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    // Calculate Churn Rate (Percentage of inactive/churned customers)
    const churnedCustomers = customers.filter(c => c.profile?.status === 'Inactive' || c.profile?.status === 'Churned').length;
    const churnRate = totalCustomers > 0 ? (churnedCustomers / totalCustomers) * 100 : 0;

    const stats = [
        { label: 'Total Revenue', value: `฿${totalRevenue.toLocaleString()}`, icon: 'fa-coins', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Active Students', value: totalCustomers - churnedCustomers, icon: 'fa-user-graduate', color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Avg. Lifetime Value', value: `฿${Math.round(avgLTV).toLocaleString()}`, subValue: `Avg. Lifespan: ${avgLifespanText}`, icon: 'fa-chart-line', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Churn Rate', value: `${churnRate.toFixed(1)}%`, icon: 'fa-user-minus', color: 'text-rose-500', bg: 'bg-rose-500/10' },
        { label: 'Marketing Spend (30d)', value: `฿${Number(insights.spend).toLocaleString()}`, icon: 'fa-ads-click', color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { label: 'Marketing Reach', value: Number(insights.reach).toLocaleString(), icon: 'fa-bullhorn', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    ];

    // --- AI Insight Calculations ---
    const allCoursesEnrolled = customers.flatMap(c => c.inventory?.learning_courses || []).map(c => c.name);
    const courseFreq = {};
    allCoursesEnrolled.forEach(c => courseFreq[c] = (courseFreq[c] || 0) + 1);
    const topCourse = Object.entries(courseFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    const platinumMembers = customers.filter(c => c.profile?.membership_tier === 'PLATINUM' || c.profile?.membership_tier === 'GOLD');
    const goldFreq = platinumMembers.length > 0 ? (platinumMembers.reduce((sum, c) => sum + (c.intelligence?.metrics?.total_order || 1), 0) / platinumMembers.length).toFixed(1) : 0;


    return (
        <div className="animate-fade-in space-y-8">
            {/* Page Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-black text-[#F8F8F6] tracking-tight mb-2">Executive Dashboard</h2>
                    <p className="text-white/40 text-sm font-bold uppercase tracking-[0.2em]">V SCHOOL METRICS OVERVIEW</p>
                </div>
                <div className="flex items-center gap-4">
                    {isTokenExpired && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/30 rounded-xl animate-pulse">
                            <i className="fas fa-key text-rose-500 text-xs shadow-[0_0_10px_rgba(244,63,94,0.3)]"></i>
                            <div>
                                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Token Expired</p>
                                <p className="text-[8px] text-rose-500/70 font-bold leading-tight uppercase">Live Ads Sync Paused</p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className={`bg-white/5 border border-white/10 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-3 shadow-xl ${syncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <i className={`fas ${syncing ? 'fa-spinner fa-spin' : 'fa-sync-alt'} text-[#C9A34E]`}></i>
                        {syncing ? 'Syncing...' : 'Sync Messenger Leads'}
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 transition-all duration-300 group relative">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center text-xl shadow-lg`}>
                                <i className={`fas ${stat.icon}`}></i>
                            </div>
                            <span className="text-white/20 text-[10px] font-black uppercase tracking-widest">Live Sync</span>
                        </div>
                        <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-2xl font-black text-white group-hover:text-[#C9A34E] transition-colors">{stat.value}</p>
                        {stat.subValue && (
                            <p className="text-[10px] font-bold text-white/40 mt-1 flex items-center gap-1">
                                <i className="fas fa-clock text-[#C9A34E]"></i>
                                {stat.subValue}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="font-black text-white text-xl tracking-tight">Recent Student Activity</h3>
                            <button className="text-[10px] font-black text-[#C9A34E] uppercase tracking-widest hover:underline">View All Notifications</button>
                        </div>
                        <div className="space-y-4">
                            {customers.slice(0, 5).map((customer, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-3xl bg-white/5 border border-white/5 hover:border-white/20 transition-all cursor-pointer group/item">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white/40 font-black relative overflow-hidden border border-white/10">
                                        {customer.profile?.profile_picture ? (
                                            <img src={customer.profile.profile_picture} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <span>{customer.profile?.nick_name?.charAt(0) || 'C'}</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-black text-white group-hover/item:text-[#C9A34E] transition-colors">
                                            {customer.profile?.nick_name || customer.profile?.first_name} {customer.profile?.last_name}
                                        </p>
                                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                                            {customer.profile?.lifecycle_stage || 'Active Student'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-white/80">
                                            {customer.timeline?.[0]?.summary || 'Recently Joined'}
                                        </p>
                                        <p className="text-[10px] text-white/20 font-mono mt-0.5">
                                            {customer.timeline?.[0]?.date?.split('T')[0] || '2026-02-08'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Quick Insights */}
                <div className="bg-[#C9A34E] rounded-[2.5rem] p-8 text-[#0A1A2F] shadow-2xl shadow-[#C9A34E]/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                    <div className="relative z-10 h-full flex flex-col">
                        <div className="mb-8">
                            <div className="w-12 h-12 bg-[#0A1A2F] text-[#C9A34E] rounded-2xl flex items-center justify-center text-xl mb-4 shadow-xl">
                                <i className="fas fa-lightbulb"></i>
                            </div>
                            <h3 className="font-black text-2xl tracking-tight leading-tight">AI Insights Peak Performance</h3>
                        </div>
                        <div className="space-y-6 flex-1 text-sm font-bold opacity-80 leading-relaxed">
                            <p>Current retention rate is at <span className="underline decoration-2">{(100 - churnRate).toFixed(1)}%</span> from {totalCustomers} students.</p>
                            <p>Gold/Platinum members average <span className="underline decoration-2">{goldFreq}x</span> order frequency.</p>
                            <p>Most popular course category: <span className="underline decoration-2">{topCourse}</span>.</p>
                        </div>

                        <button className="mt-8 w-full bg-[#0A1A2F] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-xl">
                            Run Full Analysis
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
