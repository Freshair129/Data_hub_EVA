'use client';

import { useState, useEffect } from 'react';

export default function ProductModal({ product, allProducts, activeCustomer, onClose, onAddToCart, isOpen }) {
    const [fullData, setFullData] = useState(null);
    const [mainImage, setMainImage] = useState('');
    const [loading, setLoading] = useState(true);

    // Configuration State
    const [selectedFreeCourses, setSelectedFreeCourses] = useState([]);

    useEffect(() => {
        if (product) {
            loadProductDetails();
        }
    }, [product]);

    if (!isOpen || !product) return null;

    async function loadProductDetails() {
        setLoading(true);
        try {
            const folder = product.type === 'bundle' ? 'packages' : 'courses';
            const filename = product.id;

            const res = await fetch(`/data/products/${folder}/${filename}.json`);
            if (res.ok) {
                const data = await res.json();
                setFullData(data);
                setMainImage(data.images?.[0] || product.image || '');

                // Initialize default selections if needed
                if (data.free_courses_selection) {
                    setSelectedFreeCourses([]);
                }
            }
        } catch (e) {
            console.error('Failed to load product details', e);
        }
        setLoading(false);
    }

    const images = fullData?.images || [product.image].filter(Boolean);
    const metadata = fullData?.metadata || {};

    // Helper to find product details
    const getProductDetails = (id) => allProducts?.find(p => p.id === id) || { name: 'Unknown Course', id };

    const handleSelectFree = (courseId) => {
        const max = fullData.free_courses_selection.amount;
        if (selectedFreeCourses.includes(courseId)) {
            setSelectedFreeCourses(selectedFreeCourses.filter(id => id !== courseId));
        } else {
            if (selectedFreeCourses.length < max) {
                setSelectedFreeCourses([...selectedFreeCourses, courseId]);
            } else {
                // Replace the first one if full (optional UX choices)
                alert(`You can only select ${max} free course(s).`);
            }
        }
    };

    const isReadyToCart = () => {
        if (fullData?.free_courses_selection) {
            return selectedFreeCourses.length === fullData.free_courses_selection.amount;
        }
        return true;
    };

    const handleAddToCart = () => {
        const isActuallyBundle = product.type === 'bundle' || product.type === 'package';
        const finalProduct = {
            ...product, // Basic catalog info (name, id, type, price)
            ...fullData, // Detailed info (courses, free_courses, configuration)
            type: isActuallyBundle ? 'bundle' : product.type, // Maintain correct type
            selectedFreeCourses: selectedFreeCourses, // User selections
        };
        onAddToCart(finalProduct);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4 md:p-6"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl w-full max-w-2xl max-h-full flex flex-col shadow-2xl animate-scale-up overflow-hidden relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Header / Title Bar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-20 shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 line-clamp-1">{product.name}</h2>
                        <div className="flex items-center gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded font-bold uppercase ${product.type === 'bundle' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                                {product.type === 'bundle' ? 'Package' : 'Course'}
                            </span>
                            <span className="text-slate-400">|</span>
                            <span className="font-bold text-orange-600">฿{(product.price || 0).toLocaleString()}</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Hero Image */}
                    <div className="relative aspect-video bg-slate-100">
                        <img
                            src={mainImage || 'https://via.placeholder.com/800x400'}
                            alt={product.name}
                            className="w-full h-full object-cover"
                        />
                        {/* Thumbnails Overlay */}
                        {images.length > 1 && (
                            <div className="absolute bottom-4 left-4 flex gap-2">
                                {images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setMainImage(img)}
                                        className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shadow-lg ${mainImage === img ? 'border-orange-500' : 'border-white hover:border-slate-300'
                                            }`}
                                    >
                                        <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-6 space-y-8 pb-32">
                        {/* Description */}
                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">About this Item</h3>
                            <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-line">
                                {loading ? 'Loading details...' : (fullData?.description || 'No description available.')}
                            </p>
                        </div>

                        {/* 1. Standard Courses (Fixed) */}
                        {fullData?.courses && (
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <i className="fas fa-box text-slate-400"></i>
                                    Core Curriculum (Fixed)
                                </h3>
                                <div className="space-y-3">
                                    {fullData.courses.map((courseId, idx) => {
                                        const currentCourse = getProductDetails(courseId);

                                        return (
                                            <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-white rounded-lg overflow-hidden shrink-0 border border-slate-200">
                                                        <img src={currentCourse.image} alt={currentCourse.name} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-700 text-sm">{currentCourse.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-xs text-slate-400">Standard Course</p>
                                                            <span className="text-[10px] text-slate-300">•</span>
                                                            <p className="text-xs text-orange-600 font-bold">Value: ฿{currentCourse.price?.toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">
                                                    INCLUDED
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 2. Free Course Selection (Configurable) */}
                        {fullData?.free_courses_selection && (
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-200 shadow-inner">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-black text-amber-900 uppercase tracking-widest flex items-center gap-2">
                                        <i className="fas fa-hand-pointer text-amber-600 animate-bounce-short"></i>
                                        Select Your Free Bonus
                                    </h3>
                                    <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full shadow-sm border border-amber-200">
                                        Choose {selectedFreeCourses.length} of {fullData.free_courses_selection.amount}
                                    </span>
                                </div>

                                <div className="grid gap-3">
                                    {fullData.free_courses_selection.options.map((courseId) => {
                                        const course = getProductDetails(courseId);
                                        const isSelected = selectedFreeCourses.includes(courseId);

                                        return (
                                            <div
                                                key={courseId}
                                                onClick={() => handleSelectFree(courseId)}
                                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-4 group relative overflow-hidden ${isSelected
                                                    ? 'border-amber-500 bg-white shadow-lg shadow-amber-100 ring-4 ring-amber-500/10'
                                                    : 'border-white bg-white/60 hover:bg-white hover:border-amber-300 hover:shadow-md'
                                                    }`}
                                            >
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 bg-white'
                                                    }`}>
                                                    {isSelected && <i className="fas fa-check text-[10px]"></i>}
                                                </div>
                                                <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden shrink-0 border border-slate-100">
                                                    <img src={course.image} alt={course.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-bold text-sm truncate ${isSelected ? 'text-amber-900' : 'text-slate-700'}`}>{course.name}</p>
                                                    <p className="text-xs text-amber-600 font-bold mt-0.5">Value: ฿{course.price?.toLocaleString()}</p>
                                                    {isSelected && <p className="text-[10px] text-green-600 font-bold mt-1 flex items-center gap-1"><i className="fas fa-check-circle"></i> Selected</p>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 2b. Automatic Free Courses (If any) */}
                        {fullData?.free_courses && fullData.free_courses.length > 0 && (
                            <div className="bg-green-50 p-6 rounded-2xl border border-green-200 shadow-inner">
                                <h3 className="text-sm font-black text-green-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <i className="fas fa-gift text-green-600"></i>
                                    Automatic Bonus Included
                                </h3>
                                <div className="space-y-3">
                                    {fullData.free_courses.map((courseId) => {
                                        const course = getProductDetails(courseId);
                                        return (
                                            <div key={courseId} className="p-4 rounded-xl border-2 border-white bg-white/60 flex items-center gap-4">
                                                <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden shrink-0 border border-slate-100">
                                                    <img src={course.image} alt={course.name} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-700 truncate">{course.name}</p>
                                                    <p className="text-xs text-green-600 font-bold mt-0.5">Value: ฿{course.price?.toLocaleString()}</p>
                                                    <p className="text-[10px] text-green-600 font-black mt-1 uppercase tracking-widest flex items-center gap-1">
                                                        <i className="fas fa-check-circle"></i> Added to Package
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {product.type === 'bundle' && (
                            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl">
                                <h3 className="text-sm font-black text-white/90 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <i className="fas fa-clipboard-check text-orange-500"></i>
                                    Package Price Breakdown
                                </h3>

                                {(() => {
                                    const coreCourses = fullData?.courses?.map(id => getProductDetails(id)) || [];
                                    const selectableBonuses = selectedFreeCourses.map(id => getProductDetails(id)) || [];
                                    const automaticBonuses = fullData?.free_courses?.map(id => getProductDetails(id)) || [];
                                    const allBonuses = [...selectableBonuses, ...automaticBonuses];

                                    const coreValue = coreCourses.reduce((sum, c) => sum + (c.price || 0), 0);
                                    const bonusValue = allBonuses.reduce((sum, c) => sum + (c.price || 0), 0);
                                    const totalOriginalValue = coreValue + bonusValue;
                                    const totalDiscount = totalOriginalValue - product.price;
                                    const additionalBundleDiscount = totalDiscount - bonusValue;

                                    return (
                                        <div className="space-y-4">
                                            {/* Itemized List */}
                                            <div className="space-y-2 pb-4 border-b border-white/10">
                                                {coreCourses.map((c, i) => (
                                                    <div key={`core-${i}`} className="flex justify-between text-xs">
                                                        <span className="text-slate-400">{c.name}</span>
                                                        <span className="font-mono">฿{c.price?.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                                {allBonuses.map((c, i) => (
                                                    <div key={`bonus-${i}`} className="flex justify-between text-xs text-green-400">
                                                        <span className="font-bold">{c.name} (Bonus)</span>
                                                        <span className="font-mono">฿{c.price?.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Totals Breakdown */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Total Original Value</span>
                                                    <span className="font-black">฿{totalOriginalValue.toLocaleString()}</span>
                                                </div>

                                                <div className="flex justify-between text-sm text-green-400">
                                                    <span className="font-bold uppercase tracking-wider text-[10px]">Bonus Course Deduction</span>
                                                    <span className="font-black">-฿{bonusValue.toLocaleString()}</span>
                                                </div>

                                                {additionalBundleDiscount > 0 && (
                                                    <div className="flex justify-between text-sm text-orange-400">
                                                        <span className="font-bold uppercase tracking-wider text-[10px]">Exclusive Package Discount</span>
                                                        <span className="font-black">-฿{additionalBundleDiscount.toLocaleString()}</span>
                                                    </div>
                                                )}

                                                <div className="flex justify-between items-center pt-4 border-t border-white/20 mt-2">
                                                    <span className="text-white font-black uppercase tracking-[0.2em] text-xs">Final Package Price</span>
                                                    <span className="text-2xl font-black text-orange-500">฿{product.price?.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-white p-6 border-t border-slate-100 sticky bottom-0 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    {activeCustomer?.inventory?.learning_courses?.some(item => {
                        // 1. Direct match (Stand-alone Course or Bundle Header)
                        if (item.course_id === product.id || item.bundle_id === product.id) return true;

                        // 2. Nested match (Course inside a Bundle)
                        if (item.type === 'bundle' && item.items) {
                            return item.items.some(subItem => subItem.course_id === product.id);
                        }
                        return false;
                    }) ? (
                        <div className="w-full py-4 rounded-xl font-black text-lg bg-green-100 text-green-600 flex items-center justify-center gap-2 border-2 border-green-200">
                            <i className="fas fa-check-circle text-xl"></i>
                            ALREADY OWNED
                        </div>
                    ) : (
                        <button
                            onClick={handleAddToCart}
                            disabled={!isReadyToCart()}
                            className={`w-full py-4 rounded-xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3 ${isReadyToCart()
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-orange-300 active:scale-95'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            <i className="fas fa-cart-plus text-xl"></i>
                            {isReadyToCart() ? `ADD TO CART • ฿${(product.price || 0).toLocaleString()}` : 'Please complete selection'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
