import express from "express"
import dotenv from "dotenv"
dotenv.config()
import connectDb from "./config/db.js"
import cookieParser from "cookie-parser"
import authRouter from "./routes/auth.routes.js"
import cors from "cors"
import userRouter from "./routes/user.routes.js"
import itemRouter from "./routes/item.routes.js"
import shopRouter from "./routes/shop.routes.js"
import orderRouter from "./routes/order.routes.js"
import adminRouter from "./routes/admin.routes.js"
import chatbotRouter from "./routes/chatbot.routes.js"
import http from "http"
import { Server } from "socket.io"
import { socketHandler } from "./socket.js"
import { startCronJobs } from "./utils/cronJob.js"

const app = express()
const server = http.createServer(app)

const allowedOrigins = [
    "https://hungerhub-05l1.onrender.com",
    "http://localhost:5173",
    "capacitor://localhost",
    "http://localhost",
    "http://192.168.1.100:5173", // Example local IP, would be better to use * for development or a more robust dynamic list
];

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ['POST', 'GET']
    }
})

app.set("io", io)

const port = process.env.PORT || 8000

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())

// --- ROUTES ---
app.use("/api/auth", authRouter)
app.use("/api/user", userRouter)
app.use("/api/shop", shopRouter)
app.use("/api/item", itemRouter)
app.use("/api/order", orderRouter)
app.use("/api/admin", adminRouter)
app.use("/api/chatbot", chatbotRouter)

// --- SERVER STARTUP FUNCTION ---
const startServer = async () => {
    try {
        // 1. Connect to Database FIRST
        await connectDb();
        console.log("✅ Database Connected Successfully");

        // 2. Initialize Sockets & Cron Jobs
        socketHandler(io);
        startCronJobs();

        // 3. Start Listening on Port
        server.listen(port, () => {
            console.log(`🚀 Server started at port ${port}`);
        });

    } catch (error) {
        console.error("❌ Failed to connect to Database:", error);
        process.exit(1); // Stop the app if DB fails
    }
};

// Run the startup function
startServer();// Restart nodemon
