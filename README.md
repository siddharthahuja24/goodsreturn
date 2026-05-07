# GoodsReturn Manager

A mobile-first goods return management app for stores.

## Setup Instructions

### 1. Supabase Database Setup
- Go to your Supabase project dashboard
- Click **SQL Editor** in the left sidebar
- Copy everything from `supabase_setup.sql` and paste it there
- Click **Run**

### 2. Supabase Storage Setup
- In Supabase, go to **Storage** in the left sidebar
- Click **New Bucket**
- Name it exactly: `documents`
- Check **Public bucket** → click Create

### 3. Deploy on Vercel
- Push this folder to GitHub
- Go to vercel.com → New Project → Import your GitHub repo
- Click Deploy — done!

## Roles
- **Store Owner** — creates return requests, reviews GR invoices, marks ready to pack
- **Accounts Team** — uploads GR invoices
- **Packer** — dispatches goods via courier or records party pickup
