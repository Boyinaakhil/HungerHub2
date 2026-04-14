import React from 'react'
import { useState, useEffect } from 'react';
import { FaRegEye } from "react-icons/fa";
import { FaRegEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { useNavigate } from 'react-router-dom';
import axios from "axios"
import { serverUrl } from '../App';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth } from '../../firebase';
import { ClipLoader } from 'react-spinners';
import { useDispatch } from 'react-redux';
import { setUserData } from '../redux/userSlice';
function SignIn() {
    const primaryColor = "#ff4d2d";
    const hoverColor = "#e64323";
    const bgColor = "#fff9f6";
    const borderColor = "#ddd";
    const [showPassword, setShowPassword] = useState(false)
    const navigate=useNavigate()
    const [email,setEmail]=useState("")
    const [password,setPassword]=useState("")
    const [err,setErr]=useState("")
    const [loading,setLoading]=useState(false)
    const dispatch=useDispatch()

    useEffect(() => {
    const handleRedirectData = async () => {
        try {
            const result = await getRedirectResult(auth);
            if (result) {
                // This block runs ONLY after returning from Google Redirect
                const { data } = await axios.post(`${serverUrl}/api/auth/google-auth`, {
                    email: result.user.email,
                    fullName: result.user.displayName, // Fixes your previous fullName error
                }, { withCredentials: true });
                
                dispatch(setUserData(data));
                // Optional: Redirect user to home/dashboard here
            }
        } catch (error) {
            console.error("Redirect Result Error:", error);
            setErr("Failed to complete sign-in after redirect.");
        }
    };

    handleRedirectData();
}, [dispatch]);


     const handleSignIn=async () => {
        setLoading(true)
        try {
            const result=await axios.post(`${serverUrl}/api/auth/signin`,{
                email,password
            },{withCredentials:true})
           dispatch(setUserData(result.data))
            setErr("")
            setLoading(false)
        } catch (error) {
           setErr(error?.response?.data?.message)
           setLoading(false)
        }
     }
    // Redirect result is now handled globally in App.jsx during the splash screen
    // to prevent the result from expiring before SignIn.jsx even mounts on mobile.

    // Hybrid Google Sign In Logic
    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        const isMobile = window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);

        try {
            if (isMobile) {
                // Mobile: Use Redirect Flow to avoid popup/session blockers
                await signInWithRedirect(auth, provider);
            } else {
                // Desktop: Keep using Popup Flow
                const result = await signInWithPopup(auth, provider);
                const { data } = await axios.post(`${serverUrl}/api/auth/google-auth`, {
                    email: result.user.email,
                }, { withCredentials: true });
                dispatch(setUserData(data));
            }
        } catch (error) {
            console.error("Popup Error:", error);
            if (error.code === 'auth/unauthorized-domain') {
                // REMINDER: Add HTTP://192.168.x.x:5173 to Firebase Authorized Domains!
                setErr("Unauthorized Domain! Add your local IP to Firebase Console > Authentication > Settings > Authorized Domains.");
            } else if (error.code === 'auth/popup-blocked') {
                setErr("Browser blocked the popup. Please enable popups or try on mobile.");
            } else {
                setErr("Sign in failed. Cross-Origin block or closed manually.");
            }
        }
    };
    return (
        <div className='min-h-screen w-full flex items-center justify-center p-4' style={{ backgroundColor: bgColor }}>
            <div className={`bg-white rounded-xl shadow-lg w-full max-w-md p-8 border-[1px] `} style={{
                border: `1px solid ${borderColor}`
            }}>
                <h1 className={`text-3xl font-bold mb-2 `} style={{ color: primaryColor }}>Hunger Hub</h1>
                <p className='text-gray-600 mb-8'> Sign In to your account to get started with delicious food deliveries
                </p>

              
                {/* email */}

                <div className='mb-4'>
                    <label htmlFor="email" className='block text-gray-700 font-medium mb-1'>Email</label>
                    <input type="email" className='w-full border rounded-lg px-3 py-2 focus:outline-none ' placeholder='Enter your Email' style={{ border: `1px solid ${borderColor}` }} onChange={(e)=>setEmail(e.target.value)} value={email} required/>
                </div>
                {/* password*/}

                <div className='mb-4'>
                    <label htmlFor="password" className='block text-gray-700 font-medium mb-1'>Password</label>
                    <div className='relative'>
                        <input type={`${showPassword ? "text" : "password"}`} className='w-full border rounded-lg px-3 py-2 focus:outline-none pr-10' placeholder='Enter your password' style={{ border: `1px solid ${borderColor}` }} onChange={(e)=>setPassword(e.target.value)} value={password} required/>

                        <button className='absolute right-3 cursor-pointer top-[14px] text-gray-500' onClick={() => setShowPassword(prev => !prev)}>{!showPassword ? <FaRegEye /> : <FaRegEyeSlash />}</button>
                    </div>
                </div>
                <div className='text-right mb-4 cursor-pointer text-[#ff4d2d] font-medium' onClick={()=>navigate("/forgot-password")}>
                  Forgot Password
                </div>
              

            <button className={`w-full font-semibold py-2 rounded-lg transition duration-200 bg-[#ff4d2d] text-white hover:bg-[#e64323] cursor-pointer`} onClick={handleSignIn} disabled={loading}>
                {loading?<ClipLoader size={20} color='white'/>:"Sign In"}
            </button>
      {err && <p className='text-red-500 text-center my-[10px]'>*{err}</p>}

            <button className='w-full mt-4 flex items-center justify-center gap-2 border rounded-lg px-4 py-2 transition cursor-pointer duration-200 border-gray-400 hover:bg-gray-100' onClick={handleGoogleSignIn}>
<FcGoogle size={20}/>
<span>Sign In with Google</span>
            </button>
            <p className='text-center mt-6 cursor-pointer' onClick={()=>navigate("/signup")}>Want to create a new account ?  <span className='text-[#ff4d2d]'>Sign Up</span></p>
            </div>
        </div>
    )
}

export default SignIn
