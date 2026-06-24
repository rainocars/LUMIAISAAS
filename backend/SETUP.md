# Setup Instructions

## Prerequisites

- Docker and Docker Compose
- Node.js (if running locally)
- Postgres (if not using Docker)

## Setup

1. Clone the repository
2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. Edit the `.env` file to set your environment variables (especially database credentials, JWT secrets, AWS keys, Resend key, etc.)
4. Start the database:
   ```bash
   docker-compose up -d
   ```
   This will start a PostgreSQL container on port 5432.
5. Install dependencies:
   ```bash
   npm install
   ```
6. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
7. Run migrations:
   ```bash
   npx prisma migrate dev
   ```
8. Start the application:
   ```bash
   npm run start:dev
   ```

## Environment Variables

Refer to `.env.example` for the required variables.

## API Documentation

Once the server is running, visit `http://localhost:3000/api` to see the Swagger documentation.

## Testing

Run tests with:
```bash
npm run test
```