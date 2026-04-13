import express from "express"
import { 
    getCurrentUser, 
    updateUserLocation, 
    createWalletOrder,    
    verifyWalletPayment,  
    getWalletHistory,
    applyForLeave,
    updateAddress,
    updateProfile
} from "../controllers/user.controllers.js"
import isAuth from "../middlewares/isAuth.js"

const userRouter = express.Router()

// Basic
userRouter.get("/current", isAuth, getCurrentUser)
userRouter.post('/update-location', isAuth, updateUserLocation)

// Payments
userRouter.post('/create-wallet-order', isAuth, createWalletOrder)
userRouter.post('/verify-wallet-payment', isAuth, verifyWalletPayment)
userRouter.get('/wallet-history', isAuth, getWalletHistory)

// Leave
userRouter.post('/apply-leave', isAuth, applyForLeave)

// Address & Profile
userRouter.post('/update-address', isAuth, updateAddress)
userRouter.post('/update-profile', isAuth, updateProfile)

export default userRouter