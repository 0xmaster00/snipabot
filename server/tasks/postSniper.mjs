import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const userIdsPath = path.join(__dirname, 'UserIDs.json');
const videoDataPath = path.join(__dirname, '..', '..', 'public', 'videoData.json');
const thumbnailsPath = path.join(__dirname, '..', '..', 'public', 'thumbnails');
const logPath = path.join(__dirname, 'snipelogs.txt');

// Logging function
async function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;
    await fs.appendFile(logPath, logMessage);
}

const MAX_CONCURRENT_REQUESTS = 10;
const limit = pLimit(MAX_CONCURRENT_REQUESTS);

let knownPostIds = new Set();

async function loadExistingPosts() {
    try {
        const videoData = await fs.readJson(videoDataPath);
        knownPostIds = new Set(videoData.map(post => post.id));
        await logToFile(`Loaded ${knownPostIds.size} existing posts`);
    } catch (error) {
        await logToFile('No existing video data found, starting fresh');
    }
}

async function downloadThumbnail(url, videoId) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch thumbnail: ${response.status}`);
        
        const buffer = await response.arrayBuffer();
        const thumbnailPath = path.join(thumbnailsPath, `${videoId}.jpg`);
        await fs.writeFile(thumbnailPath, Buffer.from(buffer));
    } catch (error) {
        await logToFile(`Error downloading thumbnail for ${videoId}: ${error.message}`);
    }
}

async function processSingleUser(user) {
    try {
        const { userId, uniqueId } = user;
        const response = await fetch(`https://tiktok-scraper7.p.rapidapi.com/user/posts?user_id=${userId}&count=30&cursor=0`, {
            headers: {
                'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
                'x-rapidapi-key': '0b9c0cbf2emsh084020b2e07687cp170939jsn5ec18037eddd'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.data?.videos) return [];

        const newPosts = [];

        for (const video of data.data.videos) {
            if (!knownPostIds.has(video.video_id)) {
                // Found new post - log it
                await logToFile(`🚨 NEW POST FOUND - Author: ${uniqueId}, Post ID: ${video.video_id}`);

                if (video.ai_dynamic_cover) {
                    await downloadThumbnail(video.ai_dynamic_cover, video.video_id);
                }

                const processedPost = {
                    AIGCDescription: "",
                    CategoryType: 0,
                    author: {
                        id: userId,
                        uniqueId,
                        nickname: uniqueId,
                        avatarLarger: "",
                        avatarMedium: "",
                        avatarThumb: "",
                        signature: ""
                    },
                    createTime: video.create_time,
                    desc: video.title,
                    id: video.video_id,
                    music: {
                        id: "",
                        title: "",
                        playUrl: video.music || "",
                        coverLarge: "",
                        coverMedium: "",
                        coverThumb: "",
                        authorName: uniqueId,
                        original: false
                    },
                    stats: {
                        collectCount: video.collect_count || 0,
                        commentCount: video.comment_count || 0,
                        diggCount: video.digg_count || 0,
                        playCount: video.play_count || 0,
                        shareCount: video.share_count || 0
                    },
                    video: {
                        cover: video.cover,
                        dynamicCover: video.ai_dynamic_cover,
                        originCover: video.origin_cover,
                        playAddr: video.play,
                        downloadAddr: video.play,
                        duration: video.duration,
                        width: 576,
                        height: 1024
                    }
                };

                newPosts.push(processedPost);
                knownPostIds.add(video.video_id);
            }
        }

        return newPosts;
    } catch (error) {
        await logToFile(`Error processing user ${user.uniqueId}: ${error.message}`);
        return [];
    }
}

async function saveNewPosts(posts) {
    try {
        let existingPosts = [];
        try {
            existingPosts = await fs.readJson(videoDataPath);
        } catch (error) {
            // File doesn't exist yet
        }

        const updatedPosts = [...posts, ...existingPosts];
        await fs.writeJson(videoDataPath, updatedPosts, { spaces: 2 });
        await logToFile(`Saved ${posts.length} new posts to database`);
    } catch (error) {
        await logToFile(`Error saving posts: ${error.message}`);
    }
}

async function checkNewPosts() {
    try {
        await logToFile('\n=== Starting New Check ===');
        const startTime = Date.now();

        const users = await fs.readJson(userIdsPath);
        
        const results = await Promise.all(
            users.map(user => limit(() => processSingleUser(user)))
        );

        const allNewPosts = results.flat().filter(Boolean);

        if (allNewPosts.length > 0) {
            await saveNewPosts(allNewPosts);
        }

        const endTime = Date.now();
        await logToFile(`Batch completed in ${(endTime - startTime) / 1000} seconds`);
        await logToFile(`Processed ${users.length} users, found ${allNewPosts.length} new posts`);

    } catch (error) {
        await logToFile(`Error in batch check: ${error.message}`);
    }
}

// Initial setup
async function main() {
    await logToFile('\n=== Post Sniper Started ===');
    await loadExistingPosts();
    await checkNewPosts();
    
    // Run every minute
    setInterval(checkNewPosts, 60000);
}

main().catch(async (error) => {
    await logToFile(`Fatal error: ${error.message}`);
});