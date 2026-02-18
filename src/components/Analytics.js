'use client';

import { useState, useEffect } from 'react';
import BusinessIntelligence from './BusinessIntelligence';

export default function Analytics({ customers, products }) {
    const [rankingPeriod, setRankingPeriod] = useState('month');
    const [activeTab, setActiveTab] = useState('strategic');
    const [marketingData, setMarketingData] = useState(null);
    const [adMapping, setAdMapping] = useState({ campaign_mappings: [], ad_mappings: [] });
    const [isLoadingMapping, setIsLoadingMapping] = useState(false);
    const [campaigns, setCampaigns] = useState([]);
    const [insights, setInsights] = useState({});
    const [loadingMarketing, setLoadingMarketing] = useState(true);

    useEffect(() => {
        const fetchMarketing = async () => {
            try {
                // Fetch with preset to match rankingPeriod
                const preset = rankingPeriod === 'day' ? 'today' : rankingPeriod === 'week' ? 'last_7d' : 'last_30d';
                const [cRes, iRes] = await Promise.all([
                    fetch(`/api/marketing/campaigns?range=${rankingPeriod === 'month' ? 'last_30d' : rankingPeriod === 'week' ? 'last_7d' : 'today'}`),
                    fetch('/api/marketing/insights')
                ]);
                const cData = await cRes.json();
                const iData = await iRes.json();

                if (cData.success) {
                    setCampaigns(cData.data || []);
                    setMarketingData({
                        campaigns: cData.data || [],
                        insights: iData.insights || {}
                    });
                }
                if (iData.success) setInsights(iData.insights || {});
            } catch (err) {
                console.error('Analytics marketing fetch error:', err);
            } finally {
                setLoadingMarketing(false);
            }
        };
        fetchMarketing();
    }, [rankingPeriod]);

    useEffect(() => {
        const fetchMapping = async () => {
            setIsLoadingMapping(true);
            try {
                const res = await fetch('/api/marketing/mapping');
                const data = await res.json();
                setAdMapping(data);
            } catch (err) {
                console.error('Failed to fetch mapping:', err);
            } finally {
                setIsLoadingMapping(false);
            }
        };
        fetchMapping();
    }, []);

    const handleSaveMapping = async (type, data) => {
        try {
            const res = await fetch('/api/marketing/mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, data })
            });
            const result = await res.json();
            if (result.success) {
                setAdMapping(result.mapping);
            }
        } catch (err) { console.error('Failed to save mapping:', err); }
    };

    const handleDeleteMapping = async (type, name) => {
        try {
            const res = await fetch(`/api/marketing/mapping?type=${type}&name=${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });
            const result = await res.json();
            if (result.success) {
                setAdMapping(result.mapping);
            }
        } catch (err) { console.error('Failed to delete mapping:', err); }
    };

    const handleAiAutoMap = async () => {
        // This will call the AI to suggest mappings
        // For now, let's mock the logic or implement a basic version that looks for substrings
        const suggestions = [];
        const allProducts = products || [];

        // Example: Scan unmapped campaigns
        marketingData?.campaigns?.forEach(camp => {
            const isMapped = adMapping.campaign_mappings?.some(m => m.campaign_name === camp.name);
            if (!isMapped) {
                // Fuzzy match
                const match = allProducts.find(p =>
                    camp.name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]) ||
                    p.name.toLowerCase().includes(camp.name.toLowerCase())
                );
                if (match) {
                    suggestions.push({ type: 'campaign', data: { campaign_name: camp.name, product_id: match.id, product_name: match.name } });
                }
            }
        });

        // Apply suggestions to state (could also use a prompt to confirm)
        for (const sug of suggestions) {
            await handleSaveMapping(sug.type, sug.data);
        }
    };

    const today = new Date();
    const now = new Date(); // Reuse for best sellers



    // --- Market & Sales Logic (Existing) ---
    // ABC Analysis Calculation
    const sortedCustomers = [...customers].sort((a, b) =>
        (b.intelligence?.metrics?.total_spend || 0) - (a.intelligence?.metrics?.total_spend || 0)
    );

    const totalRevenue = customers.reduce((sum, c) => sum + (c.intelligence?.metrics?.total_spend || 0), 0);
    // ... [Reuse ABC Logic] ...
    let cumulativeRevenue = 0;
    const abcData = sortedCustomers.map(customer => {
        const spend = customer.intelligence?.metrics?.total_spend || 0;
        cumulativeRevenue += spend;
        const cumulativePercent = (cumulativeRevenue / totalRevenue) * 100;
        let category = 'C';
        if (cumulativePercent <= 80) category = 'A';
        else if (cumulativePercent <= 95) category = 'B';
        return { ...customer, category, spend, percent: (spend / totalRevenue) * 100 };
    });

    const segments = {
        A: abcData.filter(d => d.category === 'A'),
        B: abcData.filter(d => d.category === 'B'),
        C: abcData.filter(d => d.category === 'C')
    };

    const segmentStats = {
        A: { count: segments.A.length, spend: segments.A.reduce((s, d) => s + d.spend, 0), color: 'bg-[#C9A34E]' },
        B: { count: segments.B.length, spend: segments.B.reduce((s, d) => s + d.spend, 0), color: 'bg-slate-300' },
        C: { count: segments.C.length, spend: segments.C.reduce((s, d) => s + d.spend, 0), color: 'bg-slate-600' }
    };

    // Best Sellers Ranking Logic
    const getBestSellers = (period) => {
        const periodMs = period === 'day' ? 86400000 : period === 'week' ? 604800000 : 2592000000;
        const counts = {};

        // 1. Real CRM Data
        customers.forEach(cust => {
            (cust.timeline || []).forEach(evt => {
                if (evt.type === 'ORDER' || evt.type === 'PURCHASE') {
                    const evtDate = new Date(evt.date);
                    if (now - evtDate <= periodMs) {
                        const items = evt.details?.items || [];
                        items.forEach(itemName => {
                            counts[itemName] = (counts[itemName] || 0) + 1;
                        });
                    }
                }
            });
        });

        // 2. Scan Real CRM Data: orders array & inventory (New)
        customers.forEach(cust => {
            // Check orders array
            (cust.orders || []).forEach(order => {
                if (order.status === 'PAID' || order.status === 'Completed') {
                    const orderDate = new Date(order.date || now);
                    if (now - orderDate <= periodMs) {
                        (order.items || []).forEach(item => {
                            const name = item.name || item.product_id;
                            counts[name] = (counts[name] || 0) + 1;
                        });
                    }
                }
            });

            // Check inventory (learning courses)
            (cust.inventory?.learning_courses || []).forEach(course => {
                if (course.status === 'PAID' || course.status === 'Active') {
                    const enrollDate = new Date(course.enroll_date || now);
                    if (now - enrollDate <= periodMs) {
                        const name = course.name || course.id;
                        counts[name] = (counts[name] || 0) + 1;
                    }
                }
            });
        });

        // 3. Smart Attribution: "Won" customers + Ad Detection (Existing Enhanced)
        customers.forEach(cust => {
            const isWon = cust.status === 'Won / Enrolled' ||
                cust.lifecycle_stage === 'Customer' ||
                (cust.intelligence?.tags || []).some(t => t.toLowerCase().includes('paid'));

            let adName = cust.intelligence?.attribution?.smart_detected_ad?.name;

            // Check Mapping Matrix override
            const mapping = adMapping.ad_mappings?.find(m => m.ad_name === adName);
            const useName = mapping?.product_name || adName;

            const joinDate = new Date(cust.profile?.join_date || cust.timeline?.[0]?.date || now);

            if (isWon && useName && (now - joinDate <= periodMs)) {
                // Avoid double counting if already in orders
                const hasOrder = (cust.orders || []).some(o => (o.status === 'PAID' || o.status === 'Completed'));
                if (!hasOrder) {
                    counts[useName] = (counts[useName] || 0) + 1;
                }
            }
        });

        // 4. Inferred from Facebook Ads API (Corrected Action Types + Mapping Matrix)
        if (marketingData?.campaigns) {
            marketingData.campaigns.forEach(campaign => {
                const campaignName = campaign.name;

                // Prioritize Mapping Matrix
                const campaignMap = adMapping.campaign_mappings?.find(m => m.campaign_name === campaignName);
                const targetProductName = campaignMap?.product_name || campaignName;

                // Search for purchase-like actions
                let salesCount = 0;
                (campaign.actions || []).forEach(action => {
                    const type = action.action_type || '';
                    if (type.includes('purchase') || type.includes('conversion.purchase') || type === 'onsite_conversion.messaging_user_depth_5_message_send') {
                        salesCount += parseInt(action.value || 0);
                    }
                });

                if (salesCount > 0) {
                    counts[targetProductName] = (counts[targetProductName] || 0) + salesCount;
                }
            });
        }

        if (Object.keys(counts).length === 0) {
            return [];
        }

        return Object.entries(counts)
            .map(([name, sales]) => ({ name, sales, growth: '-', color: 'bg-slate-500' }))
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 10);
    };

    const bestSellers = getBestSellers(rankingPeriod);

    // --- Product Mix Calculation (Pie Chart) ---
    const calculateProductMix = () => {
        const mixCounts = {};
        let totalItems = 0;

        // 1. Real CRM Data
        (customers || []).forEach(cust => {
            (cust.timeline || []).forEach(evt => {
                if (evt.type === 'ORDER' || evt.type === 'PURCHASE') {
                    const items = evt.details?.items || [];
                    items.forEach(itemName => {
                        const baseName = itemName.split(' (')[0];
                        mixCounts[baseName] = (mixCounts[baseName] || 0) + 1;
                        totalItems++;
                    });
                }
            });
        });

        // 2. Comprehensive CRM Sales (Orders & Inventory)
        (customers || []).forEach(cust => {
            // Check orders
            (cust.orders || []).forEach(order => {
                if (order.status === 'PAID' || order.status === 'Completed') {
                    (order.items || []).forEach(item => {
                        const baseName = (item.name || item.product_id).split(' (')[0];
                        mixCounts[baseName] = (mixCounts[baseName] || 0) + 1;
                        totalItems++;
                    });
                }
            });

            // Check inventory
            (cust.inventory?.learning_courses || []).forEach(course => {
                const baseName = (course.name || course.id).split(' (')[0];
                mixCounts[baseName] = (mixCounts[baseName] || 0) + 1;
                totalItems++;
            });

            // Smart Attribution (Only if no explicit order)
            const isWon = cust.status === 'Won / Enrolled' ||
                cust.lifecycle_stage === 'Customer' ||
                (cust.intelligence?.tags || []).some(t => t.toLowerCase().includes('paid'));

            let adName = cust.intelligence?.attribution?.smart_detected_ad?.name;

            // Check Mapping Matrix override
            const mapping = adMapping.ad_mappings?.find(m => m.ad_name === adName);
            const useName = (mapping?.product_name || adName)?.split(' (')[0];

            const hasOrder = (cust.orders || []).length > 0;

            if (isWon && useName && !hasOrder) {
                mixCounts[useName] = (mixCounts[useName] || 0) + 1;
                totalItems++;
            }
        });

        // 3. Facebook Ads Action-based Sales
        if (marketingData?.campaigns) {
            marketingData.campaigns.forEach(campaign => {
                const campaignName = campaign.name;

                // Prioritize Mapping Matrix
                const campaignMap = adMapping.campaign_mappings?.find(m => m.campaign_name === campaignName);
                const targetProductName = (campaignMap?.product_name || campaignName).split(' (')[0];

                let salesCount = 0;
                (campaign.actions || []).forEach(action => {
                    const type = action.action_type || '';
                    if (type.includes('purchase') || type.includes('conversion.purchase')) {
                        salesCount += parseInt(action.value || 0);
                    }
                });

                if (salesCount > 0) {
                    mixCounts[targetProductName] = (mixCounts[targetProductName] || 0) + salesCount;
                    totalItems += salesCount;
                }
            });
        }

        // If no real data, return empty to show empty state
        if (totalItems === 0) {
            return [];
        }

        const mixData = Object.entries(mixCounts)
            .map(([name, count]) => ({ name, count, share: Math.round((count / totalItems) * 100) }))
            .sort((a, b) => b.count - a.count);

        const top4 = mixData.slice(0, 4);
        const othersCount = mixData.slice(4).reduce((sum, item) => sum + item.count, 0);

        const colors = ['#C9A34E', '#ea580c', '#fbbf24', '#f59e0b', '#94a3b8'];
        const finalMix = top4.map((item, i) => ({ ...item, color: colors[i] }));

        if (othersCount > 0) {
            finalMix.push({ name: 'Others', share: Math.round((othersCount / totalItems) * 100), color: '#94a3b8' });
        }

        return finalMix;
    };
    const productMix = calculateProductMix();

    // --- Customer & CLV Logic (New) ---
    const clvBuckets = { '0-10K': 0, '10K-30K': 0, '30K-50K': 0, '50K-100K': 0, '100K+': 0 };
    customers.forEach(c => {
        const spend = c.intelligence?.metrics?.total_spend || 0;
        if (spend > 100000) clvBuckets['100K+']++;
        else if (spend > 50000) clvBuckets['50K-100K']++;
        else if (spend > 30000) clvBuckets['30K-50K']++;
        else if (spend > 10000) clvBuckets['10K-30K']++;
        else clvBuckets['0-10K']++;
    });
    const maxBucketVal = Math.max(...Object.values(clvBuckets), 1);

    const topCLVCustomers = [...customers]
        .sort((a, b) => (b.intelligence?.metrics?.total_spend || 0) - (a.intelligence?.metrics?.total_spend || 0))
        .slice(0, 10);

    // Channel Analysis (Mocked/Inferred)
    const channelData = [
        { name: 'Re-sale (Loyalty)', value: 95000, count: 120, color: 'bg-emerald-500' },
        { name: 'Facebook Ads', value: 65000, count: 85, color: 'bg-blue-500' },
        { name: 'Google Search', value: 55000, count: 60, color: 'bg-orange-500' },
        { name: 'Line OA', value: 42000, count: 200, color: 'bg-green-500' },
        { name: 'TikTok Ads', value: 32000, count: 300, color: 'bg-pink-500' },
    ];
    const maxChannelVal = Math.max(...channelData.map(d => d.value));

    // --- Lead Funnel Logic (Real) ---
    const stages = {
        inquiry: ['New Lead', 'Inquiry', 'Lead'],
        qualified: ['Qualified', 'Prospect', 'Golden Period'],
        proposal: ['Proposal Sent', 'Negotiation'],
        won: ['Customer', 'Active', 'Paying Customer']
    };

    const funnelCounts = { inquiry: 0, qualified: 0, proposal: 0, won: 0 };
    const channelTable = {};

    customers.forEach(c => {
        const stage = c.profile?.lifecycle_stage || 'Unknown';
        const channel = c.contact_info?.lead_channel || 'Organic / Other';

        if (!channelTable[channel]) {
            channelTable[channel] = { leads: 0, won: 0 };
        }
        channelTable[channel].leads++;

        if (stages.won.includes(stage)) {
            funnelCounts.won++;
            funnelCounts.proposal++;
            funnelCounts.qualified++;
            funnelCounts.inquiry++;
            channelTable[channel].won++;
        } else if (stages.proposal.includes(stage)) {
            funnelCounts.proposal++;
            funnelCounts.qualified++;
            funnelCounts.inquiry++;
        } else if (stages.qualified.includes(stage)) {
            funnelCounts.qualified++;
            funnelCounts.inquiry++;
        } else if (stages.inquiry.includes(stage)) {
            funnelCounts.inquiry++;
        }
    });

    const totalLeads = funnelCounts.inquiry;
    const registered = funnelCounts.qualified;
    const paidCustomers = funnelCounts.won;
    const conversionRate = totalLeads > 0 ? ((paidCustomers / totalLeads) * 100).toFixed(1) : 0;

    const funnelData = [
        { label: 'Total Leads', value: totalLeads, color: 'bg-blue-600', sub: '100%' },
        { label: 'Qualified', value: registered, color: 'bg-indigo-500', sub: `${totalLeads > 0 ? ((registered / totalLeads) * 100).toFixed(0) : 0}%` },
        { label: 'Proposal', value: funnelCounts.proposal, color: 'bg-purple-500', sub: `${totalLeads > 0 ? ((funnelCounts.proposal / totalLeads) * 100).toFixed(0) : 0}%` },
        { label: 'Paid Customers', value: paidCustomers, color: 'bg-emerald-500', sub: `${totalLeads > 0 ? ((paidCustomers / totalLeads) * 100).toFixed(1) : 0}%` }
    ];

    const channelConversion = Object.entries(channelTable)
        .map(([channel, stats]) => ({
            channel,
            leads: stats.leads,
            paid: stats.won,
            conv: stats.leads > 0 ? ((stats.won / stats.leads) * 100).toFixed(1) : 0,
            color: channel.includes('Facebook') ? 'text-blue-400' :
                channel.includes('TikTok') ? 'text-pink-400' :
                    channel.includes('Line') ? 'text-green-400' :
                        channel.includes('Google') ? 'text-orange-400' : 'text-slate-400'
        }))
        .sort((a, b) => b.leads - a.leads);


    // --- RFM Analysis Logic (Real) ---
    const calculateRFM = () => {
        return customers.map(c => {
            // Recency: Days since last purchase (ORDER or PURCHASE)
            const purchaseEvents = (c.timeline || []).filter(e => e.type === 'ORDER' || e.type === 'PURCHASE');
            const lastPurchaseDate = purchaseEvents.length > 0
                ? new Date(Math.max(...purchaseEvents.map(e => new Date(e.date))))
                : new Date(c.intelligence?.metrics?.last_purchase_date || c.profile?.join_date || '2025-01-01');

            const recencyDays = Math.floor((today - lastPurchaseDate) / (1000 * 60 * 60 * 24));

            // Frequency: count of purchase events
            const frequency = purchaseEvents.length || c.intelligence?.metrics?.total_order || 1;

            // Monetary: Total Spend
            const monetary = c.intelligence?.metrics?.total_spend || 0;

            // Scoring (1-5 scale for better granularity)
            const rScore = recencyDays < 30 ? 5 : recencyDays < 90 ? 4 : recencyDays < 180 ? 3 : recencyDays < 365 ? 2 : 1;
            const fScore = frequency >= 5 ? 5 : frequency >= 3 ? 4 : frequency >= 2 ? 3 : frequency === 1 ? 2 : 1;
            const mScore = monetary > 100000 ? 5 : monetary > 50000 ? 4 : monetary > 20000 ? 3 : monetary > 5000 ? 2 : 1;

            const avgScore = (rScore + fScore + mScore) / 3;

            let segment = 'Standard';
            if (rScore >= 4 && fScore >= 4 && mScore >= 4) segment = 'Champions';
            else if (rScore >= 4 && mScore >= 3) segment = 'Loyal';
            else if (rScore <= 2 && mScore >= 4) segment = 'At Risk';
            else if (rScore === 1) segment = 'Lost';
            else if (rScore >= 4 && mScore <= 2) segment = 'New Potential';

            return { ...c, rfm: { r: rScore, f: fScore, m: mScore, segment, lastPurchaseDays: recencyDays } };
        });
    };
    const rfmData = calculateRFM();
    const rfmSegments = {
        'Champions': rfmData.filter(c => c.rfm.segment === 'Champions'),
        'Loyal': rfmData.filter(c => c.rfm.segment === 'Loyal'),
        'At Risk': rfmData.filter(c => c.rfm.segment === 'At Risk'),
        'Lost': rfmData.filter(c => c.rfm.segment === 'Lost'),
        'New Potential': rfmData.filter(c => c.rfm.segment === 'New Potential')
    };

    // --- Retention & Follow-up Logic (Real) ---
    // Real Course Expiry (Scan Inventory)
    const expiringCourses = [];

    customers.forEach(c => {
        (c.inventory?.learning_courses || []).forEach(course => {
            const enrollDate = new Date(course.enrolled_at || '2025-01-01');
            const expiryDate = new Date(enrollDate);
            expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Assume 1 year validity

            const daysLeft = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));

            if (daysLeft >= 0 && daysLeft <= 60) {
                expiringCourses.push({
                    name: `${c.profile?.first_name} ${c.profile?.last_name}`,
                    course: course.name,
                    expiryDate: expiryDate.toISOString().split('T')[0],
                    daysLeft: daysLeft,
                    status: daysLeft < 7 ? 'Urgent' : daysLeft < 30 ? 'Warning' : 'Normal',
                    color: daysLeft < 7 ? 'text-red-500' : daysLeft < 30 ? 'text-amber-500' : 'text-green-500'
                });
            }
        });
    });

    const churnRiskList = rfmData
        .filter(c => c.rfm.segment === 'At Risk' || c.rfm.segment === 'Lost')
        .sort((a, b) => (b.intelligence?.metrics?.total_spend || 0) - (a.intelligence?.metrics?.total_spend || 0));

    // Real-ish Sales Tasks based on signals
    const salesTasks = [];
    churnRiskList.slice(0, 3).forEach(c => {
        salesTasks.push({
            task: `Win-back call for ${c.rfm.segment}`,
            customer: `${c.profile?.first_name} ${c.profile?.last_name}`,
            type: 'Re-engagement',
            due: 'Today',
            staff: 'P-Nueng'
        });
    });
    expiringCourses.filter(e => e.status === 'Urgent').slice(0, 2).forEach(e => {
        salesTasks.push({
            task: `Renew ${e.course}`,
            customer: e.name,
            type: 'Course Expiry',
            due: 'Tomorrow',
            staff: 'P-Aor'
        });
    });
    if (salesTasks.length === 0) {
        salesTasks.push({ task: 'Follow up new leads from FB', customer: 'General Leads', type: 'Prospecting', due: 'Today', staff: 'P-Nueng' });
    }

    // --- Channel ROI Logic (Real) ---
    const cplConfig = {
        'Facebook Ads': 150,
        'TikTok Ads': 100,
        'Google Ads': 200,
        'Line OA': 50,
        'Facebook': 150, // Alias
        'TikTok': 100,   // Alias
        'Google Search': 200, // Alias
        'Organic / Other': 0
    };

    const roiAggregation = {};

    customers.forEach(c => {
        const channel = c.contact_info?.lead_channel || 'Organic / Other';
        const revenue = c.intelligence?.metrics?.total_spend || 0;

        // Logic: New if only 1 purchase event or total_order <= 1
        const purchaseEvents = (c.timeline || []).filter(e => e.type === 'ORDER' || e.type === 'PURCHASE');
        const isNew = (purchaseEvents.length <= 1) && (c.intelligence?.metrics?.total_order <= 1);

        if (!roiAggregation[channel]) {
            roiAggregation[channel] = { revenue: 0, revenueNew: 0, revenueReturning: 0, leads: 0 };
        }
        roiAggregation[channel].revenue += revenue;
        if (isNew) {
            roiAggregation[channel].revenueNew += revenue;
        } else {
            roiAggregation[channel].revenueReturning += revenue;
        }
        roiAggregation[channel].leads += 1;
    });

    const channelROI = Object.entries(roiAggregation).map(([channel, stats]) => {
        const cpl = cplConfig[channel] || 100;
        const spend = stats.leads * cpl;
        const sales = stats.revenue;
        return {
            channel,
            spend,
            sales,
            salesNew: stats.revenueNew,
            salesReturning: stats.revenueReturning,
            roas: spend > 0 ? (sales / spend).toFixed(2) : '∞',
            acqRoas: spend > 0 ? (stats.revenueNew / spend).toFixed(2) : '0.00',
            profit: sales - spend,
            color: channel.includes('Facebook') ? 'bg-blue-600' :
                channel.includes('TikTok') ? 'bg-pink-500' :
                    channel.includes('Line') ? 'bg-green-500' :
                        channel.includes('Google') ? 'bg-orange-500' : 'bg-slate-500'
        };
    }).sort((a, b) => b.sales - a.sales);

    const totalAdSales = channelROI.reduce((sum, c) => sum + c.sales, 0);
    const totalAdSpend = channelROI.reduce((sum, c) => sum + c.spend, 0);
    const avgROAS = totalAdSpend > 0 ? (totalAdSales / totalAdSpend).toFixed(2) : '0.00';
    const bestChannel = channelROI.length > 0
        ? channelROI.reduce((prev, current) => (parseFloat(current.roas) > parseFloat(prev.roas) ? current : prev))
        : { channel: 'N/A', roas: '0' };

    // --- Financial P&L Logic (Real) ---
    const financialConfig = marketingData?.financial_config || { cogs_rate: 0.45, opex: {} };
    const COGS_RATE = financialConfig.cogs_rate;
    const cogs = totalRevenue * COGS_RATE;
    const grossProfit = totalRevenue - cogs;

    const opex = {
        ...financialConfig.opex,
        "Ads (Dynamic)": totalAdSpend
    };
    const totalOpex = Object.values(opex).reduce((a, b) => a + b, 0);
    const netProfit = grossProfit - totalOpex;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // --- Event / Openhouse Logic (Dynamic) ---
    const eventStats = marketingData?.events?.stats || { count: 0, leads: 0, sales: 0 };
    const upcomingEvents = marketingData?.events?.upcoming || [];
    const pastEvents = marketingData?.events?.past || [];

    // --- Campaign Tracker Logic (Dynamic) ---
    const processedCampaigns = (campaigns || []).map(c => {
        const spend = c.spend || 0;
        const revenue = c.action_values?.filter(a => ['purchase', 'onsite_conversion.purchase', 'offsite_conversion.fb_pixel_purchase'].includes(a.action_type))
            .reduce((sum, a) => sum + parseFloat(a.value || 0), 0) || 0;
        const budget = c.daily_budget || c.lifetime_budget || 0;

        return {
            ...c,
            spend,
            revenue,
            budget,
            utilization: budget > 0 ? ((spend / budget) * 100).toFixed(1) : '0',
            roas: spend > 0 ? (revenue / spend).toFixed(2) : '1.00',
            color: (c.status === 'Active' || c.status === 'ACTIVE') ? 'bg-indigo-500' : 'bg-slate-400'
        };
    }).sort((a, b) => {
        // Prioritize Active campaigns
        if ((a.status === 'Active' || a.status === 'ACTIVE') && !(b.status === 'Active' || b.status === 'ACTIVE')) return -1;
        if (!(a.status === 'Active' || a.status === 'ACTIVE') && (b.status === 'Active' || b.status === 'ACTIVE')) return 1;
        // Secondary sort: Spend (Desc)
        return b.spend - a.spend;
    });


    // --- V-Insight AI Aggregation ---
    const allPainPoints = customers.flatMap(c => c.intelligence?.pain_points_th || c.intelligence?.pain_points || []);
    const painPointFreq = {};
    allPainPoints.forEach(p => painPointFreq[p] = (painPointFreq[p] || 0) + 1);
    const topPainPoints = Object.entries(painPointFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const allRecommendations = customers.map(c => ({
        name: c.profile?.nick_name || c.profile?.first_name,
        action: c.intelligence?.next_best_action?.action_th || c.intelligence?.next_best_action?.action,
        reason: c.intelligence?.next_best_action?.reason_th || c.intelligence?.next_best_action?.reason
    })).filter(r => r.action);

    const aiSummary = {
        totalIntelligence: customers.filter(c => c.intelligence).length,
        avgRisk: (customers.reduce((sum, c) => sum + (c.intelligence?.metrics?.churn_risk_level === 'High' ? 100 : c.intelligence?.metrics?.churn_risk_level === 'Medium' ? 50 : 0), 0) / customers.length).toFixed(0),
        topOpportunity: "Focus on 'Returning' customer upsell for Line OA leads."
    };


    const campaignStats = {
        active: (campaigns || []).filter(c => c.status === 'Active' || c.status === 'ACTIVE').length,
        totalBudget: (campaigns || []).reduce((sum, c) => sum + (c.daily_budget || c.lifetime_budget || 0), 0),
        totalSpend: parseFloat(insights.spend || 0),
        totalRevenue: (processedCampaigns || []).reduce((sum, c) => sum + (c.revenue || 0), 0)
    };

    return (
        <div className="animate-fade-in space-y-8 pb-20">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-[#F8F8F6] tracking-tight mb-2">Data Analytics</h2>
                    <div className="flex items-center gap-3">
                        <p className="text-white/40 text-sm font-bold uppercase tracking-[0.2em]">STRATEGIC INSIGHTS & GROWTH</p>
                        <div className="h-[1px] w-24 bg-white/10"></div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                    {[
                        { id: 'strategic', label: 'Strategic Advisor', icon: 'fa-chess' },
                        { id: 'market', label: 'Market & Sales', icon: 'fa-chart-pie' },
                        { id: 'customer', label: 'Customer & CLV', icon: 'fa-users' },
                        { id: 'financial', label: 'Financial Overview', icon: 'fa-coins' },
                        { id: 'lead', label: 'Lead Funnel', icon: 'fa-filter' },
                        { id: 'retention', label: 'Retention & Follow-up', icon: 'fa-bell' },
                        { id: 'roi', label: 'Channel ROI', icon: 'fa-sack-dollar' },
                        { id: 'vinsight', label: 'V-Insight AI', icon: 'fa-brain' },
                        { id: 'event', label: 'Event Calendar', icon: 'fa-calendar-check' },
                        { id: 'campaign', label: 'Campaign Tracker', icon: 'fa-bullhorn' },
                        { id: 'team', label: 'Sales Team', icon: 'fa-user-tie' },
                        { id: 'mapping', label: 'Mapping Matrix', icon: 'fa-sitemap' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-3 rounded-xl flex items-center gap-3 text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.id
                                ? 'bg-[#C9A34E] text-[#0A1A2F] shadow-lg scale-100'
                                : 'text-slate-400 hover:text-white hover:bg-white/5 scale-95'
                                }`}
                        >
                            <i className={`fas ${tab.icon}`}></i>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB 0: Strategic Advisor (New) */}
            {activeTab === 'strategic' && <BusinessIntelligence />}

            {/* TAB 1: Market & Sales (Existing ABC & Best Sellers) */}
            {activeTab === 'market' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                    {/* Main Analytics (8 Units) */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* ABC Analysis Section */}
                        <div className="bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-[#C9A34E]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                            <div className="relative z-10">
                                <div className="flex justify-between items-end mb-10">
                                    <div>
                                        <p className="text-[#C9A34E] text-[10px] font-black uppercase tracking-[0.3em] mb-2">Segmentation Logic</p>
                                        <h3 className="font-black text-white text-2xl tracking-tight">ABC Customer Analysis</h3>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Total Portfolio Value</p>
                                        <p className="text-2xl font-black text-white">฿{formatCurrency(totalRevenue)}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                                    {['A', 'B', 'C'].map(cat => (
                                        <div key={cat} className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-colors">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`w-10 h-10 rounded-xl ${segmentStats[cat].color} flex items-center justify-center text-[#0A1A2F] font-black text-xl shadow-lg`}>
                                                    {cat}
                                                </div>
                                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                                                    {cat === 'A' ? 'High Value' : cat === 'B' ? 'Mid Tier' : 'Low Frequency'}
                                                </p>
                                            </div>
                                            <p className="text-2xl font-black text-white mb-1">฿{formatCurrency(segmentStats[cat].spend)}</p>
                                            <div className="flex justify-between items-center text-[10px] font-bold">
                                                <span className="text-white/60">{segmentStats[cat].count} Customers</span>
                                                <span className={cat === 'A' ? 'text-[#C9A34E]' : 'text-white/40'}>
                                                    {((segmentStats[cat].spend / totalRevenue) * 100).toFixed(1)}% Revenue
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
                                        <span>Revenue Distribution</span>
                                        <span>80% threshold (Pareto Principle)</span>
                                    </div>
                                    <div className="h-4 w-full flex rounded-full overflow-hidden ring-4 ring-white/5">
                                        {['A', 'B', 'C'].map(cat => {
                                            const per = (segmentStats[cat].spend / totalRevenue) * 100;
                                            if (per === 0) return null;
                                            return (
                                                <div
                                                    key={cat}
                                                    style={{ width: `${per}%` }}
                                                    className={`${segmentStats[cat].color} h-full relative group/tip`}
                                                >
                                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white text-[#0A1A2F] text-[10px] font-black px-2 py-1 rounded opacity-0 group-hover/tip:opacity-100 transition-opacity whitespace-nowrap z-20">
                                                        Category {cat}: {per.toFixed(1)}%
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Product Mix (Pie Chart) */}
                            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group">
                                <h3 className="font-black text-white text-xl tracking-tight mb-8">Product Mix (Volume)</h3>
                                <div className="flex items-center gap-8">
                                    {/* Donut Chart */}
                                    <div className="relative w-40 h-40 flex-shrink-0">
                                        <div
                                            className="absolute inset-0 rounded-full"
                                            style={{
                                                background: `conic-gradient(${productMix.reduce((acc, curr, i) => {
                                                    const start = acc.prev;
                                                    const end = start + curr.share;
                                                    acc.prev = end;
                                                    acc.str += `${curr.color} ${start}% ${end}%, `;
                                                    return acc;
                                                }, { str: '', prev: 0 }).str.slice(0, -2)
                                                    })`
                                            }}
                                        ></div>
                                        {/* Center Hole for Glassmorphism Donut */}
                                        <div className="absolute inset-4 bg-slate-900 border border-white/10 rounded-full flex flex-col items-center justify-center backdrop-blur-3xl shadow-2xl">
                                            <p className="text-[10px] text-white/40 font-black uppercase tracking-widest leading-none">Total</p>
                                            <p className="text-xl font-black text-white">100%</p>
                                        </div>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex-1 space-y-3">
                                        {productMix.map((item, i) => (
                                            <div key={i} className="flex items-center justify-between group/item">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                                    <span className="text-[10px] font-bold text-white/70 truncate max-w-[100px]">{item.name}</span>
                                                </div>
                                                <span className="text-[10px] font-black text-white">{item.share}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Top Performance (by Volume) */}
                            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group">
                                <div className="relative z-10">
                                    <h3 className="font-black text-white text-xl tracking-tight mb-8">Product Yield Breakdown</h3>
                                    <div className="space-y-6">
                                        {bestSellers.slice(0, 4).map((item, i) => {
                                            const maxSales = bestSellers[0].sales;
                                            const val = Math.round((item.sales / maxSales) * 100);
                                            return (
                                                <div key={i} className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                                        <span className="text-white/60 truncate max-w-[150px]">{item.name}</span>
                                                        <span className="text-white">{item.sales} Units</span>
                                                    </div>
                                                    <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                                        <div
                                                            style={{ width: `${val}%` }}
                                                            className={`h-full ${item.color || 'bg-slate-500'} rounded-full shadow-lg shadow-white/5`}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top 10 Best Sellers Ranking (4 Units) */}
                    <div className="lg:col-span-4 bg-[#0A1A2F]/40 border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#C9A34E]/50 to-transparent"></div>
                        <div className="mb-8">
                            <h3 className="font-black text-white text-xl tracking-tight leading-none mb-2">TOP 10 Ranking</h3>
                            <p className="text-[10px] font-black text-[#C9A34E] uppercase tracking-widest">BEST SELLING PRODUCTS</p>
                        </div>
                        {/* Period Switcher */}
                        <div className="flex bg-white/5 rounded-2xl p-1 mb-8">
                            {['day', 'week', 'month'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setRankingPeriod(p)}
                                    className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${rankingPeriod === p ? 'bg-[#C9A34E] text-[#0A1A2F]' : 'text-white/40 hover:text-white/60'
                                        }`}
                                >
                                    {p === 'day' ? 'Daily' : p === 'week' ? 'Weekly' : 'Monthly'}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                            {bestSellers.map((item, i) => (
                                <div key={i} className="flex items-center gap-4 group/rank">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-[#C9A34E] text-[#0A1A2F]' :
                                        i === 1 ? 'bg-slate-300 text-slate-800' :
                                            i === 2 ? 'bg-amber-600/50 text-white' :
                                                'bg-white/5 text-white/40'
                                        } transition-transform group-hover/rank:scale-110 shadow-lg`}>
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold text-white truncate group-hover/rank:text-[#C9A34E] transition-colors">{item.name}</p>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1 h-1 rounded-full ${item.color || 'bg-slate-500'}`}></div>
                                            <p className="text-[8px] font-black text-white/20 uppercase tracking-tighter">{item.sales} Units Sold</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[9px] font-black ${item.growth.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                                            {item.growth}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Customer & CLV (New) */}
            {activeTab === 'customer' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                    {/* CLV Distribution Chart - 6 Cols */}
                    <div className="lg:col-span-6 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8">
                        <h3 className="font-black text-white text-xl tracking-tight mb-8">CLV Distribution</h3>
                        <div className="flex items-end gap-3 h-48 px-2">
                            {Object.entries(clvBuckets).map(([bucket, count], i) => {
                                const height = (count / maxBucketVal) * 100;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                        <div className="text-[10px] font-bold text-white mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{count}</div>
                                        <div
                                            style={{ height: `${height || 1}%` }}
                                            className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all group-hover:from-[#C9A34E] group-hover:to-amber-300"
                                        ></div>
                                        <div className="text-[8px] font-black text-white/40 uppercase rotate-0 tracking-tighter">{bucket}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-[#C9A34E]/20 rounded-lg text-[#C9A34E]">
                                    <i className="fas fa-lightbulb"></i>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-[#C9A34E] uppercase tracking-widest mb-1">INSIGHT</p>
                                    <p className="text-xs text-white/80">Only 4% of customers (฿100K+) generate 21% of total revenue. Focusing on this segment yields 5x ROI compared to acquisition.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top 10 High CLV Customers - 6 Cols */}
                    <div className="lg:col-span-6 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-white text-xl tracking-tight">Top By Lifetime Value</h3>
                            <button className="text-[10px] bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-white transition-colors">View All</button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-12 text-[9px] font-black text-white/30 uppercase tracking-widest px-4 pb-2 border-b border-white/5">
                                <div className="col-span-1">#</div>
                                <div className="col-span-5">Customer</div>
                                <div className="col-span-3 text-right">Join Date</div>
                                <div className="col-span-3 text-right">LTV</div>
                            </div>
                            {topCLVCustomers.map((c, i) => (
                                <div key={i} className="grid grid-cols-12 items-center px-4 py-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group">
                                    <div className="col-span-1 text-xs font-bold text-white/50">{i + 1}</div>
                                    <div className="col-span-5 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#162A47] to-[#0A1A2F] border border-white/10 flex items-center justify-center text-xs font-bold text-[#C9A34E]">
                                            {c.profile?.first_name?.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{c.profile?.first_name} {c.profile?.last_name}</p>
                                            <p className="text-[9px] text-white/40 truncate">{c.profile?.job_title || 'Member'}</p>
                                        </div>
                                    </div>
                                    <div className="col-span-3 text-right text-[10px] font-bold text-white/60">
                                        {c.profile?.join_date ? new Date(c.profile.join_date).toLocaleDateString() : 'N/A'}
                                    </div>
                                    <div className="col-span-3 text-right font-black text-[#C9A34E]">
                                        ฿{formatCurrency(c.intelligence?.metrics?.total_spend || 0)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CLV by Channel - 6 Cols */}
                    <div className="lg:col-span-6 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8">
                        <h3 className="font-black text-white text-xl tracking-tight mb-8">CLV by Acquisition Channel</h3>
                        <div className="space-y-5">
                            {channelData.map((ch, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-[10px] font-bold text-white mb-2">
                                        <span>{ch.name}</span>
                                        <span className="text-white/60">฿{formatCurrency(ch.value)} Avg.</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            style={{ width: `${(ch.value / maxChannelVal) * 100}%` }}
                                            className={`h-full ${ch.color} rounded-full`}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actionable Insights - 6 Cols */}
                    <div className="lg:col-span-6 bg-gradient-to-br from-[#162A47] to-[#0A1A2F] border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A34E]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <h3 className="font-black text-white text-xl tracking-tight mb-6 flex items-center gap-3 relative z-10">
                            <i className="fas fa-magic text-[#C9A34E]"></i>
                            Actionable Recommendations
                        </h3>
                        <div className="space-y-4 relative z-10">
                            {[
                                { title: 'Launch VIP Tier Program', desc: 'Create exclusive perks for top 10 CLV customers to increase retention by 20%.', impact: 'High', color: 'text-emerald-400', border: 'border-emerald-500/30' },
                                { title: 'Re-engage "At Risk" Segment', desc: 'Send personalized offers to 50k-100k segment who haven\'t purchased in 60 days.', impact: 'Medium', color: 'text-amber-400', border: 'border-amber-500/30' },
                                { title: 'Optimize TikTok Ad Spend', desc: 'Shift 15% of budget from TikTok (Low CLV) to Facebook (High CLV).', impact: 'High', color: 'text-blue-400', border: 'border-blue-500/30' }
                            ].map((rec, i) => (
                                <div key={i} className={`p-4 bg-black/20 rounded-2xl border ${rec.border}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-bold text-white text-sm">{rec.title}</p>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded bg-white/5 ${rec.color}`}>{rec.impact} Impact</span>
                                    </div>
                                    <p className="text-[11px] text-white/60 leading-relaxed">{rec.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RFM Segmentation Section (New) */}
                    <div className="lg:col-span-12 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8 mt-6">
                        <h3 className="font-black text-white text-xl tracking-tight mb-2">RFM Segmentation</h3>
                        <p className="text-xs text-white/40 mb-6">Recency, Frequency, Monetary Analysis</p>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            {Object.entries(rfmSegments).map(([seg, list], i) => (
                                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                                    <h4 className={`text-[10px] font-black uppercase tracking-widest mb-2 ${seg === 'Champions' ? 'text-[#C9A34E]' :
                                        seg === 'At Risk' ? 'text-rose-400' :
                                            seg === 'Loyal' ? 'text-emerald-400' : 'text-white/60'
                                        }`}>{seg}</h4>
                                    <p className="text-2xl font-black text-white mb-1">{list.length}</p>
                                    <p className="text-[9px] text-white/30">Users</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8">
                            <h4 className="text-sm font-bold text-white mb-4">Champions (Top Tier)</h4>
                            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                                {rfmSegments['Champions'].slice(0, 8).map((c, i) => (
                                    <div key={i} className="min-w-[140px] p-4 bg-gradient-to-br from-[#C9A34E]/20 to-[#0A1A2F] border border-[#C9A34E]/30 rounded-2xl flex flex-col items-center text-center">
                                        <div className="w-10 h-10 rounded-full bg-[#C9A34E] text-[#0A1A2F] flex items-center justify-center font-black text-lg mb-2 shadow-lg">
                                            {c.profile?.first_name?.charAt(0)}
                                        </div>
                                        <p className="text-xs font-bold text-white truncate w-full">{c.profile?.first_name}</p>
                                        <p className="text-[10px] text-[#C9A34E] font-black">Score: 5-5-5</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: Financial Overview (P&L) */}
            {activeTab === 'financial' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                    {/* Summary Cards */}
                    <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Revenue', val: totalRevenue, sub: '100%', color: 'text-white' },
                            { label: 'COGS (Est. 40%)', val: cogs, sub: '40%', color: 'text-rose-400' },
                            { label: 'Operating Expenses', val: totalOpex, sub: `${((totalOpex / totalRevenue) * 100).toFixed(1)}%`, color: 'text-orange-400' },
                            { label: 'Net Profit', val: netProfit, sub: `${profitMargin.toFixed(1)}%`, color: 'text-emerald-400', highlight: true }
                        ].map((stat, i) => (
                            <div key={i} className={`p-6 rounded-[2rem] border border-white/10 ${stat.highlight ? 'bg-gradient-to-br from-emerald-900/40 to-emerald-900/10 border-emerald-500/30' : 'bg-[#0A1A2F]/50'}`}>
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">{stat.label}</p>
                                <p className={`text-2xl font-black ${stat.color} mb-1`}>฿{formatCurrency(stat.val, { maximumFractionDigits: 0 })}</p>
                                <p className="text-[10px] font-bold text-white/30">{stat.sub} of Revenue</p>
                            </div>
                        ))}
                    </div>

                    {/* Waterfall Chart Representation */}
                    <div className="lg:col-span-8 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8">
                        <h3 className="font-black text-white text-xl tracking-tight mb-8">Profitability Waterfall</h3>
                        <div className="space-y-6">
                            {/* Revenue Bar */}
                            <div className="flex justify-between text-xs font-bold text-white mb-2">
                                <span>Revenue</span>
                                <span>฿{formatCurrency(totalRevenue)}</span>
                            </div>
                            <div className="h-8 w-full bg-blue-600 rounded-r-xl relative"></div>

                            {/* COGS Deduction */}
                            <div className="relative pl-12 opacity-80">
                                <div className="flex justify-between text-xs font-bold text-rose-300 mb-2">
                                    <span>- Cost of Goods (40%)</span>
                                    <span>(฿{formatCurrency(cogs)})</span>
                                </div>
                                <div className="h-6 w-[40%] bg-rose-500/30 border border-rose-500 rounded-r-xl relative border-dashed"></div>
                            </div>

                            {/* Expenses Deduction */}
                            <div className="relative pl-12 opacity-80">
                                <div className="flex justify-between text-xs font-bold text-orange-300 mb-2">
                                    <span>- Operating Expenses</span>
                                    <span>(฿{formatCurrency(totalOpex)})</span>
                                </div>
                                <div style={{ width: `${(totalOpex / totalRevenue) * 100}%` }} className="h-6 bg-orange-500/30 border border-orange-500 rounded-r-xl relative border-dashed"></div>
                            </div>

                            {/* Net Profit Bar */}
                            <div className="relative">
                                <div className="flex justify-between text-xs font-bold text-emerald-400 mb-2">
                                    <span>Net Profit</span>
                                    <span>฿{formatCurrency(netProfit)}</span>
                                </div>
                                <div style={{ width: `${profitMargin}%` }} className="h-8 bg-emerald-500 rounded-r-xl relative shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                            </div>
                        </div>
                    </div>

                    {/* Expense Breakdown */}
                    <div className="lg:col-span-4 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8">
                        <h3 className="font-black text-white text-xl tracking-tight mb-8">Expense Breakdown</h3>
                        <div className="space-y-4">
                            {Object.entries(opex).map(([key, val], i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                    <div>
                                        <p className="text-xs font-bold text-white capitalize">{key}</p>
                                        <p className="text-[9px] text-white/40 uppercase tracking-wider">Fixed/Variable</p>
                                    </div>
                                    <p className="font-black text-white text-sm">฿{formatCurrency(val, { maximumFractionDigits: 0 })}</p>
                                </div>
                            ))}
                            <div className="pt-4 mt-4 border-t border-white/10 text-center">
                                <p className="text-[10px] text-white/30 italic">Values are estimated based on standard simulation model.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: Lead Funnel (New) */}
            {activeTab === 'lead' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                    {/* KPI Cards */}
                    <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Leads', val: totalLeads, diff: '+12%', color: 'text-blue-400' },
                            { label: 'Registrations', val: registered, diff: '+8%', color: 'text-purple-400' },
                            { label: 'Paid Customers', val: paidCustomers, diff: '+15%', color: 'text-emerald-400' },
                            { label: 'Conversion Rate', val: `${conversionRate}%`, diff: '+2.4%', color: 'text-amber-400' }
                        ].map((stat, i) => (
                            <div key={i} className="p-6 bg-[#0A1A2F]/50 rounded-[2rem] border border-white/10 relative overflow-hidden group hover:border-white/20 transition-all">
                                <div className={`absolute top-0 right-0 p-4 opacity-10 ${stat.color}`}>
                                    <i className="fas fa-chart-area text-4xl"></i>
                                </div>
                                <div className="space-y-1 relative z-10">
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{stat.label}</p>
                                    <p className={`text-3xl font-black text-white`}>
                                        {typeof stat.val === 'number' ? formatCurrency(stat.val) : stat.val}
                                    </p>
                                    <div className="inline-flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded text-[10px] font-bold text-green-400">
                                        <i className="fas fa-arrow-up text-[8px]"></i> {stat.diff}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Funnel Chart */}
                    <div className="lg:col-span-8 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8">
                        <h3 className="font-black text-white text-xl tracking-tight mb-8">Lead Funnel Stage</h3>
                        <div className="flex flex-col gap-4">
                            {funnelData.map((stage, i) => (
                                <div key={i} className="relative group">
                                    <div className="flex justify-between items-end mb-2 px-1">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                                            <span className="text-xs font-bold text-white">{stage.label}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-black text-white block">{formatCurrency(stage.value)}</span>
                                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{stage.sub} of Leads</span>
                                        </div>
                                    </div>
                                    <div className="h-10 w-full bg-white/5 rounded-r-2xl relative overflow-hidden">
                                        <div
                                            style={{ width: stage.sub }}
                                            className={`h-full ${stage.color} rounded-r-2xl relative shadow-[5px_0_20px_rgba(0,0,0,0.3)] transition-all duration-1000 ease-out group-hover:brightness-110`}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20"></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Channel Conversion Table */}
                    <div className="lg:col-span-4 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8">
                        <h3 className="font-black text-white text-xl tracking-tight mb-6">Conversion by Channel</h3>
                        <div className="overflow-hidden bg-white/5 rounded-2xl border border-white/5">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black text-white/40 uppercase tracking-widest">
                                        <th className="p-4">Channel</th>
                                        <th className="p-4 text-right">Leads</th>
                                        <th className="p-4 text-right">Paid</th>
                                        <th className="p-4 text-right">Conv %</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-white divide-y divide-white/5">
                                    {channelConversion.map((ch, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className={`p-4 ${ch.color}`}>{ch.channel}</td>
                                            <td className="p-4 text-right">{formatCurrency(ch.leads)}</td>
                                            <td className="p-4 text-right">{formatCurrency(ch.paid)}</td>
                                            <td className="p-4 text-right">{ch.conv}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: Retention & Follow-up (New) */}
            {activeTab === 'retention' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                    {/* KPI Cards */}
                    <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <h4 className="text-xs font-bold text-white/60 mb-2 uppercase tracking-wider"><i className="fas fa-clock text-rose-400 mr-2"></i>Expiring Soon</h4>
                            <p className="text-3xl font-black text-white">{expiringCourses.length} Users</p>
                            <p className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-1 rounded inline-block mt-2">Action Required</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <h4 className="text-xs font-bold text-white/60 mb-2 uppercase tracking-wider"><i className="fas fa-user-minus text-amber-400 mr-2"></i>Churn Risk (&gt;60 Days)</h4>
                            <p className="text-3xl font-black text-white">{rfmSegments['At Risk'].length} Users</p>
                            <p className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-1 rounded inline-block mt-2">+5 from last week</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <h4 className="text-xs font-bold text-white/60 mb-2 uppercase tracking-wider"><i className="fas fa-phone text-blue-400 mr-2"></i>Pending Follow-ups</h4>
                            <p className="text-3xl font-black text-white">{salesTasks.length} Tasks</p>
                            <p className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded inline-block mt-2">Sales Team</p>
                        </div>
                    </div>

                    {/* Alerts Table */}
                    <div className="lg:col-span-12 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <button className="text-sm font-bold text-rose-400 border-b-2 border-rose-500 pb-1">Course Credit Alert</button>
                            <button className="text-sm font-bold text-white/40 hover:text-white pb-1 transition-colors">Churn Risk Alert</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[10px] font-black text-white/40 uppercase tracking-widest border-b border-white/5">
                                        <th className="pb-3 pl-2">Customer</th>
                                        <th className="pb-3">Course</th>
                                        <th className="pb-3">Expiry Date</th>
                                        <th className="pb-3">Days Left</th>
                                        <th className="pb-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-white">
                                    {expiringCourses.map((item, i) => (
                                        <tr key={i} className="group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                                            <td className="py-4 pl-2 text-white">{item.name}</td>
                                            <td className="py-4 text-white/70">{item.course}</td>
                                            <td className="py-4 text-white/50">{item.expiryDate}</td>
                                            <td className="py-4 text-white">{item.daysLeft} Days</td>
                                            <td className="py-4">
                                                <span className={`flex items-center gap-2 ${item.color}`}>
                                                    <div className={`w-2 h-2 rounded-full bg-current`}></div>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Sales To-Do List */}
                    <div className="lg:col-span-12 bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
                        <h3 className="font-black text-white text-xl tracking-tight mb-6 flex items-center gap-2">
                            <i className="fas fa-check-square text-green-500"></i> To-Do List (Sales)
                        </h3>
                        <div className="space-y-1">
                            {salesTasks.map((task, i) => (
                                <div key={i} className="flex justify-between items-center p-4 bg-[#0A1A2F]/30 hover:bg-[#0A1A2F]/50 rounded-xl border border-white/5 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <input type="checkbox" className="w-4 h-4 rounded border-white/20 bg-white/5 text-green-500 focus:ring-green-500/50" />
                                        <div>
                                            <p className="text-sm font-bold text-white group-hover:text-green-400 transition-colors">{task.task} ({task.customer})</p>
                                            <p className="text-[10px] text-white/40">{task.type}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-white">{task.due}</p>
                                        <p className="text-[10px] text-white/40">{task.staff}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 6: Channel ROI Tracker (New) */}
            {activeTab === 'roi' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                    {/* Summary Cards */}
                    <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="p-6 bg-blue-600/10 border border-blue-500/30 rounded-3xl">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Total Ad Spend</p>
                            <p className="text-3xl font-black text-white">฿{formatCurrency(totalAdSpend)}</p>
                        </div>
                        <div className="p-6 bg-emerald-600/10 border border-emerald-500/30 rounded-3xl">
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Total Sales</p>
                            <p className="text-3xl font-black text-white">฿{formatCurrency(totalAdSales)}</p>
                        </div>
                        <div className="p-6 bg-purple-600/10 border border-purple-500/30 rounded-3xl">
                            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">Avg ROAS</p>
                            <p className="text-3xl font-black text-white">{avgROAS}x</p>
                        </div>
                        <div className="p-6 bg-amber-600/10 border border-amber-500/30 rounded-3xl">
                            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">Best Channel</p>
                            <p className="text-3xl font-black text-white">{bestChannel.channel}</p>
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded ml-1">{bestChannel.roas}x ROAS</span>
                        </div>
                    </div>

                    {/* Chart & Table */}
                    <div className="lg:col-span-5 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8">
                        <h3 className="font-black text-white text-xl tracking-tight mb-8">ROAS by Channel</h3>
                        <div className="flex items-end gap-4 h-64 border-l border-b border-white/10 pb-4 pl-4 relative">
                            {/* Y-Axis Lables Mock */}
                            <div className="absolute top-0 left-0 text-[8px] text-white/40">6x</div>
                            <div className="absolute top-1/2 left-0 text-[8px] text-white/40">3x</div>

                            {channelROI.map((ch, i) => {
                                const height = (parseFloat(ch.roas) / 7) * 100; // Max 7x
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center group">
                                        <div className="mb-2 text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">{ch.roas}x</div>
                                        <div style={{ height: `${height}%` }} className={`w-full ${ch.color} rounded-t-lg transition-all group-hover:brightness-110 relative`}></div>
                                        <div className="mt-2 text-[10px] font-bold text-white/40 -rotate-45 origin-left translate-y-2 whitespace-nowrap">{ch.channel}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-7 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8">
                        <h3 className="font-black text-white text-xl tracking-tight mb-8">Revenue vs Ad Spend</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 text-[10px] font-black text-white/40 uppercase tracking-widest">
                                        <th className="p-3 rounded-l-lg">Channel</th>
                                        <th className="p-3 text-right">Ad Spend</th>
                                        <th className="p-3 text-right">Sales</th>
                                        <th className="p-3 text-right">ROAS</th>
                                        <th className="p-3 rounded-r-lg text-right">Profit</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-white divide-y divide-white/5">
                                    {channelROI.map((ch, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4">{ch.channel}</td>
                                            <td className="p-4 text-right text-white/60">{formatCurrency(ch.spend)}</td>
                                            <td className="p-4 text-right">{formatCurrency(ch.sales)}</td>
                                            <td className="p-4 text-right font-black text-[#C9A34E]">{ch.roas}x</td>
                                            <td className="p-4 text-right text-emerald-400">+{formatCurrency(ch.profit)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 7: Event / Openhouse Analytics (New) */}
            {activeTab === 'event' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                    {/* KPI Cards */}
                    <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2"><i className="fas fa-calendar-alt text-rose-500"></i> Events This Month</h4>
                            <p className="text-4xl font-black text-slate-800">{eventStats.count} Events</p>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2"><i className="fas fa-user-friends text-blue-500"></i> Leads from Events</h4>
                            <p className="text-4xl font-black text-slate-800">{eventStats.leads} People</p>
                            <span className="inline-block mt-2 px-2 py-0.5 bg-green-100 text-green-600 text-[10px] font-bold rounded-md">+25%</span>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2"><i className="fas fa-money-bill-wave text-[#C9A34E]"></i> Sales from Events</h4>
                            <p className="text-4xl font-black text-slate-800">฿{formatCurrency(eventStats.sales)}</p>
                        </div>
                    </div>

                    {/* Upcoming Events Table */}
                    <div className="lg:col-span-12 bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8">
                        <h3 className="flex items-center gap-2 font-black text-slate-800 text-xl tracking-tight mb-6">
                            <i className="fas fa-calendar-check text-slate-400"></i> Upcoming Events
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-wider">
                                        <th className="pb-4 pl-2">Event</th>
                                        <th className="pb-4">Date</th>
                                        <th className="pb-4">Location</th>
                                        <th className="pb-4">Status</th>
                                        <th className="pb-4 text-right">Est. Leads</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-bold text-slate-700">
                                    {upcomingEvents.map((evt, i) => (
                                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="py-4 pl-2 flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${evt.dot}`}></div>
                                                {evt.name}
                                            </td>
                                            <td className="py-4 text-slate-500">{evt.date}</td>
                                            <td className="py-4 text-slate-500">{evt.loc}</td>
                                            <td className="py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${evt.color} bg-opacity-10 bg-current`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full bg-current`}></div>
                                                    {evt.status}
                                                </span>
                                            </td>
                                            <td className="py-4 text-right">{evt.leads}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Past Performance */}
                    <div className="lg:col-span-12">
                        <h3 className="flex items-center gap-2 font-black text-slate-800 text-xl tracking-tight mb-6">
                            <i className="fas fa-chart-bar text-green-600"></i> Past Event Performance
                        </h3>
                        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50">
                                    <tr className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                        <th className="p-4 pl-6">Event</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4 text-right">Leads</th>
                                        <th className="p-4 text-right">Registered</th>
                                        <th className="p-4 text-right">Closed</th>
                                        <th className="p-4 text-right pr-6">Sales</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-bold text-slate-700 divide-y divide-slate-100">
                                    {pastEvents.map((evt, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 pl-6 flex items-center gap-2">
                                                <i className="fas fa-tree text-green-500"></i> {evt.name}
                                            </td>
                                            <td className="p-4 text-slate-500">{evt.date}</td>
                                            <td className="p-4 text-right">{evt.leads}</td>
                                            <td className="p-4 text-right">{evt.reg}</td>
                                            <td className="p-4 text-right">{evt.closed}</td>
                                            <td className="p-4 text-right pr-6 font-black text-emerald-600">฿{formatCurrency(evt.sales)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 8: Campaign Tracker (New) */}
            {activeTab === 'campaign' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                    {/* ... (Campaign Tracker content stays the same) ... */}
                    {/* KPI Cards */}
                    <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2"><i className="fas fa-bullhorn text-indigo-500"></i> Active Campaigns</h4>
                            <p className="text-4xl font-black text-slate-800">{campaignStats.active}</p>
                            <span className="text-[10px] text-slate-400 font-bold">Initiatives Running</span>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2"><i className="fas fa-wallet text-slate-600"></i> Total Budget</h4>
                            <p className="text-4xl font-black text-slate-800">฿{formatCurrency(campaignStats.totalBudget)}</p>
                            <span className="text-[10px] text-slate-400 font-bold">Planned Spend</span>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 relative overflow-hidden">
                            <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2"><i className="fas fa-fire text-orange-500"></i> Burn Rate</h4>
                            <p className="text-4xl font-black text-slate-800">{((campaignStats.totalSpend / campaignStats.totalBudget) * 100).toFixed(1)}%</p>
                            <div className="w-full bg-slate-100 h-1 mt-2 rounded-full overflow-hidden">
                                <div style={{ width: `${((campaignStats.totalSpend / campaignStats.totalBudget) * 100)}%` }} className="h-full bg-orange-500 rounded-full"></div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2"><i className="fas fa-sack-dollar text-[#C9A34E]"></i> Revenue Generated</h4>
                            <p className="text-4xl font-black text-slate-800">฿{formatCurrency(campaignStats.totalRevenue)}</p>
                            <span className="text-[10px] text-green-500 font-bold bg-green-50 px-2 py-0.5 rounded">{(campaignStats.totalRevenue / campaignStats.totalSpend).toFixed(2)}x ROAS</span>
                        </div>
                    </div>

                    {/* Detailed Campaign Table */}
                    <div className="lg:col-span-12 bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8">
                        <h3 className="font-black text-slate-800 text-xl tracking-tight mb-6">Campaign Performance</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50">
                                    <tr className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                        <th className="p-4 rounded-l-xl pl-6">Campaign</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Timeline</th>
                                        <th className="p-4 text-right">Spend</th>
                                        <th className="p-4 text-right">Revenue</th>
                                        <th className="p-4 text-right rounded-r-xl pr-6">ROAS</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-bold text-slate-700 divide-y divide-slate-100">
                                    {processedCampaigns.map((c, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 pl-6">
                                                <p className="font-bold text-slate-800">{c.name}</p>
                                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${c.color || 'bg-slate-500'}`}></span>
                                                    {c.platform || 'Facebook'}
                                                </p>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${c.status === 'Active' || c.status === 'ACTIVE' ? 'bg-green-100 text-green-600' :
                                                    c.status === 'Paused' || c.status === 'PAUSED' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-xs text-slate-500">
                                                {c.start || 'N/A'} - {c.end || 'N/A'}
                                            </td>
                                            <td className="p-4 text-right">฿{formatCurrency(c.spend)}</td>
                                            <td className="p-4 text-right">฿{formatCurrency(c.revenue)}</td>
                                            <td className="p-4 text-right pr-6">
                                                <span className={`text-[#C9A34E] font-black hover:underline decoration-dashed decoration-slate-300 underline-offset-4 cursor-help`} title="Return on Ad Spend">
                                                    {c.roas}x
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 9: Sales Team Performance (New) */}
            {activeTab === 'team' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                    <div className="lg:col-span-12 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="font-black text-white text-xl tracking-tight mb-2">Sales Team Performance</h3>
                                <p className="text-xs text-white/40">Revenue contribution by assigned agent.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {/* Calculate Agent Stats */}
                            {(() => {
                                const agentStats = {};
                                customers.forEach(c => {
                                    const agent = c.profile?.agent || 'Unassigned';
                                    if (!agentStats[agent]) agentStats[agent] = { name: agent, revenue: 0, leads: 0, customers: 0 };

                                    agentStats[agent].leads++;
                                    const spend = c.intelligence?.metrics?.total_spend || 0;
                                    agentStats[agent].revenue += spend;
                                    if (spend > 0) agentStats[agent].customers++;
                                });

                                const topAgents = Object.values(agentStats).sort((a, b) => b.revenue - a.revenue);

                                return topAgents.map((agent, i) => (
                                    <div key={i} className="bg-white/5 border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:bg-white/10 transition-all">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 text-white">
                                            <i className="fas fa-trophy text-6xl"></i>
                                        </div>

                                        <div className="relative z-10">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shadow-lg ${i === 0 ? 'bg-gradient-to-br from-[#C9A34E] to-amber-600 text-[#0A1A2F]' :
                                                    i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800' :
                                                        'bg-white/10 text-white'
                                                    }`}>
                                                    {agent.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-black text-white text-lg">{agent.name}</p>
                                                    <p className="text-[10px] text-white/40 uppercase tracking-widest">{i === 0 ? 'Top Performer' : 'Sales Agent'}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-white/60">Revenue</span>
                                                    <span className="text-lg font-black text-[#C9A34E]">฿{formatCurrency(agent.revenue)}</span>
                                                </div>
                                                <div className="h-px w-full bg-white/5"></div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-white/60">Conversion Rate</span>
                                                    <span className="text-xs font-bold text-white">
                                                        {agent.leads > 0 ? ((agent.customers / agent.leads) * 100).toFixed(1) : 0}%
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-white/60">Leads Managed</span>
                                                    <span className="text-xs font-bold text-white">{agent.leads}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>

                    {/* Ad-Product Attribution Table */}
                    <div className="lg:col-span-12 bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8">
                        <h3 className="font-black text-slate-800 text-xl tracking-tight mb-6 flex items-center gap-2">
                            <i className="fas fa-tags text-indigo-500"></i> Product x Ad Attribution
                        </h3>
                        <p className="text-sm text-slate-500 mb-6">See which ads are selling which products.</p>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50">
                                    <tr className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                        <th className="p-4 pl-6 rounded-l-xl">Product Name</th>
                                        <th className="p-4">Top Source (Ad/Campaign)</th>
                                        <th className="p-4 text-right">Units Sold</th>
                                        <th className="p-4 text-right rounded-r-xl pr-6">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-bold text-slate-700 divide-y divide-slate-100">
                                    {(() => {
                                        // Attribution Logic
                                        const productAttribution = {};

                                        customers.forEach(c => {
                                            const source = c.intelligence?.attribution?.source || 'Organic/Direct';
                                            (c.timeline || []).forEach(evt => {
                                                if (evt.type === 'ORDER' || evt.type === 'PURCHASE') {
                                                    const items = evt.details?.items || [];
                                                    const amount = evt.details?.total || 0; // Approximate per order

                                                    items.forEach(item => {
                                                        const cleanName = item.split(' (')[0];
                                                        if (!productAttribution[cleanName]) {
                                                            productAttribution[cleanName] = {
                                                                name: cleanName,
                                                                totalUnits: 0,
                                                                totalRevenue: 0,
                                                                sources: {}
                                                            };
                                                        }
                                                        productAttribution[cleanName].totalUnits += 1;
                                                        // Distribute revenue evenly among items if multiple (rough estimate)
                                                        productAttribution[cleanName].totalRevenue += (amount / items.length);

                                                        if (!productAttribution[cleanName].sources[source]) {
                                                            productAttribution[cleanName].sources[source] = 0;
                                                        }
                                                        productAttribution[cleanName].sources[source]++;
                                                    });
                                                }
                                            });
                                        });

                                        return Object.values(productAttribution)
                                            .sort((a, b) => b.totalRevenue - a.totalRevenue)
                                            .map((prod, i) => {
                                                // Find top source
                                                const topSource = Object.entries(prod.sources).sort((a, b) => b[1] - a[1])[0];

                                                return (
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-4 pl-6 font-bold text-slate-800">{prod.name}</td>
                                                        <td className="p-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-indigo-600 font-bold">{topSource ? topSource[0] : 'N/A'}</span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    {topSource ? `${Math.round((topSource[1] / prod.totalUnits) * 100)}% of sales` : ''}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-right">{prod.totalUnits}</td>
                                                        <td className="p-4 text-right pr-6 font-black text-emerald-600">฿{formatCurrency(prod.totalRevenue)}</td>
                                                    </tr>
                                                );
                                            });
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 9: Mapping Matrix (New) */}
            {activeTab === 'mapping' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                    <div className="lg:col-span-12 bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="font-black text-white text-xl tracking-tight leading-none mb-2">Ad-to-Course Mapping Matrix</h3>
                                <p className="text-[10px] font-black text-[#C9A34E] uppercase tracking-widest">DEFINITIVE PRODUCT ATTRIBUTION</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleAiAutoMap}
                                    className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors"
                                >
                                    <i className="fas fa-magic mr-2"></i> AI Auto-Map
                                </button>
                                <button className="bg-[#C9A34E] hover:bg-amber-400 text-[#0A1A2F] text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors">
                                    Add New Mapping
                                </button>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* Campaign Mappings Row */}
                            <div>
                                <h4 className="text-sm font-black text-white/60 uppercase tracking-widest mb-4 border-l-4 border-[#C9A34E] pl-3">Campaign Mappings</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {(adMapping.campaign_mappings || []).map((m, i) => (
                                        <div key={i} className="bg-white/5 border border-white/10 p-5 rounded-2xl relative group overflow-hidden">
                                            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="text-white/40 hover:text-white mr-2"><i className="fas fa-edit"></i></button>
                                                <button className="text-white/40 hover:text-rose-400"><i className="fas fa-trash"></i></button>
                                            </div>
                                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Campaign</p>
                                            <p className="text-sm font-bold text-white mb-4 truncate">{m.campaign_name}</p>
                                            <div className="p-3 bg-black/40 rounded-xl border border-[#C9A34E]/30">
                                                <p className="text-[9px] font-black text-[#C9A34E] uppercase tracking-widest mb-1">Maps To Product</p>
                                                <p className="text-xs font-bold text-white truncate">{m.product_name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Ad Mappings Row */}
                            <div>
                                <h4 className="text-sm font-black text-white/60 uppercase tracking-widest mb-4 border-l-4 border-blue-500 pl-3">Specific Ad Mappings</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {(adMapping.ad_mappings || []).map((m, i) => (
                                        <div key={i} className="bg-white/5 border border-white/10 p-5 rounded-2xl relative group">
                                            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="text-white/40 hover:text-white mr-2"><i className="fas fa-edit"></i></button>
                                                <button className="text-white/40 hover:text-rose-400"><i className="fas fa-trash"></i></button>
                                            </div>
                                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Ad Creative</p>
                                            <p className="text-sm font-bold text-white mb-4 truncate">{m.ad_name}</p>
                                            <div className="p-3 bg-black/40 rounded-xl border border-blue-500/30">
                                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Maps To Product</p>
                                                <p className="text-xs font-bold text-white truncate">{m.product_name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Recommendation Card */}
                        <div className="mt-12 p-6 bg-gradient-to-r from-[#C9A34E]/10 to-transparent border border-[#C9A34E]/20 rounded-3xl">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-[#C9A34E]/20 rounded-2xl text-[#C9A34E]">
                                    <i className="fas fa-lightbulb text-xl"></i>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-black text-white text-lg tracking-tight mb-1">Why use Mapping Matrix?</h4>
                                    <p className="text-sm text-white/60 leading-relaxed max-w-2xl">
                                        Facebook campaign names often don't match your catalog exactly. By mapping them here, we ensure your
                                        <strong> Best Seller rankings</strong>, <strong>Inventory planning</strong>, and <strong>Campaign ROI</strong>
                                        are based on actual products, not just campaign aliases.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const formatCurrency = (value, options = {}) => {
    return new Intl.NumberFormat('th-TH', {
        ...options
    }).format(value);
};
