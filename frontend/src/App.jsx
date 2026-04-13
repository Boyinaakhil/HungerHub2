import React, { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { io } from 'socket.io-client'
import { setSocket } from './redux/userSlice'

// Pages
import SignUp from './pages/SignUp'
import SignIn from './pages/SignIn'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import CreateEditShop from './pages/CreateEditShop'
import AddItem from './pages/AddItem'
import EditItem from './pages/EditItem'
import CartPage from './pages/CartPage'
import CheckOut from './pages/CheckOut'
import OrderPlaced from './pages/OrderPlaced'
import MyOrders from './pages/MyOrders'
import TrackOrderPage from './pages/TrackOrderPage'
import Shop from './pages/Shop'
import UserPoints from './pages/UserPoints'

// Components (Dashboards)
import DeliveryBoy from './components/DeliveryBoy'
import AdminDashboard from './components/AdminDashboard'
import HungerBot from './components/HungerBot'
import SplashScreen from './components/SplashScreen'

// Hooks
import useGetCurrentUser from './hooks/useGetCurrentUser'
import useGetCity from './hooks/useGetCity'
import useGetMyshop from './hooks/useGetMyShop'
import useGetShopByCity from './hooks/useGetShopByCity'
import useGetItemsByCity from './hooks/useGetItemsByCity'
import useGetMyOrders from './hooks/useGetMyOrders'
import useUpdateLocation from './hooks/useUpdateLocation'

export const serverUrl = "https://hungerhub-backend-59wx.onrender.com"

function App() {
  const { userData } = useSelector(state => state.user)
  const dispatch = useDispatch()
  
  // Splash Screen States
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [isFullyUnmounted, setIsFullyUnmounted] = useState(false);

  // Custom Hooks (Fetch Data on Load)
  useGetCurrentUser()
  useUpdateLocation()
  useGetCity()
  useGetMyshop()
  useGetShopByCity()
  useGetItemsByCity()
  useGetMyOrders()

  useEffect(() => {
    const socketInstance = io(serverUrl, { withCredentials: true })
    dispatch(setSocket(socketInstance))
    
    socketInstance.on('connect', () => {
      if (userData) {
        socketInstance.emit('identity', { userId: userData._id })
      }
    })
    
    return () => {
      socketInstance.disconnect()
    }
  }, [userData?._id])

  useEffect(() => {
     // Splash screen logic (Zomato-style)
     const timer1 = setTimeout(() => {
         setIsSplashVisible(false); // Trigger Framer Motion Exit
     }, 3500);

     const timer2 = setTimeout(() => {
         setIsFullyUnmounted(true); // Purge from DOM
     }, 4000);
     
     return () => {
         clearTimeout(timer1);
         clearTimeout(timer2);
     }
  }, []);

  const token = localStorage.getItem("token");

  return (
    <>
    {!isFullyUnmounted && <SplashScreen showSplash={isSplashVisible} />}
    
    <div className={!isFullyUnmounted ? "h-screen overflow-hidden opacity-0 pointer-events-none" : "animate-fade-in"}>
      {/* Hide underlying components if splash is running, OR if token is loading */}
      {(token && !userData) ? null : (
        <Routes>
          <Route path='/signup' element={!userData ? <SignUp /> : <Navigate to={"/"} />} />
          <Route path='/signin' element={!userData ? <SignIn /> : <Navigate to={"/"} />} />
          <Route path='/forgot-password' element={!userData ? <ForgotPassword /> : <Navigate to={"/"} />} />
          
          {/* Protected Routes */}
          <Route path='/' element={userData ? <Home /> : <Navigate to={"/signin"} />} />
          <Route path='/create-edit-shop' element={userData ? <CreateEditShop /> : <Navigate to={"/signin"} />} />
          <Route path='/add-item' element={userData ? <AddItem /> : <Navigate to={"/signin"} />} />
          <Route path='/edit-item/:itemId' element={userData ? <EditItem /> : <Navigate to={"/signin"} />} />
          <Route path='/cart' element={userData ? <CartPage /> : <Navigate to={"/signin"} />} />
          <Route path='/checkout' element={userData ? <CheckOut /> : <Navigate to={"/signin"} />} />
          <Route path='/order-placed' element={userData ? <OrderPlaced /> : <Navigate to={"/signin"} />} />
          <Route path='/my-orders' element={userData ? <MyOrders /> : <Navigate to={"/signin"} />} />
          <Route path='/track-order/:orderId' element={userData ? <TrackOrderPage /> : <Navigate to={"/signin"} />} />
          <Route path='/shop/:shopId' element={userData ? <Shop /> : <Navigate to={"/signin"} />} />
          
          {/* --- NEW FEATURES --- */}
          <Route path='/user-points' element={userData ? <UserPoints /> : <Navigate to={"/signin"} />} />
          <Route path='/delivery' element={userData?.role === 'deliveryBoy' ? <DeliveryBoy/> : <Navigate to="/"/>} />
          <Route path='/admin' element={userData?.role === 'admin' ? <AdminDashboard/> : <Navigate to="/"/>} />
        </Routes>
      )}
    </div>
    {isFullyUnmounted && <HungerBot />}
    </>
  )
}

export default App
