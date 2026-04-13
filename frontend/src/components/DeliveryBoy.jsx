import React, { useEffect, useState } from 'react'
import Nav from './Nav' 
import { useSelector } from 'react-redux'
import axios from 'axios'
import { serverUrl } from '../App'
import DeliveryBoyTracking from './DeliveryBoyTracking' 
import { ClipLoader } from 'react-spinners'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FaHistory, FaMotorcycle, FaMapMarkerAlt, FaChevronDown, FaChevronUp, FaCheckCircle } from "react-icons/fa";

function DeliveryBoy() {
  const { userData, socket } = useSelector(state => state.user)
  
  // Tabs: "active" (Current Work) vs "history" (Past Earnings)
  const [activeTab, setActiveTab] = useState("active"); 

  // Active Data
  const [activeOrders, setActiveOrders] = useState([]) 
  const [availableAssignments, setAvailableAssignments] = useState([])
  const [todayDeliveries, setTodayDeliveries] = useState([])
  const [deliveryBoyLocation, setDeliveryBoyLocation] = useState(null)
  
  // History Data
  const [historyData, setHistoryData] = useState([]);
  const [expandedDate, setExpandedDate] = useState(null);

  // OTP State
  const [otpInputs, setOtpInputs] = useState({}) 
  const [otpVisible, setOtpVisible] = useState({}) 
  const [loadingOrders, setLoadingOrders] = useState({}) 
  const [confirmationResults, setConfirmationResults] = useState({});

  // --- SUCCESS MODAL STATE ---
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // --- 1. DYNAMIC RATE CALCULATOR ---
  const getRateForHour = (hour) => {
      if (hour < 8) return 10;                // Breakfast
      if (hour >= 10 && hour < 15) return 10; // Lunch
      if (hour >= 18 && hour < 21) return 10; // Dinner
      return 25;                              // Off-Peak
  }

  const totalEarning = todayDeliveries.reduce((sum, d) => {
      const rate = getRateForHour(d.hour);
      return sum + (d.count * rate);
  }, 0);


  // --- 2. LOCATION TRACKING ---
  useEffect(() => {
    if (!socket || userData?.role !== "deliveryBoy") return
    let watchId
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition((position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude
        setDeliveryBoyLocation({ lat: latitude, lon: longitude })
        socket.emit('updateLocation', { latitude, longitude, userId: userData._id })
      },
        (error) => console.log("Location Error:", error),
        { enableHighAccuracy: true }
      )
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId) }
  }, [socket, userData])


  // --- 3. FETCH DATA ---
  const getAssignments = async () => {
    try {
      const result = await axios.get(`${serverUrl}/api/order/get-assignments`, { withCredentials: true })
      setAvailableAssignments(result.data)
    } catch (error) { console.log(error) }
  }

  const getCurrentOrders = async () => {
    try {
      const result = await axios.get(`${serverUrl}/api/order/get-current-order`, { withCredentials: true })
      setActiveOrders(Array.isArray(result.data) ? result.data : [])
    } catch (error) { setActiveOrders([]) }
  }

  const handleTodayDeliveries = async () => {
    try {
      const result = await axios.get(`${serverUrl}/api/order/get-today-deliveries`, { withCredentials: true })
      setTodayDeliveries(result.data)
    } catch (error) { console.log(error) }
  }

  const getHistory = async () => {
    try {
        const res = await axios.get(`${serverUrl}/api/order/delivery-history`, { withCredentials: true });
        setHistoryData(res.data);
    } catch (error) { console.log(error); }
  }

  useEffect(() => {
    if (userData) {
        if(activeTab === 'active') {
            getAssignments()
            getCurrentOrders()
            handleTodayDeliveries()
        } else {
            getHistory()
        }
    }
  }, [userData, activeTab])


  // --- 4. SOCKET LISTENERS ---
  useEffect(() => {
    if (socket) {
        socket.on('newAssignment', (data) => {
            setAvailableAssignments(prev => {
                if (prev.find(a => a.assignmentId === data.assignmentId)) return prev;
                return [...prev, data];
            })
        })
        socket.on('assignmentRevoked', ({ assignmentId }) => {
            setAvailableAssignments(prev => prev.filter(a => a.assignmentId !== assignmentId))
            getCurrentOrders()
        })
    }
    return () => {
      if (socket) { socket.off('newAssignment'); socket.off('assignmentRevoked'); }
    }
  }, [socket])


  // --- 5. ACTIONS ---
  const acceptOrder = async (assignmentId) => {
    try {
      await axios.get(`${serverUrl}/api/order/accept-order/${assignmentId}`, { withCredentials: true })
      await getCurrentOrders(); getAssignments(); 
    } catch (error) { alert(error.response?.data?.message || "Failed to accept order") }
  }

  const sendOtp = async (orderId, shopOrderId, mobileNumber) => {
    setLoadingOrders(prev => ({ ...prev, [orderId]: true }))
    try {
        await axios.post(`${serverUrl}/api/order/send-delivery-otp`, {
            orderId, shopOrderId
        }, { withCredentials: true })
        
        setLoadingOrders(prev => ({ ...prev, [orderId]: false }));
        setOtpVisible(prev => ({ ...prev, [orderId]: true }));
        alert("OTP sent successfully to the student's registered email.");

    } catch (error) {
        console.error("OTP Send Error:", error);
        setLoadingOrders(prev => ({ ...prev, [orderId]: false }));
        alert(error.response?.data?.message || "Failed to send OTP. Please check your backend.");
    }
  }

  // --- VERIFY OTP (Trigger Modal) ---
  const verifyOtp = async (orderId, shopOrderId) => {
    try {
      setLoadingOrders(prev => ({ ...prev, [orderId]: true }));
      const userOtp = otpInputs[orderId];
      if (!userOtp) throw new Error("Please enter OTP");

      // Verify directly with your backend
      const result = await axios.post(`${serverUrl}/api/order/verify-delivery-otp`, {
        orderId, shopOrderId, otp: userOtp
      }, { withCredentials: true });
      
      setLoadingOrders(prev => ({ ...prev, [orderId]: false }));
      setSuccessMessage(result.data.message || "Order Delivered Successfully!");
      setShowSuccessModal(true); 
      
    } catch (error) { 
      setLoadingOrders(prev => ({ ...prev, [orderId]: false }));
      alert(error.response?.data?.message || "Invalid OTP or Verification Failed");
    }
  }

  const handleModalClose = (shouldReload) => {
      setShowSuccessModal(false);
      if (shouldReload) {
          window.location.reload();
      } else {
          // If cancel, refresh lists so delivered order moves to history
          getCurrentOrders();
          handleTodayDeliveries();
          if(activeTab === 'history') getHistory();
      }
  }

  const handleOtpChange = (orderId, value) => {
      setOtpInputs(prev => ({...prev, [orderId]: value}))
  }

  const displayedOrders = activeOrders.filter(order => ['preparing', 'out of delivery'].includes(order.shopOrder?.status));


  return (
    <div className='w-full min-h-screen flex flex-col items-center bg-[#fff9f6] pb-10 relative'>
      <Nav />
      
      {/* --- CUSTOM SUCCESS MODAL (Fixed Z-Index) --- */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-fade-in">
             <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center transform transition-all scale-100 border border-green-100 relative z-[10000]">
                 <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <FaCheckCircle className="text-green-600 text-4xl" />
                 </div>
                 <h3 className="text-2xl font-bold text-gray-800 mb-2">Excellent!</h3>
                 <p className="text-gray-600 mb-6 font-medium">{successMessage}</p>
                 
                 <div className="flex gap-3 justify-center">
                    <button 
                        onClick={() => handleModalClose(false)} 
                        className="px-5 py-2.5 rounded-lg border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition active:scale-95"
                    >
                        Close
                    </button>
                    <button 
                        onClick={() => handleModalClose(true)} 
                        className="px-8 py-2.5 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 transition shadow-lg active:scale-95"
                    >
                        OK
                    </button>
                 </div>
             </div>
        </div>
      )}

      <div className='w-full max-w-[1000px] flex flex-col gap-6 items-center mt-[100px] px-4'>
        
        {/* --- DASHBOARD HEADER --- */}
        <div className='w-full bg-white rounded-2xl shadow-sm border border-orange-100 p-4 flex justify-between items-center'>
             <div>
                <h1 className='text-xl font-bold text-[#ff4d2d]'>Hello, {userData?.fullName}</h1>
                <p className='text-xs text-gray-500'>Wallet: <span className="font-bold text-green-600">₹{userData?.walletBalance}</span></p>
             </div>
             <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                 <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-md text-sm font-semibold transition ${activeTab==='active' ? 'bg-white text-[#ff4d2d] shadow' : 'text-gray-500'}`}>Active Tasks</button>
                 <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-md text-sm font-semibold transition ${activeTab==='history' ? 'bg-white text-[#ff4d2d] shadow' : 'text-gray-500'}`}>My History</button>
             </div>
        </div>

        {activeTab === 'active' && (
            <>
                {/* 1. TODAY'S STATS */}
                <div className='bg-white rounded-2xl shadow-sm p-5 w-full border border-orange-100'>
                    <div className='flex justify-between items-center mb-4'>
                        <h1 className='text-lg font-bold text-gray-800'>Today's Performance</h1>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">Live</span>
                    </div>
                    
                    <div className='h-[180px] w-full'>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={todayDeliveries}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                                <YAxis allowDecimals={false} />
                                <Tooltip 
                                    formatter={(value) => [`${value} Orders`, "Count"]} 
                                    labelFormatter={label => `${label}:00`} 
                                />
                                <Bar dataKey="count" fill='#ff4d2d' radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className='mt-4 flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200'>
                        <div>
                            <p className='text-xs text-gray-500 uppercase font-bold'>Estimated Earnings</p>
                            <p className='text-xs text-gray-400'>Based on completion time</p>
                        </div>
                        <span className='text-3xl font-bold text-green-600'>₹{totalEarning}</span>
                    </div>
                </div>

                {/* 2. AVAILABLE ORDERS (FIXED) */}
                <div className='bg-white rounded-2xl p-5 shadow-sm w-full border border-orange-100'>
                    <h1 className='text-lg font-bold mb-4 flex items-center gap-2'>🔔 Available Requests</h1>
                    <div className='space-y-3'>
                        {availableAssignments?.length > 0 ? (
                        availableAssignments.map((a, index) => {
                            // IMPROVED COD CHECK: Looks for 'cod' (case-insensitive) OR existing cash value
                            const isCod = (a.paymentMethod && a.paymentMethod.toLowerCase() === 'cod') || (a.paidByCashOnline > 0);
                            return (
                                <div className='border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white hover:shadow-sm transition' key={index}>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className='font-bold text-gray-800'>{a?.shopName}</p>
                                            {/* REMOVED: The #b66e Order ID slice */}
                                        </div>
                                        <p className='text-sm text-gray-600 flex items-center gap-1'><FaMapMarkerAlt className="text-[#ff4d2d]"/> {a?.deliveryAddress?.text}</p>
                                        <div className="flex gap-2 mt-2">
                                            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">{a.items.length} Items</span>
                                            {/* CORRECTED BADGE */}
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${isCod ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                                {isCod ? `Collect ₹${a.paidByCashOnline || 0}` : 'Prepaid'}
                                            </span>
                                        </div>
                                    </div>
                                    <button className='bg-[#ff4d2d] text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-[#e04328] transition active:scale-95' onClick={() => acceptOrder(a.assignmentId)}>
                                        Accept
                                    </button>
                                </div>
                            )
                        })
                        ) : <p className='text-gray-400 text-sm text-center py-6 italic'>No new orders nearby.</p>}
                    </div>
                </div>

                {/* 3. ACTIVE ORDERS */}
                {displayedOrders.length > 0 && (
                    <div className='w-full'>
                        <h2 className='text-lg font-bold text-gray-800 mb-4 flex items-center gap-2'><FaMotorcycle/> Active Deliveries ({displayedOrders.length})</h2>
                        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                            {displayedOrders.map((order) => {
                                const isCod = (order.paymentMethod && order.paymentMethod.toLowerCase() === 'cod') || (order.paidByCashOnline > 0);
                                return (
                                <div key={order._id} className='bg-white rounded-xl p-5 shadow-md border-l-4 border-[#ff4d2d] flex flex-col'>
                                    <div className='border-b pb-3 mb-3'>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className='font-bold text-lg text-gray-800'>{order.shopName}</p>
                                                <p className='text-xs text-gray-500'>#{order._id.slice(-6)}</p>
                                            </div>
                                            <span className='bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold capitalize'>{order.shopOrder?.status}</span>
                                        </div>
                                        <p className='text-sm text-gray-600 mt-2 line-clamp-2'>{order.deliveryAddress.text}</p>
                                        
                                        <div className={`mt-3 p-2 rounded text-center border ${isCod ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Action Required</p>
                                            {isCod ? (
                                                <p className="text-xl font-bold text-[#ff4d2d]">Collect ₹{order.paidByCashOnline}</p>
                                            ) : (
                                                <p className="text-lg font-bold text-green-600">Give Package (Prepaid)</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="h-48 w-full rounded-lg overflow-hidden border border-gray-200 mb-4 bg-gray-100 relative">
                                        <DeliveryBoyTracking data={{
                                            deliveryBoyLocation: deliveryBoyLocation || { lat: 0, lon: 0 },
                                            customerLocation: { lat: order.customerLocation.lat, lon: order.customerLocation.lon }
                                        }} />
                                    </div>

                                    {!otpVisible[order._id] ? (
                                        <button className='w-full bg-green-500 text-white font-bold py-3 rounded-xl shadow hover:bg-green-600 transition flex justify-center items-center' onClick={() => sendOtp(order._id, order.shopOrder._id, order.user.mobile)} disabled={loadingOrders[order._id]}>
                                            {loadingOrders[order._id] ? <><ClipLoader size={18} color='white' className="mr-2"/> Sending...</> : "Arrived? Send SMS OTP"}
                                        </button>
                                    ) : (
                                        <div className='p-4 border border-orange-200 rounded-xl bg-orange-50 animate-fade-in'>
                                            <p className='text-sm font-semibold mb-2 text-center text-gray-700'>Ask Student for SMS OTP</p>
                                            <input 
                                                type="text" 
                                                inputMode="numeric" 
                                                pattern="[0-9]*"
                                                className='w-full border border-gray-300 px-3 py-3 rounded-lg mb-3 text-center text-2xl tracking-[0.6em] font-mono shadow-inner outline-none focus:ring-2 focus:ring-orange-500' 
                                                placeholder='XXXX' 
                                                maxLength={4} 
                                                onChange={(e) => handleOtpChange(order._id, e.target.value)} 
                                                value={otpInputs[order._id] || ""} 
                                            />
                                            <button className="w-full bg-[#ff4d2d] flex justify-center items-center text-white py-3 rounded-lg font-bold hover:bg-[#e04328] transition shadow disabled:opacity-70" onClick={() => verifyOtp(order._id, order.shopOrder._id)} disabled={loadingOrders[order._id]}>
                                                {loadingOrders[order._id] ? <ClipLoader size={18} color="white"/> : "Verify & Complete"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )})}
                        </div>
                    </div>
                )}
            </>
        )}

        {/* --- TAB: HISTORY --- */}
        {activeTab === 'history' && (
            <div className="w-full space-y-6 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">Total Earnings</p>
                        <h3 className="text-2xl font-bold text-green-700">₹{userData.walletBalance}</h3>
                        <p className="text-xs text-green-600">Wallet Balance</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">Cash in Hand</p>
                        <h3 className="text-2xl font-bold text-orange-700">
                            ₹{historyData.reduce((acc, day) => acc + day.cashCollected, 0)}
                        </h3>
                        <p className="text-xs text-orange-600">To Deposit</p>
                    </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><FaHistory/> Past Deliveries</h3>
                <div className="space-y-4">
                    {historyData.length > 0 ? historyData.map((day, index) => (
                        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition" onClick={() => setExpandedDate(expandedDate === day.date ? null : day.date)}>
                                <div>
                                    <h4 className="font-bold text-gray-800">{day.date}</h4>
                                    <p className="text-xs text-gray-500">{day.totalOrders} Orders • <span className="text-green-600 font-bold">₹{day.totalEarnings} Earned</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-orange-600">Cash: ₹{day.cashCollected}</p>
                                    <div className="text-gray-400 mt-1 flex justify-end">{expandedDate === day.date ? <FaChevronUp/> : <FaChevronDown/>}</div>
                                </div>
                            </div>
                            {expandedDate === day.date && (
                                <div className="bg-gray-50 p-3 border-t border-gray-100 space-y-2">
                                    {day.details.map((order, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded border border-gray-200 flex justify-between items-center text-sm">
                                            <div>
                                                <p className="font-semibold text-gray-800">{order.shopName}</p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">{order.time}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-green-600">+₹{order.earning}</p>
                                                {order.paymentMethod === 'cod' && <p className="text-xs text-orange-500 font-medium">Collected ₹{order.cashCollected}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )) : (
                        <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300"><p className="text-gray-400">No delivery history found.</p></div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  )
}

export default DeliveryBoy