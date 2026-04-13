import mongoose from "mongoose";

const adminLedgerSchema = new mongoose.Schema({
    studentId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true
    },
    studentName: String, // Storing name for faster read access
    amount: { 
        type: Number, 
        required: true 
    },
    type: {
        type: String,
        enum: ['credit', 'debit'], // credit = gain, debit = loss
        required: true
    },
    breakdown: { 
        type: String, 
        required: true 
    }, 
    date: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });

const AdminLedger = mongoose.model("AdminLedger", adminLedgerSchema);
export default AdminLedger;
