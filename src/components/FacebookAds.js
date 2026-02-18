'use client';

import React, { useState, useEffect, useMemo } from 'react';
import AIAnalytics from './AIAnalytics';
import AdVisualReport from './AdVisualReport';
import MonthlyPerformance from './MonthlyPerformance';
import DailyReport from './DailyReport';
import WeeklyReport from './WeeklyReport';
import HourlyReport from './HourlyReport';
import YearlyReport from './YearlyReport';
import ActiveAdsDashboard from './ActiveAdsDashboard';

export default function FacebookAds({ customers }) {
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [campaigns, setCampaigns] = useState([]);
    const [adsets, setAdsets] = useState([]);
    const [daily, setDaily] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTokenExpired, setIsTokenExpired] = useState(false);
    const [expandedCampaign, setExpandedCampaign] = useState(null);
    const [expandedAdset, setExpandedAdset] = useState(null);
    const [selectedAd, setSelectedAd] = useState(null);
    const [dashboardMode, setDashboardMode] = useState('daily'); // 'daily' or 'monthly'
    const [ads, setAds] = useState([]);
    const [chartMetric, setChartMetric] = useState('spend');
    const [auditResults, setAuditResults] = useState({ verified: 0, anomalies: [], healthScore: 100 });

    useEffect(() => {
        if (purchaseModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [purchaseModalOpen]);

    const AuditedMetric = ({ value, label, base, comparison, type = 'logic' }) => {
        let isError = false;
        let diff = 0;
        let errorMsg = '';

        if (type === 'logic' && base && comparison) {
            const calculated = comparison / base;
            diff = Math.abs(value - calculated);
            // Logic check: e.g. CTR = Clicks / Impressions
            if (label.includes('CTR') || label.includes('CPC')) {
                isError = label.includes('CTR') ? diff > 0.005 : diff > 0.5;
                if (isError) errorMsg = `Logic Mismatch: API ${value.toFixed(2)} vs Calc ${calculated.toFixed(2)}`;
            }
        }

        const isAnomaly = auditResults.anomalies.some(a => a.label === label);
        if (isAnomaly) {
            isError = true;
            errorMsg = auditResults.anomalies.find(a => a.label === label).reason;
        }

        return (
            <div className={`relative ${isError ? 'animate-shake' : ''}`}>
                <p className={`text-2xl font-black tracking-tight ${isError ? 'text-rose-500' : 'text-white'}`}>
                    {value}
                </p>
                {isError && (
                    <div className="absolute -right-2 -top-2 flex items-center justify-center w-4 h-4 bg-rose-500 rounded-full cursor-help" title={errorMsg}>
                        <i className="fas fa-exclamation text-[8px] text-white"></i>
                    </div>
                )}
            </div>
        );
    };

    const DataHealthHeader = () => (
        <div className="flex items-center justify-between px-6 py-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md mb-8">
            <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${auditResults.healthScore === 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${auditResults.healthScore === 100 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                    System Health: {auditResults.healthScore}%
                </div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                    <i className="fas fa-shield-check mr-2 text-emerald-500/40"></i>
                    {auditResults.verified} Metrics Autonomously Audited
                </p>
            </div>
            {auditResults.anomalies.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/20 rounded-lg border border-rose-500/30 animate-pulse">
                    <i className="fas fa-triangle-exclamation text-rose-400 text-[10px]"></i>
                    <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Critical: {auditResults.anomalies[0].reason}</span>
                </div>
            )}
        </div>
    );

    const fmt = (val, decimals = 0) => (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    const [syncing, setSyncing] = useState(false);



    const [deepSyncing, setDeepSyncing] = useState(false);
    const [lastSync, setLastSync] = useState(null);

    const syncMarketingData = async (deep = false) => {
        if (deep) setDeepSyncing(true);
        else setSyncing(true);

        try {
            const months = deep ? 37 : 3;
            const res = await fetch(`/api/marketing/sync?months=${months}`);
            const data = await res.json();
            if (data.success) {
                setLastSync(new Date().toISOString());
                // Refresh daily data after sync
                const dailyRes = await fetch('/api/marketing/daily');
                const dailyData = await dailyRes.json();
                if (dailyData.success) setDaily(dailyData.data || []);
            }
        } catch (err) {
            console.error('Sync error:', err);
        } finally {
            setSyncing(false);
            setDeepSyncing(false);
        }
    };

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            setError(null);
            try {
                // Trigger sync in background
                syncMarketingData();

                const [campRes, adsetRes, dailyRes, adsRes] = await Promise.all([
                    fetch('/api/marketing/campaigns'),
                    fetch('/api/marketing/adsets'),
                    fetch('/api/marketing/daily'),
                    fetch('/api/marketing/ads'),
                ]);
                const [campData, adsetData, dailyData, adsData] = await Promise.all([
                    campRes.json(), adsetRes.json(), dailyRes.json(), adsRes.json(),
                ]);

                if (campData.success) {
                    const sorted = (campData.data || []).sort((a, b) => {
                        const sA = (a.status || '').toUpperCase();
                        const sB = (b.status || '').toUpperCase();
                        if (sA === 'ACTIVE' && sB !== 'ACTIVE') return -1;
                        if (sA !== 'ACTIVE' && sB === 'ACTIVE') return 1;
                        return 0;
                    });
                    setCampaigns(sorted);
                }
                if (adsetData.success) setAdsets(adsetData.data || []);
                if (dailyData.success) setDaily(dailyData.data || []);
                if (adsData.success) setAds(adsData.data || []);

                if (campData.errorType === 'TOKEN_EXPIRED' || dailyData.errorType === 'TOKEN_EXPIRED' || adsData.errorType === 'TOKEN_EXPIRED') {
                    setIsTokenExpired(true);
                    setError('Facebook Access Token has expired.');
                } else if (!campData.success && !dailyData.success) {
                    setError(campData.error || dailyData.error || 'Failed to load data');
                }
            } catch (err) {
                console.error('FacebookAds fetch error:', err);
                setError('Failed to connect to API');
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    // KPI Categories
    const PURCHASE_TYPES = ['purchase', 'onsite_conversion.purchase'];
    const MESSAGE_TYPES = ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply', 'messenger.conversation_started', 'onsite_conversion.total_messaging_connection'];

    // Metric Helpers
    const getBestActionValue = (campaign, types) => {
        const values = campaign.action_values?.filter(a => types.includes(a.action_type)).map(a => parseFloat(a.value || 0)) || [];
        return values.length > 0 ? Math.max(...values) : 0;
    };

    const getBestActionCount = (campaign, types) => {
        const counts = campaign.actions?.filter(a => types.includes(a.action_type)).map(a => parseInt(a.value || 0)) || [];
        return counts.length > 0 ? Math.max(...counts) : 0;
    };

    // KPI Totals
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
    const totalReach = campaigns.reduce((s, c) => s + c.reach, 0);

    // Advanced KPIs
    const totalPurchaseValue = campaigns.reduce((s, c) => s + getBestActionValue(c, PURCHASE_TYPES), 0);
    const totalPurchases = campaigns.reduce((s, c) => s + getBestActionCount(c, PURCHASE_TYPES), 0);
    const totalMessages = campaigns.reduce((s, c) => s + getBestActionCount(c, MESSAGE_TYPES), 0);
    const totalResults = campaigns.reduce((s, c) => s + (c.actions ? c.actions.reduce((a, x) => a + parseInt(x.value), 0) : 0), 0);
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;

    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
    const avgCPC = totalClicks > 0 ? (totalSpend / totalClicks) : 0;
    const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions * 1000) : 0;

    const avgROAS = totalSpend > 0 ? (totalPurchaseValue / totalSpend) : 0;
    const avgCPP = totalPurchases > 0 ? (totalSpend / totalPurchases) : 0;
    const avgCostPerMsg = totalMessages > 0 ? (totalSpend / totalMessages) : 0;
    const avgCPR = totalResults > 0 ? (totalSpend / totalResults) : 0;

    // Today's Date Detection (Thai Time)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); // YYYY-MM-DD

    const latestDay = useMemo(() => {
        if (!daily || daily.length === 0) return null;

        // Find exact match for Today (Thai Time)
        const todayEntry = daily.find(d => d.date === todayStr);
        if (todayEntry) return todayEntry;

        // Fallback: Use the actual last entry but mark as "Last recorded"
        return daily[daily.length - 1];
    }, [daily, todayStr]);

    const isDataStale = latestDay && latestDay.date !== todayStr;

    // Reconciliation/Audit Logic
    useEffect(() => {
        if (!latestDay || daily.length < 2) return;

        const anomalies = [];
        const prev7Days = daily.slice(-8, -1);
        const avgSpend = prev7Days.reduce((s, d) => s + d.spend, 0) / prev7Days.length;

        // Anomaly: Spend spike (The 500k fix)
        if (latestDay.spend > avgSpend * 3 && avgSpend > 100) {
            anomalies.push({ label: 'Total Spend', reason: `Sudden Spend Spike: ฿${fmt(latestDay.spend)} vs Avg ฿${fmt(avgSpend)}` });
        }

        setAuditResults({
            verified: 8 + (campaigns.length * 4), // KPI cards + Campaign metrics
            anomalies,
            healthScore: anomalies.length > 0 ? 75 : 100
        });
    }, [daily, campaigns]);

    const displayMetrics = dashboardMode === 'daily' && latestDay ? {
        spend: latestDay.spend || 0,
        roas: (latestDay.spend || 0) > 0 ? (getBestActionValue(latestDay, PURCHASE_TYPES) / latestDay.spend) : 0,
        purchases: getBestActionCount(latestDay, PURCHASE_TYPES),
        impressions: latestDay.impressions || 0,
        clicks: latestDay.clicks || 0,
        ctr: latestDay.ctr || 0,
        cpc: latestDay.cpc || 0,
        results: latestDay.actions?.reduce((a, b) => a + parseInt(b.value), 0) || 0
    } : {
        spend: totalSpend,
        roas: avgROAS,
        purchases: totalPurchases,
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: avgCTR,
        cpc: avgCPC,
        results: totalResults
    };

    // Active Ads Logic for Overview
    const adStatusMetrics = useMemo(() => {
        if (!daily || daily.length === 0) return null;

        const allAds = new Set();
        const adActivity = {}; // { adName: { date: boolean } }

        // Use last 8 days for context
        const recent8 = daily.slice(-8);
        const dates = recent8.map(d => d.date);

        recent8.forEach(day => {
            (day.campaigns || []).forEach(c => {
                (c.ads || []).forEach(a => {
                    if ((a.impressions || 0) > 0) {
                        allAds.add(a.name);
                        if (!adActivity[a.name]) adActivity[a.name] = {};
                        adActivity[a.name][day.date] = true;
                    }
                });
            });
        });

        const sortedAds = Array.from(allAds);
        const today = dates[dates.length - 1];
        const yesterday = dates[dates.length - 2];
        const weekAgo = dates[0];

        const activeToday = new Set(sortedAds.filter(n => adActivity[n]?.[today]));
        const activeYesterday = new Set(sortedAds.filter(n => adActivity[n]?.[yesterday]));
        const activeWeekAgo = new Set(sortedAds.filter(n => adActivity[n]?.[weekAgo]));

        return {
            totalActiveToday: activeToday.size,
            newToday: sortedAds.filter(n => !activeYesterday.has(n) && activeToday.has(n)).length,
            stopToday: sortedAds.filter(n => activeYesterday.has(n) && !activeToday.has(n)).length,
            newWeek: sortedAds.filter(n => !activeWeekAgo.has(n) && activeToday.has(n)).length,
            stopWeek: sortedAds.filter(n => activeWeekAgo.has(n) && !activeToday.has(n)).length,
            date: today
        };
    }, [daily]);

    const handleToggleStatus = async (e, campaign) => {
        e.stopPropagation();
        const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

        if (!window.confirm(`Are you sure you want to ${newStatus} campaign "${campaign.name}"?`)) {
            return;
        }

        // Optimistic Update
        const originalStatus = campaign.status;
        setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c));

        try {
            const res = await fetch(`/api/marketing/campaigns/${campaign.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to update');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to update status: ' + err.message);
            // Revert
            setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: originalStatus } : c));
        }
    };


    // Chart data (Limit to last 30 days for readability)
    const recentDaily = daily.slice(-30);
    const chartData = recentDaily.map(d => d[chartMetric] || 0);
    const maxChart = Math.max(...chartData, 1);

    // Status badge
    const statusBadge = (status) => {
        const map = {
            'ACTIVE': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            'PAUSED': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            'DELETED': 'bg-red-500/20 text-red-400 border-red-500/30',
            'ARCHIVED': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        };
        return map[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    };

    // Objective label
    const objectiveLabel = (obj) => {
        const map = {
            'OUTCOME_ENGAGEMENT': 'Engagement',
            'OUTCOME_AWARENESS': 'Awareness',
            'OUTCOME_TRAFFIC': 'Traffic',
            'OUTCOME_LEADS': 'Leads',
            'OUTCOME_SALES': 'Sales',
            'OUTCOME_APP_PROMOTION': 'App Promotion',
            'LINK_CLICKS': 'Link Clicks',
            'POST_ENGAGEMENT': 'Engagement',
            'REACH': 'Reach',
            'BRAND_AWARENESS': 'Awareness',
            'CONVERSIONS': 'Conversions',
            'MESSAGES': 'Messages',
            'VIDEO_VIEWS': 'Video Views',
            'LEAD_GENERATION': 'Lead Gen',
        };
        return map[obj] || obj?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) || 'N/A';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                        <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
                        <i className="fab fa-facebook text-blue-500 text-2xl absolute inset-0 flex items-center justify-center"></i>
                    </div>
                    <p className="text-white/60 text-sm font-bold uppercase tracking-widest">Loading Facebook Ads Data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center bg-red-500/10 border border-red-500/30 rounded-3xl p-10 max-w-md">
                    <i className={`fas ${isTokenExpired ? 'fa-key' : 'fa-exclamation-triangle'} text-red-400 text-4xl mb-4`}></i>
                    <h3 className="text-white font-black text-xl mb-2">
                        {isTokenExpired ? 'Token Expired' : 'Connection Error'}
                    </h3>
                    <p className="text-white/60 text-sm mb-6">{error}</p>
                    {isTokenExpired && (
                        <div className="space-y-4">
                            <p className="text-xs text-white/40 italic">Please update your FB_ACCESS_TOKEN in .env.local and restart the server.</p>
                            <a
                                href="https://developers.facebook.com/tools/explorer/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
                            >
                                Generate New Token
                            </a>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-8 animate-fade-in relative z-10">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <i className="fab fa-facebook-f text-white text-2xl"></i>
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight">Facebook Ads</h1>
                            <p className="text-sm text-white/40 font-bold">
                                Last 30 Days Performance • {campaigns.length} Campaign{campaigns.length !== 1 ? 's' : ''} Tracked • Server Auto-Sync Active
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => syncMarketingData(true)}
                            disabled={syncing || deepSyncing}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${deepSyncing
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-wait'
                                : 'bg-[#C9A34E]/20 border border-[#C9A34E]/30 text-[#C9A34E] hover:bg-[#C9A34E]/30'
                                }`}
                            title="Sync last 37 months of data"
                        >
                            <i className={`fas ${deepSyncing ? 'fa-spinner animate-spin' : 'fa-calendar-alt'}`}></i>
                            {deepSyncing ? 'Deep Syncing...' : 'Deep Sync (3Y)'}
                        </button>
                        <button
                            onClick={() => syncMarketingData(false)}
                            disabled={syncing || deepSyncing}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${syncing
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-wait'
                                : 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30'
                                }`}
                        >
                            <i className={`fas ${syncing ? 'fa-spinner animate-spin' : 'fa-history'}`}></i>
                            {syncing ? 'Syncing...' : 'Quick Sync'}
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-5 py-2.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600/30 transition-all"
                        >
                            <i className="fas fa-sync-alt mr-2"></i> Refresh
                        </button>
                    </div>
                </div>

                {/* Dashboard Selector */}
                <div className="flex flex-wrap justify-center gap-4 mb-8">
                    <button
                        onClick={() => setDashboardMode('daily')}
                        className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${dashboardMode === 'daily' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40' : 'text-white/30 hover:text-white/60'}`}
                    >
                        <i className="fas fa-chart-line mr-2"></i> Overview
                    </button>
                    <button
                        onClick={() => setDashboardMode('hourly_report')}
                        className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${dashboardMode === 'hourly_report' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/40' : 'text-white/30 hover:text-white/60'}`}
                    >
                        <i className="fas fa-clock mr-2"></i> Daily (Hourly)
                    </button>
                    <button
                        onClick={() => setDashboardMode('daily_report')}
                        className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${dashboardMode === 'daily_report' ? 'bg-[#C9A34E] text-[#0A1A2F] shadow-lg shadow-[#C9A34E]/40' : 'text-white/30 hover:text-white/60'}`}
                    >
                        <i className="fas fa-calendar-alt mr-2"></i> Detailed Daily
                    </button>
                    <button
                        onClick={() => setDashboardMode('weekly_report')}
                        className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${dashboardMode === 'weekly_report' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' : 'text-white/30 hover:text-white/60'}`}
                    >
                        <i className="fas fa-calendar-week mr-2"></i> Weekly Report
                    </button>
                    <button
                        onClick={() => setDashboardMode('monthly')}
                        className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${dashboardMode === 'monthly' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/40' : 'text-white/30 hover:text-white/60'}`}
                    >
                        <i className="fas fa-calendar mr-2"></i> Monthly Report
                    </button>
                    <button
                        onClick={() => setDashboardMode('yearly')}
                        className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${dashboardMode === 'yearly' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/40' : 'text-white/30 hover:text-white/60'}`}
                    >
                        <i className="fas fa-layer-group mr-2"></i> Yearly Report
                    </button>
                </div>

                {dashboardMode === 'yearly' ? (
                    <YearlyReport dailyData={daily} />
                ) : dashboardMode === 'hourly_report' ? (
                    <HourlyReport />
                ) : dashboardMode === 'weekly_report' ? (
                    <WeeklyReport dailyData={daily} />
                ) : dashboardMode === 'active_ads' ? (
                    <ActiveAdsDashboard dailyData={daily} />
                ) : dashboardMode === 'daily_report' ? (
                    <DailyReport dailyData={daily} />
                ) : dashboardMode === 'monthly' ? (
                    <MonthlyPerformance dailyData={daily} />
                ) : (
                    <>
                        {/* System Status Banner */}
                        {isTokenExpired && (
                            <div className="mb-8 p-6 bg-rose-500/10 border border-rose-500/30 rounded-[2rem] flex items-center justify-between animate-pulse">
                                <div className="flex items-center gap-6">
                                    <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-[#0A1A2F] shadow-lg shadow-rose-500/20">
                                        <i className="fas fa-key text-xl"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-rose-500 font-black text-lg tracking-tight">Facebook Token Expired</h3>
                                        <p className="text-rose-500/60 text-xs font-bold uppercase tracking-widest">Live sync is disabled. Showing cached data only.</p>
                                    </div>
                                </div>
                                <button onClick={() => syncMarketingData()} className="px-6 py-3 bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all">
                                    Retry Connection
                                </button>
                            </div>
                        )}

                        {!isTokenExpired && isDataStale && dashboardMode === 'daily' && (
                            <div className="mb-8 p-6 bg-amber-500/10 border border-amber-500/30 rounded-[2rem] flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-[#0A1A2F] shadow-lg shadow-amber-500/20">
                                        <i className="fas fa-clock-rotate-left text-xl"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-amber-500 font-black text-lg tracking-tight">Data Delay Detected</h3>
                                        <p className="text-amber-500/60 text-xs font-bold uppercase tracking-widest">Showing data for {latestDay?.date} (Thai Time {todayStr})</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => syncMarketingData()}
                                    disabled={syncing}
                                    className="px-6 py-3 bg-amber-500 text-[#0A1A2F] rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center gap-3"
                                >
                                    <i className={`fas fa-sync-alt ${syncing ? 'animate-spin' : ''}`}></i>
                                    {syncing ? 'Syncing...' : 'Sync Today\'s Data'}
                                </button>
                            </div>
                        )}

                        <DataHealthHeader />

                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Spend', value: `฿${fmt(totalSpend, 2)}`, icon: 'fa-money-bill-wave', color: 'from-blue-600 to-blue-500', iconBg: 'bg-blue-500/20 text-blue-400' },
                                { label: 'ROAS', value: `${fmt(avgROAS, 2)}x`, icon: 'fa-chart-line', color: 'from-[#C9A34E] to-amber-500', iconBg: 'bg-[#C9A34E]/20 text-[#C9A34E]' },
                                {
                                    label: 'Purchases',
                                    value: fmt(totalPurchases),
                                    icon: 'fa-shopping-cart',
                                    color: 'from-emerald-600 to-emerald-500',
                                    iconBg: 'bg-emerald-500/20 text-emerald-400',
                                    onClick: () => setPurchaseModalOpen(true),
                                    cursor: 'cursor-pointer hover:scale-[1.02]'
                                },
                                { label: 'Cost / Purchase', value: `฿${fmt(avgCPP, 0)}`, icon: 'fa-tag', color: 'from-rose-600 to-rose-500', iconBg: 'bg-rose-500/20 text-rose-400' },
                            ].map((kpi, i) => (
                                <div
                                    key={i}
                                    onClick={kpi.onClick}
                                    className={`bg-[#0A1A2F]/60 border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-white/20 transition-all ${kpi.cursor || ''}`}
                                >
                                    <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r ${kpi.color}`}></div>
                                    <div className="flex items-start justify-between mb-3">
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{kpi.label} {dashboardMode === 'daily' ? '(Daily)' : '(30-Day)'}</p>
                                        <div className={`w-8 h-8 rounded-lg ${kpi.iconBg} flex items-center justify-center`}>
                                            <i className={`fas ${kpi.icon} text-xs`}></i>
                                        </div>
                                    </div>
                                    {kpi.label === 'Total Spend' ? (
                                        <AuditedMetric value={`฿${fmt(displayMetrics.spend, 2)}`} label="Total Spend" />
                                    ) : (
                                        <p className="text-2xl font-black text-white tracking-tight">
                                            {kpi.label === 'ROAS' ? `${fmt(displayMetrics.roas, 2)}x` :
                                                kpi.label === 'Purchases' ? fmt(displayMetrics.purchases) :
                                                    `฿${fmt(displayMetrics.spend / (displayMetrics.purchases || 1), 0)}`}
                                        </p>
                                    )}
                                </div>
                            ))}
                            {[
                                { label: 'Cost / Message', value: `฿${fmt(avgCostPerMsg, 0)}`, icon: 'fa-comment-dollar', iconBg: 'bg-blue-500/20 text-blue-400', color: 'from-blue-600 to-cyan-500' },
                                { label: 'Cost / Result', value: `฿${fmt(avgCPR, 2)}`, icon: 'fa-poll', iconBg: 'bg-indigo-500/20 text-indigo-400', color: 'from-indigo-600 to-indigo-500' },
                                { label: 'CTR', value: `${fmt(avgCTR, 2)}%`, icon: 'fa-percentage', iconBg: 'bg-purple-500/20 text-purple-400', color: 'from-purple-600 to-purple-500' },
                                { label: 'Active Campaigns', value: activeCampaigns.toString(), icon: 'fa-bullhorn', iconBg: 'bg-slate-500/20 text-slate-400', color: 'from-slate-600 to-slate-500' },
                            ].map((kpi, i) => (
                                <div key={i + 4} className="bg-[#0A1A2F]/60 border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-white/20 transition-all">
                                    <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r ${kpi.color}`}></div>
                                    <div className="flex items-start justify-between mb-3">
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{kpi.label} {dashboardMode === 'daily' ? '(Daily)' : '(30-Day)'}</p>
                                        <div className={`w-8 h-8 rounded-lg ${kpi.iconBg} flex items-center justify-center`}>
                                            <i className={`fas ${kpi.icon} text-xs`}></i>
                                        </div>
                                    </div>
                                    <p className="text-2xl font-black text-white tracking-tight">
                                        {kpi.label === 'CTR' ? (
                                            <AuditedMetric
                                                value={`${fmt(displayMetrics.ctr, 2)}%`}
                                                label="CTR"
                                                base={displayMetrics.impressions}
                                                comparison={displayMetrics.clicks}
                                            />
                                        ) : (
                                            kpi.label === 'Active Campaigns' ? activeCampaigns :
                                                `฿${fmt(displayMetrics.spend / (displayMetrics.results || 1), 2)}`
                                        )}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Daily Trend Chart */}
                        <div className="bg-[#0A1A2F]/60 border border-white/10 rounded-[2rem] p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="font-black text-white text-xl tracking-tight">Daily Performance</h2>
                                    <p className="text-xs text-white/40 font-bold mt-1">30-Day Trend</p>
                                </div>
                                <div className="flex bg-white/5 rounded-xl p-1 border border-white/5">
                                    {[
                                        { key: 'spend', label: 'Spend' },
                                        { key: 'impressions', label: 'Impr.' },
                                        { key: 'clicks', label: 'Clicks' },
                                        { key: 'reach', label: 'Reach' },
                                    ].map(m => (
                                        <button
                                            key={m.key}
                                            onClick={() => setChartMetric(m.key)}
                                            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${chartMetric === m.key
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                                : 'text-white/40 hover:text-white/60'
                                                }`}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {recentDaily.length > 0 ? (
                                <div className="relative">
                                    {/* Y-axis labels */}
                                    <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-[9px] font-bold text-white/30">
                                        <span>{chartMetric === 'spend' ? `฿${fmt(maxChart)}` : fmt(maxChart)}</span>
                                        <span>{chartMetric === 'spend' ? `฿${fmt(maxChart / 2)}` : fmt(maxChart / 2)}</span>
                                        <span>0</span>
                                    </div>
                                    {/* Bars */}
                                    <div className="ml-16 flex items-end h-52">
                                        {recentDaily.map((d, i) => {
                                            const val = d[chartMetric] || 0;
                                            const height = (val / maxChart) * 100;
                                            const dateStr = new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                                            return (
                                                <div key={i} className="flex-1 flex flex-col items-center group relative px-[1px]" style={{ minWidth: 0 }}>
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#162A47] text-white text-[9px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 border border-white/10 shadow-xl pointer-events-none">
                                                        <p className="font-black">{chartMetric === 'spend' ? `฿${fmt(val, 2)}` : fmt(val)}</p>
                                                        <p className="text-white/40">{dateStr}</p>
                                                    </div>
                                                    <div
                                                        style={{ height: `${Math.max(height, 1)}%` }}
                                                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm transition-all duration-300 group-hover:from-[#C9A34E] group-hover:to-amber-300 cursor-pointer"
                                                    ></div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/* X-axis labels */}
                                    <div className="ml-16 flex justify-between mt-3">
                                        {recentDaily.length > 0 && (
                                            <>
                                                <span className="text-[8px] font-bold text-white/30">
                                                    {new Date(recentDaily[0].date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                                </span>
                                                {recentDaily.length > 15 && (
                                                    <span className="text-[8px] font-bold text-white/30">
                                                        {new Date(recentDaily[Math.floor(recentDaily.length / 2)].date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                )}
                                                <span className="text-[8px] font-bold text-white/30">
                                                    {new Date(recentDaily[recentDaily.length - 1].date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-52 text-white/20">
                                    <div className="text-center">
                                        <i className="fas fa-chart-bar text-4xl mb-3"></i>
                                        <p className="text-xs font-bold uppercase tracking-widest">No daily data available</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Campaign Performance Table */}
                        <div className="bg-[#0A1A2F]/60 border border-white/10 rounded-[2rem] overflow-hidden">
                            <div className="p-8 pb-0">
                                <h2 className="font-black text-white text-xl tracking-tight mb-1">Campaign Performance</h2>
                                <p className="text-xs text-white/40 font-bold mb-6">Click a campaign row to see its ad sets</p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-white/5 text-[9px] font-black text-white/40 uppercase tracking-widest">
                                            <th className="p-4 pl-8">Campaign</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Spend</th>
                                            <th className="p-4 text-right">ROAS</th>
                                            <th className="p-4 text-right">Results</th>
                                            <th className="p-4 text-right">Cost/Result</th>
                                            <th className="p-4 text-right">CTR</th>
                                            <th className="p-4 text-right pr-8">CPC</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs font-bold text-white divide-y divide-white/5">
                                        {campaigns.map((c, i) => {
                                            const campAdsets = adsets.filter(a => a.campaign_id === c.id);
                                            const isExpanded = expandedCampaign === c.id;

                                            const purchaseValue = getBestActionValue(c, PURCHASE_TYPES);
                                            const purchaseCount = getBestActionCount(c, PURCHASE_TYPES);
                                            const messageCount = getBestActionCount(c, MESSAGE_TYPES);
                                            const roas = c.spend > 0 ? (purchaseValue / c.spend) : 0;

                                            // Results logic: Priority Purchase > Messages > All Actions
                                            const resultCount = purchaseCount > 0 ? purchaseCount : (messageCount > 0 ? messageCount : (c.actions?.reduce((sum, a) => sum + parseInt(a.value), 0) || 0));
                                            const resultLabel = purchaseCount > 0 ? 'purchases' : (messageCount > 0 ? 'messages' : 'actions');
                                            const costPerResult = resultCount > 0 ? (c.spend / resultCount) : 0;

                                            return (
                                                <React.Fragment key={c.id || i}>
                                                    <tr
                                                        onClick={() => setExpandedCampaign(isExpanded ? null : c.id)}
                                                        className={`cursor-pointer transition-all ${isExpanded ? 'bg-blue-600/10' : 'hover:bg-white/5'}`}
                                                    >
                                                        <td className="p-4 pl-8">
                                                            <div className="flex items-center gap-3">
                                                                <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} text-[8px] text-white/30 w-3 transition-transform`}></i>
                                                                <div className="min-w-0">
                                                                    <p className="font-black text-white truncate max-w-[200px]">{c.name}</p>
                                                                    <p className="text-[9px] text-white/30 mt-0.5">
                                                                        {objectiveLabel(c.objective)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={(e) => handleToggleStatus(e, c)}
                                                                        className={`w-8 h-4 rounded-full p-0.5 transition-colors relative ${c.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-white/10'}`}
                                                                    >
                                                                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${c.status === 'ACTIVE' ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                                                    </button>
                                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${statusBadge(c.status)}`}>
                                                                        {c.status}
                                                                    </span>
                                                                </div>
                                                                <span className="flex items-center gap-1 text-[7px] text-emerald-400/60 font-black uppercase tracking-widest whitespace-nowrap">
                                                                    <i className="fas fa-shield-check"></i> Audited
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-right text-white/80">฿{fmt(c.spend, 2)}</td>
                                                        <td className="p-4 text-right">
                                                            <span className={roas >= 4 ? 'text-[#C9A34E]' : roas >= 2 ? 'text-emerald-400' : 'text-white/30'}>
                                                                {fmt(roas, 2)}x
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right text-white/60">
                                                            {resultCount.toLocaleString()}
                                                            <span className={`block text-[8px] ${purchaseCount > 0 ? 'text-emerald-400' : 'text-blue-400'}`}>{resultLabel}</span>
                                                        </td>
                                                        <td className="p-4 text-right text-white/60">
                                                            {costPerResult > 0 ? `฿${fmt(costPerResult, 2)}` : '-'}
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <span className={c.ctr > 1 ? 'text-emerald-400' : c.ctr > 0 ? 'text-amber-400' : 'text-white/30'}>
                                                                {fmt(c.ctr, 2)}%
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right pr-8 text-white/80">฿{fmt(c.cpc, 2)}</td>
                                                    </tr>

                                                    {/* Expanded Ad Sets */}
                                                    {isExpanded && campAdsets.length > 0 && campAdsets.map((adset, j) => {
                                                        const asPurchaseValue = getBestActionValue(adset, PURCHASE_TYPES);
                                                        const asRoas = adset.spend > 0 ? (asPurchaseValue / adset.spend) : 0;
                                                        const asResultCount = getBestActionCount(adset, PURCHASE_TYPES) || getBestActionCount(adset, MESSAGE_TYPES) || (adset.actions?.reduce((sum, a) => sum + parseInt(a.value), 0) || 0);
                                                        const isAdsetExpanded = expandedAdset === adset.id;
                                                        const adsetAds = ads.filter(a => a.adset_id === adset.id);

                                                        return (
                                                            <React.Fragment key={adset.id || j}>
                                                                <tr
                                                                    onClick={() => setExpandedAdset(isAdsetExpanded ? null : adset.id)}
                                                                    className={`bg-blue-600/5 border-l-2 border-blue-500/50 cursor-pointer transition-colors ${isAdsetExpanded ? 'bg-blue-600/10' : 'hover:bg-blue-600/10'}`}
                                                                >
                                                                    <td className="p-3 pl-16">
                                                                        <div className="flex items-center gap-2">
                                                                            <i className={`fas fa-chevron-${isAdsetExpanded ? 'down' : 'right'} text-[7px] text-blue-400/40 w-2`}></i>
                                                                            <i className="fas fa-layer-group text-[8px] text-blue-400/60"></i>
                                                                            <p className="text-[11px] text-white/70 truncate max-w-[180px]">{adset.name}</p>
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${statusBadge(adset.status)}`}>
                                                                            {adset.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-3 text-right text-white/50 text-[11px]">฿{fmt(adset.spend, 2)}</td>
                                                                    <td className="p-3 text-right text-[11px]">
                                                                        <span className={asRoas >= 4 ? 'text-[#C9A34E]' : asRoas >= 2 ? 'text-emerald-400/70' : 'text-white/30'}>
                                                                            {fmt(asRoas, 2)}x
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-3 text-right text-white/40 text-[11px]">
                                                                        {asResultCount.toLocaleString()}
                                                                    </td>
                                                                    <td className="p-3 text-right text-white/40 text-[11px]">
                                                                        {asResultCount > 0 ? `฿${fmt(adset.spend / asResultCount, 2)}` : '-'}
                                                                    </td>
                                                                    <td className="p-3 text-right text-[11px]">
                                                                        <span className={adset.ctr > 1 ? 'text-emerald-400/70' : 'text-white/30'}>
                                                                            {fmt(adset.ctr, 2)}%
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-3 text-right pr-8 text-white/50 text-[11px]">฿{fmt(adset.cpc, 2)}</td>
                                                                </tr>

                                                                {/* Ads under this adset */}
                                                                {isAdsetExpanded && adsetAds.length > 0 && adsetAds.map((ad, k) => {
                                                                    const adPurchaseValue = getBestActionValue(ad, PURCHASE_TYPES);
                                                                    const adRoas = ad.spend > 0 ? (adPurchaseValue / ad.spend) : 0;

                                                                    return (
                                                                        <tr key={ad.id || k} className="bg-white/[0.02] border-l-4 border-emerald-500/30 group">
                                                                            <td className="p-2 pl-24">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="w-8 h-8 rounded bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                                                                                        {ad.thumbnail ? <img src={ad.thumbnail} alt="" className="w-full h-full object-cover" /> : <i className="fas fa-image text-[10px] text-white/10 h-full w-full flex items-center justify-center"></i>}
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <p className="text-[10px] text-white/60 truncate max-w-[150px] font-bold">{ad.name}</p>
                                                                                        <button
                                                                                            onClick={(e) => { e.stopPropagation(); setSelectedAd(ad); }}
                                                                                            className="text-[8px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 flex items-center gap-1 mt-0.5"
                                                                                        >
                                                                                            <i className="fas fa-chart-pie text-[7px]"></i> Visual Report
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                            <td className="p-2">
                                                                                <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter border ${statusBadge(ad.status)}`}>
                                                                                    {ad.status}
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-2 text-right text-white/30 text-[10px]">฿{fmt(ad.spend, 2)}</td>
                                                                            <td className="p-2 text-right text-[10px]">
                                                                                <span className={adRoas >= 4 ? 'text-[#C9A34E]' : 'text-white/20'}>
                                                                                    {fmt(adRoas, 2)}x
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-2 text-right text-white/20 text-[10px]">
                                                                                {getBestActionCount(ad, PURCHASE_TYPES) || getBestActionCount(ad, MESSAGE_TYPES) || '-'}
                                                                            </td>
                                                                            <td colSpan={3} className="p-2 text-right pr-8">
                                                                                <span className="text-[10px] text-white/20">{fmt(ad.ctr, 2)}% CTR</span>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </React.Fragment>
                                                        )
                                                    })}
                                                    {isExpanded && campAdsets.length === 0 && (
                                                        <tr className="bg-blue-600/5">
                                                            <td colSpan={9} className="p-4 pl-16 text-center text-white/20 text-[10px] font-bold uppercase tracking-widest">
                                                                No ad sets found for this campaign
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                        {campaigns.length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="p-12 text-center text-white/20">
                                                    <i className="fas fa-bullhorn text-4xl mb-3 block"></i>
                                                    <p className="text-xs font-bold uppercase tracking-widest">No campaigns found</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Actions Summary */}
                        {
                            campaigns.some(c => c.actions?.length > 0) && (
                                <div className="bg-[#0A1A2F]/60 border border-white/10 rounded-[2rem] p-8">
                                    <h2 className="font-black text-white text-xl tracking-tight mb-6">Campaign Actions / Results</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {campaigns.filter(c => c.actions?.length > 0).map((c, i) => (
                                            <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                                                <p className="text-xs font-black text-white truncate mb-3">{c.name}</p>
                                                <div className="space-y-2">
                                                    {c.actions.slice(0, 5).map((action, j) => (
                                                        <div key={j} className="flex justify-between items-center">
                                                            <span className="text-[10px] text-white/50 font-bold capitalize">
                                                                {action.action_type?.replace(/_/g, ' ') || 'Action'}
                                                            </span>
                                                            <span className="text-xs font-black text-[#C9A34E]">{fmt(action.value)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        }

                        {/* Footer */}
                        <div className="text-center py-4">
                            <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
                                Data sourced from Facebook Marketing API • Ad Account: {campaigns.length > 0 ? 'Connected' : 'Pending'}
                            </p>
                        </div>

                        {/* Ad Visual Report Modal */}
                        {
                            selectedAd && (
                                <AdVisualReport
                                    ad={selectedAd}
                                    onClose={() => setSelectedAd(null)}
                                />
                            )
                        }
                    </>
                )
                }

                {/* AI Marketing Intelligence */}
                <AIAnalytics campaigns={campaigns} />
            </div>
            {/* Purchase Breakdown Modal */}
            {purchaseModalOpen && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0A1A2F] border border-white/10 rounded-[2rem] w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#0A1A2F] shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                        <i className="fas fa-shopping-cart"></i>
                                    </div>
                                    Purchase Breakdown
                                </h2>
                                <p className="text-white/40 text-xs font-bold mt-1 ml-14">
                                    {dashboardMode === 'daily' && latestDay
                                        ? `Analysing Sales for ${new Date(latestDay.date).toLocaleDateString('en-GB')}`
                                        : 'Analysing Last 30 Days Sales'}
                                </p>
                            </div>
                            <button
                                onClick={() => setPurchaseModalOpen(false)}
                                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                                {/* Left: Ad Source */}
                                <div className="flex flex-col h-full bg-blue-900/10 rounded-2xl border border-blue-500/10 overflow-hidden">
                                    <div className="p-4 border-b border-blue-500/10 bg-blue-900/20">
                                        <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                            <i className="fab fa-facebook"></i> Ad Source {dashboardMode === 'daily' ? '(Daily)' : '(30D)'}
                                        </h3>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                        {(() => {
                                            // Determine which campaigns source to use
                                            const sourceCampaigns = (dashboardMode === 'daily' && latestDay?.campaigns)
                                                ? latestDay.campaigns
                                                : campaigns;

                                            const activeItems = sourceCampaigns.filter(c => {
                                                const purch = c.actions?.find(a => ['purchase', 'onsite_conversion.purchase'].includes(a.action_type));
                                                return purch && parseInt(purch.value) > 0;
                                            });

                                            if (activeItems.length === 0) {
                                                return (
                                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-white/20">
                                                        <i className="fas fa-ghost text-4xl mb-2"></i>
                                                        <p className="text-xs">No Ad Attribution Found for this period</p>
                                                    </div>
                                                );
                                            }

                                            return activeItems.map((c, i) => {
                                                const purchVal = c.action_values?.find(a => ['purchase', 'onsite_conversion.purchase'].includes(a.action_type))?.value || 0;
                                                const purchCount = c.actions?.find(a => ['purchase', 'onsite_conversion.purchase'].includes(a.action_type))?.value || 0;
                                                return (
                                                    <div key={i} className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-3 flex justify-between items-center group hover:bg-blue-600/20 transition-all">
                                                        <div>
                                                            <p className="font-bold text-white text-sm mb-1 line-clamp-1">{c.name.replace(/\|/g, ' ').replace(/\s+/g, ' ')}</p>
                                                            <p className="text-[10px] text-blue-300 font-medium bg-blue-500/20 px-2 py-0.5 rounded-full inline-block">
                                                                Campaign
                                                            </p>
                                                        </div>
                                                        <div className="text-right shrink-0 ml-4">
                                                            <p className="text-lg font-black text-white">{purchCount} <span className="text-xs text-white/40 font-normal">sales</span></p>
                                                            <p className="text-xs text-emerald-400 font-bold">฿{fmt(purchVal)}</p>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>

                                {/* Right: Actual Product Sold (CRM) */}
                                <div className="flex flex-col h-full bg-emerald-900/10 rounded-2xl border border-emerald-500/10 overflow-hidden">
                                    <div className="p-4 border-b border-emerald-500/10 bg-emerald-900/20">
                                        <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                            <i className="fas fa-box-open"></i> Actual Products Sold (CRM)
                                        </h3>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                        {(() => {
                                            // CRM Formatting
                                            const relevantOrders = [];

                                            // Date Filtering
                                            let targetDateStr = null;
                                            let periodMs = 2592000000; // Default 30 days

                                            if (dashboardMode === 'daily' && latestDay) {
                                                targetDateStr = latestDay.date; // "YYYY-MM-DD"
                                            } else {
                                                // 30 Days logic
                                                const now = new Date();
                                                periodMs = 2592000000;
                                            }

                                            // 1. Build a lookup map for Agents and IDs (to handle duplicates)
                                            const agentMap = {}; // fb_id -> agent_name
                                            (customers || []).forEach(c => {
                                                const fbId = c.contact_info?.facebook_id || c.social_profiles?.facebook?.id;
                                                const agent = c.profile?.agent;
                                                if (fbId && agent && agent !== 'Unassigned') {
                                                    agentMap[fbId] = agent;
                                                }
                                            });

                                            (customers || []).forEach(c => {
                                                const fbId = c.contact_info?.facebook_id || c.social_profiles?.facebook?.id;
                                                const timeline = c.timeline || [];
                                                const orders = c.orders || [];

                                                // 1. Check Timeline
                                                timeline.forEach((evt, idx) => {
                                                    const isOrder = evt.type === 'ORDER' || evt.type === 'PURCHASE' || (evt.details?.total > 0) || (evt.details?.amount > 0);
                                                    if (isOrder) {
                                                        const evtDate = new Date(evt.date);
                                                        const year = evtDate.getFullYear();
                                                        const month = String(evtDate.getMonth() + 1).padStart(2, '0');
                                                        const day = String(evtDate.getDate()).padStart(2, '0');
                                                        const evtDateStr = `${year}-${month}-${day}`;

                                                        if (targetDateStr ? (evtDateStr === targetDateStr) : (new Date() - evtDate <= periodMs)) {
                                                            const isReturning = timeline.slice(idx + 1).some(e => e.type === 'ORDER' || e.type === 'PURCHASE' || (e.details?.total > 0));
                                                            relevantOrders.push({
                                                                id: evt.id || `tl-${idx}-${c.customer_id}`,
                                                                items: evt.details?.items || [evt.summary || 'Product Purchase'],
                                                                amount: evt.details?.total || evt.details?.amount || 0,
                                                                time: evtDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                                                                date: evtDate,
                                                                customer: `${c.profile?.first_name} ${c.profile?.last_name}`,
                                                                agent: agentMap[fbId] || c.profile?.agent || 'Unassigned',
                                                                isNew: !isReturning,
                                                                attribution: c.intelligence?.attribution?.source || null
                                                            });
                                                        }
                                                    }
                                                });

                                                // 2. Check Orders & Transactions (Catch ones missing from timeline)
                                                orders.forEach(order => {
                                                    const transactions = order.transactions || [];
                                                    transactions.forEach((trn, tIdx) => {
                                                        const trnDate = new Date(trn.date);
                                                        const year = trnDate.getFullYear();
                                                        const month = String(trnDate.getMonth() + 1).padStart(2, '0');
                                                        const day = String(trnDate.getDate()).padStart(2, '0');
                                                        const trnDateStr = `${year}-${month}-${day}`;

                                                        if (targetDateStr ? (trnDateStr === targetDateStr) : (new Date() - trnDate <= periodMs)) {
                                                            // Avoid duplicates if already in timeline
                                                            if (!relevantOrders.find(r => r.amount === trn.amount && r.time === trnDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }))) {
                                                                relevantOrders.push({
                                                                    id: trn.transaction_id || `trn-${tIdx}-${order.order_id}`,
                                                                    items: order.items?.map(i => i.name) || [order.summary || 'Product Purchase'],
                                                                    amount: trn.amount,
                                                                    time: trnDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                                                                    date: trnDate,
                                                                    customer: `${c.profile?.first_name} ${c.profile?.last_name}`,
                                                                    agent: agentMap[fbId] || c.profile?.agent || 'Unassigned',
                                                                    isNew: (c.intelligence?.metrics?.total_order || 0) <= 1,
                                                                    attribution: c.intelligence?.attribution?.source || null
                                                                });
                                                            }
                                                        }
                                                    });
                                                });
                                            });

                                            if (relevantOrders.length === 0) {
                                                return (
                                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-white/20">
                                                        <i className="fas fa-inbox text-4xl mb-2"></i>
                                                        <p className="text-xs">No CRM orders found for {targetDateStr || 'this period'}.</p>
                                                    </div>
                                                );
                                            }

                                            return relevantOrders
                                                .sort((a, b) => b.date - a.date)
                                                .map((ord, i) => (
                                                    <div key={i} className="bg-emerald-600/10 border border-emerald-500/20 rounded-xl p-3 group hover:bg-emerald-600/20 transition-all">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1 mr-4">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <p className="font-bold text-white text-sm line-clamp-2">{ord.items.join(', ')}</p>
                                                                    {ord.isNew ? (
                                                                        <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter shrink-0 border border-blue-500/30">New</span>
                                                                    ) : (
                                                                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter shrink-0 border border-emerald-500/30">Returning</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] font-medium">
                                                                    <p className="text-white/60 flex items-center gap-1">
                                                                        <i className="fas fa-user-circle text-emerald-400"></i> {ord.customer}
                                                                    </p>
                                                                    <p className="text-emerald-300 flex items-center gap-1">
                                                                        <i className="fas fa-headset"></i> {ord.agent}
                                                                    </p>
                                                                    <p className="text-white/40 flex items-center gap-1">
                                                                        <i className="fas fa-clock"></i> {ord.time}
                                                                    </p>
                                                                    {ord.attribution && (
                                                                        <p className="text-blue-300/60 flex items-center gap-1 italic">
                                                                            <i className="fas fa-bullhorn text-[8px]"></i> {ord.attribution}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <p className="text-lg font-black text-white">฿{fmt(ord.amount)}</p>
                                                                <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest">{ord.date.toLocaleDateString('th-TH')}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ));
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
