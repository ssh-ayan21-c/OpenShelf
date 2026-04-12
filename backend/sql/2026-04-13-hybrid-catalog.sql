-- Hybrid catalog + premium subscription updates for Supabase

-- 1) Enums
DO $$
BEGIN
  CREATE TYPE public.book_format AS ENUM ('physical', 'digital', 'hybrid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.subscription_tier AS ENUM ('free', 'premium');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) books table updates
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS format public.book_format NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS shelf_location text,
  ADD COLUMN IF NOT EXISTS available_copies integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

-- 3) users table updates
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_tier public.subscription_tier NOT NULL DEFAULT 'free';

-- 4) rentals table updates (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rentals'
  ) THEN
    ALTER TABLE public.rentals
      ADD COLUMN IF NOT EXISTS expires_at timestamptz;
  END IF;
END $$;

-- 5) Index for rental access checks
CREATE INDEX IF NOT EXISTS idx_rentals_user_book_expires
ON public.rentals (user_id, book_id, expires_at);
