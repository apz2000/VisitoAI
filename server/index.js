const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const rabbitMQ = require('./rabbitmq');
const { connectDB, closeDB } = require('./config/db');
const Notification = require('./models/Notification');
const User = require('./models/User');
require('dotenv').config();

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "http://localhost:3000", methods: ["GET", "POST", "PATCH"] },
});

// Define separate queues for different concerns
const QUEUE_NAMES = {
    DB_OPERATIONS: 'notifications_db',
    REALTIME_NOTIFICATIONS: 'notifications_realtime'
};

// Connect and set up consumers
rabbitMQ.connect().then(() => {
    // Consumer for database operations
    rabbitMQ.consumeFromQueue(QUEUE_NAMES.DB_OPERATIONS, async (message) => {
        try {
            // TODO: add logic to handle different channels
            // TODO: avoid dependency on mongoose models and send real-time notifications directly
            const notification = new Notification(message);
            const savedNotification = await notification.save();
            // console.log('Notification saved to DB:', notification._id);
            
            // After saving, publish to realtime queue
            /* Update to use tempId instead of _id for real-time notifications
            await rabbitMQ.publishToQueue(QUEUE_NAMES.REALTIME_NOTIFICATIONS, {
                ...notification.toObject(),
                _id: notification._id.toString(),
                userId: notification.userId.toString()
            }, false);*/

            await rabbitMQ.publishToQueue(QUEUE_NAMES.REALTIME_NOTIFICATIONS, {
                ...savedNotification.toObject(),
                _id: savedNotification._id.toString(),
                userId: savedNotification.userId.toString(),
                tempId: message.tempId.toString()
            }, false);
        } catch (error) {
            console.error('Error saving notification to DB:', error);
        }
    });

    // Consumer for real-time notifications
    rabbitMQ.consumeFromQueue(QUEUE_NAMES.REALTIME_NOTIFICATIONS, async (message) => {
        try {
            io.to(message.userId).emit(message._id ? 'notification_updated' : 'new_notification', message);
        } catch (error) {
            console.error('Error emitting notification:', error);
        }
    }, false);
});

io.on("connection", (socket) => {
    // console.log(`User connected: ${socket.id}`);
    
    // Add handler for joining user-specific room
    socket.on("join_user_room", (userId) => {
        // console.log(`Socket ${socket.id} joining room for user: ${userId}`);
        socket.join(userId);
    });

    // Handle initial notifications request through socket
    socket.on("get_initial_notifications", async ({ userId, channel }) => {
        try {
            const notifications = await Notification.find({ 
                userId: userId,
                channel: channel || 'web'
            })
                .sort({ timestamp: -1 })
                .lean(); // Get plain objects

            // Convert ObjectIds to strings
            const sanitizedNotifications = notifications.map(notification => ({
                ...notification,
                _id: notification._id.toString(),
                userId: notification.userId.toString()
            }));

            socket.emit("initial_notifications", sanitizedNotifications);
        } catch (error) {
            console.error('Error fetching initial notifications:', error);
        }
    });

    // Handle mark as read events
    socket.on("notification_change_status", async ({ notificationId, status }) => {
        try {
            const notification = await Notification.findByIdAndUpdate(
                notificationId,
                { status: status },
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

    // Handle notification creation
    socket.on("send_notification", async ({ message, userId, status, title }) => {
        // TODO: add logic to send notification to selected user
        try {
            const notificationData = {
                userId: userId,
                title: title || 'Notification',
                message: message,
                status: status || 'unread',
                timestamp: new Date(),
                channel: 'web',
                tempId: Date.now() // temporary ID for real-time notifications
            };
            
            // Publish to DB operations queue
            await Promise.all([
                rabbitMQ.publishToQueue(QUEUE_NAMES.DB_OPERATIONS, notificationData),
                rabbitMQ.publishToQueue(QUEUE_NAMES.REALTIME_NOTIFICATIONS, notificationData, false)
            ]);
        } catch (error) {
            console.error('Failed to queue notification:', error);
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
app.get("/api/notifications/user/:userId/channel/:channel", async (req, res) => {
    // add logic depending channel, for the moment, only web is supported
    try {
        const notifications = await Notification.find({ 
            userId: req.params.userId,
            channel: req.params.channel || 'web' 
        }).sort({ timestamp: -1 });
        res.json({ notifications });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

app.post("/api/notification", async (req, res) => {
    // add logic depending channel, for the moment, only web is supported
    try {
        const notificationData = {
            userId: req.body.userId,
            title: req.body.title || 'Notification',
            message: req.body.message,
            status: req.body.status || 'unread',
            timestamp: new Date(),
            channel: req.body.channel || 'web',
            tempId: Date.now() // temporary ID for real-time notifications
        };
        
        // Publish to DB operations queue
        await Promise.all([
            rabbitMQ.publishToQueue(QUEUE_NAMES.DB_OPERATIONS, notificationData),
            rabbitMQ.publishToQueue(QUEUE_NAMES.REALTIME_NOTIFICATIONS, notificationData, false)
        ]);
        
        res.status(202).json({ message: 'Notification queued successfully' });
    } catch (error) {
        console.error('Failed to queue notification:', error);
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

process.on('SIGINT', async () => {
    console.log('Server shutting down');
    try {
        await rabbitMQ.channel.close();
        await server.close();
        await closeDB();
        await io.close();
        process.exit(0);
    } catch (error) {
        console.error('Error shutting down server:', error);
        process.exit(1);
    }
});
