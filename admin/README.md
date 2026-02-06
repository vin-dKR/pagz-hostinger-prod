# Admin Panel

A production-ready, enterprise-level admin panel for managing the e-print store.

## Features

- **Next.js 16 App Router** with TypeScript
- **Server Components** by default for optimal performance
- **Client Components** only where needed (interactivity)
- **Modular Architecture** with clear separation of concerns
- **Type-Safe** API client and data handling
- **Reusable UI Components** with maximum decomposition
- **Protected Routes** with authentication middleware
- **Loading States** and Error Boundaries
- **Optimized Performance** with proper code splitting

## Getting Started

```bash
# Install dependencies (from root)
bun install

# Run development server
bun run dev --filter=admin

# Or from this directory
bun run dev
```

The admin panel will be available at `http://localhost:3001`

## Project Structure

```
app/
├── (auth)/              # Auth route group
│   └── login/
├── (dashboard)/         # Dashboard route group (protected)
│   ├── layout.tsx       # Dashboard layout with sidebar
│   ├── page.tsx         # Dashboard overview
│   ├── products/        # Product management
│   ├── orders/          # Order management
│   └── categories/      # Category management
├── api/                 # API route handlers
├── components/          # Shared components
│   ├── ui/              # Base UI components
│   └── features/        # Feature-specific components
├── lib/                 # Core utilities
│   ├── api/             # API client & services
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   └── types/           # TypeScript types
└── layouts/             # Layout components

```

## Architecture Principles

1. **Server Components First**: Default to Server Components for better performance
2. **Client Components Only When Needed**: Use 'use client' only for interactivity
3. **Feature-Based Organization**: Group related code by feature
4. **Component Decomposition**: Small, focused, reusable components
5. **Type Safety**: Strict TypeScript with proper types
6. **Error Handling**: Comprehensive error boundaries and loading states

## Features Implemented

### Authentication
- ✅ Admin login page
- ✅ Token-based authentication
- ✅ Protected routes
- ✅ Logout functionality

### Dashboard
- ✅ Overview page with statistics
- ✅ Recent orders widget
- ✅ Navigation sidebar
- ✅ Responsive header

### Product Management
- ✅ List all products
- ✅ View product details
- ✅ Create new products
- ✅ Delete products
- ✅ Product variants display

### Order Management
- ✅ List all orders
- ✅ View order details
- ✅ Update order status
- ✅ Order filtering and search (ready for implementation)

### Category Management
- ✅ List all categories
- ✅ View category details

## Environment Variables

Create a `.env.local` file in the admin app directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3002/api/v1
```

## Development

The admin panel follows Next.js 16 App Router best practices:

- **Route Groups**: `(auth)` and `(dashboard)` for logical grouping
- **Server Components**: Default for all pages
- **Client Components**: Only where interactivity is needed
- **Error Boundaries**: Global and route-specific error handling
- **Loading States**: Proper loading UI for async operations

## Code Quality

- ✅ TypeScript strict mode
- ✅ ESLint configuration
- ✅ Consistent code formatting
- ✅ Proper error handling
- ✅ Loading states for all async operations

