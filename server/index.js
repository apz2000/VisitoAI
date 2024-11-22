const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const rabbitMQ = require('./rabbitmq');
const connectDB = require('./config/db');
const Notification = require('./models/Notification');
const User = require('./models/User');
require('dotenv').config();

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
});

// Initialize RabbitMQ connection
rabbitMQ.connect().then(() => {
    rabbitMQ.consumeFromQueue('notifications', async (message) => {
        try {
            const notification = new Notification(message);
            await notification.save();
            
            // Convert to plain object and ensure IDs are strings
            const plainNotification = {
                ...notification.toObject(),
                _id: notification._id.toString(),
                userId: notification.userId.toString()
            };
            
            console.log('About to emit notification:', plainNotification);
            io.to(plainNotification.userId).emit('new_notification', plainNotification);
            console.log('Notification emitted');
        } catch (error) {
            console.error('Error processing notification:', error);
        }
    });
});

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // Add handler for joining user-specific room
    socket.on("join_user_room", (userId) => {
        console.log(`Socket ${socket.id} joining room for user: ${userId}`);
        socket.join(userId);
        console.log('Current rooms for socket:', Array.from(socket.rooms));
    });

    socket.on("leave_user_room", (userId) => {
        console.log(`Socket ${socket.id} leaving room for user ${userId}`);
        socket.leave(userId);
    });

    // Handle mark as read events
    socket.on("mark_notification_read", async ({ notificationId }) => {
        try {
            const notification = await Notification.findByIdAndUpdate(
                notificationId,
                { status: 'read' },
                { new: true }
            );
            if (notification) {
                const plainNotification = {
                    ...notification.toObject(),
                    _id: notification._id.toString(),
                    userId: notification.userId.toString()
                };
                io.to(plainNotification.userId).emit('notification_updated', plainNotification);
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    });
});

// User endpoints
app.post("/api/users", async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.status(201).json(user);
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error
            res.status(400).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create user' });
        }
    }
});

app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find({ isActive: true })
            .select('-__v')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.get("/api/users/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-__v');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

app.patch("/api/users/:id", async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).select('-__v');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// API endpoints
app.get("/api/notifications/:userId", async (req, res) => {
    try {
        const notifications = await Notification.find({ 
            userId: req.params.userId 
        }).sort({ timestamp: -1 });
        res.json({ notifications });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

app.post("/api/notification", async (req, res) => {
    try {
        const notification = new Notification(req.body);
        await notification.save();
        
        // Send to RabbitMQ queue
        await rabbitMQ.publishToQueue('notifications', {
            userId: notification.userId,
            message: notification.message,
            status: notification.status,
            timestamp: notification.timestamp,
        });
        
        res.status(201).json(notification);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

app.patch("/api/notification/:id", async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        );
        res.json(notification);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

server.listen(4000, () => {
    console.log("Server running on port 4000");
});

