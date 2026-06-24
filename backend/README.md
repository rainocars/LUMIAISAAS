# LUMI AI Labs Backend

This is the backend for the LUMI AI Labs application, built with NestJS, Prisma, and PostgreSQL.

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js (if you want to run locally without Docker)

### Installation

1. Clone the repository
2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. Edit the .env file to set your environment variables

### Running with Docker Compose

```bash
docker-compose up --build
```

The API will be available at http://localhost:3000

### Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Prisma generate:
   ```bash
   npx prisma generate
   ```
3. Run migrations:
   ```bash
   npx prisma migrate dev
   ```
4. Start the application:
   ```bash
   npm run start:dev
   ```

### API Documentation

Once the application is running, visit http://localhost:3000/api to see the Swagger documentation.

## License

This project is licensed under the MIT License.