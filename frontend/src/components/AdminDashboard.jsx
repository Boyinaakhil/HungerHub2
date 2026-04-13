import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { serverUrl } from '../App';
import { 
    FaUsers, FaStore, FaMotorcycle, FaBox, FaMoneyBillWave, FaWallet, FaChartLine, 
    FaUserGraduate, FaUtensils, FaChevronDown, FaChevronUp, FaPiggyBank, FaCalendarCheck
} from "react-icons/fa";
import { useNavigate } from 'react-router-dom';
import Nav from './Nav'; 
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const App = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); 
    
    // Payout modal state
    const [payoutModal, setPayoutModal] = useState({ isOpen: false, type: "", id: "", name: "", amount: 0 });
    
    // Data States
    const [deliveryBoys, setDeliveryBoys] = useState([]);
    const [users, setUsers] = useState([]);
    const [shops, setShops] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [dailyData, setDailyData] = useState([]);
    
    const [expandedShopId, setExpandedShopId] = useState(null);

    const navigate = useNavigate();

    // --- FETCH FUNCTIONS ---
    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${serverUrl}/api/admin/stats`, {
                headers: { Authorization: `Bearer ${token}` },
                withCredentials: true
            });
            setStats(res.data);
            setDailyData(res.data.dailyFinancials || []);
            
            if (activeTab !== 'shops' && (!shops || shops.length === 0) && res.data.newShops) {
                setShops(res.data.newShops);
            }
        } catch (error) {
            console.error("Admin fetch error", error);
        } finally {
            if(loading) setLoading(false);
        }
    };

    const fetchDeliveryBoys = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${serverUrl}/api/admin/delivery-boys`, {
                headers: { Authorization: `Bearer ${token}` },
                withCredentials: true
            });
            setDeliveryBoys(res.data);
        } catch (error) { console.error(error); }
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${serverUrl}/api/admin/users`, {
                headers: { Authorization: `Bearer ${token}` },
                withCredentials: true
            });
            setUsers(res.data);
        } catch (error) { console.error(error); }
    };

    const fetchLedger = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${serverUrl}/api/admin/ledger`, {
                headers: { Authorization: `Bearer ${token}` },
                withCredentials: true
            });
            setLedger(res.data);
            console.log("Ledger Sample:", res.data.slice(0, 10));
        } catch (error) { console.error(error); }
    };

    const fetchShops = async () => {
       try {
           const token = localStorage.getItem('token');
           const res = await axios.get(`${serverUrl}/api/admin/shops`, {
               headers: { Authorization: `Bearer ${token}` },
               withCredentials: true
           });
           setShops(res.data); 
       } catch(err) { 
           console.error(err);
       }
    };

    // --- REAL-TIME UPDATER (POLLING) ---
    useEffect(() => {
        const refreshData = () => {
            fetchStats(); 
            if (activeTab === 'delivery') fetchDeliveryBoys();
            if (activeTab === 'students') fetchUsers();
            if (activeTab === 'vault') fetchLedger();
            if (activeTab === 'shops') fetchShops();
        };

        refreshData();
        const intervalId = setInterval(refreshData, 5000);
        return () => clearInterval(intervalId);

    }, [activeTab]); 

    // --- HELPERS ---
    const isPlanActive = (user) => {
        if (!user.subscription?.planExpiresAt) return false;
        return new Date(user.subscription.planExpiresAt) > new Date();
    };

    const formatDate = (date) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // --- PAYOUT FUNCTION ---
    const handleSettleSubmit = async () => {
        try {
            const token = localStorage.getItem('token');
            const endpoint = payoutModal.type === 'shop' 
                ? `${serverUrl}/api/admin/settle-shop/${payoutModal.id}` 
                : `${serverUrl}/api/admin/settle-delivery/${payoutModal.id}`;
                
            await axios.post(endpoint, {}, {
                headers: { Authorization: `Bearer ${token}` },
                withCredentials: true
            });
            
            setPayoutModal({ isOpen: false, type: "", id: "", name: "", amount: 0 });
            
            if (payoutModal.type === 'shop') fetchShops();
            if (payoutModal.type === 'delivery') fetchDeliveryBoys();
            fetchStats(); 
            
        } catch(err) {
            alert("Settlement failed: " + (err.response?.data?.error || err.message));
        }
    };

// --- SEPARATE LEDGER LOGIC ---

// 1️⃣ Leave Gains (Admin collects from students going on leave)
const leaveEntries = ledger.filter(entry =>
  entry.breakdown?.toLowerCase().includes('leave:')
);

// 2️⃣ Coupon Redemptions (Admin loses value when coupons are used)
const couponDeductionEntries = ledger.filter(entry =>
  entry.breakdown?.toLowerCase().includes('coupon redemption')
);

// 3️⃣ Daily Breakage (Missed Meals / Unused Points)
// 3️⃣ Daily Breakage (Missed Meals / Unused Points)
const sweepEntries = ledger
  .filter(entry => {
    const text = entry.breakdown?.toLowerCase() || '';
    // Exclude leave and coupon entries
    const isExcluded = text.includes('leave') || text.includes('coupon');
    // Include missed meals / unused points
    const isDailyBreakage =
      text.includes('breakfast') ||
      text.includes('lunch') ||
      text.includes('dinner') ||
      text.includes('daily sweep') ||
      text.includes('missed');
    return !isExcluded && isDailyBreakage;
  })
  // Sort newest first (latest breakage on top)
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));


// 💰 Calculate Totals
const totalLeaveGain = leaveEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
const totalCouponCost = couponDeductionEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
const couponSystemNetImpact = totalLeaveGain - totalCouponCost;

console.log("Leave Entries:", leaveEntries);
console.log("Coupon Deduction Entries:", couponDeductionEntries);
console.log("Sweep Entries (Daily Unused Points):", sweepEntries);





    if (loading) return <div className="min-h-screen flex items-center justify-center text-[#ff4d2d] font-bold">Loading Admin Panel...</div>;

    const s = stats?.stats || {};

    // --- MANUAL TRIGGER FOR TESTING ---
    const handleTriggerSweep = async () => {
        if(!window.confirm("⚠️ Test Mode: Run End-of-Day Sweep Now?\n\nThis will check all students immediately, deduct unused points for TODAY, and add them to your Admin Vault.")) {
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${serverUrl}/api/admin/trigger-sweep`, {}, {
                headers: { Authorization: `Bearer ${token}` },
                withCredentials: true
            });
            
            alert(`✅ Success! ${res.data.message}`);
            fetchStats();
            if (activeTab === 'vault') fetchLedger();
            
        } catch (error) {
            console.error(error);
            alert("Failed to trigger sweep: " + (error.response?.data?.message || error.message));
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <Nav />
            
            <div className="flex flex-1 pt-[80px]">
                {/* --- SIDEBAR --- */}
                <aside className="w-64 bg-white shadow-md hidden md:block fixed h-full z-10 left-0 top-[80px]">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-[#ff4d2d] flex items-center gap-2">Super Admin</h2>
                    </div>
                    <nav className="mt-6 space-y-1">
                        <SidebarItem icon={<FaChartLine />} label="Overview" id="overview" activeTab={activeTab} setActiveTab={setActiveTab} />
                        <SidebarItem icon={<FaWallet />} label="The Vault" id="vault" activeTab={activeTab} setActiveTab={setActiveTab} />
                        <SidebarItem icon={<FaUserGraduate />} label="Students" id="students" activeTab={activeTab} setActiveTab={setActiveTab} />
                        <SidebarItem icon={<FaUtensils />} label="Shops" id="shops" activeTab={activeTab} setActiveTab={setActiveTab} />
                        <SidebarItem icon={<FaMotorcycle />} label="Delivery Fleet" id="delivery" activeTab={activeTab} setActiveTab={setActiveTab} />
                    </nav>
                </aside>

                {/* --- MAIN CONTENT --- */}
                <main className="flex-1 p-8 md:ml-64 bg-gray-50 min-h-screen">
                    
                    {/* TAB: OVERVIEW */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-fade-in">
                            <h1 className="text-2xl font-bold text-gray-800">Financial Overview</h1>
                            
                            {/* 1. METRIC CARDS */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Profit Card */}
                                <div className="bg-gradient-to-r from-[#10b981] to-[#059669] p-6 rounded-xl text-white shadow-lg transform hover:scale-[1.01] transition">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-semibold opacity-90">Admin Vault (Profit)</h3>
                                        <FaPiggyBank className="text-2xl opacity-80"/>
                                    </div>
                                    <p className="text-3xl font-bold">₹{s.adminProfit || 0}</p>
                                    <p className="text-xs mt-2 opacity-80">Breakage Revenue (Unused Points)</p>
                                </div>

                                {/* Shop Liability */}
                                <div className="bg-white p-6 rounded-xl shadow border-l-4 border-orange-500">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-gray-500 text-xs font-bold uppercase">Payable to Shops</p>
                                        <FaUtensils className="text-orange-400 text-xl"/>
                                    </div>
                                    <h3 className="text-3xl font-bold text-gray-800">₹{s.shopPayable || 0}</h3>
                                    <p className="text-xs text-orange-500 mt-1">Total Food Cost of Delivered Orders</p>
                                </div>
                                
                                {/* Fleet Liability */}
                                <div className="bg-white p-6 rounded-xl shadow border-l-4 border-purple-500">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-gray-500 text-xs font-bold uppercase">Payable to Fleet</p>
                                        <FaMotorcycle className="text-purple-400 text-xl"/>
                                    </div>
                                    <h3 className="text-3xl font-bold text-gray-800">₹{s.deliveryPayable || 0}</h3>
                                    <p className="text-xs text-purple-500 mt-1">Total Wallet Balance of Delivery Boys</p>
                                </div>
                            </div>

                            {/* 2. DAILY GRAPH */}
                            <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Daily Financial Flow</h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dailyData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="date" tickFormatter={(date) => new Date(date).getDate()} />
                                            <YAxis />
                                            <Tooltip 
                                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                                formatter={(value) => [`₹${value}`]}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                            <Legend />
                                            <Bar dataKey="cashValue" name="Cash Collected" stackId="a" fill="#f97316" radius={[0,0,4,4]}/>
                                            <Bar dataKey="pointsValue" name="Points Redeemed" stackId="a" fill="#10b981" radius={[4,4,0,0]}/>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="text-center text-xs text-gray-400 mt-2">
                                    <span className="inline-block w-3 h-3 bg-[#f97316] mr-1 rounded-sm"></span>Cash Collected
                                    <span className="inline-block w-3 h-3 bg-[#10b981] ml-4 mr-1 rounded-sm"></span>Points Redeemed
                                </p>
                            </div>

                            {/* 3. QUICK COUNTS */}
                            <h2 className="text-lg font-bold text-gray-700 mt-4">Platform Activity</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard icon={<FaUsers />} title="Students" value={s.users || 0} color="blue" />
                                <StatCard icon={<FaStore />} title="Shops" value={s.shops || 0} color="orange" />
                                <StatCard icon={<FaMotorcycle />} title="Fleet" value={s.deliveryBoys || 0} color="purple" />
                                <StatCard icon={<FaBox />} title="Orders" value={s.orders || 0} color="green" />
                            </div>
                        </div>
                    )}

                    {/* TAB: THE VAULT */}
                    {activeTab === 'vault' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex justify-between items-center">
                                <h1 className="text-2xl font-bold text-gray-800">The Vault (Revenue Log)</h1>
                                <div className="flex gap-4 items-center">
                                    <button 
                                        onClick={handleTriggerSweep}
                                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition transform active:scale-95"
                                    >
                                        ⚡ Test: Run Daily Sweep
                                    </button>
                                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold border border-green-200">
                                        Total Earned: ₹{s.adminProfit || 0}
                                    </div>
                                </div>
                            </div>

                            {/* --- NEW: Coupon System Net Impact Indicator --- */}
                            <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-200">
                                <h3 className="font-bold text-blue-800 mb-2">Coupon System Net Impact</h3>
                                <p className="text-sm text-blue-700">
                                    Total Points Gained from Leave Deductions: <span className="font-bold">₹{totalLeaveGain}</span>
                                </p>
                                <p className="text-sm text-blue-700">
                                    Total Cost of Coupons Applied (Admin Loss): <span className="font-bold text-red-600">-₹{totalCouponCost}</span>
                                </p>
                                <p className="mt-2 text-lg font-bold">
                                    Net Result: ₹{couponSystemNetImpact}
                                </p>
                            </div>

                            {/* --- SECTION 1: MESS LEAVE DEDUCTIONS --- */}
                            <div className="bg-white rounded-xl shadow overflow-hidden border border-orange-200">
                                <div className="bg-orange-50 p-4 border-b border-orange-100 flex items-center gap-2">
                                    <FaCalendarCheck className="text-orange-500"/>
                                    <h3 className="font-bold text-gray-800">Mess Leave Deductions (Bulk)</h3>
                                    <span className="text-xs text-gray-500 ml-auto bg-white px-2 py-1 rounded border">Points collected from students going on leave</span>
                                </div>
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-semibold text-sm uppercase">
                                        <tr>
                                            <th className="p-4">Date Applied</th>
                                            <th className="p-4">Student Name</th>
                                            <th className="p-4">Leave Details</th>
                                            <th className="p-4 text-center">Next Month Discount (50%)</th>
                                            <th className="p-4 text-right">Added to Vault (100%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {leaveEntries.length > 0 ? leaveEntries.map((entry) => (
                                            <tr key={entry._id} className="hover:bg-orange-50/30 transition">
                                                <td className="p-4 text-gray-500 text-sm">{formatDate(entry.createdAt)}</td>
                                                <td className="p-4 font-bold text-gray-800">{entry.studentName}</td>
                                                <td className="p-4 text-sm text-gray-600">{entry.breakdown.replace('Leave Applied: ', '')}</td>
                                                <td className="p-4 text-center text-blue-600 font-bold bg-blue-50/50">
                                                    {entry.amount / 2} Pts
                                                </td>
                                                <td className="p-4 text-right text-green-600 font-bold">
                                                    + ₹{entry.amount}
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="5" className="p-8 text-center text-gray-400">No leave applications yet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {/* --- COUPON REDEMPTION LOG (COSTS) --- */}
                            <div className="bg-white rounded-xl shadow overflow-hidden border border-red-200">
                                <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-2">
                                    <FaMoneyBillWave className="text-red-500"/>
                                    <h3 className="font-bold text-gray-800">Coupon Redemptions (Cost to Admin)</h3>
                                </div>
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-semibold text-sm uppercase">
                                        <tr>
                                            <th className="p-4">Date Used</th>
                                            <th className="p-4">Student Name</th>
                                            <th className="p-4">Transaction Details</th>
                                            <th className="p-4 text-right">Admin Cost (Deduction)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {couponDeductionEntries.length > 0 ? couponDeductionEntries.map((entry) => (
                                            <tr key={entry._id} className="hover:bg-red-50/30 transition">
                                                <td className="p-4 text-gray-500 text-sm">{formatDate(entry.createdAt)}</td>
                                                <td className="p-4 font-bold text-gray-800">{entry.studentName}</td>
                                                <td className="p-4 text-sm text-gray-600">{entry.breakdown}</td>
                                                <td className="p-4 text-right text-red-600 font-bold">- ₹{entry.amount}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="4" className="p-8 text-center text-gray-400">No coupon redemptions recorded yet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* --- SECTION 2: DAILY SWEEP LOG --- */}
                            <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
                                <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center gap-2">
                                    <FaPiggyBank className="text-gray-500"/>
                                    <h3 className="font-bold text-gray-800">Daily Breakage (Missed Meals)</h3>
                                </div>
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-semibold text-sm uppercase">
                                        <tr>
                                            <th className="p-4">Date</th>
                                            <th className="p-4">Student</th>
                                            <th className="p-4">Reason</th>
                                            <th className="p-4 text-right">Amount Collected</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {sweepEntries.length > 0 ? sweepEntries.map((entry) => (
                                            <tr key={entry._id} className="hover:bg-gray-50 transition">
                                                <td className="p-4 text-gray-500">{formatDate(entry.createdAt)}</td>
                                                <td className="p-4 font-medium text-gray-800">{entry.studentName || "Unknown"}</td>
                                                <td className="p-4 text-gray-600">{entry.breakdown || entry.reason}</td>
                                                <td className="p-4 text-right text-green-600 font-bold">+ ₹{entry.amount}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="4" className="p-8 text-center text-gray-400">No daily breakage recorded yet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB: STUDENTS */}
                    {activeTab === 'students' && (
                        <div className="space-y-6 animate-fade-in">
                            <h1 className="text-2xl font-bold text-gray-800">Students</h1>
                            <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-semibold text-sm uppercase">
                                        <tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Wallet Balance</th><th className="p-4">Plan Status</th><th className="p-4">Expiry</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {users.map(u => {
                                            const active = isPlanActive(u);
                                            return (
                                                <tr key={u._id} className="hover:bg-gray-50">
                                                    <td className="p-4 font-medium">{u.fullName}</td>
                                                    <td className="p-4 text-gray-500 text-sm">{u.email}</td>
                                                    <td className="p-4 font-bold text-gray-800">₹{u.walletBalance}</td>
                                                    <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${active?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{active?'Active':'Expired'}</span></td>
                                                    <td className="p-4 text-sm text-gray-500">{u.subscription?.planExpiresAt ? formatDate(u.subscription.planExpiresAt) : 'N/A'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB: SHOPS */}
                    {activeTab === 'shops' && (
                        <div className="space-y-6 animate-fade-in">
                            <h1 className="text-2xl font-bold text-gray-800">Shop Partners & Payouts</h1>
                            <div className="grid gap-4">
                                {shops.length > 0 ? shops.map(shop => (
                                    <div key={shop._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div 
                                            className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition"
                                            onClick={() => setExpandedShopId(expandedShopId === shop._id ? null : shop._id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <img src={shop.image} alt={shop.name} className="w-12 h-12 rounded-full object-cover border"/>
                                                <div>
                                                    <h3 className="font-bold text-gray-800">{shop.name}</h3>
                                                    <p className="text-xs text-gray-500">{shop.city}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-400 uppercase">Total Revenue</p>
                                                    <p className="font-bold text-green-600">₹{shop.totalRevenue || 0}</p>
                                                </div>
                                                <div className="text-gray-400">
                                                    {expandedShopId === shop._id ? <FaChevronUp/> : <FaChevronDown/>}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {expandedShopId === shop._id && (
                                            <div className="bg-gray-50 p-4 border-t border-gray-100 flex flex-col gap-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-white p-3 rounded border">
                                                        <p className="text-xs text-gray-500 uppercase">Total Items</p>
                                                        <p className="font-bold text-lg">{shop.items?.length || 0}</p>
                                                    </div>
                                                    <div className="bg-white p-3 rounded border border-red-100">
                                                        <p className="text-xs text-red-500 uppercase">Payable Amount</p>
                                                        <p className="font-bold text-xl text-red-600">₹{shop.totalRevenue || 0}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-white p-4 rounded border flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase mb-1">Payout Status</p>
                                                        {shop.totalRevenue > 0 ? (
                                                            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-yellow-400">Pending Settlement</span>
                                                        ) : (
                                                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-green-400">Settled</span>
                                                        )}
                                                    </div>
                                                    
                                                    {shop.totalRevenue > 0 && (
                                                        <button 
                                                            onClick={() => setPayoutModal({ isOpen: true, type: 'shop', id: shop._id, name: shop.name, amount: shop.totalRevenue })}
                                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition"
                                                        >
                                                            <FaMoneyBillWave /> Settle Account
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )) : <p className="text-gray-500">No shops found.</p>}
                            </div>
                        </div>
                    )}

                    {/* TAB: DELIVERY FLEET */}
                    {activeTab === 'delivery' && (
                        <div className="space-y-6 animate-fade-in">
                            <h1 className="text-2xl font-bold text-gray-800">Delivery Fleet Payouts</h1>
                            <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200 overflow-x-auto">
                                <table className="w-full text-left min-w-[800px]">
                                    <thead className="bg-gray-50 text-gray-600 font-semibold text-sm uppercase">
                                        <tr><th className="p-4">Name</th><th className="p-4">Phone</th><th className="p-4">Total Deliveries</th><th className="p-4">Wallet Balance</th><th className="p-4">Payout Status</th><th className="p-4">Action</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {deliveryBoys.map(boy => (
                                            <tr key={boy._id} className="hover:bg-gray-50">
                                                <td className="p-4 font-medium">{boy.fullName}</td>
                                                <td className="p-4">{boy.mobile}</td>
                                                <td className="p-4 font-bold">{boy.totalDeliveries || 0}</td>
                                                <td className="p-4 text-red-600 font-bold">₹{boy.walletBalance}</td>
                                                <td className="p-4">
                                                    {boy.walletBalance > 0 ? (
                                                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold ring-1 ring-yellow-400">Pending Settlement</span>
                                                    ) : (
                                                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold ring-1 ring-green-400">Settled</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {boy.walletBalance > 0 && (
                                                        <button 
                                                            onClick={() => setPayoutModal({ isOpen: true, type: 'delivery', id: boy._id, name: boy.fullName, amount: boy.walletBalance })}
                                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow transition"
                                                        >
                                                            <FaMoneyBillWave /> Settle Account
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </main>
            </div>

            {/* --- CONFIRMATION MODAL --- */}
            {payoutModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="bg-blue-600 p-4 text-white text-center">
                            <FaMoneyBillWave className="text-4xl mx-auto mb-2 opacity-90" />
                            <h2 className="text-xl font-bold">Initiate Payout</h2>
                        </div>
                        <div className="p-6 text-center space-y-4">
                            <p className="text-gray-600 text-sm">
                                Confirm payment of <span className="font-bold text-red-600 text-lg">₹{payoutModal.amount}</span> to <span className="font-bold text-gray-800">{payoutModal.name}</span>? 
                                <br/><br/>
                                This will formally record the transaction and reset their monthly balance to zero.
                            </p>
                            <div className="flex gap-3 mt-4">
                                <button 
                                    onClick={() => setPayoutModal({ isOpen: false, type: "", id: "", name: "", amount: 0 })}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl font-bold transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSettleSubmit}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-bold shadow-md transition"
                                >
                                    Confirm Payment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SidebarItem = ({ icon, label, id, activeTab, setActiveTab }) => (
    <button onClick={() => setActiveTab(id)} className={`w-full text-left px-6 py-3 flex items-center gap-3 hover:bg-orange-50 transition-colors duration-200 ${activeTab === id ? 'bg-orange-50 text-[#ff4d2d] border-r-4 border-[#ff4d2d]' : 'text-gray-600'}`}>
        <span className="text-lg">{icon}</span><span className="font-medium">{label}</span>
    </button>
);

const StatCard = ({ icon, title, value, color }) => {
    const colors = { blue: "text-blue-600 bg-blue-100", orange: "text-orange-600 bg-orange-100", purple: "text-purple-600 bg-purple-100", green: "text-green-600 bg-green-100" };
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition">
            <div className={`p-4 rounded-full ${colors[color]}`}>{icon}</div>
            <div><p className="text-gray-500 text-xs font-bold uppercase">{title}</p><p className="text-2xl font-bold text-gray-800">{value}</p></div>
        </div>
    );
};

export default App;