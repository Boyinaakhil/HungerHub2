import DeliveryAssignment from "../models/deliveryAssignment.model.js"
import Order from "../models/order.model.js"
import Shop from "../models/shop.model.js"
import User from "../models/user.model.js"
import { sendDeliveryOtpMail } from "../utils/mail.js"
import RazorPay from "razorpay"
import dotenv from "dotenv"

dotenv.config()

let instance = new RazorPay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const placeOrder = async (req, res) => {
    try {
        const { cartItems, paymentMethod, deliveryAddress, totalAmount: foodBasePrice } = req.body
        
        if (!cartItems || cartItems.length == 0) return res.status(400).json({ message: "cart is empty" })
        if (!deliveryAddress.text || !deliveryAddress.latitude || !deliveryAddress.longitude) return res.status(400).json({ message: "send complete deliveryAddress" })

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // --- 1. CHECK LEAVE STATUS ---
        const today = new Date();
        const isOnLeave = user.leaves && user.leaves.some(leave => {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            const checkDate = new Date(today);
            return checkDate >= start && checkDate <= end;
        });

        // --- 2. CALCULATE DEDUCTIONS ---
        const now = new Date();
        const currentHour = now.getHours();
        const todayStr = now.toISOString().split('T')[0];

        if (user.subscription.lastOrderedDate !== todayStr) {
            user.subscription.lastOrderedDate = todayStr;
            user.subscription.breakfastUsed = 0;
            user.subscription.lunchUsed = 0;
            user.subscription.dinnerUsed = 0;
        }

        let limit = 0;
        let used = 0;
        let type = '';
        let deliveryFee = 0;

        // Determine Meal Type
        if (currentHour < 8) { 
            limit = 30; used = user.subscription.breakfastUsed; type = 'breakfast';
        } else if (currentHour >= 10 && currentHour < 15) { 
            limit = 40; used = user.subscription.lunchUsed; type = 'lunch';
        } else if (currentHour >= 18 && currentHour < 21) { 
            limit = 30; used = user.subscription.dinnerUsed; type = 'dinner';
        } else {
            deliveryFee = 40; limit = 0; // Off-peak fee
        }

        let walletDeduction = 0;

        if (isOnLeave) {
            // 🛑 USER IS ON LEAVE: FORCE 0 POINT USAGE
            walletDeduction = 0; 
            // We do NOT stop the function here. We just ensure points aren't used.
        } else {
            // ✅ NORMAL FLOW: Calculate Point Deduction
            const remainingLimit = Math.max(0, limit - used);
            walletDeduction = Math.min(foodBasePrice, remainingLimit);

            if (user.walletBalance < walletDeduction) {
                walletDeduction = user.walletBalance;
            }
        }

        const finalOrderTotal = foodBasePrice + deliveryFee;
        const finalPayableAmount = finalOrderTotal - walletDeduction; // If on leave, payable = total

        // --- 3. UPDATE USER WALLET (Only if not on leave) ---
        if (!isOnLeave) {
            user.walletBalance = (user.walletBalance || 0) - walletDeduction;

            if (type === 'breakfast') user.subscription.breakfastUsed += walletDeduction;
            if (type === 'lunch') user.subscription.lunchUsed += walletDeduction;
            if (type === 'dinner') user.subscription.dinnerUsed += walletDeduction;

            if (walletDeduction > 0) {
                user.walletHistory.push({
                    amount: walletDeduction,
                    type: 'debit',
                    desc: `Food Order (${type || 'meal'}) - Plan Savings`,
                    date: new Date()
                });
            }
            await user.save();
        }
        // Note: If on leave, we don't touch walletBalance or subscription counters.

        // --- 4. PREPARE SHOP ORDERS ---
        const groupItemsByShop = {}
        cartItems.forEach(item => {
            const shopId = item.shop
            if (!groupItemsByShop[shopId]) groupItemsByShop[shopId] = []
            groupItemsByShop[shopId].push(item)
        });

        const shopOrders = await Promise.all(Object.keys(groupItemsByShop).map(async (shopId) => {
            const shop = await Shop.findById(shopId).populate("owner")
            if (!shop) throw new Error("shop not found") 
            const items = groupItemsByShop[shopId]
            const subtotal = items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0)
            return {
                shop: shop._id,
                owner: shop.owner._id,
                subtotal,
                shopOrderItems: items.map((i) => ({
                    item: i.id,
                    price: i.price,
                    quantity: i.quantity,
                    name: i.name
                }))
            }
        }))

        // --- 5. HANDLE PAYMENT (ONLINE / CASH) ---
        if (paymentMethod == "online" && finalPayableAmount > 0) {
            const razorOrder = await instance.orders.create({
                amount: Math.round(finalPayableAmount * 100),
                currency: 'INR',
                receipt: `receipt_${Date.now()}`
            })
            
            const newOrder = await Order.create({
                user: req.userId,
                paymentMethod,
                deliveryAddress,
                totalAmount: finalOrderTotal,
                paidByWallet: walletDeduction,      
                paidByCashOnline: finalPayableAmount, 
                shopOrders,
                razorpayOrderId: razorOrder.id,
                payment: false
            })

            return res.status(200).json({
                razorOrder,
                orderId: newOrder._id,
                walletDeducted: walletDeduction,
                deliveryFeeApplied: deliveryFee > 0,
                isOnLeave: isOnLeave // Send flag to frontend
            })
        }

        // Cash Order or Fully Paid by Points (Points only possible if !isOnLeave)
        const newOrder = await Order.create({
            user: req.userId,
            paymentMethod,
            deliveryAddress,
            totalAmount: finalOrderTotal,
            paidByWallet: walletDeduction,      
            paidByCashOnline: finalPayableAmount, 
            shopOrders,
            payment: finalPayableAmount <= 0 ? true : false
        })

        // ... [Populate & Socket Logic] ...
        await newOrder.populate("shopOrders.shopOrderItems.item", "name image price")
        await newOrder.populate("shopOrders.shop", "name")
        await newOrder.populate("shopOrders.owner", "name socketId")
        await newOrder.populate("user", "name email mobile")

        const io = req.app.get('io')
        if (io) {
            newOrder.shopOrders.forEach(shopOrder => {
                const ownerSocketId = shopOrder.owner.socketId
                if (ownerSocketId) {
                    io.to(ownerSocketId).emit('newOrder', {
                        _id: newOrder._id,
                        paymentMethod: newOrder.paymentMethod,
                        user: newOrder.user,
                        shopOrders: shopOrder,
                        createdAt: newOrder.createdAt,
                        deliveryAddress: newOrder.deliveryAddress,
                        payment: newOrder.payment
                    })
                }
            });
        }

        return res.status(201).json({
            ...newOrder.toObject(),
            walletDeducted: walletDeduction,
            deliveryFeeApplied: deliveryFee > 0,
            isOnLeave: isOnLeave
        })

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: `place order error ${error.message}` })
    }
}

// ... [Keep other order controllers like verifyPayment, getMyOrders, updateOrderStatus etc.] ...
// Assuming you have the rest of the file content from previous context or will append it.
// I will include the other critical functions to ensure the file is complete for the router.

export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_payment_id, orderId } = req.body
        const payment = await instance.payments.fetch(razorpay_payment_id)
        if (!payment || payment.status != "captured") {
            return res.status(400).json({ message: "payment not captured" })
        }
        const order = await Order.findById(orderId)
        if (!order) {
            return res.status(400).json({ message: "order not found" })
        }

        order.payment = true
        order.razorpayPaymentId = razorpay_payment_id
        await order.save()

        await order.populate("shopOrders.shopOrderItems.item", "name image price")
        await order.populate("shopOrders.shop", "name")
        await order.populate("shopOrders.owner", "name socketId")
        await order.populate("user", "name email mobile")

        const io = req.app.get('io')

        if (io) {
            order.shopOrders.forEach(shopOrder => {
                const ownerSocketId = shopOrder.owner.socketId
                if (ownerSocketId) {
                    io.to(ownerSocketId).emit('newOrder', {
                        _id: order._id,
                        paymentMethod: order.paymentMethod,
                        user: order.user,
                        shopOrders: shopOrder,
                        createdAt: order.createdAt,
                        deliveryAddress: order.deliveryAddress,
                        payment: order.payment
                    })
                }
            });
        }

        return res.status(200).json(order)

    } catch (error) {
        return res.status(500).json({ message: `verify payment  error ${error}` })
    }
}

export const getMyOrders = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
        if (user.role == "user") {
            const orders = await Order.find({ user: req.userId })
                .sort({ createdAt: -1 })
                .populate("shopOrders.shop", "name")
                .populate("shopOrders.owner", "name email mobile")
                .populate("shopOrders.shopOrderItems.item", "name image price")

            return res.status(200).json(orders)
        } else if (user.role == "owner") {
            const orders = await Order.find({ "shopOrders.owner": req.userId })
                .sort({ createdAt: -1 })
                .populate("shopOrders.shop", "name")
                .populate("user")
                .populate("shopOrders.shopOrderItems.item", "name image price")
                .populate("shopOrders.assignedDeliveryBoy", "fullName mobile")

            const filteredOrders = orders.map((order => ({
                _id: order._id,
                paymentMethod: order.paymentMethod,
                user: order.user,
                shopOrders: order.shopOrders.find(o => o.owner._id == req.userId),
                createdAt: order.createdAt,
                deliveryAddress: order.deliveryAddress,
                payment: order.payment,
                paidByWallet: order.paidByWallet,
                paidByCashOnline: order.paidByCashOnline
            })))

            return res.status(200).json(filteredOrders)
        }

    } catch (error) {
        return res.status(500).json({ message: `get User order error ${error}` })
    }
}

export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, shopId } = req.params
        const { status } = req.body
        const order = await Order.findById(orderId)

        const shopOrder = order.shopOrders.find(o => o.shop == shopId)
        if (!shopOrder) {
            return res.status(400).json({ message: "shop order not found" })
        }

        // Cleanup Logic when Reverting Status
        if (shopOrder.status === "out of delivery" && status !== "out of delivery" && status !== "delivered") {
            if (shopOrder.assignment) {
                const assignment = await DeliveryAssignment.findById(shopOrder.assignment);
                if (assignment) {
                    const io = req.app.get('io');
                    if (io) {
                        if (assignment.assignedTo) {
                            const boy = await User.findById(assignment.assignedTo);
                            if (boy && boy.socketId) {
                                io.to(boy.socketId).emit('assignmentRevoked', { assignmentId: assignment._id });
                            }
                        }
                        if (assignment.brodcastedTo && assignment.brodcastedTo.length > 0) {
                            const boys = await User.find({ _id: { $in: assignment.brodcastedTo } });
                            boys.forEach(boy => {
                                if (boy.socketId) {
                                    io.to(boy.socketId).emit('assignmentRevoked', { assignmentId: assignment._id });
                                }
                            });
                        }
                    }
                    await DeliveryAssignment.findByIdAndDelete(shopOrder.assignment);
                }
            }
            shopOrder.assignment = null;
            shopOrder.assignedDeliveryBoy = null;
            shopOrder.deliveryOtp = null;
        }

        shopOrder.status = status;
        
        let deliveryBoysPayload = []
        
        if (status == "out of delivery" && !shopOrder.assignment) {
            const { longitude, latitude } = order.deliveryAddress
            const nearByDeliveryBoys = await User.find({
                role: "deliveryBoy",
                location: {
                    $near: {
                        $geometry: { type: "Point", coordinates: [Number(longitude), Number(latitude)] },
                        $maxDistance: 5000
                    }
                }
            })

            const nearByIds = nearByDeliveryBoys.map(b => b._id)
            
            const activeAssignments = await DeliveryAssignment.find({
                assignedTo: { $in: nearByIds },
                status: { $nin: ["brodcasted", "completed"] }
            })

            const busyBoysMap = {} 
            activeAssignments.forEach(assign => {
                if(assign.assignedTo) {
                    busyBoysMap[assign.assignedTo.toString()] = assign.shop.toString();
                }
            })

            const availableBoys = nearByDeliveryBoys.filter(boy => {
                const boyId = boy._id.toString();
                const busyWithShop = busyBoysMap[boyId];
                if (!busyWithShop) return true;
                if (busyWithShop === shopOrder.shop.toString()) return true;
                return false;
            });

            const candidates = availableBoys.map(b => b._id)

            if (candidates.length == 0) {
                await order.save()
                return res.json({
                    message: "order status updated but there is no available delivery boys"
                })
            }

            const deliveryAssignment = await DeliveryAssignment.create({
                order: order?._id,
                shop: shopOrder.shop,
                shopOrderId: shopOrder?._id,
                brodcastedTo: candidates,
                status: "brodcasted"
            })

            shopOrder.assignedDeliveryBoy = deliveryAssignment.assignedTo
            shopOrder.assignment = deliveryAssignment._id
            
            deliveryBoysPayload = availableBoys.map(b => ({
                id: b._id,
                fullName: b.fullName,
                longitude: b.location.coordinates?.[0],
                latitude: b.location.coordinates?.[1],
                mobile: b.mobile
            }))

            await deliveryAssignment.populate('order')
            await deliveryAssignment.populate('shop')
            const io = req.app.get('io')
            if (io) {
                availableBoys.forEach(boy => {
                    const boySocketId = boy.socketId
                    if (boySocketId) {
                        io.to(boySocketId).emit('newAssignment', {
                            sentTo: boy._id,
                            assignmentId: deliveryAssignment._id,
                            orderId: deliveryAssignment.order._id,
                            shopName: deliveryAssignment.shop.name,
                            deliveryAddress: deliveryAssignment.order.deliveryAddress,
                            items: deliveryAssignment.order.shopOrders.find(so => so._id.equals(deliveryAssignment.shopOrderId)).shopOrderItems || [],
                            subtotal: deliveryAssignment.order.shopOrders.find(so => so._id.equals(deliveryAssignment.shopOrderId))?.subtotal
                        })
                    }
                });
            }
        }

        await order.save()
        const updatedShopOrder = order.shopOrders.find(o => o.shop == shopId)
        await order.populate("shopOrders.shop", "name")
        await order.populate("shopOrders.assignedDeliveryBoy", "fullName email mobile")
        await order.populate("user", "socketId")

        const io = req.app.get('io')
        if (io) {
            const userSocketId = order.user.socketId
            if (userSocketId) {
                io.to(userSocketId).emit('update-status', {
                    orderId: order._id,
                    shopId: updatedShopOrder.shop._id,
                    status: updatedShopOrder.status,
                    userId: order.user._id
                })
            }
        }

        return res.status(200).json({
            shopOrder: updatedShopOrder,
            assignedDeliveryBoy: updatedShopOrder?.assignedDeliveryBoy,
            availableBoys: deliveryBoysPayload,
            assignment: updatedShopOrder?.assignment?._id
        })

    } catch (error) {
        return res.status(500).json({ message: `order status error ${error}` })
    }
}

export const getDeliveryBoyAssignment = async (req, res) => {
    try {
        const deliveryBoyId = req.userId
        const assignments = await DeliveryAssignment.find({
            brodcastedTo: deliveryBoyId,
            status: "brodcasted"
        })
            .populate("order")
            .populate("shop")

        const formated = assignments.map(a => ({
            assignmentId: a._id,
            orderId: a.order._id,
            shopName: a.shop.name,
            deliveryAddress: a.order.deliveryAddress,
            items: a.order.shopOrders.find(so => so._id.equals(a.shopOrderId)).shopOrderItems || [],
            subtotal: a.order.shopOrders.find(so => so._id.equals(a.shopOrderId))?.subtotal,
            paymentMethod: a.order.paymentMethod,
            paidByCashOnline: a.order.paidByCashOnline
        }))

        return res.status(200).json(formated)
    } catch (error) {
        return res.status(500).json({ message: `get Assignment error ${error}` })
    }
}

export const acceptOrder = async (req, res) => {
    try {
        const { assignmentId } = req.params
        const assignment = await DeliveryAssignment.findById(assignmentId)
        if (!assignment) {
            return res.status(400).json({ message: "assignment not found" })
        }
        if (assignment.status !== "brodcasted") {
            return res.status(400).json({ message: "assignment is expired" })
        }

        const activeAssignments = await DeliveryAssignment.find({
            assignedTo: req.userId,
            status: { $nin: ["brodcasted", "completed"] }
        })

        if (activeAssignments.length > 0) {
            const differentShopOrder = activeAssignments.find(a => a.shop.toString() !== assignment.shop.toString());
            if (differentShopOrder) {
                return res.status(400).json({ message: "You are active with another restaurant. Complete those orders first." })
            }
        }

        assignment.assignedTo = req.userId
        assignment.status = 'assigned'
        assignment.acceptedAt = new Date()
        await assignment.save()

        const order = await Order.findById(assignment.order)
        if (!order) {
            return res.status(400).json({ message: "order not found" })
        }

        let shopOrder = order.shopOrders.id(assignment.shopOrderId)
        shopOrder.assignedDeliveryBoy = req.userId
        await order.save()

        return res.status(200).json({
            message: 'order accepted'
        })
    } catch (error) {
        return res.status(500).json({ message: `accept order error ${error}` })
    }
}

export const getCurrentOrder = async (req, res) => {
    try {
        const assignments = await DeliveryAssignment.find({
            assignedTo: req.userId,
            status: "assigned"
        })
            .populate("shop", "name")
            .populate("assignedTo", "fullName email mobile location")
            .populate({
                path: "order",
                populate: [{ path: "user", select: "fullName email location mobile" }]
            })

        if (!assignments || assignments.length === 0) {
            return res.status(200).json([]) 
        }

        const activeOrders = assignments.map(assignment => {
            if (!assignment.order) return null;
            
            const shopOrder = assignment.order.shopOrders.find(so => String(so._id) == String(assignment.shopOrderId))
            
            let deliveryBoyLocation = { lat: null, lon: null }
            if (assignment.assignedTo.location.coordinates.length == 2) {
                deliveryBoyLocation.lat = assignment.assignedTo.location.coordinates[1]
                deliveryBoyLocation.lon = assignment.assignedTo.location.coordinates[0]
            }

            let customerLocation = { lat: null, lon: null }
            if (assignment.order.deliveryAddress) {
                customerLocation.lat = assignment.order.deliveryAddress.latitude
                customerLocation.lon = assignment.order.deliveryAddress.longitude
            }

            return {
                _id: assignment.order._id,
                user: assignment.order.user,
                shopOrder,
                deliveryAddress: assignment.order.deliveryAddress,
                deliveryBoyLocation,
                customerLocation,
                shopName: assignment.shop.name,
                paymentMethod: assignment.order.paymentMethod,
                paidByCashOnline: assignment.order.paidByCashOnline,
                paidByWallet: assignment.order.paidByWallet,
            }
        }).filter(item => item !== null);

        return res.status(200).json(activeOrders)

    } catch (error) {
        return res.status(500).json({ message: `get current order error ${error}` })
    }
}

export const getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params
        const order = await Order.findById(orderId)
            .populate("user")
            .populate({
                path: "shopOrders.shop",
                model: "Shop"
            })
            .populate({
                path: "shopOrders.assignedDeliveryBoy",
                model: "User"
            })
            .populate({
                path: "shopOrders.shopOrderItems.item",
                model: "Item"
            })
            .lean()

        if (!order) {
            return res.status(400).json({ message: "order not found" })
        }
        return res.status(200).json(order)
    } catch (error) {
        return res.status(500).json({ message: `get by id order error ${error}` })
    }
}

export const sendDeliveryOtp = async (req, res) => {
    try {
        const { orderId, shopOrderId } = req.body
        const order = await Order.findById(orderId).populate("user")
        const shopOrder = order.shopOrders.id(shopOrderId)
        if (!order || !shopOrder) {
            return res.status(400).json({ message: "enter valid order/shopOrderid" })
        }
        const otp = Math.floor(1000 + Math.random() * 9000).toString()
        shopOrder.deliveryOtp = otp
        shopOrder.otpExpires = Date.now() + 5 * 60 * 1000
        await order.save()
        await sendDeliveryOtpMail(order.user, otp)
        return res.status(200).json({ message: `Otp sent Successfuly to ${order?.user?.fullName}` })
    } catch (error) {
        return res.status(500).json({ message: `delivery otp error ${error}` })
    }
}

export const verifyDeliveryOtp = async (req, res) => {
    try {
        const { orderId, shopOrderId, otp } = req.body
        const order = await Order.findById(orderId).populate("user")
        const shopOrder = order.shopOrders.id(shopOrderId)
        if (!order || !shopOrder) {
            return res.status(400).json({ message: "enter valid order/shopOrderid" })
        }
        if (otp !== "FIREBASE_SUCCESS") {
            if (shopOrder.deliveryOtp !== otp || !shopOrder.otpExpires || shopOrder.otpExpires < Date.now()) {
                return res.status(400).json({ message: "Invalid/Expired Otp" })
            }
        }

        // 1. Update Status
        shopOrder.status = "delivered"
        shopOrder.deliveredAt = Date.now()

        // 2. Wallet Logic for Delivery Boy
        if (shopOrder.assignedDeliveryBoy) {
            const deliveryBoy = await User.findById(shopOrder.assignedDeliveryBoy);
            if (deliveryBoy) {
                const orderTime = new Date(order.createdAt);
                const orderHour = orderTime.getHours();
                
                let commission = 25; // Default Off-Peak

                if (orderHour < 8) { 
                    commission = 10; // Breakfast
                } else if (orderHour >= 10 && orderHour < 15) { 
                    commission = 10; // Lunch
                } else if (orderHour >= 18 && orderHour < 21) { 
                    commission = 10; // Dinner
                }

                deliveryBoy.walletBalance = (deliveryBoy.walletBalance || 0) + commission;
                
                deliveryBoy.walletHistory.push({
                    amount: commission,
                    type: 'credit',
                    desc: `Delivery Commission (Order #${order._id.toString().slice(-4)})`,
                    date: new Date()
                });
                
                if (deliveryBoy.walletHistory.length > 50) deliveryBoy.walletHistory.shift();
                
                await deliveryBoy.save();
            }
        }

        await order.save()
        await DeliveryAssignment.deleteOne({
            shopOrderId: shopOrder._id,
            order: order._id,
            assignedTo: shopOrder.assignedDeliveryBoy
        })

        // --- 3. NEW: EMIT SOCKET EVENT TO USER ---
        const io = req.app.get('io')
        if (io) {
            const userSocketId = order.user.socketId
            if (userSocketId) {
                io.to(userSocketId).emit('update-status', {
                    orderId: order._id,
                    shopId: shopOrder.shop, // Send shop ID so frontend can match
                    status: "delivered",
                    userId: order.user._id
                })
            }
        }

        return res.status(200).json({ message: "Order Delivered Successfully!" })

    } catch (error) {
        return res.status(500).json({ message: `verify delivery otp error ${error}` })
    }
}

export const getTodayDeliveries = async (req, res) => {
    try {
        const deliveryBoyId = req.userId
        const startsOfDay = new Date()
        startsOfDay.setHours(0, 0, 0, 0)

        const orders = await Order.find({
            "shopOrders.assignedDeliveryBoy": deliveryBoyId,
            "shopOrders.status": "delivered",
            "shopOrders.deliveredAt": { $gte: startsOfDay }
        }).lean()

        let todaysDeliveries = []

        orders.forEach(order => {
            order.shopOrders.forEach(shopOrder => {
                if (shopOrder.assignedDeliveryBoy == deliveryBoyId &&
                    shopOrder.status == "delivered" &&
                    shopOrder.deliveredAt &&
                    shopOrder.deliveredAt >= startsOfDay
                ) {
                    todaysDeliveries.push(shopOrder)
                }
            })
        })

        let stats = {}

        todaysDeliveries.forEach(shopOrder => {
            const hour = new Date(shopOrder.deliveredAt).getHours()
            stats[hour] = (stats[hour] || 0) + 1
        })

        let formattedStats = Object.keys(stats).map(hour => ({
            hour: parseInt(hour),
            count: stats[hour]
        }))

        formattedStats.sort((a, b) => a.hour - b.hour)

        return res.status(200).json(formattedStats)

    } catch (error) {
        return res.status(500).json({ message: `today deliveries error ${error}` })
    }
}

export const getDeliveryHistory = async (req, res) => {
    try {
        const deliveryBoyId = req.userId;
        
        // 1. Fetch all orders delivered by this user
        const orders = await Order.find({
            "shopOrders.assignedDeliveryBoy": deliveryBoyId,
            "shopOrders.status": "delivered"
        })
        .populate("shopOrders.shop", "name")
        .sort({ createdAt: -1 });

        const historyMap = {};

        // 2. Process Orders
        orders.forEach(order => {
            order.shopOrders.forEach(subOrder => {
                // Filter for this specific delivery boy and status
                if (subOrder.assignedDeliveryBoy?.toString() === deliveryBoyId && subOrder.status === 'delivered') {
                    
                    // Group by Date (DD/MM/YYYY)
                    const dateKey = new Date(subOrder.deliveredAt || order.createdAt).toLocaleDateString('en-GB'); 
                    
                    if (!historyMap[dateKey]) {
                        historyMap[dateKey] = {
                            date: dateKey,
                            totalOrders: 0,
                            cashCollected: 0,
                            totalEarnings: 0,
                            peakCount: 0,
                            offPeakCount: 0,
                            details: []
                        };
                    }

                    // A. Calculate Commission based on Time
                    const orderTime = new Date(order.createdAt);
                    const hour = orderTime.getHours();
                    let commission = 25; // Default Off-Peak
                    let isPeak = false;

                    // Peak Rules: <8 AM, 10-3 PM, 6-9 PM
                    if (hour < 8 || (hour >= 10 && hour < 15) || (hour >= 18 && hour < 21)) {
                        commission = 10;
                        isPeak = true;
                    }

                    // B. Calculate Cash Collected (Only if COD)
                    let cash = 0;
                    if (order.paymentMethod === 'cod') {
                        cash = order.paidByCashOnline || 0; 
                    }

                    // C. Update Daily Stats
                    const dayStat = historyMap[dateKey];
                    dayStat.totalOrders += 1;
                    dayStat.cashCollected += cash;
                    dayStat.totalEarnings += commission;
                    if (isPeak) dayStat.peakCount += 1;
                    else dayStat.offPeakCount += 1;

                    // D. Push Order Detail
                    dayStat.details.push({
                        orderId: order._id,
                        shopName: subOrder.shop?.name || "Unknown Shop",
                        time: orderTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                        paymentMethod: order.paymentMethod,
                        cashCollected: cash,
                        earning: commission,
                        type: isPeak ? "Peak Time" : "Free Time"
                    });
                }
            });
        });

        // 3. Convert to Array and Sort by Date (Newest First)
        const historyArray = Object.values(historyMap).sort((a, b) => {
            const dateA = a.date.split('/').reverse().join('');
            const dateB = b.date.split('/').reverse().join('');
            return dateB.localeCompare(dateA);
        });

        res.status(200).json(historyArray);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};