FROM node:18-alpine

WORKDIR /app

# Copy everything (backend + all frontend-* folders)
COPY . .

# Install backend dependencies
WORKDIR /app/backend
RUN npm install --production

# Back to app root (server.js references ../frontend-* paths)
WORKDIR /app

EXPOSE 3000

CMD ["node", "backend/server.js"]
