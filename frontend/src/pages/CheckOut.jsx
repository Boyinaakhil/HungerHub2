import React, { useEffect, useState } from 'react'
import { IoIosArrowRoundBack } from "react-icons/io";
import { IoSearchOutline, IoLocationSharp } from "react-icons/io5"; 
import { TbCurrentLocation } from "react-icons/tb";
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { useDispatch, useSelector } from 'react-redux';
import "leaflet/dist/leaflet.css"
import { setAddress, setLocation } from '../redux/mapSlice';
import { MdDeliveryDining } from "react-icons/md";
import { FaCreditCard } from "react-icons/fa";
import axios from 'axios';
import { FaMobileScreenButton } from "react-icons/fa6";
import { useNavigate } from 'react-router-dom';
import { serverUrl } from '../App';
import { FaHome, FaEdit } from "react-icons/fa";
import { addMyOrder, setUserData, clearCart } from '../redux/userSlice'; // Import clearCart

function RecenterMap({ location }) {
  if (location.lat && location.lon) {
    const map = useMap()
    map.setView([location.lat, location.lon], 16, { animate: true })
  }
  return null
}

function CheckOut() {
  const { location, address } = useSelector(state => state.map)
  const { cartItems, totalAmount, userData } = useSelector(state => state.user)
  const [addressInput, setAddressInput] = useState("")
  const [profileName, setProfileName] = useState("")
  const [profileMobile, setProfileMobile] = useState("")
  const [manualAddress, setManualAddress] = useState("")
  const [isEditingAddress, setIsEditingAddress] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState("cod")
  const [walletDiscount, setWalletDiscount] = useState(0)
  const [deliveryFee, setDeliveryFee] = useState(0) 
  
  const navigate = useNavigate()
  const dispatch = useDispatch()
  
  const apiKey = import.meta.env.VITE_GEOAPIKEY
  
  // Grand Total = Food Cost + Delivery Fee
  const grandTotal = totalAmount + deliveryFee
  
  // Payable Amount = Grand Total - Wallet Savings
  const payableAmount = Math.max(0, grandTotal - walletDiscount) 

  // --- SMART LOGIC: Time-Based Delivery Fee & Discounts ---
  useEffect(() => {
    if (!userData) return;

    const hour = new Date().getHours();
    let limit = 0;
    let used = 0; // Track how much they already used today
    let fee = 40; // Default: Charge ₹40 delivery fee (Off-Peak hours)

    // Check Time Slots
    if (hour < 8) { 
        // Breakfast (Before 8 AM)
        limit = 30; 
        used = userData.subscription?.breakfastUsed || 0;
        fee = 0; // Free Delivery
    } else if (hour >= 10 && hour < 15) { 
        // Lunch (10 AM - 3 PM)
        limit = 40; 
        used = userData.subscription?.lunchUsed || 0;
        fee = 0; // Free Delivery
    } else if (hour >= 18 && hour < 21) { 
        // Dinner (6 PM - 9 PM)
        limit = 30; 
        used = userData.subscription?.dinnerUsed || 0;
        fee = 0; // Free Delivery
    }

    setDeliveryFee(fee);

    // Calculate Wallet Deduction
    // 1. Calculate Remaining Daily Limit (e.g., 40 - 40 = 0 if already ate)
    const remainingLimit = Math.max(0, limit - used);

    // 2. Can't deduct more than the remaining limit
    // 3. Can't deduct more than the FOOD cost (wallet doesn't cover delivery fee)
    const maxDeductible = Math.min(remainingLimit, totalAmount);
    
    // 4. Can't deduct more than user HAS in wallet balance
    const actualDeduction = Math.min(maxDeductible, userData.walletBalance || 0);

    setWalletDiscount(actualDeduction);

  }, [totalAmount, userData]); // Re-run if cart total or user data changes


  const onDragEnd = (e) => {
    const { lat, lng } = e.target._latlng
    dispatch(setLocation({ lat, lon: lng }))
    getAddressByLatLng(lat, lng)
  }
  
  const getCurrentLocation = () => {
      if (userData?.location?.coordinates) {
        const latitude = userData.location.coordinates[1]
        const longitude = userData.location.coordinates[0]
        dispatch(setLocation({ lat: latitude, lon: longitude }))
        getAddressByLatLng(latitude, longitude)
      }
  }

  const getAddressByLatLng = async (lat, lng) => {
    try {
      const result = await axios.get(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&format=json&apiKey=${apiKey}`)
      if (result.data.results && result.data.results.length > 0) {
        dispatch(setAddress(result.data.results[0].address_line2))
      }
    } catch (error) {
      console.log(error)
    }
  }

  const getLatLngByAddress = async () => {
    try {
      const result = await axios.get(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(addressInput)}&apiKey=${apiKey}`)
      if (result.data.features && result.data.features.length > 0) {
        const { lat, lon } = result.data.features[0].properties
        dispatch(setLocation({ lat, lon }))
      }
    } catch (error) {
      console.log(error)
    }
  }

  const refreshUserData = async () => {
    try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${serverUrl}/api/user/current`, { 
            headers: { Authorization: `Bearer ${token}` },
            withCredentials: true 
        });
        if(res.status === 200) {
            dispatch(setUserData(res.data));
        }
    } catch (error) {
        console.log("Failed to refresh balance", error);
    }
  }

  useEffect(() => {
    if (userData) {
      if (userData.fullName) setProfileName(userData.fullName);
      if (userData.mobile) setProfileMobile(userData.mobile);

      // 1. Auto-fill Saved Address
      if (userData.savedAddress) {
        setManualAddress(userData.savedAddress);
        setIsEditingAddress(false);
      }
      
      // 2. Auto-load GPS Coordinates (if previously saved and currently empty in Redux)
      if (userData.location?.coordinates && userData.location.coordinates[0] !== 0 && userData.location.coordinates[1] !== 0) {
        if (!location || (!location.lat && !location.lon)) {
           dispatch(setLocation({ lat: userData.location.coordinates[1], lon: userData.location.coordinates[0] }));
        }
      }
    }
  }, [userData])

  const handlePlaceOrder = async () => {
    if (!profileName.trim() || !profileMobile.trim() || !manualAddress.trim()) {
        alert("Please complete your delivery profile fields.");
        return;
    }
    if (!location?.lat || !location?.lon) {
        alert("Please select a location on the map.");
        return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // If profile is incomplete, save all profile data
      if (!userData?.isProfileComplete) {
          await axios.post(`${serverUrl}/api/user/update-profile`, {
              fullName: profileName,
              mobile: profileMobile,
              savedAddress: manualAddress
          }, { 
              headers: { Authorization: `Bearer ${token}` },
              withCredentials: true 
          });
      } 
      // Otherwise if only the address changed, just update address
      else if (manualAddress !== userData?.savedAddress) {
          await axios.post(`${serverUrl}/api/user/update-address`, {
              savedAddress: manualAddress
          }, { 
              headers: { Authorization: `Bearer ${token}` },
              withCredentials: true 
          });
      }

      // Always save the latest dropped PIN location permanently so the user doesn't have to do it again
      await axios.post(`${serverUrl}/api/user/update-location`, {
          lat: location.lat,
          lon: location.lon
      }, { 
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true 
      });

      // Send the FOOD price (totalAmount) to backend. 
      const result = await axios.post(`${serverUrl}/api/order/place-order`, {
        paymentMethod,
        deliveryAddress: {
          text: `Deliver to: ${profileName} | ${manualAddress}`, // Formatted for Delivery Boy App
          latitude: location.lat,
          longitude: location.lon
        },
        totalAmount: totalAmount, // Send base food amount
        cartItems
      }, { 
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true 
      })

      // Backend returns the actual final calculation
      const backendOrderId = result.data.orderId;
      const backendRazorOrder = result.data.razorOrder;
      
      // If backend says we need to pay online (because of delivery fee or insufficient wallet)
      if (paymentMethod === "online" && backendRazorOrder) {
        openRazorpayWindow(backendOrderId, backendRazorOrder);
      } else {
        // COD or Fully Wallet Paid
        dispatch(addMyOrder(result.data))
        dispatch(clearCart()) // --- FIX: Clear cart after order ---
        await refreshUserData(); 
        navigate("/order-placed")
      }

    } catch (error) {
      console.log(error)
      alert(error.response?.data?.message || "Order Failed")
    }
  }

  const openRazorpayWindow = (orderId, razorOrder) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: razorOrder.amount,
      currency: 'INR',
      name: "HungerHub",
      description: "Food Delivery",
      order_id: razorOrder.id,
      handler: async function (response) {
        try {
          const token = localStorage.getItem('token');
          const result = await axios.post(`${serverUrl}/api/order/verify-payment`, {
            razorpay_payment_id: response.razorpay_payment_id,
            orderId
          }, { 
            headers: { Authorization: `Bearer ${token}` },
            withCredentials: true 
          })
          
          dispatch(addMyOrder(result.data))
          dispatch(clearCart()) // --- FIX: Clear cart after payment ---
          await refreshUserData(); 
          navigate("/order-placed")
        } catch (error) {
          console.log(error)
          alert("Payment Verification Failed")
        }
      },
      theme: {
        color: "#ff4d2d"
      }
    }

    const rzp = new window.Razorpay(options)
    rzp.open()
  }

  useEffect(() => {
    if (address) {
        setAddressInput(address)
    }
  }, [address])

  return (
    <div className='min-h-screen bg-[#fff9f6] flex items-center justify-center p-6 pt-[100px]'>
      <div className=' absolute top-[90px] left-[20px] z-[10] cursor-pointer' onClick={() => navigate("/")}>
        <IoIosArrowRoundBack size={35} className='text-[#ff4d2d]' />
      </div>
      <div className='w-full max-w-[900px] bg-white rounded-2xl shadow-xl p-6 space-y-6'>
        <h1 className='text-2xl font-bold text-gray-800'>Checkout</h1>

        <section>
          <h2 className='text-lg font-semibold mb-2 flex items-center gap-2 text-gray-800'><IoLocationSharp className='text-[#ff4d2d]' /> GPS Coordinates</h2>
          <div className='flex gap-2 mb-3'>
            <input type="text" className='flex-1 border border-gray-300 rounded-lg p-2 text-sm bg-gray-100 cursor-not-allowed text-gray-600' placeholder='Map Address...' value={addressInput} readOnly />
            <button className='bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center justify-center transition' onClick={getCurrentLocation} title="Get Current Location"><TbCurrentLocation size={17} /></button>
          </div>
          <div className='rounded-xl border border-gray-200 overflow-hidden mb-5 shadow-sm'>
            <div className='h-64 w-full flex items-center justify-center'>
              <MapContainer
                className={"w-full h-full"}
                center={[location?.lat || 20.5937, location?.lon || 78.9629]} 
                zoom={16}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RecenterMap location={location} />
                <Marker position={[location?.lat || 20.5937, location?.lon || 78.9629]} draggable eventHandlers={{ dragend: onDragEnd }} />
              </MapContainer>
            </div>
          </div>

          <h2 className='text-lg font-semibold mb-3 flex items-center gap-2 text-gray-800'>
             <FaHome className='text-[#ff4d2d]' /> {userData?.isProfileComplete && !isEditingAddress ? 'Delivery To' : 'Complete Delivery Profile'}
          </h2>
          {(!userData?.isProfileComplete || isEditingAddress) ? (
            <div className='animate-fade-in space-y-3 bg-orange-50/50 p-4 border border-orange-200 rounded-xl'>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-600">Full Name</label>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#ff4d2d]"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            placeholder="Your Name"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-600">Mobile Number</label>
                        <input 
                            type="tel" 
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:border-[#ff4d2d]"
                            value={profileMobile}
                            onChange={(e) => setProfileMobile(e.target.value)}
                            placeholder="+91 XXXXXXXXXX"
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-600">Manual Address</label>
                    <textarea 
                        className='w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:border-[#ff4d2d] shadow-sm' 
                        placeholder='e.g. Room No, Hostel Name, Landmark' 
                        value={manualAddress} 
                        onChange={(e) => setManualAddress(e.target.value)}
                        rows={3}
                    ></textarea>
                </div>
                <p className='text-xs text-gray-500 italic'>* This profile will be saved permanently to instantly place future orders.</p>
            </div>
          ) : (
            <div className='bg-orange-50 border border-orange-200 p-4 rounded-xl flex justify-between items-start shadow-sm animate-fade-in'>
               <div className='flex gap-3'>
                   <div className='bg-white p-2 rounded-full shadow-sm text-[#ff4d2d] h-8 w-8 flex items-center justify-center'>
                       <FaHome size={16} />
                   </div>
                   <div>
                       <p className='text-xs text-gray-500 font-bold uppercase mb-1'>{profileName} • {profileMobile}</p>
                       <p className='text-sm text-gray-800 font-medium whitespace-pre-wrap'>{manualAddress}</p>
                   </div>
               </div>
               <button 
                  onClick={() => setIsEditingAddress(true)}
                  className='text-[#ff4d2d] hover:text-[#e64526] bg-white border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition shadow-sm'
               >
                   <FaEdit /> Edit
               </button>
            </div>
          )}
        </section>

        <section>
          <h2 className='text-lg font-semibold mb-3 text-gray-800'>Order Summary</h2>
          <div className='rounded-xl border bg-gray-50 p-4 space-y-2'>
            {cartItems.map((item, index) => (
              <div key={index} className='flex justify-between text-sm text-gray-700'>
                <span>{item.name} x {item.quantity}</span>
                <span>₹{item.price * item.quantity}</span>
              </div>
            ))}
            <hr className='border-gray-200 my-2' />
            
            <div className='flex justify-between font-medium text-gray-800'>
              <span>Subtotal</span>
              <span>₹{totalAmount}</span>
            </div>
            
            {/* --- DELIVERY FEE DISPLAY --- */}
            <div className='flex justify-between text-gray-700'>
              <span>Delivery Fee</span>
              {deliveryFee > 0 ? (
                  <span className='text-orange-600 font-medium'>+ ₹{deliveryFee} (Off-Peak)</span>
              ) : (
                  <span className='text-green-600 font-medium'>Free (Meal Time)</span>
              )}
            </div>

            {/* --- WALLET DISCOUNT DISPLAY --- */}
            {walletDiscount > 0 ? (
                <div className='flex justify-between text-green-600 font-bold'>
                    <span>Wallet Savings (Plan)</span>
                    <span>- ₹{walletDiscount}</span>
                </div>
            ) : (
                <div className='flex justify-between text-gray-400 text-sm'>
                    <span>Wallet Savings</span>
                    <span>₹0 {deliveryFee === 0 ? "(Daily Limit Reached)" : "(Off-Peak)"}</span>
                </div>
            )}

            <div className='border-t border-gray-300 pt-2 flex justify-between text-xl font-bold text-[#ff4d2d]'>
              <span>To Pay</span>
              <span>₹{payableAmount}</span>
            </div>
          </div>
        </section>

        {/* Hide Payment Options if Payable is 0 (Fully covered by wallet) */}
        {payableAmount > 0 && (
            <section>
            <h2 className='text-lg font-semibold mb-3 text-gray-800'>Payment Method</h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div className={`flex items-center gap-3 rounded-xl border p-4 text-left transition cursor-pointer ${paymentMethod === "cod" ? "border-[#ff4d2d] bg-orange-50 shadow" : "border-gray-200 hover:border-gray-300"
                }`} onClick={() => setPaymentMethod("cod")}>

                <span className='inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-100'>
                    <MdDeliveryDining className='text-green-600 text-xl' />
                </span>
                <div >
                    <p className='font-medium text-gray-800'>Cash On Delivery</p>
                    <p className='text-xs text-gray-500'>Pay ₹{payableAmount} on delivery</p>
                </div>

                </div>
                <div className={`flex items-center gap-3 rounded-xl border p-4 text-left transition cursor-pointer ${paymentMethod === "online" ? "border-[#ff4d2d] bg-orange-50 shadow" : "border-gray-200 hover:border-gray-300"
                }`} onClick={() => setPaymentMethod("online")}>

                <span className='inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-100'>
                    <FaMobileScreenButton className='text-purple-700 text-lg' />
                </span>
                <span className='inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100'>
                    <FaCreditCard className='text-blue-700 text-lg' />
                </span>
                <div>
                    <p className='font-medium text-gray-800'>Pay Online</p>
                    <p className='text-xs text-gray-500'>UPI / Cards / NetBanking</p>
                </div>
                </div>
            </div>
            </section>
        )}

        <button 
            className={`w-full py-3 rounded-xl font-semibold shadow-lg transition transform ${
                !manualAddress.trim() || !profileName.trim() || !profileMobile.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-[#ff4d2d] hover:bg-[#e64526] text-white hover:scale-[1.01]'
            }`} 
            onClick={handlePlaceOrder}
            disabled={!manualAddress.trim() || !profileName.trim() || !profileMobile.trim()}
        > 
            {payableAmount === 0 ? "Place Order (Paid by Wallet)" : 
             paymentMethod == "cod" ? `Place Order (Pay ₹${payableAmount} later)` : `Pay ₹${payableAmount} & Place Order`}
        </button>

      </div>
    </div>
  )
}

export default CheckOut