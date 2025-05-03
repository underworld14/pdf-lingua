#!/bin/sh
set -e

# Print commands as they're executed
echo "Starting docker-entrypoint.sh"

# Generate Prisma client if needed
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations in production
if [ "$NODE_ENV" = "production" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy
fi

# Start the Next.js application
echo "Starting Next.js application..."
exec node server.js
