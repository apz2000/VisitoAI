const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const rabbitMQ = require("../services/rabbitmq");
// Define separate queues for different concerns
const QUEUE_NAMES = {
    DB_OPERATIONS: 'notifications_db',
    REALTIME_NOTIFICATIONS: 'notifications_realtime'
};


router.get("/user/:userId/channel/:channel", async (req, res) => {
    // add logic depending channel, for the moment, only web is supported
    try {
        const notifications = await Notification.find({ 
            userId: req.params.userId,
            channel: req.params.channel || 'web' 
        }).sort({ timestamp: -1 });
        res.json({ notifications });
    } catch (error) {
        // TODO: add logger 
        // TODO: add error handling for better user experience
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

router.post("/", async (req, res) => {
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
        // TODO: add logger 
        // TODO: add error handling for better user experience
        console.error('Failed to queue notification:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

router.patch("/:id", async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        );
        res.json(notification);
    } catch (error) {
        // TODO: add logger 
        // TODO: add error handling for better user experience
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

module.exports = router;


