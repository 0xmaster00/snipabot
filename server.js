import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { getLinkPreview } from 'link-preview-js';
import { fileURLToPath } from 'url';
import { updateMetrics } from './server/tasks/fetchMetrics.mjs';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Use Railway's PORT environment variable or fallback to 3000
const PORT = process.env.PORT || 3000;
// Bind to all interfaces (0.0.0.0) instead of localhost
const HOST = '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check route (good practice for Railway)
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes

// Serve videoData.json
app.get('/videos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'videoData.json'));
});

// Metadata route for URL previews
app.get('/metadata', async (req, res) => {
    const { url } = req.query;

    try {
        const previewData = await getLinkPreview(url);
        res.json(previewData);
    } catch (error) {
        console.error('Error fetching metadata:', error);
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
});

// New route for updating metrics
app.post('/update-metrics', async (req, res) => {
    try {
        console.log('Starting metrics update...');
        const result = await updateMetrics();
        
        if (result.success) {
            console.log(`Successfully updated ${result.updatedCount} videos`);
            res.json({
                success: true,
                message: `Updated ${result.updatedCount} videos`,
                updatedCount: result.updatedCount
            });
        } else {
            console.error('Metrics update failed:', result.error);
            res.status(500).json({
                success: false,
                message: result.error
            });
        }
    } catch (error) {
        console.error('Error in metrics update endpoint:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.post('/add-user', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({
                success: false,
                message: 'Username is required'
            });
        }

        const response = await fetch(
            `https://tiktok-scraper2.p.rapidapi.com/user/info?user_name=${encodeURIComponent(username)}`,
            {
                method: 'GET',
                headers: {
                    'x-rapidapi-key': '4292a497a4msh4de7947cbee1fa6p1195ddjsn8b33127ea1ff',
                    'x-rapidapi-host': 'tiktok-scraper2.p.rapidapi.com'
                }
            }
        );

        const data = await response.json();
        
        // Check if we have valid user data with ID
        if (data.user && data.user.id) {
            // Read existing users
            const userIdsPath = path.join(__dirname, 'server', 'tasks', 'UserIDs.json');
            let users = [];
            
            try {
                users = await fs.readJson(userIdsPath);
            } catch (err) {
                // If file doesn't exist, start with empty array
                users = [];
            }
            
            // Check for existing user
            const existingUser = users.find(u => u.uniqueId.toLowerCase() === username.toLowerCase());
            if (existingUser) {
                return res.json({
                    success: false,
                    message: 'User already exists in database'
                });
            }

            // Create new user entry
            const newUser = {
                uniqueId: username,
                userId: data.user.id,
                id: `pending_${Date.now()}`
            };
            
            // Add user and save
            users.push(newUser);
            await fs.writeJson(userIdsPath, users, { spaces: 2 });
            
            return res.json({
                success: true,
                message: 'User added successfully'
            });
        } else {
            return res.json({
                success: false,
                message: 'User not found or invalid response'
            });
        }
    } catch (error) {
        console.error('Error adding user:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'An unexpected error occurred'
    });
});

// Start server - FIXED: bind to HOST (0.0.0.0) instead of localhost
app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
    console.log(`Public directory: ${path.join(__dirname, 'public')}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});