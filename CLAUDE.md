# CLAUDE.md - LiftsPump Dashboard

This document provides comprehensive guidance for AI assistants working with the LiftsPump Dashboard codebase.

## Project Overview

LiftsPump Dashboard is a **B2B SaaS platform for fitness trainers** to manage their coaching business. Key features include:

- **Trainer Dashboard**: Analytics, client management, and revenue tracking
- **Subscription Tiers**: Customizable pricing with Stripe integration
- **Real-Time Coaching**: LiveKit-powered video sessions with AI personas
- **MiniMe Feature**: Creates AI coach personas from YouTube videos using Gemini AI
- **Exercise Tracking**: 300+ built-in exercises, custom routines, and progress tracking
- **Client Management**: Routine assignment, weight tracking, and performance insights

## Technology Stack

### Core Framework
- **Next.js 15.4.2** with App Router and Turbopack
- **React 19.1.0** with TypeScript 5
- **Node.js 20** runtime

### UI & Styling
- **Material-UI (MUI) 7.x** - Primary component library
- **Emotion** - CSS-in-JS styling
- **ECharts** - Data visualization
- Custom dark theme (primary: `#1AE080`, background: `#0f0f10`)

### Backend & Database
- **Supabase** - PostgreSQL database, authentication, storage, and real-time
- **Stripe** - Payments and subscriptions with Connect
- **LiveKit** - WebRTC video/audio for coaching sessions

### AI & Media Processing
- **Google Gemini 2.5 Pro** - Persona generation and analysis
- **Cartesia** - Text-to-speech
- **FFmpeg** - Audio/video processing
- **youtube-transcript** / **ytdl-core** - YouTube content extraction

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (serverless functions)
│   │   ├── admin/         # Trainer/member management
│   │   ├── checkout/      # Stripe checkout
│   │   ├── dashboard/     # Dashboard data
│   │   ├── exercises/     # Exercise CRUD
│   │   ├── livekit/       # Real-time session tokens
│   │   ├── minime/        # YouTube persona processing
│   │   ├── public/        # Unauthenticated endpoints
│   │   ├── sessions/      # Coaching session management
│   │   ├── settings/      # Tier configuration
│   │   ├── stripe/        # Webhooks and portal
│   │   ├── subscriptions/ # Subscription management
│   │   └── users/         # User data and routines
│   ├── auth/              # Auth callback handlers
│   ├── exercises/         # Exercise browser page
│   ├── join/              # Public signup page
│   ├── login/             # Authentication page
│   ├── minime/            # MiniMe persona builder
│   ├── onboarding/        # First-time setup
│   ├── payments/          # Payment/tier settings
│   ├── routines/          # Routine management
│   ├── sessions/          # Session scheduling
│   ├── templates/         # Workout templates
│   ├── users/             # Client management
│   ├── videos/            # Video library
│   ├── layout.tsx         # Root layout with theme
│   └── page.tsx           # Main dashboard
├── components/            # Reusable React components
│   ├── Header.tsx         # Top navigation
│   ├── Navigation.tsx     # Sidebar nav
│   ├── SupabaseProvider.tsx
│   └── ...
├── hooks/                 # Custom React hooks
├── lib/                   # Business logic utilities
│   ├── persona.ts         # AI persona generation
│   └── youtube.ts         # YouTube utilities
├── utils/                 # Helper utilities
│   └── supabase/          # Supabase client factories
│       ├── server.ts      # Server-side client
│       ├── admin.ts       # Service role client
│       └── middleware.ts  # Auth middleware
├── types/                 # TypeScript definitions
└── data/                  # Static data (exercises.json)
```

## Key Conventions

### File Organization
- Pages use `"use client"` directive for client-side rendering
- API routes are in `src/app/api/[endpoint]/route.ts`
- Reusable components go in `src/components/`
- Utility functions go in `src/utils/` or `src/lib/`

### Naming Conventions
- **Files**: kebab-case for utilities, PascalCase for components
- **Components**: PascalCase (e.g., `StatCard.tsx`)
- **API routes**: lowercase with hyphens (e.g., `/api/trainer-info`)
- **Database tables**: lowercase with underscores (e.g., `trainer_sessions`)

### TypeScript
- Strict mode enabled
- Use `@/*` path alias for imports from `src/`
- Prefer explicit types over `any` (though `any` is allowed in ESLint config)
- Zod for runtime validation in API routes

### React Patterns

**Data Fetching with Cleanup:**
```typescript
useEffect(() => {
  let alive = true;
  const run = async () => {
    const data = await fetchData();
    if (alive) setState(data);
  };
  run();
  return () => { alive = false };
}, [dependencies]);
```

**Auth-Protected Pages:**
```typescript
const { session, isLoading } = useSessionContext();
if (isLoading) return <LoadingSpinner />;
if (!session) return null; // Layout handles redirect
```

### Component Structure
Standard page layout:
1. `Header` component at top
2. `Navigation` sidebar on left
3. Main content area with MUI `Box`, `Paper`, `Stack`
4. `Snackbar` for notifications

### API Route Pattern
```typescript
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Business logic...
  return NextResponse.json({ data });
}
```

## Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| `profile` | User profiles (first_name, last_name, type, trainer_id) |
| `trainer` | Trainer profiles (display_name, bio, photo_url, persona, voice_id) |
| `routine` | Workout routines (name, type, days, duration) |
| `exercise` | Exercises in routines (name, eCode, routine_id) |
| `sets` | Exercise sets (reps, weight, completed, pr) |
| `trainer_sessions` | Coaching sessions (title, start_at, end_at, meet_url) |
| `tiers` | Subscription tiers (name, price, stripePriceId) |
| `stripe_customers` | Stripe customer mappings |
| `stripe_subscriptions` | Subscription records |
| `minime_personas` | AI personas from YouTube |
| `weight_entries` | Weight tracking data |
| `memories` | User insights/achievements |

### User Types
- **Type 0**: Member (subscriber/client)
- **Type 1**: Trainer (coach/creator)

### Storage Buckets
- `minime-clips`: Audio clips of trainer personas

## Authentication

### Flow
1. Supabase Auth handles email/password and OAuth (Google, Apple)
2. Session managed via cookies using `@supabase/ssr`
3. `layout.tsx` contains `AuthRedirect` component for route protection
4. Unauthenticated users redirect to `/login?next=...`

### Supabase Clients
- **Client-side**: Use `useSupabaseClient()` hook
- **Server-side**: Use `createClient()` from `@/utils/supabase/server`
- **Admin operations**: Use `createAdminClient()` from `@/utils/supabase/admin`

## Development Workflow

### Commands
```bash
npm run dev      # Start dev server with Turbopack
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
npm run test     # Run tests with Node test runner
```

### Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

### Testing
- Uses Node's native test runner (`node --test`)
- Test files located in `__tests__/` directories
- Run with: `npm run test`

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';

test('description', () => {
  assert.equal(actual, expected);
});
```

## Deployment

### Infrastructure
- **Platform**: AWS ECS with ECR
- **Region**: us-east-2
- **CI/CD**: GitHub Actions (`.github/workflows/aws.yml`)

### Docker
Multi-stage build in `Dockerfile`:
1. `deps` - Install dependencies
2. `builder` - Build Next.js app
3. `runner` - Production image (node:20-alpine)

Deployment triggers on push to `main` branch.

## Navigation Colors
Each section has a distinct accent color:
- **routines**: `#60a5fa` (blue)
- **videos**: `#f87171` (red)
- **users**: `#1AE080` (green)
- **payments**: `#a78bfa` (purple)
- Default: `#1AE080` (primary green)

## Important Guidelines for AI Assistants

### Code Style
1. Use MUI components for UI elements
2. Follow existing patterns for data fetching with cleanup
3. Use Snackbar for user notifications
4. Prefer functional components with hooks
5. Use the `@/*` import alias

### Security
1. Always validate user authentication in API routes
2. Use service role client only for admin operations
3. Verify Stripe webhook signatures
4. Never expose service keys client-side

### API Development
1. Return proper HTTP status codes (401 for unauth, 400 for bad request)
2. Use Zod for request validation
3. Handle errors gracefully with try/catch
4. Return consistent JSON response shapes

### Styling
1. Use MUI's `sx` prop for component-specific styles
2. Theme is dark mode with glass-morphism effects
3. Primary color: `#1AE080`
4. Background: `#0f0f10`
5. Paper backgrounds use blur and subtle gradients

### Database
1. Use Supabase client for all database operations
2. Check for null/undefined before accessing nested properties
3. Use `.limit(1)` when expecting single results
4. Handle both `data` and `error` from Supabase queries

### Common Pitfalls to Avoid
1. Don't use `any` excessively (though ESLint allows it)
2. Don't forget cleanup in useEffect async operations
3. Don't call Supabase admin client from client components
4. Don't hardcode trainer IDs or user IDs
5. Don't skip authentication checks in API routes

## Quick Reference

### Add a new page
1. Create `src/app/[page-name]/page.tsx`
2. Add `"use client"` if using hooks/state
3. Include `Header` and `Navigation` components
4. Add navigation entry if needed

### Add a new API endpoint
1. Create `src/app/api/[endpoint]/route.ts`
2. Export `GET`, `POST`, `DELETE`, etc. functions
3. Validate auth with `supabase.auth.getUser()`
4. Return `NextResponse.json()`

### Add a new component
1. Create `src/components/ComponentName.tsx`
2. Use MUI components and theme
3. Export as default or named export
4. Add tests in `src/components/__tests__/` if needed
