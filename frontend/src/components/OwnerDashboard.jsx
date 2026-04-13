import React, { useEffect, useState } from 'react';
import Nav from './Nav'; 
import { useSelector } from 'react-redux';
import { FaUtensils, FaPen, FaBoxOpen, FaCalendarAlt, FaMoneyBillWave, FaChevronDown, FaChevronUp, FaWallet } from "react-icons/fa";
import { MdOutlineAccountBalanceWallet, MdAttachMoney, MdDeliveryDining } from "react-icons/md";
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { serverUrl } from '../App';
import OwnerItemCard from './OwnerItemCard'; 
import OwnerOrderCard from './OwnerOrderCard'; 

function OwnerDashboard() {
  const { myShopData } = useSelector(state => state.owner);
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ count: 0, cash: 0, points: 0 });
  const [historyData, setHistoryData] = useState({ daily: [], monthly: [] }); 
  const [activeTab, setActiveTab] = useState("dashboard"); 

  // New state for expanding history
  const [expandedDate, setExpandedDate] = useState(null);

  const fetchOwnerOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${serverUrl}/api/order/my-orders`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      
      if (res.status === 200) {
        setOrders(res.data);
        calculateTodayStats(res.data);
        calculateHistory(res.data); 
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  const calculateTodayStats = (data) => {
    const today = new Date().toDateString();
    let cashSum = 0;
    let pointSum = 0;
    let countSum = 0;

    data.forEach(order => {
        const orderDate = new Date(order.createdAt).toDateString();
        if (orderDate === today) {
            if (order.shopOrders?.status === 'delivered') {
                countSum += 1; 
                cashSum += (order.paidByCashOnline || 0); 
                pointSum += (order.paidByWallet || 0);
            }
        }
    });

    setStats({ count: countSum, cash: cashSum, points: pointSum });
  };

  const calculateHistory = (data) => {
      const dailyMap = {};
      const monthlyMap = {};

      data.forEach(order => {
          if (order.shopOrders?.status !== 'delivered') return;

          const dateObj = new Date(order.createdAt);
          const dateKey = dateObj.toLocaleDateString('en-GB'); 
          const monthKey = dateObj.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

          const cash = order.paidByCashOnline || 0;
          const points = order.paidByWallet || 0;
          const total = cash + points;

          // Daily Grouping
          if (!dailyMap[dateKey]) {
              dailyMap[dateKey] = { 
                  date: dateKey, 
                  orders: 0, 
                  cash: 0, 
                  points: 0, 
                  total: 0, 
                  timestamp: dateObj.getTime(),
                  details: [] // Store full order details for expansion
              };
          }
          dailyMap[dateKey].orders += 1;
          dailyMap[dateKey].cash += cash;
          dailyMap[dateKey].points += points;
          dailyMap[dateKey].total += total;
          
          // Add detailed record
          dailyMap[dateKey].details.push({
              id: order._id,
              customerName: order.user?.fullName || "Guest",
              items: order.shopOrders.shopOrderItems.length,
              total: total,
              cash: cash,
              points: points,
              time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              paymentMethod: order.paymentMethod
          });

          // Monthly Grouping
          if (!monthlyMap[monthKey]) {
              monthlyMap[monthKey] = { month: monthKey, orders: 0, total: 0 };
          }
          monthlyMap[monthKey].orders += 1;
          monthlyMap[monthKey].total += total;
      });

      const sortedDaily = Object.values(dailyMap).sort((a, b) => b.timestamp - a.timestamp);
      const sortedMonthly = Object.values(monthlyMap); 

      setHistoryData({ daily: sortedDaily, monthly: sortedMonthly });
  };

  useEffect(() => {
    if(myShopData){
        fetchOwnerOrders();
        const interval = setInterval(fetchOwnerOrders, 30000);
        return () => clearInterval(interval);
    }
  }, [myShopData]);

  return (
    <div className='w-full min-h-screen bg-[#fff9f6] flex flex-col items-center pb-10'>
      <Nav />
      
      {!myShopData && (
        <div className='flex justify-center items-center p-4 sm:p-6 mt-10'>
           <div className='w-full max-w-md bg-white shadow-lg rounded-2xl p-6 border border-gray-100 hover:shadow-xl transition-shadow duration-300'>
            <div className='flex flex-col items-center text-center'>
              <FaUtensils className='text-[#ff4d2d] w-16 h-16 sm:w-20 sm:h-20 mb-4' />
              <h2 className='text-xl sm:text-2xl font-bold text-gray-800 mb-2'>Add Your Restaurant</h2>
              <p className='text-gray-600 mb-4 text-sm sm:text-base'>
                Join our food delivery platform and reach thousands of hungry customers every day.
              </p>
              <button 
                className='bg-[#ff4d2d] text-white px-5 sm:px-6 py-2 rounded-full font-medium shadow-md hover:bg-orange-600 transition-colors duration-200' 
                onClick={() => navigate("/create-edit-shop")}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}

      {myShopData && (
        <div className='w-full max-w-6xl flex flex-col gap-6 px-4 sm:px-6 pt-[30px]'>
          
          <div className='bg-white shadow-md rounded-xl overflow-hidden border border-orange-100 relative'>
            <div 
                className='absolute top-4 right-4 bg-[#ff4d2d] text-white p-2 rounded-full shadow-md hover:bg-orange-600 transition-colors cursor-pointer z-10' 
                onClick={() => navigate("/create-edit-shop")}
            >
                <FaPen size={16}/>
            </div>
            <div className="h-32 sm:h-48 bg-gray-200 w-full relative">
                <img src={myShopData.image} alt={myShopData.name} className='w-full h-full object-cover'/>
                <div className="absolute inset-0 bg-black/40 flex items-end p-6">
                    <h1 className='text-2xl sm:text-4xl font-bold text-white'>{myShopData.name}</h1>
                </div>
            </div>
          </div>

          <div className="flex gap-4 border-b border-gray-200 bg-white px-4 rounded-t-xl overflow-x-auto">
            <button 
                onClick={() => setActiveTab("dashboard")}
                className={`py-3 px-4 font-semibold border-b-2 whitespace-nowrap transition ${activeTab === "dashboard" ? "text-[#ff4d2d] border-[#ff4d2d]" : "text-gray-500 border-transparent hover:text-gray-700"}`}
            >
                Orders & Earnings
            </button>
            <button 
                onClick={() => setActiveTab("menu")}
                className={`py-3 px-4 font-semibold border-b-2 whitespace-nowrap transition ${activeTab === "menu" ? "text-[#ff4d2d] border-[#ff4d2d]" : "text-gray-500 border-transparent hover:text-gray-700"}`}
            >
                Menu Management
            </button>
            <button 
                onClick={() => setActiveTab("history")}
                className={`py-3 px-4 font-semibold border-b-2 whitespace-nowrap transition ${activeTab === "history" ? "text-[#ff4d2d] border-[#ff4d2d]" : "text-gray-500 border-transparent hover:text-gray-700"}`}
            >
                History & Reports
            </button>
          </div>

          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500 flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase">Delivered Orders</p>
                            <h3 className="text-3xl font-bold text-gray-800">{stats.count}</h3>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600"><MdDeliveryDining size={28} /></div>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-orange-500 flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase">Cash Collected</p>
                            <h3 className="text-3xl font-bold text-gray-800">₹{stats.cash}</h3>
                            <p className="text-xs text-orange-500">From Delivered Orders</p>
                        </div>
                        <div className="bg-orange-100 p-3 rounded-full text-orange-600"><MdAttachMoney size={28} /></div>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-green-500 flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase">Points Earned</p>
                            <h3 className="text-3xl font-bold text-gray-800">₹{stats.points}</h3>
                            <p className="text-xs text-green-500">From Delivered Subscriptions</p>
                        </div>
                        <div className="bg-green-100 p-3 rounded-full text-green-600"><MdOutlineAccountBalanceWallet size={28} /></div>
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4 px-2">Recent Orders</h3>
                    {orders.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {orders.map((order) => (
                                <OwnerOrderCard key={order._id} data={order} refreshOrders={fetchOwnerOrders} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <FaBoxOpen className="mx-auto text-gray-300 mb-3" size={40} />
                            <p className="text-gray-500">No orders received yet.</p>
                        </div>
                    )}
                </div>
            </div>
          )}

          {activeTab === "menu" && (
            <div className="animate-fade-in">
                <div className='flex justify-between items-center mb-6 px-2'>
                    <h3 className="text-xl font-bold text-gray-800">Menu Items</h3>
                    <button 
                        className='bg-[#ff4d2d] text-white px-4 py-2 rounded-lg font-medium shadow-md hover:bg-orange-600 transition' 
                        onClick={() => navigate("/add-item")}
                    >
                        + Add Food
                    </button>
                </div>
                {myShopData.items.length === 0 ? (
                    <div className='text-center py-10 bg-white rounded-xl shadow-sm'>
                        <p className='text-gray-500 mb-4'>Your menu is empty.</p>
                        <button className='text-[#ff4d2d] font-bold underline' onClick={() => navigate("/add-item")}>
                            Add your first item
                        </button>
                    </div>
                ) : (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        {myShopData.items.map((item, index) => (
                            <OwnerItemCard data={item} key={index}/>
                        ))}
                    </div>
                )}
            </div>
          )}

          {/* --- TAB 3: HISTORY & REPORTS (UPDATED) --- */}
          {activeTab === "history" && (
              <div className="space-y-8 animate-fade-in">
                  
                  {/* Monthly Summary Cards */}
                  <div>
                      <h3 className="text-xl font-bold text-gray-800 mb-4 px-2">Monthly Summary</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {historyData.monthly.length > 0 ? historyData.monthly.map((m, idx) => (
                              <div key={idx} className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-xl text-white shadow-lg flex justify-between items-center">
                                  <div>
                                      <p className="text-sm font-semibold opacity-80 uppercase">{m.month}</p>
                                      <h2 className="text-3xl font-bold mt-1">₹{m.total}</h2>
                                      <p className="text-xs mt-2 opacity-90">{m.orders} Total Orders</p>
                                  </div>
                                  <FaCalendarAlt className="text-4xl opacity-30" />
                              </div>
                          )) : <p className="text-gray-500 px-2">No monthly data available yet.</p>}
                      </div>
                  </div>

                  {/* Daily Expandable List */}
                  <div>
                      <h3 className="text-xl font-bold text-gray-800 mb-4 px-2">Day-wise Breakdown</h3>
                      <div className="space-y-4">
                          {historyData.daily.length > 0 ? historyData.daily.map((day, idx) => (
                              <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                  {/* Header Row */}
                                  <div 
                                      className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition"
                                      onClick={() => setExpandedDate(expandedDate === day.date ? null : day.date)}
                                  >
                                      <div>
                                          <h4 className="font-bold text-gray-800 text-lg">{day.date}</h4>
                                          <p className="text-xs text-gray-500 mt-1">
                                              {day.orders} Orders • <span className="text-green-600 font-bold">₹{day.total} Revenue</span>
                                          </p>
                                      </div>
                                      <div className="text-right">
                                          <div className="flex gap-4 text-sm">
                                              <span className="text-green-600 font-bold flex items-center gap-1"><FaWallet/> ₹{day.points}</span>
                                              <span className="text-orange-500 font-bold flex items-center gap-1"><FaMoneyBillWave/> ₹{day.cash}</span>
                                          </div>
                                          <div className="text-gray-400 mt-2 flex justify-end">
                                              {expandedDate === day.date ? <FaChevronUp/> : <FaChevronDown/>}
                                          </div>
                                      </div>
                                  </div>

                                  {/* Expanded Details Table */}
                                  {expandedDate === day.date && (
                                      <div className="bg-gray-50 p-4 border-t border-gray-100">
                                          <table className="w-full text-left text-sm">
                                              <thead className="text-gray-500 border-b border-gray-200">
                                                  <tr>
                                                      <th className="pb-2 font-semibold">Time</th>
                                                      <th className="pb-2 font-semibold">Customer</th>
                                                      <th className="pb-2 font-semibold text-center">Items</th>
                                                      <th className="pb-2 font-semibold text-right">Points</th>
                                                      <th className="pb-2 font-semibold text-right">Cash</th>
                                                      <th className="pb-2 font-semibold text-right">Total</th>
                                                  </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-200">
                                                  {day.details.map((order, i) => (
                                                      <tr key={i}>
                                                          <td className="py-2 text-gray-500">{order.time}</td>
                                                          <td className="py-2 font-medium">{order.customerName}</td>
                                                          <td className="py-2 text-center">{order.items}</td>
                                                          <td className="py-2 text-right text-green-600 font-bold">₹{order.points}</td>
                                                          <td className="py-2 text-right text-orange-500 font-bold">₹{order.cash}</td>
                                                          <td className="py-2 text-right font-bold">₹{order.total}</td>
                                                      </tr>
                                                  ))}
                                              </tbody>
                                          </table>
                                      </div>
                                  )}
                              </div>
                          )) : (
                              <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300">
                                  <p className="text-gray-400">No delivery history found.</p>
                              </div>
                          )}
                      </div>
                  </div>

              </div>
          )}

        </div>
      )}
    </div>
  )
}

export default OwnerDashboard;