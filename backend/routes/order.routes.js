import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { 
    acceptOrder, 
    getCurrentOrder, 
    getDeliveryBoyAssignment, 
    getMyOrders, 
    getOrderById, 
    getTodayDeliveries, 
    placeOrder, 
    sendDeliveryOtp, 
    updateOrderStatus, 
    verifyDeliveryOtp, 
    verifyPayment,
    getDeliveryHistory 
} from "../controllers/order.controllers.js"

const orderRouter = express.Router()

// --- Customer Routes ---
orderRouter.post("/place-order", isAuth, placeOrder)
orderRouter.post("/verify-payment", isAuth, verifyPayment)
orderRouter.get("/my-orders", isAuth, getMyOrders)
orderRouter.get('/get-order-by-id/:orderId', isAuth, getOrderById)

// --- Delivery Boy Routes ---
orderRouter.get("/get-assignments", isAuth, getDeliveryBoyAssignment)
orderRouter.get("/get-current-order", isAuth, getCurrentOrder)
orderRouter.get('/accept-order/:assignmentId', isAuth, acceptOrder)
orderRouter.post("/send-delivery-otp", isAuth, sendDeliveryOtp)
orderRouter.post("/verify-delivery-otp", isAuth, verifyDeliveryOtp)
orderRouter.get('/get-today-deliveries', isAuth, getTodayDeliveries)
orderRouter.get('/delivery-history', isAuth, getDeliveryHistory)

// --- Shared / System Routes ---
orderRouter.post("/update-status/:orderId/:shopId", isAuth, updateOrderStatus)

export default orderRouter