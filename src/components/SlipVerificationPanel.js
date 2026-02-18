'use client';
import { useState, useEffect } from 'react';

export default function SlipVerificationPanel({ orders, onVerify, onReject }) {
    const [verifyingId, setVerifyingId] = useState(null);
    const [scanProgress, setScanProgress] = useState(0);
    const [detectedData, setDetectedData] = useState(null);

    const pendingOrders = orders.filter(o => o.inventory_status === 'Pending Verification');

    const startScan = (order) => {
        setVerifyingId(order.id);
        setScanProgress(0);
        setDetectedData(null);

        // Simulate Scanning Process
        const interval = setInterval(() => {
            setScanProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    // Mock OCR Detected Data
                    setTimeout(() => {
                        setDetectedData({
                            ref_no: order.reference_no || 'REF-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                            amount: order.total_amount,
                            recipient: "V School Thailand",
                            status: "VALID_MATCH"
                        });
                    }, 500);
                    return 100;
                }
                return prev + 5;
            });
        }, 100);
    };

    if (pendingOrders.length === 0) {
        return (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-check-double text-3xl text-green-500"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Queue Clear!</h3>
                <p className="text-slate-500 max-w-xs mx-auto">All bank transfer slips have been verified. Excellent work!</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Slip Verification Queue</h2>
                    <p className="text-slate-500 text-sm">Reviewing {pendingOrders.length} pending transfers</p>
                </div>
                <div className="bg-orange-100 px-4 py-2 rounded-full border border-orange-200 animate-pulse">
                    <span className="text-[10px] font-black text-orange-700 uppercase tracking-widest">Action Required</span>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {pendingOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row h-full group hover:shadow-xl transition-all duration-500">
                        {/* 1. Slip Image & Scanning Overlay */}
                        <div className="md:w-64 bg-slate-900 relative overflow-hidden group">
                            <img
                                src={order.slip_url || "https://upload.wikimedia.org/wikipedia/commons/e/e1/Thai_Bank_Transfer_Slip_Example.jpg"}
                                alt="Payment Slip"
                                className={`w-full h-full object-cover opacity-60 transition-all duration-700 ${verifyingId === order.id ? 'blur-sm scale-110' : 'group-hover:opacity-80'}`}
                            />

                            {/* Scanning Animation */}
                            {verifyingId === order.id && scanProgress < 100 && (
                                <div className="absolute inset-0 z-10">
                                    <div
                                        className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_20px_#22d3ee] animate-scan-y"
                                        style={{ top: `${scanProgress}%` }}
                                    ></div>

                                    {/* QR Finder Box */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-cyan-400/50 rounded-lg flex items-center justify-center">
                                        <div className="absolute inset-0 border-t-4 border-l-4 border-cyan-400 w-4 h-4 rounded-tl-sm"></div>
                                        <div className="absolute top-0 right-0 border-t-4 border-r-4 border-cyan-400 w-4 h-4 rounded-tr-sm"></div>
                                        <div className="absolute bottom-0 left-0 border-b-4 border-l-4 border-cyan-400 w-4 h-4 rounded-bl-sm"></div>
                                        <div className="absolute bottom-0 right-0 border-b-4 border-r-4 border-cyan-400 w-4 h-4 rounded-br-sm"></div>
                                        <i className="fas fa-qrcode text-cyan-400/30 text-4xl animate-pulse"></i>
                                    </div>

                                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-8">
                                        <div className="text-center">
                                            <p className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">QR Detected & Scanning...</p>
                                            <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden mx-auto">
                                                <div
                                                    className="h-full bg-cyan-400 transition-all duration-300"
                                                    style={{ width: `${scanProgress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Detected Info Overlays (Post-Scan) */}
                            {verifyingId === order.id && detectedData && (
                                <div className="absolute inset-0 z-20 bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in flex flex-col justify-center gap-3">
                                    <div className="bg-white/10 border border-white/20 p-3 rounded-2xl">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-[8px] text-cyan-300 font-black uppercase tracking-widest">QR Reference</p>
                                            <i className="fas fa-check-circle text-green-400 text-[10px]"></i>
                                        </div>
                                        <p className="text-xs font-mono text-white truncate">{detectedData.ref_no}</p>
                                    </div>
                                    <div className="bg-white/10 border border-white/20 p-3 rounded-2xl">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-[8px] text-cyan-300 font-black uppercase tracking-widest">Bank Amount</p>
                                            <i className="fas fa-check-circle text-green-400 text-[10px]"></i>
                                        </div>
                                        <p className="text-xl font-black text-white">฿{detectedData.amount.toLocaleString()}</p>
                                    </div>
                                    <div className="mt-2 bg-green-500 text-white px-3 py-1.5 rounded-xl flex items-center justify-center gap-2">
                                        <i className="fas fa-shield-alt text-[10px]"></i>
                                        <span className="text-[9px] font-black uppercase tracking-widest">Security Authenticated</span>
                                    </div>
                                </div>
                            )}

                            {!verifyingId && (
                                <button
                                    onClick={() => startScan(order)}
                                    className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-6 py-2 rounded-full font-black text-[10px] shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 flex items-center gap-2 hover:bg-orange-500 hover:text-white"
                                >
                                    <i className="fas fa-robot text-xs"></i>
                                    START AI SCAN
                                </button>
                            )}
                        </div>

                        {/* 2. Order Information Content */}
                        <div className="flex-1 p-6 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</p>
                                        <h4 className="font-bold text-slate-800">{order.customer_name || "Unknown"}</h4>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order ID</p>
                                        <p className="text-xs font-mono text-slate-600">#{order.id.split('-').pop()}</p>
                                    </div>
                                </div>

                                <div className="space-y-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-600 shadow-sm">
                                            <i className="fas fa-shopping-basket"></i>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase Total</p>
                                            <p className="text-lg font-black text-slate-800 leading-none">฿{order.total_amount.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {order.items?.map((item, i) => (
                                            <span key={i} className="bg-white px-3 py-1 rounded-full text-[10px] font-bold text-slate-600 border border-slate-200">
                                                {item.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-50">
                                <button
                                    onClick={() => onVerify(order.id, detectedData)}
                                    className={`flex-1 py-3 rounded-2xl font-black text-[10px] tracking-widest transition-all ${detectedData && verifyingId === order.id
                                        ? 'bg-gradient-to-tr from-green-600 to-emerald-500 text-white shadow-lg shadow-green-500/20 hover:-translate-y-1'
                                        : 'bg-slate-100 text-slate-300 pointer-events-none'}`}
                                >
                                    APPROVE & ACTIVATE
                                </button>
                                <button
                                    onClick={() => onReject(order.id)}
                                    className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all group/reject"
                                >
                                    <i className="fas fa-times group-hover/reject:rotate-90 transition-transform"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <style jsx>{`
                @keyframes scan-y {
                    0% { top: 0; }
                    100% { top: 100%; }
                }
                .animate-scan-y {
                    animation: scan-y 2s linear infinite;
                }
                .animate-fade-in {
                    animation: fadeIn 0.5s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
