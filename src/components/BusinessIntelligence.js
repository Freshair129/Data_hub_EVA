'use client';

import React, { useState, useEffect } from 'react';

export default function BusinessIntelligence() {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [chatHistory, setChatHistory] = useState([
        { role: 'assistant', content: 'สวัสดีครับ ผมคือ V-Insight Business Brain ผู้ช่วยวิเคราะห์ธุรกิจของคุณ วันนี้อยากทราบข้อมูลด้านไหนเป็นพิเศษไหมครับ?' }
    ]);
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        fetchAnalysis();
    }, []);

    const fetchAnalysis = async () => {
        try {
            const res = await fetch('/api/ai/analyze');
            const data = await res.json();
            if (data.success) {
                setAnalysis(data.data);
            }
        } catch (error) {
            console.error('Failed to load analysis:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAskQuestion = async (question) => {
        const newHistory = [...chatHistory, { role: 'user', content: question }];
        setChatHistory(newHistory);
        setIsTyping(true);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question,
                    history: chatHistory.filter(msg => msg.role !== 'system') // Filter out any internal system roles if needed
                })
            });
            const data = await res.json();

            if (data.success) {
                setChatHistory([...newHistory, { role: 'assistant', content: data.answer }]);
            } else {
                setChatHistory([...newHistory, { role: 'assistant', content: 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่ครับ' }]);
            }
        } catch (error) {
            console.error('Chat failed:', error);
            setChatHistory([...newHistory, { role: 'assistant', content: 'เกิดข้อผิดพลาดในการเชื่อมต่อครับ' }]);
        } finally {
            setIsTyping(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <div className="w-16 h-16 border-4 border-[#C9A34E] border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-white/40 font-black uppercase tracking-widest">Analyzing System Data...</p>
            </div>
        );
    }

    if (!analysis) return null;

    return (
        <div className="animate-fade-in space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#C9A34E] to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/20">
                    <i className="fas fa-brain text-white text-4xl"></i>
                </div>
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">V-Insight Business Brain</h2>
                    <p className="text-white/40 text-sm font-bold uppercase tracking-[0.2em]">Strategic AI Advisor</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Metrics & Alerts */}
                <div className="lg:col-span-8 space-y-8">

                    {/* Executive Summary */}
                    <div className="grid grid-cols-3 gap-6">
                        <div className="bg-[#162A47]/80 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem]">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Health Score</p>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black text-white">{analysis.executiveSummary.healthScore}</span>
                                <span className="text-xs font-bold text-slate-500 mb-1">/ 100</span>
                            </div>
                        </div>
                        <div className="bg-[#162A47]/80 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem]">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Sentiment</p>
                            <p className={`text-2xl font-black ${analysis.executiveSummary.sentiment === 'Positive' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {analysis.executiveSummary.sentiment}
                            </p>
                        </div>
                        <div className="bg-[#162A47]/80 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem]">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Primary KPI</p>
                            <p className="text-2xl font-black text-[#C9A34E]">{analysis.executiveSummary.keyMetric}</p>
                        </div>
                    </div>

                    {/* Opportunity Radar */}
                    <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-white/10 p-8 rounded-[2.5rem] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        <h3 className="font-black text-white text-xl mb-6 flex items-center gap-3 relative z-10">
                            <i className="fas fa-crosshairs text-emerald-500"></i> Opportunity Radar
                        </h3>
                        <div className="space-y-4 relative z-10">
                            {analysis.opportunities.map((opp, i) => (
                                <div key={i} className="bg-white/5 border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-colors cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-black text-xs">
                                            {opp.score}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{opp.type}</p>
                                            <p className="text-xs text-slate-400">{opp.message}</p>
                                        </div>
                                    </div>
                                    <button className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                        {opp.action}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Risk Alerts */}
                    <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-white/10 p-8 rounded-[2.5rem] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        <h3 className="font-black text-white text-xl mb-6 flex items-center gap-3 relative z-10">
                            <i className="fas fa-shield-alt text-rose-500"></i> Risk Detection
                        </h3>
                        <div className="space-y-4 relative z-10">
                            {analysis.risks.length > 0 ? analysis.risks.map((risk, i) => (
                                <div key={i} className="bg-white/5 border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-500">
                                            <i className="fas fa-exclamation-triangle"></i>
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{risk.type} Alert</p>
                                            <p className="text-xs text-slate-400">{risk.message}</p>
                                        </div>
                                    </div>
                                    <button className="px-4 py-2 bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-lg border border-white/10 hover:bg-rose-500 hover:border-rose-500 transition-colors">
                                        Action
                                    </button>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-slate-500 font-bold text-sm">
                                    No critical risks detected at this time.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Chat Interface */}
                <div className="lg:col-span-4 flex flex-col h-[600px] bg-[#0A1A2F]/50 border border-white/10 rounded-[2.5rem] overflow-hidden sticky top-24">
                    <div className="p-6 border-b border-white/5 bg-[#0A1A2F]">
                        <h3 className="font-black text-white text-lg flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live Analyst
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${msg.role === 'user'
                                    ? 'bg-[#C9A34E] text-[#0A1A2F] rounded-br-none'
                                    : 'bg-white/10 text-slate-200 rounded-bl-none'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white/10 text-slate-200 p-4 rounded-2xl rounded-bl-none flex gap-1">
                                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></span>
                                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce delay-100"></span>
                                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce delay-200"></span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-[#0A1A2F] border-t border-white/5">
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <button onClick={() => handleAskQuestion('ภาพรวมกำไรเป็นอย่างไร?')} className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 py-2 rounded-lg transition-colors text-left px-3">
                                💰 ภาพรวมกำไร
                            </button>
                            <button onClick={() => handleAskQuestion('มีอะไรต้องระวังไหม?')} className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 py-2 rounded-lg transition-colors text-left px-3">
                                ⚠️ ความเสี่ยงวันนี้
                            </button>
                            <button onClick={() => handleAskQuestion('สินค้าตัวไหนขายดี?')} className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 py-2 rounded-lg transition-colors text-left px-3">
                                🏆 สินค้าขายดี
                            </button>
                            <button onClick={() => handleAskQuestion('แนะนำกลยุทธ์หน่อย')} className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 py-2 rounded-lg transition-colors text-left px-3">
                                🚀 ขอคำแนะนำ
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="ถามคำถามเกี่ยวกับธุรกิจ..."
                                className="w-full bg-[#162A47] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#C9A34E] placeholder:text-slate-600"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleAskQuestion(e.target.value);
                                        e.target.value = '';
                                    }
                                }}
                            />
                            <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-[#C9A34E] rounded-lg text-[#0A1A2F] shadow-lg hover:scale-110 transition-transform">
                                <i className="fas fa-paper-plane text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
