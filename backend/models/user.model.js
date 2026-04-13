import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    mobile: { type: String, required: true },
    role: { type: String, enum: ["user", "owner", "deliveryBoy", "admin"], required: true, default: "user" },
    
    walletBalance: { type: Number, default: 0 },
    walletHistory: [
        {
            amount: { type: Number, required: true },
            type: { type: String, enum: ['credit', 'debit'], required: true },
            desc: { type: String, required: true },
            date: { type: Date, default: Date.now }
        }
    ],

    subscription: {
        planExpiresAt: { type: Date, default: null },
        lastOrderedDate: { type: String, default: "" },
        breakfastUsed: { type: Number, default: 0 },
        lunchUsed: { type: Number, default: 0 },
        dinnerUsed: { type: Number, default: 0 }
    },

    leaves: [{
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        daysCount: { type: Number, required: true },
        appliedAt: { type: Date, default: Date.now }
    }],

    nextMonthCoupon: { type: Number, default: 0 },

    resetOtp: { type: String },
    isOtpVerified: { type: Boolean, default: false },
    otpExpires: { type: Date },
    socketId: { type: String },
    isOnline: { type: Boolean, default: false },

    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },
    savedAddress: { type: String, default: "" },
    isProfileComplete: { type: Boolean, default: false }

}, { timestamps: true });

userSchema.index({ location: '2dsphere' });

const User = mongoose.model("User", userSchema);
export default User;
