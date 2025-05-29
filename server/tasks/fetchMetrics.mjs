import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const videoDataPath = path.join(__dirname, '..', '..', 'public', 'videoData.json');
const errorLogPath = path.join(__dirname, 'error_log.json');

// API Configuration
const API_KEY = '0b9c0cbf2emsh084020b2e07687cp170939jsn5ec18037eddd';
const API_HOST = 'tiktok-scraper2.p.rapidapi.com';

// Concurrency settings
const BATCH_SIZE = 20; // Process 20 videos at once
const CONCURRENT_REQUESTS = 10; // 10 concurrent API requests
const limit = pLimit(CONCURRENT_REQUESTS);

async function updateSingleVideo(video) {
    const videoUrl = `https://www.tiktok.com/@${video.author.uniqueId}/video/${video.id}`;
    
    try {
        const response = await fetch(`https://${API_HOST}/video/info_v2?video_url=${encodeURIComponent(videoUrl)}&video_id=${video.id}`, {
            headers: {
                'x-rapidapi-host': API_HOST,
                'x-rapidapi-key': API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.itemInfo?.itemStruct?.stats) {
            const newStats = data.itemInfo.itemStruct.stats;
            const updatedVideo = {
                ...video,
                stats: {
                    collectCount: parseInt(newStats.collectCount || newStats.collect_count || 0),
                    commentCount: parseInt(newStats.commentCount || newStats.comment_count || 0),
                    diggCount: parseInt(newStats.diggCount || newStats.digg_count || 0),
                    playCount: parseInt(newStats.playCount || newStats.play_count || 0),
                    shareCount: parseInt(newStats.shareCount || newStats.share_count || 0)
                }
            };
            
            const statsChanged = Object.keys(updatedVideo.stats).some(key => 
                updatedVideo.stats[key] !== video.stats[key]
            );
            
            return { video: updatedVideo, changed: statsChanged };
        }
        
        return { video, changed: false };
    } catch (error) {
        console.error(`Error updating video ${video.id}:`, error.message);
        return { video, changed: false };
    }
}

async function processBatch(videos, startIdx) {
    console.log(`Processing batch ${startIdx + 1}-${startIdx + videos.length}`);
    
    const batchResults = await Promise.all(
        videos.map(video => limit(() => updateSingleVideo(video)))
    );

    const changedInBatch = batchResults.filter(r => r.changed).length;
    console.log(`Batch complete: ${changedInBatch} videos updated`);
    
    return batchResults;
}

export async function updateMetrics() {
    try {
        console.log('\nStarting metrics update...');
        const startTime = Date.now();

        // Read and sort videos
        const videoData = await fs.readJson(videoDataPath);
        const recentVideos = videoData
            .sort((a, b) => b.createTime - a.createTime)
            .slice(0, 480);  // Get 250 most recent videos

        console.log(`Processing ${recentVideos.length} videos in batches of ${BATCH_SIZE}`);

        // Process in batches
        const allResults = [];
        for (let i = 0; i < recentVideos.length; i += BATCH_SIZE) {
            const batch = recentVideos.slice(i, i + BATCH_SIZE);
            const batchResults = await processBatch(batch, i);
            allResults.push(...batchResults);
        }

        // Count changes and update data
        const changedVideos = allResults.filter(result => result.changed);
        
        if (changedVideos.length > 0) {
            // Update the main videoData array
            const updatedVideoData = videoData.map(video => {
                const update = allResults.find(r => r.video.id === video.id);
                return update ? update.video : video;
            });

            await fs.writeJson(videoDataPath, updatedVideoData, { spaces: 2 });
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`\nUpdate complete in ${duration} seconds`);
        console.log(`Total videos updated: ${changedVideos.length}`);

        return {
            success: true,
            updatedCount: changedVideos.length,
            duration: duration,
            message: `Updated ${changedVideos.length} videos in ${duration} seconds`
        };

    } catch (error) {
        console.error('Error in updateMetrics:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Add this to help with debugging
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    updateMetrics().then(result => {
        console.log('Update finished:', result);
        process.exit(0);
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}