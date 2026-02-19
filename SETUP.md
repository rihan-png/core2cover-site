# Core2Cover Setup Guide

This guide will help you run the Core2Cover application locally.

## Prerequisites

- Node.js (v20 or higher recommended, based on @types/node dependency)
- PostgreSQL database (optional for development)
- npm or yarn package manager

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/core2cover?schema=public"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here-change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (Optional - for Google login)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

**Note:** 
- The `.env.local` file is gitignored and should not be committed to the repository
- For production, use strong secrets and real credentials
- Google OAuth credentials are optional and only needed if you want to enable Google login

### 3. Generate Prisma Client

```bash
npx prisma generate
```

This generates the Prisma Client based on your schema.

### 4. Database Setup (Optional)

If you have a PostgreSQL database set up, you can run migrations:

```bash
npx prisma migrate dev
```

**Note:** The application can run without a database for viewing the frontend, but database operations will fail.

### 5. Run Development Server

```bash
npm run dev
```

The application will start at [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application for production
- `npm start` - Start production server (requires build first)
- `npm run lint` - Run ESLint to check code quality

## Application Features

The Core2Cover platform includes:

- **Finished Products** - Browse and purchase finished interior products
- **Raw Materials** - Source raw materials for interior projects
- **Interior & Product Designers** - Connect with professional designers

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, you can specify a different port:

```bash
PORT=3001 npm run dev
```

### Database Connection Issues

- Ensure PostgreSQL is running if you're using a database
- Verify the `DATABASE_URL` in `.env.local` is correct
- The app can run without database for frontend-only testing

### Missing Dependencies

If you encounter missing dependencies, try:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Production Deployment

For production deployment:

1. Set up all required environment variables
2. Configure a PostgreSQL database
3. Run database migrations
4. Build the application: `npm run build`
5. Start the production server: `npm start`

For more deployment options, see the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).
