# Clerk Custom Authentication Configuration

## Problem
Clerk is redirecting to its default hosted pages (`accepted-bear-17.accounts.dev`) instead of your custom onboarding page.

## Solution

### 1. Update Vercel Environment Variables

Go to your Vercel project settings → Environment Variables and add/update these:

```bash
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/onboarding
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/onboarding
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

**IMPORTANT**: After adding these, you MUST redeploy your Vercel app for the changes to take effect.

### 2. Configure Clerk Dashboard

Go to your Clerk Dashboard → Configure → Paths and set:

- **Sign-in page**: `/onboarding?mode=signin`
- **Sign-up page**: `/onboarding`
- **After sign-in URL**: `/dashboard`
- **After sign-up URL**: `/dashboard`

### 3. Local Development

Create a `.env.local` file in your project root:

```bash
# Clerk Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# Custom Onboarding Pages
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/onboarding
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/onboarding
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Convex
CONVEX_DEPLOYMENT=your_deployment
NEXT_PUBLIC_CONVEX_URL=your_convex_url

# OpenAI
OPENAI_API_KEY=your_openai_key
```

### 4. Verify Configuration

After deploying, test:
1. Visit your homepage
2. Click "Explore Now"
3. You should be redirected to `https://your-domain.vercel.app/onboarding`
4. NOT to `accepted-bear-17.accounts.dev`

## Files Modified

The following files have been configured to use custom pages:

- ✅ `app/layout.tsx` - ClerkProvider with custom URLs
- ✅ `middleware.ts` - Public routes include /onboarding
- ✅ `.env.example` - Environment variable template
- ✅ `app/(auth)/onboarding/page.tsx` - Custom onboarding with Suspense
- ✅ `app/(auth)/sign-in/[[...sign-in]]/page.tsx` - Redirects to custom page
- ✅ `app/(auth)/sign-up/[[...sign-up]]/page.tsx` - Redirects to custom page

## Troubleshooting

If you still see Clerk's default pages:

1. **Clear browser cache** and cookies for your domain
2. **Verify Vercel environment variables** are set correctly
3. **Redeploy** your Vercel app after env var changes
4. **Check Clerk Dashboard** paths configuration
5. **Test in incognito mode** to avoid cached redirects

## Why This Happens

Clerk uses environment variables to determine where to redirect users. If these aren't set, it falls back to its default hosted pages at `*.accounts.dev`. By explicitly setting these variables, we force Clerk to use our custom onboarding page instead.
