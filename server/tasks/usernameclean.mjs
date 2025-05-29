import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const logFilePath = path.join(__dirname, 'snipelogs.txt');
const userIDsPath = path.join(__dirname, 'UserIDs.json');

async function cleanErroredUsers() {
    try {
        const logContent = await fs.readFile(logFilePath, 'utf8');
        const userIDs = await fs.readJson(userIDsPath);

        // Extract usernames from log lines with HTTP 429 errors
        const erroredUsernames = new Set();
        const lines = logContent.split('\n');
        for (const line of lines) {
            const match = line.match(/Error processing user ([^:]+): HTTP error! status: 429/);
            if (match && match[1]) {
                erroredUsernames.add(match[1].trim());
            }
        }

        console.log(`Found ${erroredUsernames.size} users with 429 errors.`);

        // Filter out those users from the UserIDs.json
        const filteredUsers = userIDs.filter(user => !erroredUsernames.has(user.uniqueId));

        console.log(`Removed ${userIDs.length - filteredUsers.length} users from the database.`);

        // Save the cleaned database
        await fs.writeJson(userIDsPath, filteredUsers, { spaces: 2 });
        console.log('✅ Cleaned UserIDs.json successfully.');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

cleanErroredUsers();
