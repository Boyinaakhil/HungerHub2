import User from "../models/user.model.js";
import AdminLedger from "../models/adminLedger.model.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// -------------------- GET CURRENT USER --------------------
export const getCurrentUser = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) return res.status(400).json({ message: "User ID not found" });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        return res.status(200).json(user);
    } catch (error) {
        return res.status(500).json({ message: `getCurrentUser error: ${error}` });
    }
};

// -------------------- UPDATE USER LOCATION --------------------
export const updateUserLocation = async (req, res) => {
    try {
        const { lat, lon } = req.body;
        const user = await User.findByIdAndUpdate(
            req.userId,
            { location: { type: "Point", coordinates: [lon, lat] } },
            { new: true }
        );

        if (!user) return res.status(404).json({ message: "User not found" });
        return res.status(200).json({ message: "Location updated" });
    } catch (error) {
        return res.status(500).json({ message: `updateUserLocation error: ${error}` });
    }
};

// -------------------- CREATE WALLET ORDER --------------------
export const createWalletOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || isNaN(amount) || amount <= 0)
            return res.status(400).json({ message: "Invalid amount" });

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const order = await instance.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: `wallet_rcpt_${Date.now()}_${req.userId.toString().slice(-4)}`
        });

        res.status(200).json({ success: true, order, key_id: process.env.RAZORPAY_KEY_ID });
    } catch (error) {
        console.error("Create Wallet Order Error:", error);
        res.status(500).json({ message: "Failed to create payment order" });
    }
};

// -------------------- VERIFY WALLET PAYMENT --------------------
export const verifyWalletPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, couponApplied } = req.body;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Verify Razorpay signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature)
            return res.status(400).json({ message: "Invalid Payment Signature" });

        // Initialize subscription if missing
        if (!user.subscription)
            user.subscription = { planExpiresAt: null, breakfastUsed: 0, lunchUsed: 0, dinnerUsed: 0 };

        const now = new Date();
        const planActive = user.subscription.planExpiresAt && new Date(user.subscription.planExpiresAt) > now;
        const fullAmount = Number(amount);

        // Activate plan if applicable
        if (!planActive && fullAmount >= 3000) {
            const newExpiry = new Date();
            newExpiry.setDate(newExpiry.getDate() + 30);
            user.subscription.planExpiresAt = newExpiry;
        }

        // Credit wallet
        user.walletBalance = (user.walletBalance || 0) + fullAmount;
        user.walletHistory.push({
            amount: fullAmount,
            type: "credit",
            desc:
                couponApplied > 0
                    ? `Monthly Recharge w/ Coupon (-${couponApplied})`
                    : "Added to Wallet",
            date: new Date()
        });

        // 🟥 Log coupon as admin loss (DEBIT)
        if (couponApplied && couponApplied > 0) {
            const admin = await User.findOne({ role: "admin" });
            if (admin) {
                admin.walletBalance = (admin.walletBalance || 0) - couponApplied;

                await AdminLedger.create({
                    studentId: user._id,
                    studentName: user.fullName,
                    amount: couponApplied,
                    type: "debit", // 🔴 Loss to admin
                    breakdown: `Coupon Redemption (Cost to Admin for ${user.fullName})`,
                    date: new Date()
                });

                await admin.save();
            }
            user.nextMonthCoupon = 0;
        }

        if (user.walletHistory.length > 50) user.walletHistory.shift();
        user.markModified("subscription");
        user.markModified("walletHistory");
        await user.save();

        const sortedHistory = [...user.walletHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        res.status(200).json({
            success: true,
            message: "Points Added Successfully",
            walletBalance: user.walletBalance,
            history: sortedHistory,
            planExpiresAt: user.subscription.planExpiresAt
        });
    } catch (error) {
        console.error("Verify Payment Error:", error);
        res.status(500).json({ message: "Payment verification failed" });
    }
};

// -------------------- GET WALLET HISTORY --------------------
export const getWalletHistory = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("walletHistory subscription nextMonthCoupon");
        if (!user) return res.status(404).json({ message: "User not found" });

        const history = [...(user.walletHistory || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
        res.status(200).json({
            history,
            planExpiresAt: user.subscription?.planExpiresAt,
            nextMonthCoupon: user.nextMonthCoupon
        });
    } catch (error) {
        res.status(500).json({ message: `Get history error: ${error.message}` });
    }
};

// -------------------- APPLY LEAVE --------------------
export const applyForLeave = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        const user = await User.findById(req.userId);
        const admin = await User.findOne({ role: "admin" });

        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))+1;
        if (diffDays < 6) return res.status(400).json({ message: "Minimum leave is 6 days." });

        const DAILY_RATE = 100;
        const totalDeduction = diffDays * DAILY_RATE;
        const cashback = totalDeduction / 2;

        if (user.walletBalance < totalDeduction)
            return res.status(400).json({ message: "Insufficient balance." });

        user.walletBalance -= totalDeduction;
        user.nextMonthCoupon = (user.nextMonthCoupon || 0) + cashback;
        user.walletHistory.push({
            amount: totalDeduction,
            type: "debit",
            desc: `Mess Leave (${diffDays} Days)`,
            date: new Date()
        });

        admin.walletBalance = (admin.walletBalance || 0) + totalDeduction;
        admin.walletHistory.push({
            amount: totalDeduction,
            type: "credit",
            desc: `Leave: ${user.fullName}`,
            date: new Date()
        });

        await AdminLedger.create({
            studentId: user._id,
            studentName: user.fullName,
            amount: totalDeduction,
            type: "credit", // 🟢 Gain to admin
            breakdown: `Leave: ${startDate} to ${endDate}`,
            date: new Date()
        });

        await user.save();
        await admin.save();

        res.status(200).json({ message: "Leave applied", refundCoupon: cashback });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// -------------------- DAILY SWEEP --------------------
export const manualCronTrigger = async (req, res) => {
    try {
        console.log("--- Running End-of-Day Sweep ---");
        const users = await User.find({ "subscription.planExpiresAt": { $gt: new Date() } });
        let totalCollected = 0;

        for (const user of users) {
            let unused = 0;
            let missed = [];

            if (user.subscription.breakfastUsed < 30) {
                unused += 30 - user.subscription.breakfastUsed;
                missed.push(`Breakfast (${30 - user.subscription.breakfastUsed})`);
            }
            if (user.subscription.lunchUsed < 40) {
                unused += 40 - user.subscription.lunchUsed;
                missed.push(`Lunch (${40 - user.subscription.lunchUsed})`);
            }
            if (user.subscription.dinnerUsed < 30) {
                unused += 30 - user.subscription.dinnerUsed;
                missed.push(`Dinner (${30 - user.subscription.dinnerUsed})`);
            }

            if (unused > 0) {
                const deduction = Math.min(user.walletBalance, unused);
                user.walletBalance -= deduction;
                user.walletHistory.push({
                    amount: deduction,
                    type: "debit",
                    desc: `Daily Expired Points: ${missed.join(", ")}`,
                    date: new Date()
                });

                await AdminLedger.create({
                    studentId: user._id,
                    studentName: user.fullName,
                    amount: deduction,
                    type: "credit", // 🟢 Admin gain
                    breakdown: `Expired: ${missed.join(", ")}`,
                    date: new Date()
                });

                const admin = await User.findOne({ role: "admin" });
                if (admin) {
                    admin.walletBalance = (admin.walletBalance || 0) + deduction;
                    await admin.save();
                }

                totalCollected += deduction;
            }

            // Reset daily counters
            user.subscription.breakfastUsed = 0;
            user.subscription.lunchUsed = 0;
            user.subscription.dinnerUsed = 0;
            await user.save();
        }

        res.status(200).json({ message: `Sweep complete. Collected ${totalCollected} points.` });
    } catch (error) {
        console.error("Cron Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// -------------------- UPDATE ADDRESS --------------------
export const updateAddress = async (req, res) => {
    try {
        const { savedAddress } = req.body;
        if (!savedAddress) return res.status(400).json({ message: "Address is required" });

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.savedAddress = savedAddress;
        await user.save();

        res.status(200).json({ message: "Address saved successfully", user });
    } catch (error) {
        console.error("Update Address Error:", error);
        res.status(500).json({ message: "Failed to update address" });
    }
};

// -------------------- COMPLETE PROFILE --------------------
export const updateProfile = async (req, res) => {
    try {
        const { fullName, mobile, savedAddress } = req.body;
        if (!fullName || !mobile || !savedAddress) return res.status(400).json({ message: "All fields are required" });

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.fullName = fullName;
        user.mobile = mobile;
        user.savedAddress = savedAddress;
        user.isProfileComplete = true;
        await user.save();

        res.status(200).json({ message: "Profile saved successfully", user });
    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({ message: "Failed to update profile" });
    }
};
