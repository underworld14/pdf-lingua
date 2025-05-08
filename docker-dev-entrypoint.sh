#!/bin/bash
set -e

# Display welcome message
echo "========================================================"
echo "PDF Lingua Development Environment"
echo "========================================================"

# Make sure database directory exists
mkdir -p /data

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.pnpm/lock.yaml" ]; then
  echo "Installing dependencies with pnpm..."
  pnpm install
fi

# Generate Prisma client if needed
if [ -f "prisma/schema.prisma" ]; then
  echo "Generating Prisma client..."
  npx prisma generate
fi

# Run migrations if needed
if [ -f "prisma/schema.prisma" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate dev --name dev-migration
fi

# Start development server
echo "Starting Next.js development server..."
exec pnpm run dev
