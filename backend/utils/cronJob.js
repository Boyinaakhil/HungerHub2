import cron from 'node-cron';
import User from '../models/user.model.js';
import AdminLedger from '../models/adminLedger.model.js';

export const startCronJobs = () => {
    // Schedule: Runs at 23:59 (11:59 PM) every day
    cron.schedule('59 23 * * *', async () => {
        console.log('🕒 Running End-of-Day Point Sweep...');

        try {
            // 1. Find all users with role 'user'
            // Optimization: Only fetch users who have a positive balance
            const users = await User.find({ role: 'user', walletBalance: { $gt: 0 } });

            const ledgerEntries = [];
            const bulkOps = [];

            for (const user of users) {
                // Only process if they have an active plan
                const planExpiry = user.subscription?.planExpiresAt ? new Date(user.subscription.planExpiresAt) : null;
                if (!planExpiry || planExpiry < new Date()) continue;

                let unusedAmount = 0;
                let missedMeals = [];

                // --- Calculate Unused Points ---
                
                // Breakfast (Limit 30)
                if (user.subscription.breakfastUsed < 30) {
                    const missed = 30 - user.subscription.breakfastUsed;
                    unusedAmount += missed;
                    missedMeals.push(`Breakfast (${missed})`);
                }

                // Lunch (Limit 40)
                if (user.subscription.lunchUsed < 40) {
                    const missed = 40 - user.subscription.lunchUsed;
                    unusedAmount += missed;
                    missedMeals.push(`Lunch (${missed})`);
                }

                // Dinner (Limit 30)
                if (user.subscription.dinnerUsed < 30) {
                    const missed = 30 - user.subscription.dinnerUsed;
                    unusedAmount += missed;
                    missedMeals.push(`Dinner (${missed})`);
                }

                // --- Transfer Logic ---
                if (unusedAmount > 0) {
                    // Can't deduct more than they have
                    const actualDeduction = Math.min(user.walletBalance, unusedAmount);
                    
                    // 1. Prepare User Update (Deduct & Reset)
                    user.walletBalance -= actualDeduction;
                    user.subscription.breakfastUsed = 0;
                    user.subscription.lunchUsed = 0;
                    user.subscription.dinnerUsed = 0;
                    // Important: Log this deduction in their history too
                    user.walletHistory.push({
                        amount: actualDeduction,
                        type: 'debit',
                        desc: `Unused Daily Points Expired: ${missedMeals.join(", ")}`,
                        date: new Date()
                    });
                    
                    // Save later via bulk or individual save
                    await user.save(); 

                    // 2. Prepare Admin Ledger Entry
                    ledgerEntries.push({
                        studentId: user._id,
                        studentName: user.fullName,
                        amount: actualDeduction,
                        breakdown: missedMeals.join(", "),
                        date: new Date()
                    });
                } else {
                    // Even if no deduction, reset counters for tomorrow
                    user.subscription.breakfastUsed = 0;
                    user.subscription.lunchUsed = 0;
                    user.subscription.dinnerUsed = 0;
                    await user.save();
                }
            }

            // Bulk Insert Admin Records
            if (ledgerEntries.length > 0) {
                await AdminLedger.insertMany(ledgerEntries);
                console.log(`✅ Sweep Complete. Collected points from ${ledgerEntries.length} students.`);
            } else {
                console.log(`✅ Sweep Complete. No unused points found today.`);
            }

        } catch (error) {
            console.error("❌ Cron Job Error:", error);
        }
    }, {
        timezone: "Asia/Kolkata" // Ensure it runs at Indian Time
    });
};