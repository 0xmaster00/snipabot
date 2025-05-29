import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const profilesPath = path.join(__dirname, 'profiles.json');
const userIdsPath = path.join(__dirname, 'UserIDs.json');

// API Configuration
const API_KEY = '4292a497a4msh4de7947cbee1fa6p1195ddjsn8b33127ea1ff';
const API_HOST = 'tiktok-scraper2.p.rapidapi.com';

// Read profiles
const profiles = await fs.readJson(profilesPath);

async function fetchUserId(profile) {
  const { uniqueId, id: videoId } = profile;
  const videoUrl = `https://www.tiktok.com/@${uniqueId}/video/${videoId}`;
  
  console.log(`\nProcessing profile: ${uniqueId}`);
  console.log('Video URL:', videoUrl);

  try {
    const response = await fetch(`https://${API_HOST}/video/info_v2?video_url=${encodeURIComponent(videoUrl)}&video_id=${videoId}`, {
      headers: {
        'x-rapidapi-host': API_HOST,
        'x-rapidapi-key': API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.itemInfo?.itemStruct?.author?.id) {
      const userId = data.itemInfo.itemStruct.author.id;
      console.log(`Successfully got user ID for ${uniqueId}: ${userId}`);
      return {
        uniqueId,
        userId,
        id: videoId
      };
    } else {
      console.log(`No user ID found in response for ${uniqueId}`);
      console.log('Response:', JSON.stringify(data, null, 2));
      return null;
    }
  } catch (error) {
    console.error(`Error processing ${uniqueId}:`, error.message);
    return null;
  }
}

async function saveResults(results) {
  try {
    console.log('\nAttempting to save results...');
    console.log('Results to save:', JSON.stringify(results, null, 2));
    
    await fs.writeJson(userIdsPath, results, { spaces: 2 });
    
    // Verify the file was written
    const saved = await fs.readJson(userIdsPath);
    console.log('\nVerification - File contents:', JSON.stringify(saved, null, 2));
    
    if (saved.length === results.length) {
      console.log('Results successfully saved and verified!');
      return true;
    } else {
      console.error('Save verification failed - length mismatch');
      return false;
    }
  } catch (error) {
    console.error('Error saving results:', error);
    return false;
  }
}

async function main() {
  try {
    console.log(`Processing ${profiles.length} profiles...`);
    const results = [];
    
    // Process profiles one at a time with delay
    for (const profile of profiles) {
      const result = await fetchUserId(profile);
      if (result) {
        results.push(result);
        console.log('Current results array:', JSON.stringify(results, null, 2));
      }
      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save and verify results
    const saveSuccessful = await saveResults(results);
    
    console.log('\nFinal Summary:');
    console.log(`Total profiles processed: ${profiles.length}`);
    console.log(`Successful retrievals: ${results.length}`);
    console.log(`Save operation successful: ${saveSuccessful}`);

  } catch (error) {
    console.error('Main process error:', error);
  }
}

main();