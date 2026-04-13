import User from "../models/user.model.js";
import Shop from "../models/shop.model.js";
import Order from "../models/order.model.js";
import AdminLedger from "../models/adminLedger.model.js";

export const getAdminStats = async (req, res) => {
    try {
        // 1. Basic Entity Counts
        const totalUsers = await User.countDocuments({ role: "user" });
        const totalShops = await Shop.countDocuments();
        const totalDeliveryBoys = await User.countDocuments({ role: "deliveryBoy" });

        // --- UPDATED: Count ONLY Delivered Orders (Sub-orders) ---
        // We unwind shopOrders because one parent Order might have items from multiple shops
        // and we count "deliveries" made.
        const deliveredOrdersCount = await Order.aggregate([
            { $unwind: "$shopOrders" },
            { $match: { "shopOrders.status": "delivered" } },
            { $count: "count" }
        ]);
        const totalOrders = deliveredOrdersCount[0]?.count || 0;


        // 2. Financials (Aggregation - FILTERED BY DELIVERED)
        
        // Liability: Student Wallet Pool (Current Balances)
        const walletLiability = await User.aggregate([
            { $match: { role: "user" } },
            { $group: { _id: null, total: { $sum: "$walletBalance" } } }
        ]);

        // --- NEW: Calculate Revenue only for Delivered Orders ---
        // Since paidByWallet and paidByCashOnline are on the Parent Order, 
        // we check if *any* shopOrder inside is delivered (or we sum up shop sub-totals).
        // To be precise for the Admin View:
        // We sum up the 'subtotal' of delivered shopOrders + their share of delivery fee.
        // Simplified approach: Sum up fields from Parent Order ONLY IF items are delivered.
        // Better approach: Re-calculate totals based on delivered ShopOrders.
        
        // Let's aggregate based on Delivered Shop Orders to be accurate
        const financials = await Order.aggregate([
            { $unwind: "$shopOrders" },
            { $match: { "shopOrders.status": "delivered" } },
            { 
                $group: { 
                    _id: null, 
                    // Summing subtotals gives us Gross Merchandise Value of delivered goods
                    grossTotal: { $sum: "$shopOrders.subtotal" }, 
                } 
            }
        ]);

        // For Cash vs Points split, we need to look at the Parent Order payment method.
        // Note: This is an approximation if an order is partially delivered.
        // A robust system would split the payment per shop order.
        // For this MVP, we will sum the Parent fields but filter by "Order has at least 1 delivered item"
        // OR better: Just use the Shop Order totals which we know are real liabilities.
        
        // Let's stick to the previous pattern but add the status filter:
        
        // Total Cash Collected (Only from Delivered Orders)
        // Note: We use $cond to avoid double counting if multiple shopOrders in one parent are delivered.
        // However, assuming 1 Shop per Order for simplicity in aggregation:
        const revenueSplit = await Order.aggregate([
            { $unwind: "$shopOrders" },
            { $match: { "shopOrders.status": "delivered" } },
            {
                $group: {
                    _id: "$_id", // Group back by Parent Order to avoid double counting payments
                    paidByWallet: { $first: "$paidByWallet" },
                    paidByCashOnline: { $first: "$paidByCashOnline" },
                    totalAmount: { $first: "$totalAmount" } // Food + Delivery Fee
                }
            },
            {
                $group: {
                    _id: null,
                    totalCash: { $sum: "$paidByCashOnline" },
                    totalPoints: { $sum: "$paidByWallet" },
                    grossRevenue: { $sum: "$totalAmount" }
                }
            }
        ]);
        
        const cashCollected = revenueSplit[0]?.totalCash || 0;
        const pointsRedeemed = revenueSplit[0]?.totalPoints || 0;
        const grossRevenue = revenueSplit[0]?.grossRevenue || 0;


        // Admin Profit (Breakage/Expired Points) - Unaffected by delivery status
        // Admin Profit (Breakage/Expired Points + Leave Gains - Coupon Costs)
        const adminPoints = await AdminLedger.aggregate([
        {
            $group: {
            _id: null,
            total: {
                $sum: {
                $cond: [
                    { $eq: ["$type", "debit"] },
                    { $multiply: ["$amount", -1] }, // subtract coupon loss
                    "$amount" // add gains
                ]
                }
            }
            }
        }
        ]);



        // Liability: Shops
        const shopLiability = await Order.aggregate([
            { $unwind: "$shopOrders" },
            { $match: { "shopOrders.status": "delivered" } },
            { $group: { _id: null, total: { $sum: "$shopOrders.subtotal" } } }
        ]);

        // Liability: Fleet
        const deliveryLiability = await User.aggregate([
            { $match: { role: "deliveryBoy" } },
            { $group: { _id: null, total: { $sum: "$walletBalance" } } }
        ]);

        // Daily Financials Graph (Filtered by Delivered)
        const dailyOrders = await Order.aggregate([
            { $unwind: "$shopOrders" },
            { $match: { "shopOrders.status": "delivered" } },
            // Group by Order ID first to deduplicate payment amounts
            {
                $group: {
                    _id: "$_id",
                    createdAt: { $first: "$createdAt" },
                    paidByCashOnline: { $first: "$paidByCashOnline" },
                    paidByWallet: { $first: "$paidByWallet" }
                }
            },
            // Now Group by Date
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    cashValue: { $sum: "$paidByCashOnline" },
                    pointsValue: { $sum: "$paidByWallet" }
                }
            }
        ]);

        // Format Chart Data
        const dailyFinancials = dailyOrders.map(d => ({
            date: d._id,
            cashValue: d.cashValue,
            pointsValue: d.pointsValue
        })).sort((a, b) => new Date(a.date) - new Date(b.date));

        // 3. Recent Activity (Show all recent, status visible)
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("user", "fullName")
            .populate("shopOrders.shop", "name");

        // Use fallback if shops route not hit directly
        const newShops = await Shop.find().sort({ createdAt: -1 }).limit(5);

        res.status(200).json({
            stats: {
                users: totalUsers,
                shops: totalShops,
                deliveryBoys: totalDeliveryBoys,
                orders: totalOrders, // Now only shows Delivered Count
                
                walletPool: walletLiability[0]?.total || 0,
                grossRevenue: grossRevenue, // Now only Delivered Revenue
                
                cashCollected: cashCollected, 
                pointsRedeemed: pointsRedeemed,
                
                adminProfit: adminPoints[0]?.total || 0,
                shopPayable: shopLiability[0]?.total || 0,
                deliveryPayable: deliveryLiability[0]?.total || 0,
            },
            dailyFinancials,
            recentOrders,
            newShops
        });

    } catch (error) {
        console.error("Admin Stats Error:", error);
        res.status(500).json({ message: `Admin stats error: ${error.message}` });
    }
};

export const getAdminLedger = async (req, res) => {
    try {
        const logs = await AdminLedger.find().sort({ createdAt: -1 });
        res.status(200).json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({ role: "user" }).select("-password");
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getAllDeliveryBoys = async (req, res) => {
    try {
        const boys = await User.find({ role: "deliveryBoy" }).select("-password");
        const boyStats = await Promise.all(boys.map(async (boy) => {
            const completedCount = await Order.countDocuments({
                "shopOrders.assignedDeliveryBoy": boy._id,
                "shopOrders.status": "delivered"
            });
            return {
                _id: boy._id,
                fullName: boy.fullName,
                mobile: boy.mobile,
                walletBalance: boy.walletBalance,
                isOnline: boy.isOnline,
                totalDeliveries: completedCount
            };
        }));
        res.status(200).json(boyStats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getAllShops = async (req, res) => {
    try {
        const shops = await Shop.find().populate("owner", "fullName email mobile");
        const shopStats = await Promise.all(shops.map(async (shop) => {
            const revenue = await Order.aggregate([
                { $unwind: "$shopOrders" },
                { $match: { "shopOrders.shop": shop._id, "shopOrders.status": "delivered", "shopOrders.isShopSettled": { $ne: true } } }, // Only count delivered NOT settled
                { $group: { _id: null, total: { $sum: "$shopOrders.subtotal" }, count: { $sum: 1 } } }
            ]);
            return {
                _id: shop._id,
                name: shop.name,
                ownerName: shop.owner?.fullName,
                mobile: shop.owner?.mobile,
                image: shop.image,
                city: shop.city,
                items: shop.items, 
                totalRevenue: revenue[0]?.total || 0,
                orderCount: revenue[0]?.count || 0
            };
        }));
        res.status(200).json(shopStats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const settleDeliveryBoy = async (req, res) => {
    try {
        const { id } = req.params;
        const boy = await User.findById(id);
        if (!boy || boy.role !== "deliveryBoy") return res.status(404).json({ error: "Delivery Boy not found" });

        const amountToPay = boy.walletBalance;
        if (amountToPay <= 0) return res.status(400).json({ error: "No pending balance to settle" });

        await AdminLedger.create({
            studentId: boy._id, // Borrowing field for entity id
            studentName: boy.fullName,
            amount: amountToPay,
            type: "debit",
            breakdown: `Monthly Settlement: ${boy.fullName} - Delivery Fleet`,
            date: new Date()
        });

        boy.walletHistory.push({
            amount: amountToPay,
            type: "debit",
            desc: "Monthly Payout Settled by Admin",
            date: new Date()
        });

        boy.walletBalance = 0;
        await boy.save();

        res.status(200).json({ message: "Successfully settled fleet payout", settledAmount: amountToPay });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const settleShop = async (req, res) => {
    try {
        const { id } = req.params;
        const shop = await Shop.findById(id).populate("owner");
        if (!shop) return res.status(404).json({ error: "Shop not found" });

        const revenue = await Order.aggregate([
            { $unwind: "$shopOrders" },
            { $match: { "shopOrders.shop": shop._id, "shopOrders.status": "delivered", "shopOrders.isShopSettled": { $ne: true } } },
            { $group: { _id: null, total: { $sum: "$shopOrders.subtotal" } } }
        ]);

        const amountToPay = revenue[0]?.total || 0;
        if (amountToPay <= 0) return res.status(400).json({ error: "No pending balance to settle" });

        await Order.updateMany(
            { shopOrders: { $elemMatch: { shop: shop._id, status: "delivered", isShopSettled: { $ne: true } } } },
            { $set: { "shopOrders.$[elem].isShopSettled": true } },
            { arrayFilters: [{ "elem.shop": shop._id, "elem.status": "delivered", "elem.isShopSettled": { $ne: true } }] }
        );

        await AdminLedger.create({
            studentId: shop.owner._id, 
            studentName: `${shop.name} (${shop.owner.fullName})`,
            amount: amountToPay,
            type: "debit",
            breakdown: `Monthly Settlement: ${shop.name} - Shop Partner`,
            date: new Date()
        });

        res.status(200).json({ message: "Successfully settled shop payout", settledAmount: amountToPay });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
};



// ⚡ How to Test it RIGHT NOW?
// Add this temporary function to manually trigger the sweep
export const manualCronTrigger = async (req, res) => {
    try {
        console.log('--- Manual Trigger: End-of-Day Point Sweep ---');
        const users = await User.find({ "subscription.planExpiresAt": { $gt: new Date() } });
        let totalCollected = 0;

        for (const user of users) {
            let unusedAmount = 0;
            let missedMeals = [];

            // 1. Breakfast
            if (user.subscription.breakfastUsed < 30) {
                const missed = 30 - user.subscription.breakfastUsed;
                unusedAmount += missed;
                missedMeals.push(`Breakfast (${missed})`);
            }
            // 2. Lunch
            if (user.subscription.lunchUsed < 40) {
                const missed = 40 - user.subscription.lunchUsed;
                unusedAmount += missed;
                missedMeals.push(`Lunch (${missed})`);
            }
            // 3. Dinner
            if (user.subscription.dinnerUsed < 30) {
                const missed = 30 - user.subscription.dinnerUsed;
                unusedAmount += missed;
                missedMeals.push(`Dinner (${missed})`);
            }

            // Transfer
            if (unusedAmount > 0) {
                const actualDeduction = Math.min(user.walletBalance, unusedAmount);
                if (actualDeduction > 0) {
                    user.walletBalance -= actualDeduction;
                    
                    user.walletHistory.push({
                        amount: actualDeduction,
                        type: 'debit',
                        desc: `Unused Daily Points Expired: ${missedMeals.join(", ")}`,
                        date: new Date()
                    });

                    await AdminLedger.create({
                    studentId: user._id,
                    studentName: user.fullName,
                    amount: actualDeduction,
                    type: 'credit', // ✅ FIXED
                    breakdown: missedMeals.join(", "),
                    date: new Date()
                    });


                    totalCollected += actualDeduction;
                }
            }

            // Reset
            user.subscription.breakfastUsed = 0;
            user.subscription.lunchUsed = 0;
            user.subscription.dinnerUsed = 0;
            await user.save();
        }

        res.status(200).json({ message: `Sweep Complete. Collected ${totalCollected} points.` });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};