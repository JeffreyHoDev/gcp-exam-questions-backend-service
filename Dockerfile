# Use official Node.js LTS base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json first for dependency installation
COPY package*.json ./

# Set the environment to production
ENV NODE_ENV=production

# Install app dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port your app runs on
# Ensure this port is documented in the application's README or deployment instructions
EXPOSE 8000

# Run the app
CMD ["node", "index.js"]
