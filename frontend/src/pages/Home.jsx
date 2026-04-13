import React from 'react'
import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom' // Import Navigate
import UserDashboard from '../components/UserDashboard' // Check capitalization (userDashboard vs UserDashboard)
import OwnerDashboard from '../components/OwnerDashboard'
import DeliveryBoy from '../components/DeliveryBoy'

function Home() {
  const { userData } = useSelector(state => state.user)

  // --- FIX: Redirect Admin to the Admin Panel ---
  if (userData?.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className='w-[100vw] min-h-[100vh] pt-[100px] flex flex-col items-center bg-[#fff9f6]'>
      {userData.role === "user" && <UserDashboard />}
      {userData.role === "owner" && <OwnerDashboard />}
      {userData.role === "deliveryBoy" && <DeliveryBoy />}
    </div>
  )
}

export default Home
