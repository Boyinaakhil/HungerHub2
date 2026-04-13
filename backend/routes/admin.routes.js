import express from "express"
import { 
    getAdminStats, 
    getAllUsers, 
    getAllDeliveryBoys, 
    getAllShops,      // <--- Import this
    getAdminLedger,
    manualCronTrigger,
    settleShop,
    settleDeliveryBoy
} from "../controllers/admin.controllers.js"
import isAuth from "../middlewares/isAuth.js"

const adminRouter = express.Router()

adminRouter.get("/stats", isAuth, getAdminStats)
adminRouter.get("/users", isAuth, getAllUsers)
adminRouter.get("/delivery-boys", isAuth, getAllDeliveryBoys)
adminRouter.get("/shops", isAuth, getAllShops) // <--- Add this route
adminRouter.get("/ledger", isAuth, getAdminLedger)

// test
adminRouter.post("/trigger-sweep", isAuth, manualCronTrigger)

adminRouter.post("/settle-shop/:id", isAuth, settleShop)
adminRouter.post("/settle-delivery/:id", isAuth, settleDeliveryBoy)

export default adminRouter