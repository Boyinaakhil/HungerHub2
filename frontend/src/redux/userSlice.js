import { createSlice } from "@reduxjs/toolkit";

// --- HELPER: Load initial state from localStorage ---
const loadCartFromStorage = () => {
  try {
    const storedCart = localStorage.getItem("cartItems");
    const storedTotal = localStorage.getItem("totalAmount");
    return {
      cartItems: storedCart ? JSON.parse(storedCart) : [],
      totalAmount: storedTotal ? JSON.parse(storedTotal) : 0,
    };
  } catch (error) {
    console.error("Failed to load cart from storage", error);
    return { cartItems: [], totalAmount: 0 };
  }
};

const { initialCartItems, initialTotalAmount } = {
  initialCartItems: loadCartFromStorage().cartItems,
  initialTotalAmount: loadCartFromStorage().totalAmount
};

const userSlice = createSlice({
  name: "user",
  initialState: {
    userData: null,
    currentCity: null,
    currentState: null,
    currentAddress: null,
    shopInMyCity: null,
    itemsInMyCity: null,
    // Initialize cart from Local Storage if available
    cartItems: initialCartItems,
    totalAmount: initialTotalAmount,
    myOrders: [],
    searchItems: null,
    socket: null
  },
  reducers: {
    setUserData: (state, action) => {
      state.userData = action.payload;
    },
    setCurrentCity: (state, action) => {
      state.currentCity = action.payload;
    },
    setCurrentState: (state, action) => {
      state.currentState = action.payload;
    },
    setCurrentAddress: (state, action) => {
      state.currentAddress = action.payload;
    },
    setShopsInMyCity: (state, action) => {
      state.shopInMyCity = action.payload;
    },
    setItemsInMyCity: (state, action) => {
      state.itemsInMyCity = action.payload;
    },
    setSocket: (state, action) => {
      state.socket = action.payload;
    },

    // --- REVISED CART LOGIC WITH PERSISTENCE ---
    addToCart: (state, action) => {
      const newItem = action.payload;
      // Robust ID check: checks _id first (MongoDB default), then id
      const newItemId = newItem._id || newItem.id; 

      const existingItem = state.cartItems.find(
        (i) => (i._id || i.id) === newItemId
      );

      if (existingItem) {
        // Ensure we are adding numbers, not concatenating strings
        existingItem.quantity = Number(existingItem.quantity) + Number(newItem.quantity);
      } else {
        // Push a copy to avoid reference issues, ensure quantity is number
        state.cartItems.push({
          ...newItem,
          quantity: Number(newItem.quantity),
          price: Number(newItem.price)
        });
      }

      // Recalculate Total
      state.totalAmount = state.cartItems.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0
      );

      // SAVE TO STORAGE
      localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
      localStorage.setItem("totalAmount", JSON.stringify(state.totalAmount));
    },

    setTotalAmount: (state, action) => {
      state.totalAmount = action.payload;
      localStorage.setItem("totalAmount", JSON.stringify(state.totalAmount));
    },

    updateQuantity: (state, action) => {
      const { id, _id, quantity } = action.payload;
      // Handle either ID format passed in payload
      const targetId = _id || id; 
      const newQuantity = Number(quantity);

      const itemIndex = state.cartItems.findIndex(
        (i) => (i._id || i.id) === targetId
      );

      if (itemIndex >= 0) {
        if (newQuantity <= 0) {
          // Remove item if quantity is 0 or less
          state.cartItems.splice(itemIndex, 1);
        } else {
          // Update quantity
          state.cartItems[itemIndex].quantity = newQuantity;
        }
      }

      // Recalculate Total
      state.totalAmount = state.cartItems.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0
      );

      // SAVE TO STORAGE
      localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
      localStorage.setItem("totalAmount", JSON.stringify(state.totalAmount));
    },

    removeCartItem: (state, action) => {
      // Expecting action.payload to be the ID (string/number)
      const targetId = action.payload;
      state.cartItems = state.cartItems.filter(
        (i) => (i._id || i.id) !== targetId
      );
      
      state.totalAmount = state.cartItems.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0
      );

      // SAVE TO STORAGE
      localStorage.setItem("cartItems", JSON.stringify(state.cartItems));
      localStorage.setItem("totalAmount", JSON.stringify(state.totalAmount));
    },

    clearCart: (state) => {
      state.cartItems = [];
      state.totalAmount = 0;
      // CLEAR STORAGE
      localStorage.removeItem("cartItems");
      localStorage.removeItem("totalAmount");
    },
    // ---------------------------

    setMyOrders: (state, action) => {
      state.myOrders = action.payload;
    },
    addMyOrder: (state, action) => {
      state.myOrders = [action.payload, ...state.myOrders];
    },
    updateOrderStatus: (state, action) => {
      const { orderId, shopId, status } = action.payload;
      const order = state.myOrders.find((o) => o._id == orderId);
      if (order) {
        // Check structure: sometimes shopOrders is an array, sometimes an object depending on backend
        if (order.shopOrders && order.shopOrders.shop?._id == shopId) {
          order.shopOrders.status = status;
        } else if (Array.isArray(order.shopOrders)) {
             // Handle if shopOrders is an array (common in multi-vendor apps)
             const subOrder = order.shopOrders.find(so => so.shop._id == shopId);
             if (subOrder) subOrder.status = status;
        }
      }
    },

    updateRealtimeOrderStatus: (state, action) => {
      const { orderId, shopId, status } = action.payload;
      const order = state.myOrders.find((o) => o._id == orderId);
      if (order) {
        // Assuming shopOrders is an array based on original code usage here
        if (Array.isArray(order.shopOrders)) {
            const shopOrder = order.shopOrders.find((so) => so.shop._id == shopId);
            if (shopOrder) {
                shopOrder.status = status;
            }
        }
      }
    },

    setSearchItems: (state, action) => {
      state.searchItems = action.payload;
    },

    updateWallet: (state, action) => {
      if (state.userData) {
        state.userData.walletBalance = action.payload;
      }
    },

    updateSubscription: (state, action) => {
      if (state.userData) {
        if (!state.userData.subscription) {
          state.userData.subscription = {};
        }
        state.userData.subscription.planExpiresAt = action.payload;
      }
    }
  },
});

export const {
  setUserData,
  setCurrentAddress,
  setCurrentCity,
  setCurrentState,
  setShopsInMyCity,
  setItemsInMyCity,
  addToCart,
  updateQuantity,
  removeCartItem,
  clearCart, // Exported new reducer
  setMyOrders,
  addMyOrder,
  updateOrderStatus,
  setSearchItems,
  setTotalAmount,
  setSocket,
  updateRealtimeOrderStatus,
  updateWallet,
  updateSubscription
} = userSlice.actions;

export default userSlice.reducer;