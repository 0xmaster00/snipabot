# Use Node.js version 18
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Install pm2 globally for process management
RUN npm install -g pm2

# Copy the entire project into the container
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start both the main server and the sniper tool concurrently
CMD ["pm2-runtime", "start", "server.js", "--name", "server", "--", "&&", "pm2-runtime", "start", "server/tasks/postSniper.mjs", "--name", "postSniper"]
