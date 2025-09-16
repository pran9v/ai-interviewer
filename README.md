This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment Setup

1. Create a `.env` file in the root directory with the following services' credentials:

#### Clerk Authentication
- Sign in at https://clerk.com/ with:
  - Username: thecampusadvisorapp@gmail.com
  - Add the following keys to your `.env`:
    ```
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWNjZXB0ZWQtYmVhci0xNy5jbGVyay5hY2NvdW50cy5kZXYk
    CLERK_SECRET_KEY=sk_test_G9SxqTqBMwg8oQ6xnNFPriaq6V5JU9hiFCACl82Qid
    ```

#### Supabase Setup
- Access at https://supabase.com/
- Project: Admito
- Region: US East
- Database password: Tst1234567#Tst1234567#
- Add your Supabase URL and keys to `.env`

#### ImageKit Configuration
- Access at https://imagekit.io
- ImageKit ID: U82a6i2pd
- URL format: https://ik.imagekit.io/u82a6i2pd/path/to/myimage.jpg
- Add your ImageKit credentials to `.env`

#### Arcjet Setup
- Access at https://arcjet.com
- Add to `.env`:
  ```
  ARCJET_KEY=ajkey_01k590m2ygfj9sm49z9v67za04
  ```

### Running the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
