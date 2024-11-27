const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['unread', 'read'],
        default: 'unread'
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    channel: {
        type: String,
        enum: ['email', 'push', 'sms','web','all'],
        default: 'web'
    }
});

module.exports = mongoose.model('Notification', notificationSchema); 