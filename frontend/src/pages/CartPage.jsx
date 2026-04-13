import React from 'react'
import { IoIosArrowRoundBack } from "react-icons/io";
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { updateQuantity, removeCartItem } from '../redux/userSlice';
import { FaPlus, FaMinus, FaTrash } from "react-icons/fa6"; 

// --- Cart Item Card Component ---
const CartItemCard = ({ data }) => {
    const dispatch = useDispatch();

    const increaseQuantity = () => {
        dispatch(updateQuantity({ 
            id: data.id, 
            _id: data._id, 
            quantity: data.quantity + 1 
        }));
    };

    const decreaseQuantity = () => {
        // Only allow decrease if quantity is greater than 1
        if (data.quantity > 1) {
            dispatch(updateQuantity({ 
                id: data.id, 
                _id: data._id, 
                quantity: data.quantity - 1 
            }));
        } 
        // We removed the else block here so it doesn't delete automatically
    };

    // New Function to handle direct removal
    const handleRemove = () => {
        dispatch(removeCartItem(data._id || data.id));
    };

    return (
        <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            {/* --- Image & Info Section --- */}
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                    <img 
                        src={data.image || "https://placehold.co/100"} 
                        alt={data.name} 
                        className="w-full h-full object-cover"
                    />
                </div>
                <div>
                    <h3 className="font-semibold text-gray-800 line-clamp-1">{data.name}</h3>
                    <p className="text-[#ff4d2d] font-bold">₹{data.price}</p>
                </div>
            </div>

            {/* --- Controls Section --- */}
            <div className="flex items-center gap-3">
                
                {/* Quantity Controls */}
                <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                    <button 
                        onClick={decreaseQuantity}
                        disabled={data.quantity <= 1} // Disable if quantity is 1
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200
                            ${data.quantity <= 1 
                                ? "text-gray-300 cursor-not-allowed" // Disabled Style
                                : "text-gray-600 hover:bg-gray-200"  // Active Style
                            }`}
                    >
                        {/* Always show Minus here */}
                        <FaMinus size={12} />
                    </button>

                    <span className="font-semibold text-gray-700 w-4 text-center">
                        {data.quantity}
                    </span>

                    <button 
                        onClick={increaseQuantity}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-green-600 hover:bg-green-50 transition-colors"
                    >
                        <FaPlus size={12} />
                    </button>
                </div>

                {/* Always Visible Delete Button */}
                <button 
                    onClick={handleRemove}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors border border-red-100"
                    title="Remove Item"
                >
                    <FaTrash size={12} />
                </button>
            </div>
        </div>
    );
};

// --- Main Cart Page ---
function CartPage() {
    const navigate = useNavigate()
    const dispatch = useDispatch() 
    const { cartItems, totalAmount } = useSelector(state => state.user)

    return (
        <div className='min-h-screen bg-[#fff9f6] flex justify-center p-6'>
            <div className='w-full max-w-[800px]'>
                <div className='flex items-center gap-[20px] mb-6 '>
                    <div className=' z-[10] cursor-pointer' onClick={() => navigate("/")}>
                        <IoIosArrowRoundBack size={35} className='text-[#ff4d2d]' />
                    </div>
                    <h1 className='text-2xl font-bold text-start'>Your Cart</h1>
                </div>
                {cartItems?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                        <p className='text-gray-500 text-lg text-center mb-4'>Your Cart is Empty</p>
                        <button 
                             onClick={() => navigate('/')}
                             className="text-[#ff4d2d] font-medium hover:underline"
                        >
                            Start Shopping
                        </button>
                    </div>
                ) : (
                    <>
                        <div className='space-y-4'>
                            {cartItems?.map((item, index) => (
                                <CartItemCard 
                                    data={item} 
                                    key={item._id || item.id || index} 
                                />
                            ))}
                        </div>
                        <div className='mt-6 bg-white p-4 rounded-xl shadow flex justify-between items-center border'>
                            <h1 className='text-lg font-semibold'>Total Amount</h1>
                            <span className='text-xl font-bold text-[#ff4d2d]'>₹{totalAmount}</span>
                        </div>
                        <div className='mt-4 flex justify-end' > 
                            <button className='bg-[#ff4d2d] text-white px-6 py-3 rounded-lg text-lg font-medium hover:bg-[#e64526] transition cursor-pointer' onClick={()=>navigate("/checkout")}>Proceed to CheckOut</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default CartPage