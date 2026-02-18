'use client';

import { useState, useRef, useEffect } from 'react';

export default function SlipVerificationModal({ isOpen, onClose, onVerifySuccess }) {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, processing, success, error
    const [preview, setPreview] = useState(null);
    const [extractedData, setExtractedData] = useState(null);
    const fileInputRef = useRef(null);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setStatus('idle');
            setPreview(null);
            setExtractedData(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            processFile(selectedFile);
        }
    };

    const processFile = (selectedFile) => {
        setFile(selectedFile);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result);
            handleVerify(selectedFile);
        };
        reader.readAsDataURL(selectedFile);
    };

    const handleVerify = async (selectedFile) => {
        setStatus('processing');

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const response = await fetch('/api/verify-slip', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setExtractedData(result.data);
                setStatus('success');
            } else {
                console.error('Verification failed:', result.error);
                setStatus('error');
                alert(result.error || 'การตรวจสอบสลิปล้มเหลว กรุณาลองใหม่อีกครั้ง');
            }
        } catch (error) {
            console.error('Verify error:', error);
            setStatus('error');
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อระบบตรวจสอบสลิป');
        }
    };

    const handleConfirm = () => {
        if (extractedData) {
            onVerifySuccess(extractedData);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-[#0A1A2F]/80 backdrop-blur-md" onClick={onClose}></div>

            <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-up border border-white/20">
                {/* Header */}
                <div className="bg-[#0A1A2F] p-8 text-white relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A34E]/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                    <div className="flex justify-between items-center relative z-10">
                        <div>
                            <p className="text-[#C9A34E] text-[10px] font-black uppercase tracking-[0.3em] mb-1">FINANCIAL PORTAL</p>
                            <h2 className="text-2xl font-black tracking-tight">Slip Verification</h2>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <div className="p-8">
                    {status === 'idle' && (
                        <div
                            onClick={() => fileInputRef.current.click()}
                            className="border-2 border-dashed border-slate-200 rounded-[2rem] p-12 flex flex-col items-center justify-center gap-4 hover:border-[#C9A34E] hover:bg-slate-50 transition-all cursor-pointer group"
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                <i className="fas fa-cloud-upload-alt text-3xl text-slate-400 group-hover:text-[#C9A34E]"></i>
                            </div>
                            <div className="text-center">
                                <p className="text-slate-900 font-black text-lg">Upload Transfer Slip</p>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">PNG, JPG, or PDF up to 10MB</p>
                            </div>
                        </div>
                    )}

                    {status === 'processing' && (
                        <div className="py-12 flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                                <div className="w-24 h-24 border-4 border-slate-100 rounded-full"></div>
                                <div className="absolute inset-0 w-24 h-24 border-4 border-[#C9A34E] rounded-full border-t-transparent animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <i className="fas fa-shield-alt text-2xl text-[#C9A34E] animate-pulse"></i>
                                </div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-black text-[#0A1A2F] mb-1">Verifying Slip...</h3>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Cross-referencing with bank records</p>
                            </div>
                        </div>
                    )}

                    {status === 'success' && extractedData && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 bg-green-50 rounded-2xl border border-green-100">
                                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-200">
                                    <i className="fas fa-check-double text-xl"></i>
                                </div>
                                <div>
                                    <p className="text-green-700 font-black text-sm">Transfer Verified</p>
                                    <p className="text-green-600/70 text-[10px] font-bold uppercase tracking-widest">Authenticity Confirmed</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount</p>
                                    <p className="text-xl font-black text-[#0A1A2F]">฿{extractedData.amount.toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank</p>
                                    <p className="text-sm font-black text-[#0A1A2F]">{extractedData.bank}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date/Time</p>
                                    <p className="text-[11px] font-black text-[#0A1A2F]">{extractedData.date} • {extractedData.time}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Transaction ID</p>
                                    <p className="text-[11px] font-mono font-bold text-[#0A1A2F]">{extractedData.transaction_id}</p>
                                </div>
                            </div>

                            <button
                                onClick={handleConfirm}
                                className="w-full bg-[#0A1A2F] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-transform active:scale-95"
                            >
                                CONFIRM TOP UP
                            </button>
                        </div>
                    )}
                </div>

                <div className="px-8 pb-8 text-center">
                    <p className="text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">SECURED BY V-PAYMENT GATEWAY</p>
                </div>
            </div>
        </div>
    );
}
