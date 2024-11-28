const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const rabbitMQ = require('./services/rabbitmq');
const { connectDB, closeDB } = require('./config/db');
const Notification = require('./models/Notification');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
require('dotenv').config();

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(express.json());
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "http://localhost:3000", methods: ["GET", "POST", "PATCH"] },
});

// Define separate queues for different concerns
const QUEUE_NAMES = {
    DB_OPERATIONS: 'notifications_db',
    REALTIME_NOTIFICATIONS: 'notifications_realtime'
};

// TODO: Create Consumers for RabbitMQ
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
            
            // After saving, publish to realtime queue with DB id.
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
