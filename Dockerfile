FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (bcrypt, node-pty), SSH client, and sqlite3
RUN apk add --no-cache python3 make g++ linux-headers openssh-client sqlite

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Generate the app category taxonomy (data/app-categories.json)
RUN npm run build:categories

# Build the frontend
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

EXPOSE 3000

CMD ["node", "server.js"]
