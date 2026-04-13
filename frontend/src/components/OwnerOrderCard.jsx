import axios from 'axios';
import React, { useState, useEffect } from 'react';
import { MdPhone, MdOutlineAccountBalanceWallet } from "react-icons/md";
import { serverUrl } from '../App';
import { useDispatch } from 'react-redux';
import { updateOrderStatus } from '../redux/userSlice';

function OwnerOrderCard({ data, refreshOrders }) {
    const [availableBoys, setAvailableBoys] = useState([]);
    // Local status state for instant UI feedback
    const [currentStatus, setCurrentStatus] = useState(data.shopOrders?.status || 'placed');
    
    const dispatch = useDispatch();

    // Helper to safely get shop order data
    const shopOrder = data.shopOrders || {};

    // Sync local status if parent data changes (e.g. background refresh)
    useEffect(() => {
        if (shopOrder.status) {
            setCurrentStatus(shopOrder.status);
        }
    }, [shopOrder.status]);

    const handleUpdateStatus = async (orderId, shopId, newStatus) => {
        try {
            // 1. Update UI instantly
            setCurrentStatus(newStatus);

            // 2. Call Backend
            // FIXED: Ensure we pass shopId._id if it's an object, or just shopId if it's a string
            const validShopId = typeof shopId === 'object' ? shopId._id : shopId;

            const result = await axios.post(`${serverUrl}/api/order/update-status/${orderId}/${validShopId}`, { status: newStatus }, { withCredentials: true })
            
            // 3. Update Redux
            dispatch(updateOrderStatus({ orderId, shopId: validShopId, status: newStatus }))
            
            // 4. Capture Available Delivery Boys (if just broadcasted)
            if (result.data.availableBoys) {
                setAvailableBoys(result.data.availableBoys);
            }

            // 5. Refresh parent list to get latest updates
            if (refreshOrders) refreshOrders();

        } catch (error) {
            console.log(error);
            alert("Failed to update status. Please try again.");
            // Revert on error
            setCurrentStatus(shopOrder.status);
        }
    }

    return (
        <div className='bg-white rounded-lg shadow p-4 space-y-4 border border-gray-100'>
            
            {/* --- USER DETAILS --- */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className='text-lg font-semibold text-gray-800'>{data.user?.fullName || "Guest"}</h2>
                    <p className='text-sm text-gray-500'>{data.user?.email}</p>
                    <p className='flex items-center gap-2 text-sm text-gray-600 mt-1'>
                        <MdPhone /><span>{data.user?.mobile}</span>
                    </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${data.paymentMethod === 'online' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                    {data.paymentMethod}
                </span>
            </div>

            {/* --- ADDRESS --- */}
            <div className='bg-gray-50 p-3 rounded-md text-sm text-gray-600'>
                <p className='font-medium text-gray-800 mb-1'>Delivery To:</p>
                <p className='line-clamp-2'>{data?.deliveryAddress?.text}</p>
                <p className='text-xs text-gray-400 mt-1'>Lat: {data?.deliveryAddress?.latitude}, Lon: {data?.deliveryAddress?.longitude}</p>
            </div>

            {/* --- ITEMS --- */}
            <div className='flex space-x-4 overflow-x-auto pb-2 custom-scrollbar'>
                {shopOrder.shopOrderItems?.map((item, index) => (
                    <div key={index} className='flex-shrink-0 w-40 border rounded-lg p-2 bg-white flex flex-col'>
                        <img src={item.item?.image} alt="" className='w-full h-24 object-cover rounded mb-2' />
                        <p className='text-sm font-semibold truncate'>{item.name}</p>
                        <p className='text-xs text-gray-500 mt-auto'>Qty: {item.quantity} x ₹{item.price}</p>
                    </div>
                ))}
            </div>

            {/* --- PAYMENT BREAKDOWN --- */}
            <div className="border-t border-gray-100 pt-3">
                <div className="flex justify-between text-sm mb-1">
                    <span>Subtotal:</span>
                    <span className="font-semibold">₹{shopOrder.subtotal}</span>
                </div>
                
                {data.paidByWallet > 0 && (
                    <div className="flex justify-between text-sm text-green-600 font-medium mb-1">
                        <span className="flex items-center gap-1"><MdOutlineAccountBalanceWallet /> Paid by Plan:</span>
                        <span>- ₹{data.paidByWallet}</span>
                    </div>
                )}

                <div className="flex justify-between text-base font-bold text-gray-800 border-t border-dashed border-gray-200 pt-2 mt-2">
                    <span>{data.paymentMethod === 'cod' ? 'Cash to Collect:' : 'Paid Online:'}</span>
                    <span>₹{data.paidByCashOnline}</span>
                </div>
                
                {data.paymentMethod === 'cod' && data.paidByCashOnline > 0 && (
                    <p className="text-xs text-orange-600 font-bold mt-1 text-right animate-pulse">
                        ⚠️ Collect ₹{data.paidByCashOnline} cash
                    </p>
                )}
            </div>

            {/* --- STATUS ACTIONS --- */}
            <div className='flex justify-between items-center mt-3 pt-3 border-t border-gray-100'>
                <span className='text-sm'>Status: <span className={`font-semibold capitalize ml-1 ${currentStatus === 'out of delivery' ? 'text-blue-600' : 'text-[#ff4d2d]'}`}>{currentStatus}</span></span>

                <select 
                    className='rounded-md border px-3 py-1 text-sm focus:outline-none focus:ring-2 border-[#ff4d2d] text-[#ff4d2d] bg-white cursor-pointer' 
                    onChange={(e) => handleUpdateStatus(data._id, shopOrder.shop, e.target.value)}
                    value="" 
                >
                    <option value="" disabled>Change Status</option>
                    <option value="pending">Pending</option>
                    <option value="preparing">Preparing</option>
                    <option value="out of delivery">Out Of Delivery</option>
                </select>
            </div>

            {/* --- DELIVERY BOY LOGIC --- */}
            {currentStatus === "out of delivery" && (
                <div className="mt-3 p-2 border rounded-lg text-sm bg-orange-50 gap-4">
                    {/* Header */}
                    {shopOrder.assignedDeliveryBoy ? (
                        <p className="font-bold text-gray-700">Assigned Delivery Boy:</p>
                    ) : (
                        <p className="font-bold text-gray-700">Available Delivery Boys:</p>
                    )}
                    
                    {/* List Logic */}
                    {availableBoys?.length > 0 ? (
                        <div className="mt-1 space-y-1">
                            {availableBoys.map((b, index) => (
                                <div key={index} className='text-gray-800 font-medium bg-white p-1 rounded border border-gray-200'>
                                    {b.fullName} - {b.mobile}
                                </div>
                            ))}
                        </div>
                    ) : shopOrder.assignedDeliveryBoy ? (
                        <div className='text-green-700 font-medium mt-1 bg-white p-1 rounded border border-green-200'>
                            {shopOrder.assignedDeliveryBoy.fullName} - {shopOrder.assignedDeliveryBoy.mobile}
                        </div>
                    ) : (
                        <div className="text-gray-500 italic mt-1">Waiting for delivery boy to accept...</div>
                    )}
                </div>
            )}
        </div>
    )
}

export default OwnerOrderCard;