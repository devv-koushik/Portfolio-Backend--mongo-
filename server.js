// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000; 

// Middlewares
app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI{
    dbName: 'Portfolio'
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

const contactSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    message: String,
    date: { type: Date, default: Date.now },
});

const Contact = mongoose.model('Contact', contactSchema);

app.get('/api/contacts', async (req, res) => {
    try {
        const contacts = await Contact.find();
        res.status(200).json(contacts);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

app.post('/api/contacts', async (req, res) => {
    try {
        const newContact = new Contact(req.body);
        await newContact.save();
        res.status(201).json({ message: 'Contact saved successfully' });
    } catch (error) {
        console.error('Error saving contact:', error);
        res.status(500).json({ error: 'Failed to save contact' });
    }
});

// Define schema for reviews
const reviewSchema = new mongoose.Schema({
    content: { type: String, required: true },
    date: { type: Date, default: Date.now },
});

// Create model
const Review = mongoose.model('Review', reviewSchema);

app.get('/api/blogs', async (req, res) => {
    try {
        const reviews = await Review.find().sort({ date: -1 }); // latest first
        res.status(200).json(reviews);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

app.post('/api/blogs', async (req, res) => {
    try {
        const { content } = req.body;

        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Review content is required' });
        }

        const newReview = new Review({ content });
        await newReview.save();

        res.status(201).json({ message: 'Review submitted successfully' });
    } catch (error) {
        console.error('Error saving review:', error);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

app.get('/', (req, res) => {
    res.send('Express + MongoDB Contact API is running...');
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
