# Overview

This is a 365-day journaling application that allows users to capture their thoughts and experiences throughout the year. The app features a glassmorphism design with smooth animations and intuitive zoom controls, enabling users to view their journal entries in different formats - from micro daily blocks to detailed expanded views. The application provides a beautiful, content-first interface for writing and organizing daily journal entries with persistent local storage.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The application uses a React-based frontend with TypeScript, built on top of Vite for development and bundling. The component architecture follows a modular design pattern with:

- **UI Components**: Comprehensive component library based on shadcn/ui with Radix UI primitives for accessibility
- **State Management**: React hooks for local state management with localStorage for data persistence
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with custom design system featuring glassmorphism effects and smooth transitions
- **Design System**: Material Design influences with minimalist glassmorphism, implementing custom color palettes for light/dark modes

## Backend Architecture
The backend uses Express.js with TypeScript in a minimal setup:

- **Server Framework**: Express.js with middleware for JSON parsing and request logging
- **Storage Interface**: Abstracted storage layer with in-memory implementation (ready for database integration)
- **API Structure**: RESTful API design with centralized route registration
- **Development Setup**: Hot reload and development tooling via Vite integration

## Data Storage Solutions
Currently implements local storage for journal entries with plans for database integration:

- **Client-side Storage**: localStorage for journal entries, organized by year
- **Database Schema**: Drizzle ORM configuration ready for PostgreSQL integration
- **Data Models**: User schema defined with Zod validation for type safety
- **Session Management**: PostgreSQL session store configuration prepared

## Design System and UI Framework
The application implements a comprehensive design system:

- **Typography**: Inter font family with various weights and sizes optimized for readability
- **Color System**: Dual-theme support (light/dark) with glassmorphism overlays and backdrop blur effects
- **Component Variants**: Consistent spacing primitives, button variants, and interaction states
- **Layout System**: Responsive grid layouts with dynamic sizing based on zoom levels
- **Animation Framework**: Smooth micro-interactions with CSS transitions and transform animations

## Key Features Architecture
- **Journal Blocks**: Dynamic sizing system (micro to xl) with auto-adjusting textareas and glassmorphism styling
- **Zoom Controls**: Real-time preview with slider inputs for visible blocks and start date navigation
- **Collapsible Sidebar**: Smooth animations with backdrop blur and responsive behavior
- **Grid System**: Flexible layout supporting 1-365 day views with optimized rendering for performance

# External Dependencies

## Core React Ecosystem
- **React 18**: Core framework with TypeScript support
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight routing solution
- **react-hook-form**: Form handling with validation

## UI and Design Libraries
- **@radix-ui**: Complete set of accessible UI primitives (accordion, dialog, dropdown, etc.)
- **tailwindcss**: Utility-first CSS framework with custom configuration
- **class-variance-authority**: Type-safe component variants
- **clsx**: Conditional class name utility
- **lucide-react**: Icon library for consistent iconography

## Database and Backend
- **drizzle-orm**: Type-safe SQL ORM with PostgreSQL dialect
- **@neondatabase/serverless**: Serverless PostgreSQL driver
- **connect-pg-simple**: PostgreSQL session store for Express
- **drizzle-zod**: Schema validation integration

## Development and Build Tools
- **vite**: Fast build tool and development server
- **typescript**: Static type checking
- **esbuild**: Fast JavaScript bundler for production
- **tsx**: TypeScript execution for development
- **@replit/vite-plugin-***: Replit-specific development enhancements

## Utility Libraries
- **date-fns**: Date manipulation and formatting
- **nanoid**: Unique ID generation
- **embla-carousel-react**: Carousel component functionality