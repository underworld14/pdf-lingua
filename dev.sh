#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}PDF Lingua Development Environment${NC}"

# Function to display help message
show_help() {
  echo -e "Usage: ./dev.sh [COMMAND]"
  echo -e ""
  echo -e "Commands:"
  echo -e "  ${YELLOW}start${NC}      Start the development environment"
  echo -e "  ${YELLOW}stop${NC}       Stop the development environment"
  echo -e "  ${YELLOW}restart${NC}    Restart the development environment"
  echo -e "  ${YELLOW}logs${NC}       Show logs from the running containers"
  echo -e "  ${YELLOW}shell${NC}      Open a shell in the running app container"
  echo -e "  ${YELLOW}prisma${NC}     Run Prisma commands inside the container"
  echo -e "  ${YELLOW}help${NC}       Show this help message"
  echo -e ""
}

# Check for command
if [ "$#" -eq 0 ]; then
  show_help
  exit 1
fi

case "$1" in
  start)
    echo -e "${GREEN}Starting development environment...${NC}"
    docker compose -f docker-compose.dev.yml up -d
    echo -e "${GREEN}Development server started at http://localhost:3000${NC}"
    ;;
  stop)
    echo -e "${GREEN}Stopping development environment...${NC}"
    docker compose -f docker-compose.dev.yml down
    ;;
  restart)
    echo -e "${GREEN}Restarting development environment...${NC}"
    docker compose -f docker-compose.dev.yml down
    docker compose -f docker-compose.dev.yml up -d
    echo -e "${GREEN}Development server restarted at http://localhost:3000${NC}"
    ;;
  logs)
    echo -e "${GREEN}Showing logs...${NC}"
    docker compose -f docker-compose.dev.yml logs -f
    ;;
  shell)
    echo -e "${GREEN}Opening shell in app container...${NC}"
    docker compose -f docker-compose.dev.yml exec app /bin/bash
    ;;
  prisma)
    # Remove the first argument and pass the rest to prisma
    shift
    echo -e "${GREEN}Running Prisma command: $@${NC}"
    docker compose -f docker-compose.dev.yml exec app npx prisma "$@"
    ;;
  help)
    show_help
    ;;
  *)
    echo -e "${YELLOW}Unknown command: $1${NC}"
    show_help
    exit 1
    ;;
esac
