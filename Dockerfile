FROM node:20-alpine

WORKDIR /app

# Copy package files from Lorenco Accounting subfolder
COPY "Lorenco Accounting/package.json" ./
RUN npm install --production

# Copy source code
COPY "Lorenco Accounting/src/" ./src/
COPY "Lorenco Accounting/public/" ./public/
COPY "Lorenco Accounting/migrations/" ./migrations/

# Create uploads directory (not in git)
RUN mkdir -p ./uploads

# Expose port
EXPOSE 3000

# Start
CMD ["node", "src/server.js"]
