import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';

// Get __dirname equivalent for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const profilesPath = path.join(__dirname, 'profiles.json');
const userIdsPath = path.join(__dirname, 'UserIDs.json');

// API key and endpoint
const API_KEY = '4292a497a4msh4de7947cbee1fa6p1195ddjsn8b33127ea1ff';
const API_ENDPOINT = 'https://tiktok-scraper7.p.rapidapi.com/';

// Read profiles.json
const profiles = await fs.readJson(profilesPath);
console.log(`Loaded ${profiles.length} profiles from profiles.json`);

// Create rate limit with concurrency of 20 (adjustable)
const limit = pLimit(20);

// Function to fetch user ID
async function fetchUserId(profile) {
  const { uniqueId, id: videoId } = profile;
  console.log(`Fetching user ID for profile: ${uniqueId}`);

  try {
    const tiktokUrl = `https://www.tiktok.com/@${uniqueId}/video/${videoId}`;
    const encodedUrl = encodeURIComponent(tiktokUrl);
    const apiUrl = `${API_ENDPOINT}?url=${encodedUrl}&hd=1`;

    const response = await fetch(apiUrl, {
      headers: {
        'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
        'x-rapidapi-key': API_KEY,
      },
    });

    const data = await response.json();
    console.log(`API response for ${uniqueId}:`, data);

    if (data.code === 0 && data.data && data.data.author && data.data.author.id) {
      return {
        uniqueId,
        userId: data.data.author.id,
      };
    } else {
      console.error(`No user ID found for ${uniqueId}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching user ID for ${uniqueId}:`, error);
    return null;
  }
}

// Process profiles with concurrency
const results = await Promise.all(profiles.map(profile => limit(() => fetchUserId(profile))));

// Filter out null results and save to UserIDs.json
const validResults = results.filter(result => result !== null);
await fs.writeJson(userIdsPath, validResults, { spaces: 2 });
console.log(`Saved ${validResults.length} user IDs to UserIDs.json`);
