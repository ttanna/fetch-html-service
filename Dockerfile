# Use official Node image
FROM node:18-bullseye

# Install Chromium (Debian package)
RUN apt-get update && \
    apt-get install -y wget gnupg --no-install-recommends && \
    apt-get install -y chromium --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Create app folder
WORKDIR /usr/src/app

# Copy files
COPY package.json ./
RUN npm install --production

COPY . .

# Ensure chromium path exported as env var for the node app
ENV CHROME_PATH=/usr/bin/chromium

# Expose port (Render uses $PORT env)
EXPOSE 3000

CMD ["node", "index.js"]
