// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000; 

// Setup Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // Standard fallback, can configure SMTP differently if needed
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Middlewares
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', apiLimiter);

const blogLikeSchema = new mongoose.Schema({
    blogId: { type: String, required: true, unique: true },
    likes: { type: Number, default: 0 }
});
const BlogLike = mongoose.model('BlogLike', blogLikeSchema);

mongoose.connect(
    process.env.MONGO_URI || 'mongodb+srv://koushikbhowmick04_db_user:eIRSWEBw8zUrsbsV@dev-koushik.wdi7itz.mongodb.net/Portfolio?retryWrites=true&w=majority',
    {
        dbName: 'Portfolio'
    }
)
.then(async () => {
    console.log('✅ Connected to MongoDB');
    // Initialize default likes if they don't exist
    const initialLikes = { '1': 84, '2': 62, '3': 95, '4': 73 };
    for (const [blogId, likes] of Object.entries(initialLikes)) {
        await BlogLike.updateOne(
            { blogId },
            { $setOnInsert: { likes } },
            { upsert: true }
        );
    }
})
.catch((err) => console.error('❌ MongoDB connection error:', err));

const contactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    message: { type: String, required: true },
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

app.post('/api/contacts', [
    body('name').notEmpty().withMessage('Name is required').trim().escape(),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phone').optional().trim().escape(),
    body('message').notEmpty().withMessage('Message is required').trim().escape()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, email, phone, message, botCheck } = req.body;
        
        // Honeypot check
        if (botCheck) {
            console.log('Spam bot caught by honeypot! Silently rejecting.');
            // Fake a success response to fool the bot
            return res.status(201).json({ message: 'Contact saved successfully' });
        }

        const newContact = new Contact({ name, email, phone, message });
        await newContact.save();

        // Send email notification
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // sending to yourself
            subject: `New Contact Form Submission from ${name}`,
            text: `You have received a new contact submission.\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nMessage:\n${message}`
        };
        
        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.error('Error sending email notification:', err);
            } else {
                console.log('Email notification sent:', info.response);
            }
        });

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

// GET all blog likes
app.get('/api/blogs/likes', async (req, res) => {
    try {
        const likes = await BlogLike.find();
        const likesMap = {};
        likes.forEach(like => {
            likesMap[like.blogId] = like.likes;
        });
        res.status(200).json(likesMap);
    } catch (error) {
        console.error('Error fetching likes:', error);
        res.status(500).json({ error: 'Failed to fetch likes' });
    }
});

// POST to increment or decrement a blog like
app.post('/api/blogs/likes/:id', async (req, res) => {
    try {
        const { liked } = req.body;
        const incValue = liked ? 1 : -1;
        
        const blogLike = await BlogLike.findOneAndUpdate(
            { blogId: req.params.id },
            { $inc: { likes: incValue } },
            { new: true, upsert: true }
        );
        
        res.status(200).json({ likes: blogLike.likes });
    } catch (error) {
        console.error('Error updating like:', error);
        res.status(500).json({ error: 'Failed to update like' });
    }
});

app.get('/', (req, res) => {
    res.send('Express + MongoDB Contact API is running...');
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
