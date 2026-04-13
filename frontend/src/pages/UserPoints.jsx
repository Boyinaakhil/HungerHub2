import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateWallet, updateSubscription } from '../redux/userSlice';
import { MdOutlineAccountBalanceWallet, MdHistory, MdWarning, MdRefresh } from "react-icons/md";
import { FaPlus, FaCircleCheck } from "react-icons/fa6"; 
import axios from 'axios';
import { serverUrl } from '../App';

// --- Simple Modal Component ---
const Modal = ({ isOpen, title, message, onClose, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
                <h3 className="text-xl font-bold mb-4">{title}</h3>
                <p className="mb-6 whitespace-pre-line">{message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300">Cancel</button>
                    {onConfirm && <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-[#ff4d2d] text-white hover:bg-[#e04328]">Confirm</button>}
                </div>
            </div>
        </div>
    );
};

const UserPoints = () => {
    const { userData } = useSelector((state) => state.user);
    const dispatch = useDispatch();
    
    const [amount, setAmount] = useState('');
    const [history, setHistory] = useState([]);
    const [localExpiry, setLocalExpiry] = useState(null); 
    const [loading, setLoading] = useState(false);
    const [fetchingHistory, setFetchingHistory] = useState(true);

    // Modal state
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    const planExpiresAt = userData?.subscription?.planExpiresAt || localExpiry;
    const isPlanActive = planExpiresAt && new Date(planExpiresAt) > new Date();
    const nextMonthCoupon = userData?.nextMonthCoupon || 0;

    // --- Fetch Wallet History ---
    const fetchHistory = useCallback(async () => {
        try {
            setFetchingHistory(true);

            const res = await axios.get(`${serverUrl}/api/user/wallet-history?t=${Date.now()}`, {
                withCredentials: true
            });

            if (res.status === 200) {
                const fetchedHistory = res.data.history || (Array.isArray(res.data) ? res.data : []);
                setHistory(fetchedHistory);
                
                if (res.data.planExpiresAt) {
                   setLocalExpiry(res.data.planExpiresAt);
                   if (userData && (!userData.subscription?.planExpiresAt || userData.subscription.planExpiresAt !== res.data.planExpiresAt)) {
                       dispatch(updateSubscription(res.data.planExpiresAt));
                   }
                }
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setFetchingHistory(false);
        }
    }, [dispatch, userData]);

    useEffect(() => {
        if (userData) fetchHistory();
    }, [fetchHistory, userData?._id]);

    // --- Razorpay Payment ---
    const initiateRazorpay = async (payableAmount, fullAmount, couponAmount) => {
        const { data } = await axios.post(`${serverUrl}/api/user/create-wallet-order`, 
            { amount: payableAmount },
            { withCredentials: true }
        );

        if (!data.success) throw new Error("Failed to initiate payment");

        const options = {
            key: data.key_id,
            amount: data.order.amount,
            currency: "INR",
            name: "HungerHub Wallet",
            description: couponAmount > 0 ? `Monthly Recharge (-₹${couponAmount} Coupon)` : "Add Points to Wallet",
            order_id: data.order.id,
            handler: async function (response) {
                try {
                    const verifyRes = await axios.post(`${serverUrl}/api/user/verify-wallet-payment`, {
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        amount: fullAmount,
                        couponApplied: couponAmount,
                    }, { withCredentials: true });

                    if (verifyRes.data.success) {
                        dispatch(updateWallet(verifyRes.data.walletBalance));
                        if (verifyRes.data.planExpiresAt) {
                            dispatch(updateSubscription(verifyRes.data.planExpiresAt));
                            setLocalExpiry(verifyRes.data.planExpiresAt);
                        }
                        fetchHistory();
                        // Show success modal
                        setModal({
                            isOpen: true,
                            title: 'Payment Successful',
                            message: `Points added: ${fullAmount}\nCoupon applied: ${couponAmount}`,
                            onConfirm: () => setModal({ ...modal, isOpen: false })
                        });
                        setAmount('');
                    }
                } catch (verifyError) {
                    console.error(verifyError);
                    setModal({
                        isOpen: true,
                        title: 'Payment Failed',
                        message: 'Verification failed on server.',
                        onConfirm: () => setModal({ ...modal, isOpen: false })
                    });
                }
            },
            prefill: {
                name: userData?.fullName,
                email: userData?.email,
                contact: userData?.mobile
            },
            theme: { color: "#ff4d2d" }
        };

        const rzp1 = new window.Razorpay(options);
        rzp1.on('payment.failed', function (response){
            setModal({
                isOpen: true,
                title: 'Payment Failed',
                message: response.error.description,
                onConfirm: () => setModal({ ...modal, isOpen: false })
            });
        });
        rzp1.open();
    };

    // --- Add Money ---
    const handleAddMoney = () => {
        const inputAmount = Number(amount);
        if (!inputAmount || inputAmount <= 0) return;

        const fullAmount = (isPlanActive || inputAmount >= 3000) ? inputAmount : 3000;
        let payableAmount = fullAmount;
        let couponApplied = 0;

        if (fullAmount === 3000 && nextMonthCoupon > 0) {
            couponApplied = nextMonthCoupon;
            payableAmount = Math.max(0, fullAmount - couponApplied);
        }

        if (!isPlanActive && fullAmount < 3000) {
            setModal({
                isOpen: true,
                title: 'Plan Inactive',
                message: 'Your Monthly Plan is inactive. Please pay at least ₹3000 to activate.',
                onConfirm: () => setModal({ ...modal, isOpen: false })
            });
            return;
        }

        const message = `
--- TRANSACTION DETAILS ---
Recharge Value: ₹${fullAmount}
Coupon Applied: -₹${couponApplied}
-----------------------------
Final Amount You Pay: ₹${payableAmount}
Points Credited: +₹${fullAmount}
(Admin covers the coupon difference: ₹${couponApplied})
        `;

        // Open confirmation modal
        setModal({
            isOpen: true,
            title: 'Confirm Payment',
            message,
            onConfirm: async () => {
                setModal({ ...modal, isOpen: false });
                setLoading(true);
                try {
                    await initiateRazorpay(payableAmount, fullAmount, couponApplied);
                } catch (error) {
                    console.error(error);
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    const getDaysLeft = () => {
        if (!isPlanActive) return 0;
        const oneDay = 24 * 60 * 60 * 1000;
        const expiryDate = new Date(planExpiresAt);
        const today = new Date();
        const expiryMidnight = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffDays = Math.round((expiryMidnight - todayMidnight) / oneDay);
        return Math.max(0, diffDays);
    };

    return (
        <div className="min-h-screen bg-[#fff9f6] pt-[100px] px-4 md:px-10 pb-10">
            <Modal {...modal} />
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h1 className="text-3xl font-bold text-[#ff4d2d] flex items-center gap-2">
                        <MdOutlineAccountBalanceWallet /> My Wallet
                    </h1>
                    {fetchingHistory ? (
                        <span className="text-gray-400 text-sm">Loading...</span>
                    ) : (
                        <div className={`px-4 py-2 rounded-full font-bold flex items-center gap-2 ${isPlanActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {isPlanActive ? <FaCircleCheck /> : <MdWarning />}
                            {isPlanActive ? `Plan Active (${getDaysLeft()} days left)` : "Monthly Plan Inactive"}
                        </div>
                    )}
                </div>

                {/* Balance Card */}
                <div className={`rounded-2xl p-6 md:p-10 text-white shadow-xl flex flex-col md:flex-row justify-between items-center mb-8 transition-colors duration-500 ${isPlanActive ? 'bg-gradient-to-r from-[#ff4d2d] to-[#ff7854]' : 'bg-gradient-to-r from-gray-500 to-gray-600'}`}>
                    <div>
                        <p className="text-lg opacity-90">Current Balance</p>
                        <h2 className="text-5xl font-bold mt-2">{userData?.walletBalance || 0} <span className="text-2xl">pts</span></h2>
                        {!isPlanActive && <p className="mt-2 text-yellow-300 font-bold bg-black/20 inline-block px-3 py-1 rounded">⚠️ Pay 3000 to activate meals</p>}
                    </div>
                    <div className="mt-6 md:mt-0 bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                        <p className="text-sm font-medium mb-1">Student ID</p>
                        <p className="font-mono text-xl tracking-wider">{userData?._id ? userData._id.slice(-8).toUpperCase() : "..."}</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Add Money */}
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><FaPlus className="text-[#ff4d2d]"/> Add Points</h3>
                        
                        {nextMonthCoupon > 0 && (
                            <div className="bg-green-100 border border-green-300 text-green-800 p-3 rounded-lg mb-4 text-sm font-bold">
                                🎁 Applying Coupon: -₹{nextMonthCoupon} discount!
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-gray-600 text-sm mb-2">Enter Amount (₹)</label>
                            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={isPlanActive ? "e.g. 100" : "Min 3000 required"} className={`w-full p-3 border rounded-lg focus:outline-none text-lg ${!isPlanActive && Number(amount) < 3000 && amount !== '' ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#ff4d2d]'}`} />
                            {!isPlanActive && <p className="text-xs text-red-500 mt-1">* Minimum ₹3000 required to activate monthly plan</p>}
                        </div>
                        
                        <div className="flex gap-3 mb-6 flex-wrap">
                            <button onClick={() => setAmount(500)} disabled={!isPlanActive} className={`px-4 py-2 border rounded-full text-sm transition ${!isPlanActive ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'hover:bg-[#ff4d2d] hover:text-white'}`}>500</button>
                            <button onClick={() => setAmount(1000)} disabled={!isPlanActive} className={`px-4 py-2 border rounded-full text-sm transition ${!isPlanActive ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'hover:bg-[#ff4d2d] hover:text-white'}`}>1000</button>
                            <button onClick={() => setAmount(3000)} className={`px-4 py-2 border text-sm font-bold rounded-full transition ${!isPlanActive ? 'bg-[#ff4d2d] text-white animate-pulse' : 'border-[#ff4d2d] text-[#ff4d2d] bg-[#ff4d2d]/10 hover:bg-[#ff4d2d] hover:text-white'}`}>3000 (Monthly)</button>
                        </div>
                        
                        <button onClick={handleAddMoney} disabled={loading} className="w-full bg-[#ff4d2d] text-white py-3 rounded-lg font-bold text-lg hover:bg-[#e04328] transition shadow-lg disabled:opacity-50 flex justify-center items-center">
                            {loading ? "Processing..." : (!isPlanActive && (Number(amount) < 3000) && amount !== '') ? "Enter 3000+" : "Pay & Add Points"}
                        </button>
                    </div>

                    {/* History */}
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 h-fit max-h-[500px] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><MdHistory className="text-[#ff4d2d]"/> Transaction History</h3>
                            <button onClick={fetchHistory} className="text-gray-500 hover:text-[#ff4d2d] transition" title="Refresh History">
                                <MdRefresh size={24} />
                            </button>
                        </div>
                        
                        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                            {fetchingHistory ? (
                                <p className="text-center text-gray-400 py-4">Loading history...</p>
                            ) : history && history.length > 0 ? (
                                history.map((item, index) => (
                                    <div key={item._id || index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                                        <div className="max-w-[70%]">
                                            <p className="font-semibold text-gray-800 text-sm md:text-base truncate">{item.desc}</p>
                                            <p className="text-xs text-gray-500">{formatDate(item.date)}</p>
                                        </div>
                                        <div className={`font-bold ${item.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                                            {item.type === 'credit' ? '+' : '-'}{item.amount}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-400 py-4">No transactions found.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserPoints;
