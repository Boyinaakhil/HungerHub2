import React, { useEffect, useRef, useState } from 'react'
import Nav from './Nav'
import { categories } from '../category'
import CategoryCard from './CategoryCard'
import { FaCircleChevronLeft, FaCircleChevronRight } from "react-icons/fa6";
import { 
    FaCalendarAlt, FaTimes, FaCheckCircle, FaExclamationTriangle, FaHistory,
    FaGift, FaInfoCircle, FaRobot, FaMagic // Used FaMagic for 'Sparkles'
} from "react-icons/fa"; 
import { useSelector, useDispatch } from 'react-redux';
import FoodCard from './FoodCard';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { serverUrl } from '../App';
import { setUserData, addToCart } from '../redux/userSlice';

function App() { // Renamed from UserDashboard to satisfy the prompt's explicit constraint
  const { currentCity, shopInMyCity, itemsInMyCity, searchItems, userData } = useSelector(state => state.user)
  const cateScrollRef = useRef()
  const shopScrollRef = useRef()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  
  // Scroll Buttons State
  const [showLeftCateButton, setShowLeftCateButton] = useState(false)
  const [showRightCateButton, setShowRightCateButton] = useState(false)
  const [showLeftShopButton, setShowLeftShopButton] = useState(false)
  const [showRightShopButton, setShowRightShopButton] = useState(false)
  const [updatedItemsList, setUpdatedItemsList] = useState([])

  // --- LEAVE FEATURE STATES ---
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false); 
  const [successData, setSuccessData] = useState(null);
  
  const [leaveDates, setLeaveDates] = useState({ start: "", end: "" });
  const [leaveCalculations, setLeaveCalculations] = useState(null);
  const [leaveError, setLeaveError] = useState("");
  const DAILY_MEAL_PRICE = 100; 

  // --- SMART MEAL ASSISTANT STATES ---
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const getWindowInfo = () => {
    const hour = new Date().getHours();
    if (hour < 8) return { name: "Breakfast", limit: 30 };
    if (hour >= 10 && hour <= 15) return { name: "Lunch", limit: 40 }; // 10 AM - 3 PM inclusive of 3
    if (hour >= 18 && hour <= 21) return { name: "Dinner", limit: 30 }; // 6 PM - 9 PM inclusive
    return { name: "Off-peak", limit: 0 };
  };

  const generateMealSuggestion = async () => {
    if (!itemsInMyCity || itemsInMyCity.length === 0) return;
    const windowInfo = getWindowInfo();
    if (windowInfo.limit === 0) {
      setAiError("No active meal window right now. The Admin sweep sleeps.");
      return;
    }

    setIsAiLoading(true);
    setAiError("");
    setAiSuggestion(null);

    try {
      const res = await axios.post(`${serverUrl}/api/chatbot/smart-meal`, {
        windowName: windowInfo.name,
        windowLimit: windowInfo.limit,
        items: itemsInMyCity.map(i => ({ id: i._id, name: i.name, price: i.price }))
      }, { withCredentials: true });
      
      setAiSuggestion(res.data);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403) {
        setAiError("Missing or Invalid Gemini API Key in the backend .env! Please set it and restart.");
      } else {
        setAiError("Failed to generate AI suggestion. Please check logs or try again.");
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAcceptAiSuggestion = () => {
    if (!aiSuggestion || !aiSuggestion.items) return;
    
    // Find each suggested item and add to cart based on strict equality
    aiSuggestion.items.forEach(suggestedItem => {
      const fullItem = itemsInMyCity?.find(i => i._id === suggestedItem.id || i.name === suggestedItem.name);
      if (fullItem) {
         dispatch(addToCart({
             id: fullItem._id,
             _id: fullItem._id,
             name: fullItem.name,
             price: fullItem.price,
             image: fullItem.image,
             shop: fullItem.shop,
             quantity: 1,
             foodType: fullItem.foodType
         }));
      }
    });
  };

  // Fire AI suggestion immediately on mount — items are already in Redux from splash screen background load.
  // Use a tiny 1-second delay so the dashboard has time to render visually before the API call fires.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (itemsInMyCity?.length > 0 && !aiSuggestion && !isAiLoading) {
        generateMealSuggestion();
      }
    }, 1000); // 1 second after dashboard appears = 5 seconds total after app launch

    return () => clearTimeout(timer);
  }, []); // Empty deps = fires once on mount, not waiting for itemsInMyCity to "change"

  // --- 1. HELPER: CHECK IF USER IS CURRENTLY ON LEAVE ---
  const checkIsOnLeave = () => {
    if (!userData?.leaves) return false;
    
    const today = new Date();
    today.setHours(0,0,0,0); // Normalize today

    // Find a leave range that includes TODAY
    return userData.leaves.find(leave => {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        // Normalize stored dates
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        
        return today >= start && today <= end;
    });
  };

  const currentActiveLeave = checkIsOnLeave();
  // ---------------------------------------------------------

  // --- FILTER LOGIC ---
  const handleFilterByCategory = (category) => {
    if (category == "All") {
      setUpdatedItemsList(itemsInMyCity)
    } else {
      const filteredList = itemsInMyCity?.filter(i => i.category === category)
      setUpdatedItemsList(filteredList)
    }
  }

  useEffect(() => {
    setUpdatedItemsList(itemsInMyCity)
  }, [itemsInMyCity])

  // --- SCROLL LOGIC ---
  const updateButton = (ref, setLeftButton, setRightButton) => {
    const element = ref.current
    if (element) {
      setLeftButton(element.scrollLeft > 0)
      setRightButton(element.scrollLeft + element.clientWidth < element.scrollWidth)
    }
  }
  const scrollHandler = (ref, direction) => {
    if (ref.current) {
      ref.current.scrollBy({
        left: direction == "left" ? -200 : 200,
        behavior: "smooth"
      })
    }
  }

  useEffect(() => {
    if (cateScrollRef.current) {
      updateButton(cateScrollRef, setShowLeftCateButton, setShowRightCateButton)
      updateButton(shopScrollRef, setShowLeftShopButton, setShowRightShopButton)
      cateScrollRef.current.addEventListener('scroll', () => {
        updateButton(cateScrollRef, setShowLeftCateButton, setShowRightCateButton)
      })
      shopScrollRef.current.addEventListener('scroll', () => {
        updateButton(shopScrollRef, setShowLeftShopButton, setShowRightShopButton)
      })
    }
  }, [categories])

  // ==========================================
  //       NEW FEATURE: LEAVE LOGIC
  // ==========================================

  const getMinStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 3); 
    return date.toISOString().split('T')[0];
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

  // Check for Date Overlaps with Existing Leaves
  const checkOverlap = (start, end) => {
    if (!userData?.leaves) return false;
    
    const newStart = new Date(start);
    const newEnd = new Date(end);

    return userData.leaves.some(leave => {
        const existingStart = new Date(leave.startDate);
        const existingEnd = new Date(leave.endDate);
        return (newStart <= existingEnd && newEnd >= existingStart);
    });
  };

  useEffect(() => {
    if (leaveDates.start && leaveDates.end) {
      const start = new Date(leaveDates.start);
      const end = new Date(leaveDates.end);
      
      const diffTime = end - start;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      setLeaveError("");
      setLeaveCalculations(null);

      if (diffDays <= 0) { setLeaveError("End date must be after start date."); return; }
      if (diffDays < 6) { setLeaveError("Minimum leave duration is 6 days."); return; }
      if (checkOverlap(leaveDates.start, leaveDates.end)) { setLeaveError("⛔ You already have leave applied during these dates!"); return; }

      const discountDays = Math.floor(diffDays / 2);
      const discountAmount = discountDays * DAILY_MEAL_PRICE;
      const totalPointsBurned = diffDays * DAILY_MEAL_PRICE; 

      setLeaveCalculations({
        totalDays: diffDays,
        pointsBurned: totalPointsBurned,
        discountAmount: discountAmount
      });
    }
  }, [leaveDates, userData]); 

  // --- SUBMIT FUNCTION (no client token check) ---
  const handleSubmitLeave = async () => {
    if (!leaveCalculations || leaveError) return;
    
    if(userData.walletBalance < leaveCalculations.pointsBurned) {
        alert("Insufficient Balance in Wallet!"); return;
    }

    try {
        const res = await axios.post(`${serverUrl}/api/user/apply-leave`, 
            { startDate: leaveDates.start, endDate: leaveDates.end },
            { withCredentials: true } // ✅ backend handles token
        );

        setShowLeaveModal(false); 
        
        // Optimistically update local state to show results immediately
        dispatch(setUserData({
            ...userData,
            walletBalance: res.data.remainingBalance,
            nextMonthCoupon: (userData.nextMonthCoupon || 0) + res.data.refundCoupon,
            leaves: [...(userData.leaves || []), { startDate: leaveDates.start, endDate: leaveDates.end }]
        }));

        setSuccessData({
            deducted: leaveCalculations.pointsBurned,
            coupon: res.data.refundCoupon,
            days: leaveCalculations.totalDays
        });
        
        setShowSuccessModal(true); 
        setLeaveDates({ start: "", end: "" });
        
        setTimeout(() => window.location.reload(), 4000); 

    } catch (error) {
        console.error("Leave Request Error:", error);
        alert(error.response?.data?.message || "Error applying leave. Please ensure you are logged in.");
    }
  }

  // ==========================================

  return (
    <div className='w-screen min-h-screen flex flex-col gap-5 items-center bg-[#fff9f6] overflow-y-auto relative'>
      <Nav />

      {/* ======================================================= */}
      {/* 🔴 SMART MEAL ASSISTANT DASHBOARD */}
      {/* ======================================================= */}
      <div className='w-full max-w-6xl px-5 mt-4'>
        <div className="bg-white border border-[#ff4d2d] rounded-2xl p-4 shadow-sm text-gray-800 flex flex-col gap-2 relative overflow-hidden">
          {/* Background Decorative Sparkles */}
          <FaMagic className="absolute text-5xl text-[#ff4d2d] opacity-5 -top-2 -right-4 transform rotate-12" />
          
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-[#ff4d2d]">
              <FaRobot className="text-2xl" /> Smart Meal Assistant
            </h2>
            <button 
              onClick={generateMealSuggestion}
              className="bg-[#ff4d2d] hover:bg-[#e64528] text-white px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              disabled={isAiLoading}
            >
              <FaMagic className={isAiLoading ? 'animate-spin' : 'animate-pulse'} /> 
              {isAiLoading ? 'Calculating' : 'Recalculate'}
            </button>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 min-h-[60px] flex flex-col items-center justify-center">
            {isAiLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-[#ff4d2d] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-600 text-sm font-medium">Calculating efficiency...</p>
              </div>
            ) : aiError ? (
              <p className="text-red-500 text-sm font-semibold text-center flex items-center gap-2">
                <FaExclamationTriangle /> {aiError}
              </p>
            ) : aiSuggestion ? (
              <div className="w-full flex flex-col gap-2 animate-fade-in">
                <p className="text-sm text-gray-700 italic">
                  "{aiSuggestion.explanation}"
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {aiSuggestion.items?.map((item, idx) => (
                    <div key={idx} className="bg-white text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-bold shadow-sm flex items-center gap-2">
                      <span className="text-[#ff4d2d]">🍽️</span> 
                      <span>{item.name}</span>
                      <span className="text-xs bg-orange-100 px-2 py-0.5 rounded-full text-orange-800">{item.price} pts</span>
                    </div>
                  ))}
                  <div className="bg-[#ff4d2d] text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-md flex items-center">
                    Total: {aiSuggestion.totalPoints} pts
                  </div>
                  <button 
                    onClick={handleAcceptAiSuggestion}
                    className="ml-auto bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-md flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                  >
                    🛒 Add to Cart
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm italic">Waiting for items to generate suggestion...</p>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================= */}
      {/* 🟢 VISUAL CHECK AREA: Status Indicators */}
      {/* ======================================================= */}
      <div className='w-full max-w-6xl px-5 mt-2 flex flex-col gap-3'>
        
        {/* 1. CHECK DISCOUNT STATUS */}
        {userData?.nextMonthCoupon > 0 && (
            <div className="bg-green-100 border border-green-300 text-green-800 p-4 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-full shadow-sm">
                        <FaGift className="text-green-600 text-xl" />
                    </div>
                    <div>
                        <h3 className="font-bold">Next Payment Discount Active!</h3>
                        <p className="text-sm">
                            You have a <span className="font-bold text-green-900">₹{userData.nextMonthCoupon}</span> coupon applied. 
                            It will be automatically used in your next recharge.
                        </p>
                    </div>
                </div>
            </div>
        )}

        {/* 2. CHECK LEAVE STATUS */}
        {currentActiveLeave ? (
            <div className="bg-orange-100 border border-orange-300 text-orange-800 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-pulse">
                <div className="bg-white p-2 rounded-full shadow-sm">
                    <FaInfoCircle className="text-orange-600 text-xl" />
                </div>
                <div>
                    <h3 className="font-bold">Mess Leave Active ({formatDate(currentActiveLeave.startDate)} - {formatDate(currentActiveLeave.endDate)})</h3>
                    <p className="text-sm">
                        <b>Points usage is disabled.</b> You can still order food by paying Cash/Online.
                    </p>
                </div>
            </div>
        ) : (
            <div className='w-full flex justify-end'>
                <button onClick={() => setShowLeaveModal(true)} className='flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition shadow-md text-sm font-medium'>
                    <FaCalendarAlt /> Apply for Mess Leave
                </button>
            </div>
        )}
      </div>
      {/* ======================================================= */}

      {/* --- LEAVE MODAL --- */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in relative">
            <div className="bg-[#ff4d2d] p-4 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold flex items-center gap-2"><FaCalendarAlt/> Apply for Leave</h2>
              <button onClick={() => setShowLeaveModal(false)}><FaTimes size={20}/></button>
            </div>
            
            <div className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              
              {userData?.leaves && userData.leaves.length > 0 && (
                 <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs">
                    <p className="font-bold text-blue-800 flex items-center gap-1 mb-1">
                        <FaHistory/> Your Upcoming Leaves:
                    </p>
                    <ul className="list-disc pl-4 text-blue-700">
                        {userData.leaves.filter(l => new Date(l.endDate) >= new Date()).map((l, i) => (
                            <li key={i}>{formatDate(l.startDate)} to {formatDate(l.endDate)}</li>
                        ))}
                    </ul>
                 </div>
              )}

              <p className="text-sm text-gray-500">
                Not eating? Tell us (min 2 days before). 
                Minimum <span className="font-bold text-gray-800">6 Days</span>.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-600">From</label>
                  <input 
                    type="date" 
                    className="border p-2 rounded-lg focus:outline-[#ff4d2d]"
                    min={getMinStartDate()} 
                    value={leaveDates.start}
                    onChange={(e) => setLeaveDates({...leaveDates, start: e.target.value})}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-600">To</label>
                  <input 
                    type="date" 
                    className="border p-2 rounded-lg focus:outline-[#ff4d2d]"
                    min={leaveDates.start || getMinStartDate()}
                    value={leaveDates.end}
                    onChange={(e) => setLeaveDates({...leaveDates, end: e.target.value})}
                  />
                </div>
              </div>

              {leaveError && (
                <div className="text-red-600 text-xs font-bold text-center bg-red-100 p-3 rounded flex items-center justify-center gap-2">
                    <FaExclamationTriangle/> {leaveError}
                </div>
              )}

              {leaveCalculations && !leaveError && (
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl space-y-2 mt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-bold text-gray-800">{leaveCalculations.totalDays} Days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Points Deducted Now:</span>
                    <span className="font-bold text-red-500">-{leaveCalculations.pointsBurned}</span>
                  </div>
                  <div className="border-t border-orange-200 my-1 pt-1 flex justify-between text-sm">
                    <span className="text-gray-600">Next Month Coupon:</span>
                    <span className="font-bold text-green-600">+{leaveCalculations.discountAmount} Points</span>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-2 italic">
                    *Points transferred to Admin Vault.
                  </p>
                </div>
              )}

              <button 
                onClick={handleSubmitLeave}
                disabled={!leaveCalculations || !!leaveError}
                className={`w-full py-3 rounded-xl text-white font-bold transition mt-2
                  ${!leaveCalculations || leaveError ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#ff4d2d] hover:bg-[#e64528] shadow-lg'}
                `}
              >
                Pay & Confirm Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUCCESS MODAL --- */}
      {showSuccessModal && successData && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 relative">
                <button onClick={() => setShowSuccessModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><FaTimes/></button>
                
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaCheckCircle className="text-green-500 text-3xl"/>
                </div>
                
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Leave Approved!</h2>
                <p className="text-gray-500 text-sm mb-6">
                    Your request for <b>{successData.days} days</b> has been processed successfully.
                </p>

                <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm border border-gray-100">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500">Status</span>
                        <span className="font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded text-xs">CONFIRMED</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500">Points Deducted</span>
                        <span className="font-bold text-red-500">-{successData.deducted}</span>
                    </div>
                    <div className="h-px bg-gray-200"></div>
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500 text-xs">Transferred to Admin Vault</span>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-800 font-bold">Discount (Next Month)</span>
                            <span className="font-bold text-blue-600">+{successData.coupon} Pts</span>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => {
                        setShowSuccessModal(false);
                        window.location.reload(); 
                    }}
                    className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold mt-6 hover:bg-black transition"
                >
                    Done
                </button>
             </div>
          </div>
      )}

      {/* --- CONTENT SECTION --- */}
      {searchItems && searchItems.length > 0 && (
        <div className='w-full max-w-6xl flex flex-col gap-5 items-start p-5 bg-white shadow-md rounded-2xl mt-4'>
            <h1 className='text-gray-900 text-2xl sm:text-3xl font-semibold border-b border-gray-200 pb-2'>
              Search Results
            </h1>
            <div className='w-full h-auto flex flex-wrap gap-6 justify-center'>
              {searchItems.map((item)=>(<FoodCard data={item} key={item._id}/>))}
            </div>
        </div>
      )}

      <div className="w-full max-w-6xl flex flex-col gap-5 items-start p-[10px]">
        <h1 className='text-gray-800 text-2xl sm:text-3xl'>Inspiration for your first order</h1>
        <div className='w-full relative'>
          {showLeftCateButton &&  <button className='absolute left-0 top-1/2 -translate-y-1/2 bg-[#ff4d2d] text-white p-2 rounded-full shadow-lg hover:bg-[#e64528] z-10' onClick={()=>scrollHandler(cateScrollRef,"left")}><FaCircleChevronLeft /></button>}
          <div className='w-full flex overflow-x-auto gap-4 pb-2 ' ref={cateScrollRef}>
            {categories.map((cate, index) => (<CategoryCard name={cate.category} image={cate.image} key={index} onClick={()=>handleFilterByCategory(cate.category)}/>))}
          </div>
          {showRightCateButton &&  <button className='absolute right-0 top-1/2 -translate-y-1/2 bg-[#ff4d2d] text-white p-2 rounded-full shadow-lg hover:bg-[#e64528] z-10' onClick={()=>scrollHandler(cateScrollRef,"right")}><FaCircleChevronRight /></button>}
        </div>
      </div>

      <div className='w-full max-w-6xl flex flex-col gap-5 items-start p-[10px]'>
        <h1 className='text-gray-800 text-2xl sm:text-3xl'>Best Shop in {currentCity}</h1>
        <div className='w-full relative'>
          {showLeftShopButton &&  <button className='absolute left-0 top-1/2 -translate-y-1/2 bg-[#ff4d2d] text-white p-2 rounded-full shadow-lg hover:bg-[#e64528] z-10' onClick={()=>scrollHandler(shopScrollRef,"left")}><FaCircleChevronLeft /></button>}
          <div className='w-full flex overflow-x-auto gap-4 pb-2 ' ref={shopScrollRef}>
            {shopInMyCity?.map((shop, index) => (<CategoryCard name={shop.name} image={shop.image} key={index} onClick={()=>navigate(`/shop/${shop._id}`)}/>))}
          </div>
          {showRightShopButton &&  <button className='absolute right-0 top-1/2 -translate-y-1/2 bg-[#ff4d2d] text-white p-2 rounded-full shadow-lg hover:bg-[#e64528] z-10' onClick={()=>scrollHandler(shopScrollRef,"right")}><FaCircleChevronRight /></button>}
        </div>
      </div>

      {/* --- FOOD ITEMS (ALWAYS VISIBLE NOW) --- */}
      <div className='w-full max-w-6xl flex flex-col gap-5 items-start p-[10px]'>
       <h1 className='text-gray-800 text-2xl sm:text-3xl'>
        Suggested Food Items
       </h1>

        <div className='w-full h-auto flex flex-wrap gap-[20px] justify-center'>
        {updatedItemsList?.map((item,index)=>(<FoodCard key={index} data={item}/>))}
        </div>
      </div>
    </div>
  )
}

export default App
