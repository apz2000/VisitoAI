const express = require("express");
const router = express.Router();
const User = require('../models/User');

// User endpoints
router.post("/", async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.status(201).json(user);
    } catch (error) {
        // TODO: add logger 
        // TODO: add error more handling for better user experience
        if (error.code === 11000) { // Duplicate key error
            res.status(400).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create user' });
        }
    }
});

router.get("/", async (req, res) => {
    try {
        const users = await User.find({ isActive: true })
            .select('-__v')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        // TODO: add logger 
        // TODO: add error handling for better user experience
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-__v');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        // TODO: add logger 
        // TODO: add error handling for better user experience
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

router.patch("/:id", async (req, res) => {
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
        // TODO: add logger 
        // TODO: add error handling for better user experience
        res.status(500).json({ error: 'Failed to update user' });
    }
});

module.exports = router;
