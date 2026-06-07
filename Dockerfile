# Use official Node 24 image
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the backend code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose the port your server uses
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
