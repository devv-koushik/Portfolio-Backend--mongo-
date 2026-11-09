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
// server.js
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Forces Node.js to resolve SRV records via Google DNS




// Setup Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // Standard fallback, can configure SMTP differently if needed
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify SMTP connection configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Nodemailer SMTP Verification Error:', error.message);
    } else {
        console.log('✅ Nodemailer is ready to send emails via Gmail SMTP');
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
    name: { type: String, default: 'Anonymous' },
    email: { type: String, default: '' },
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

app.post('/api/blogs', [
    body('content').notEmpty().withMessage('Review content is required').trim(),
    body('name').optional().trim(),
    body('email').optional().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { content, name, email, botCheck } = req.body;

        // Honeypot check for bots
        if (botCheck) {
            console.log('Spam bot caught in blog review by honeypot! Silently rejecting.');
            return res.status(201).json({ message: 'Review submitted successfully' });
        }

        const reviewerName = name && name.trim() ? name.trim() : 'Anonymous';
        const reviewerEmail = email && email.trim() ? email.trim() : '';

        const newReview = new Review({
            content: content.trim(),
            name: reviewerName,
            email: reviewerEmail
        });
        await newReview.save();

        // Send email notification to owner (just like contact form)
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // sending to yourself
            subject: `New Blog Review from ${reviewerName}`,
            text: `You have received a new review on your blog!\n\nReviewer: ${reviewerName}\nEmail: ${reviewerEmail || 'Not provided'}\nDate: ${new Date().toLocaleString()}\n\nReview:\n${content.trim()}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #222; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
                    <h2 style="color: #b74b4b; margin-top: 0; border-bottom: 2px solid #b74b4b; padding-bottom: 10px; font-size: 20px;">
                        📝 New Blog Review Received
                    </h2>
                    <p style="font-size: 15px; color: #4a5568; margin-top: 12px;">You have received a new review on your portfolio blog:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
                        <tr>
                            <td style="padding: 6px 0; color: #718096; width: 110px;"><strong>Reviewer:</strong></td>
                            <td style="padding: 6px 0; color: #1a202c; font-weight: 600;">${reviewerName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #718096;"><strong>Email:</strong></td>
                            <td style="padding: 6px 0; color: #1a202c;">${reviewerEmail || '<span style="color: #a0aec0;">Not provided</span>'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #718096;"><strong>Date:</strong></td>
                            <td style="padding: 6px 0; color: #1a202c;">${new Date().toLocaleString()}</td>
                        </tr>
                    </table>
                    <div style="background-color: #f8fafc; border-left: 4px solid #b74b4b; padding: 16px; border-radius: 4px; margin: 16px 0;">
                        <strong style="color: #4a5568; display: block; margin-bottom: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Review Message:</strong>
                        <p style="margin: 0; font-size: 15px; line-height: 1.6; white-space: pre-wrap; color: #2d3748;">${content.trim()}</p>
                    </div>
                    <p style="margin-top: 24px; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 12px;">
                        Automated notification from your Portfolio Blog Review System.
                    </p>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.error('Error sending blog review email notification:', err);
            } else {
                console.log('Blog review email notification sent successfully:', info.response);
            }
        });

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
