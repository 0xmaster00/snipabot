import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the json files
const videoDataPath = path.join(__dirname, 'fffsl.json');
const userIDsPath = path.join(__dirname, 'UserIDs.json');

async function updateUserDatabase() {
    try {
        // Read the current data
        const videoData = await fs.readJson(videoDataPath);
        const userIDs = await fs.readJson(userIDsPath);
        
        console.log(`Current users in database: ${userIDs.length}`);

        // Create a Set of existing userIds for quick lookup
        const existingUserIds = new Set(userIDs.map(user => user.userId));
        const newUsers = [];

        // Process each post to find new users
        videoData.forEach(post => {
            if (post.author && !existingUserIds.has(post.author.id)) {
                newUsers.push({
                    uniqueId: post.author.uniqueId,
                    userId: post.author.id,
                    id: post.id
                });
                existingUserIds.add(post.author.id);
            }
        });

        // Add new users to the database
        const updatedUserIDs = [...userIDs, ...newUsers];

        // Log the results
        console.log(`Found ${newUsers.length} new users`);
        if (newUsers.length > 0) {
            console.log('\nNew users added:');
            newUsers.forEach(user => {
                console.log(`Username: ${user.uniqueId}, UserID: ${user.userId}`);
            });
        }

        // Save the updated database
        await fs.writeJson(userIDsPath, updatedUserIDs, { spaces: 2 });
        console.log(`\nSuccessfully updated UserIDs.json. Total users: ${updatedUserIDs.length}`);

    } catch (error) {
        console.error('Error:', error);
        if (error.code === 'ENOENT') {
            console.error('One or more required files not found. Please check file paths.');
        }
    }
}

// Run the update function
updateUserDatabase();