'use client';

import { useState } from 'react';

export default function LoginPage({ onLogin, employees, error }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const result = await res.json();

            if (result.success) {
                onLogin(result.user);
            } else {
                onLogin(null); // Triggers error handling in parent
            }
        } catch (err) {
            console.error('Login error:', err);
            onLogin(null);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A1A2F] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#C9A34E]/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo & Header */}
                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-[#C9A34E] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#C9A34E]/20">
                        <span className="text-[#0A1A2F] font-black text-3xl">V</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">V SCHOOL</h1>
                    <p className="text-white/40 text-sm font-bold uppercase tracking-[0.2em]">Customer 360 CRM</p>
                </div>

                {/* Login Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                    <div className="mb-8">
                        <h2 className="text-xl font-black text-white mb-2">Welcome Back</h2>
                        <p className="text-white/40 text-sm">Sign in to access the dashboard</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6">
                            <p className="text-red-400 text-sm font-bold flex items-center gap-2">
                                <i className="fas fa-exclamation-circle"></i>
                                {error}
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <i className="fas fa-envelope text-white/20"></i>
                                </div>
                                <input
                                    required
                                    type="email"
                                    placeholder="you@vschool.co.th"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white font-bold placeholder:text-white/20 outline-none focus:border-[#C9A34E]/50 focus:ring-2 focus:ring-[#C9A34E]/20 transition-all"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <i className="fas fa-lock text-white/20"></i>
                                </div>
                                <input
                                    required
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white font-bold placeholder:text-white/20 outline-none focus:border-[#C9A34E]/50 focus:ring-2 focus:ring-[#C9A34E]/20 transition-all"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-[#C9A34E] text-[#0A1A2F] py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-[#C9A34E]/20 hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <i className="fas fa-spinner animate-spin"></i>
                                    Signing In...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-sign-in-alt"></i>
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest">Demo Credentials</p>
                        <p className="text-white/40 text-xs mt-2">admin@vschool.co.th / admin123</p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-white/20 text-[10px] font-bold uppercase tracking-widest mt-8">
                    © 2026 V School • Powered by Data Hub
                </p>
            </div>
        </div>
    );
}
