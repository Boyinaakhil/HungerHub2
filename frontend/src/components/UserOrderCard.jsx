import axios from 'axios'
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux' 
// In your local project, use: import { serverUrl } from '../App';
const serverUrl = "http://localhost:8000"; 

function UserOrderCard({ data }) {
    const navigate = useNavigate()
    const { socket } = useSelector(state => state.user) 
    
    // 1. Local state for Real-Time Status updates
    const [liveOrder, setLiveOrder] = useState(data);
    
    // 2. Track items rated in THIS session for instant UI feedback
    const [ratedItems, setRatedItems] = useState([]) 
    
    // Modal State
    const [showConfirm, setShowConfirm] = useState(false)
    const [pendingRating, setPendingRating] = useState(null) 
    const [isSubmitting, setIsSubmitting] = useState(false) 

    // --- REAL-TIME SOCKET LISTENER ---
    useEffect(() => {
        if (socket) {
            socket.on('update-status', (updatedData) => {
                if (updatedData.orderId === liveOrder._id) {
                    setLiveOrder(prev => {
                        const newShopOrders = prev.shopOrders.map(shopOrder => {
                            // Handle populated vs string ID
                            const currentShopId = typeof shopOrder.shop === 'object' ? shopOrder.shop._id : shopOrder.shop;
                            
                            if (currentShopId === updatedData.shopId) {
                                return { ...shopOrder, status: updatedData.status };
                            }
                            return shopOrder;
                        });
                        return { ...prev, shopOrders: newShopOrders };
                    });
                }
            });
        }
        return () => {
            if (socket) socket.off('update-status');
        }
    }, [socket, liveOrder._id]);

    // Keep state in sync if parent props change
    useEffect(() => {
        setLiveOrder(data);
    }, [data]);

    const formatDate = (dateString) => {
        const date = new Date(dateString)
        return date.toLocaleString('en-GB', {
            day: "2-digit",
            month: "short",
            year: "numeric"
        })
    }

    // --- RATING LOGIC ---
    const onStarClick = (itemId, itemName, rating) => {
        setPendingRating({ itemId, itemName, rating })
        setShowConfirm(true)
    }

    const handleConfirmRating = async () => {
        if (!pendingRating || isSubmitting) return;
        
        setIsSubmitting(true);
        try {
            await axios.post(`${serverUrl}/api/item/rating`, { 
                itemId: pendingRating.itemId, 
                rating: pendingRating.rating,
                orderId: liveOrder._id 
            }, { withCredentials: true })
            
            // Instantly mark as rated locally (Optimistic UI)
            setRatedItems(prev => [...prev, pendingRating.itemId])
            
            closeModal()
            // Optional: You can reload if you want 100% DB sync, but local state update is smoother
            // window.location.reload(); 
            
        } catch (error) {
            console.log(error)
            closeModal()
        } finally {
            setIsSubmitting(false);
        }
    }

    const closeModal = () => {
        setShowConfirm(false)
        setPendingRating(null)
        setIsSubmitting(false)
    }

    return (
        <div className='bg-white rounded-lg shadow p-4 space-y-4 relative'>
            
            {/* --- CONFIRMATION POPUP --- */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center animate-scale-up">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Rate Item?</h3>
                        <p className="text-gray-600 mb-4">
                            You are giving <span className="font-bold text-[#ff4d2d] text-lg">{pendingRating?.rating} Stars</span> to <br/>
                            <span className="font-semibold text-gray-800">"{pendingRating?.itemName}"</span>
                        </p>
                        
                        <div className="flex justify-center gap-2 mb-6">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star} className={`text-3xl transition ${pendingRating?.rating >= star ? 'text-yellow-400 scale-110' : 'text-gray-300'}`}>★</span>
                            ))}
                        </div>

                        <div className="flex gap-3 justify-center">
                            <button onClick={closeModal} disabled={isSubmitting} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50">Cancel</button>
                            <button onClick={handleConfirmRating} disabled={isSubmitting} className="px-5 py-2 rounded-lg bg-[#ff4d2d] text-white font-medium hover:bg-[#e04328] transition shadow-md disabled:opacity-70 flex items-center gap-2">
                                {isSubmitting ? "Submitting..." : "OK, Submit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ORDER INFO --- */}
            <div className='flex justify-between border-b pb-2'>
                <div>
                    <p className='font-semibold text-gray-800'>Order #{liveOrder._id.slice(-6).toUpperCase()}</p>
                    <p className='text-xs text-gray-500'>{formatDate(liveOrder.createdAt)}</p>
                </div>
                <div className='text-right'>
                    <p className={`text-xs font-bold capitalize ${liveOrder.payment ? "text-green-600" : "text-orange-500"}`}>
                        {liveOrder.paymentMethod === 'cod' ? 'Cash On Delivery' : (liveOrder.payment ? 'Paid Online' : 'Payment Pending')}
                    </p>
                    <p className='font-medium text-blue-600 capitalize text-sm'>{liveOrder.shopOrders?.[0]?.status}</p>
                </div>
            </div>

            {/* --- SHOP ORDERS LIST --- */}
            {liveOrder.shopOrders.map((shopOrder, index) => (
                <div className='border rounded-lg p-3 bg-gray-50 space-y-3' key={index}>
                    <div className="flex justify-between items-center">
                        <p className="font-bold text-sm text-gray-700">{shopOrder.shop.name}</p>
                        <span className={`text-xs font-bold px-2 py-1 rounded capitalize ${
                            shopOrder.status === 'delivered' ? 'bg-green-100 text-green-700' :
                            shopOrder.status === 'out of delivery' ? 'bg-purple-100 text-purple-700' : 
                            'bg-blue-100 text-blue-700'
                        }`}>
                            {shopOrder.status}
                        </span>
                    </div>

                    <div className='flex space-x-4 overflow-x-auto pb-2 custom-scrollbar'>
                        {shopOrder.shopOrderItems.map((item, idx) => {
                            // --- CRITICAL FIX: Safe Check for Null Item ---
                            if (!item.item) return null; 

                            // Check BOTH Database status AND Local Session status
                            const isRated = item.isRated || ratedItems.includes(item.item._id);

                            return (
                                <div key={idx} className='flex-shrink-0 w-40 border rounded-lg p-2 bg-white flex flex-col shadow-sm'>
                                    <img src={item.item.image || "https://placehold.co/100?text=No+Image"} alt="" className='w-full h-24 object-cover rounded mb-2' />
                                    <p className='text-sm font-semibold truncate'>{item.name}</p>
                                    <p className='text-xs text-gray-500 mb-2'>Qty: {item.quantity} x ₹{item.price}</p>

                                    {/* RATING SECTION (Shows ONLY if Delivered) */}
                                    {shopOrder.status === "delivered" && (
                                        <div className='mt-auto pt-2 border-t border-gray-100'>
                                            {isRated ? (
                                                <div className="text-xs font-bold text-green-600 text-center bg-green-50 py-1 rounded border border-green-100">
                                                    ✓ Rated
                                                </div>
                                            ) : (
                                                <div className='flex justify-center gap-1'>
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <button 
                                                            key={star}
                                                            className='text-xl text-gray-300 hover:text-yellow-400 transition-colors focus:outline-none active:scale-125'
                                                            onClick={() => onStarClick(item.item._id, item.name, star)}
                                                            title={`Rate ${star} stars`}
                                                        >
                                                            ★
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    
                    <div className='flex justify-between items-center border-t pt-2 text-sm'>
                        <span className='text-gray-600'>Subtotal:</span>
                        <span className='font-semibold'>₹{shopOrder.subtotal}</span>
                    </div>
                </div>
            ))}

            <div className='flex justify-between items-center border-t pt-3'>
                <div>
                    <p className='text-xs text-gray-500'>Total Amount</p>
                    <p className='font-bold text-lg text-[#ff4d2d]'>₹{liveOrder.totalAmount}</p>
                </div>
                <button 
                    className='bg-white border border-[#ff4d2d] text-[#ff4d2d] hover:bg-[#ff4d2d] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200' 
                    onClick={() => navigate(`/track-order/${liveOrder._id}`)}
                >
                    Track Order
                </button>
            </div>
        </div>
    )
}

export default UserOrderCard