'use client';

import { useState, useRef, useEffect } from 'react';

export default function AskAIButton({ context, icon = 'fa-sparkles', size = 'sm', className = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPopover, setShowPopover] = useState(false);
    const popoverRef = useRef(null);

    // Close popover when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setShowPopover(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAsk = async (e) => {
        e.preventDefault();
        if (!question.trim()) return;

        setLoading(true);
        setAnswer('');

        try {
            // Construct contextual prompt
            const contextString = `[CONTEXT]
Item: ${context.label}
Value: ${context.value}
Related Data: ${JSON.stringify(context.data || {})}
            `;

            const fullQuestion = `${contextString}\n\nUSER QUESTION: ${question}`;

            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: fullQuestion,
                    history: [] // No history for single-shot contextual ask for now
                })
            });

            const data = await res.json();
            if (data.success) {
                setAnswer(data.answer);
            } else {
                setAnswer('Sorry, I encountered an error analyzing this data.');
            }
        } catch (error) {
            console.error('AI Ask Error:', error);
            setAnswer('Failed to connect to AI service.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`relative inline-block ${className}`} ref={popoverRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setShowPopover(!showPopover)}
                className={`text-[#C9A34E] hover:text-[#E0C06E] transition-colors ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}
                title="Ask AI about this"
            >
                <i className={`fas ${icon}`}></i>
            </button>

            {/* Popover */}
            {showPopover && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-[#0A1A2F] border border-white/10 rounded-xl shadow-2xl p-4 animate-fade-in-up">
                    {/* Arrow */}
                    <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0A1A2F] border-b border-l border-white/10 transform -rotate-45"></div>

                    {/* Header */}
                    <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
                        <i className="fas fa-robot text-[#C9A34E]"></i>
                        <span className="text-xs font-bold text-white">AI Context: {context.label}</span>
                    </div>

                    {/* Content */}
                    {!answer ? (
                        <form onSubmit={handleAsk}>
                            <div className="mb-2 text-[10px] text-white/50 bg-white/5 p-2 rounded">
                                Value: <span className="text-white">{context.value}</span>
                            </div>
                            <textarea
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                placeholder="Ask about this metric..."
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-xs text-white placeholder-white/20 mb-2 focus:outline-none focus:border-[#C9A34E]/50 resize-none h-20"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={loading || !question.trim()}
                                className="w-full bg-[#C9A34E] text-black text-xs font-bold py-1.5 rounded-lg hover:bg-[#E0C06E] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                            >
                                {loading && <i className="fas fa-spinner fa-spin"></i>}
                                {loading ? 'Analyzing...' : 'Ask AI'}
                            </button>
                        </form>
                    ) : (
                        <div>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar text-xs text-white/80 leading-relaxed mb-3">
                                {answer}
                            </div>
                            <button
                                onClick={() => { setAnswer(''); setQuestion(''); }}
                                className="text-[10px] text-[#C9A34E] hover:underline w-full text-center"
                            >
                                Ask another question
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
