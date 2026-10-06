-- ============================================================================
-- NAGRIKPULSE MUNICIPAL CIVIC ISSUE TRACKER - PRODUCTION POSTGIS SCHEMA
-- Migration: 20261005_civic_pulse_postgis_schema.sql
-- Stack: Supabase PostgreSQL + PostGIS Extension + Row Level Security (RLS)
-- ============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Create Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('citizen', 'moderator', 'field_officer', 'department_admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE issue_category AS ENUM (
        'pothole',
        'broken_streetlight',
        'garbage_dump',
        'water_leakage',
        'drainage_overflow',
        'damaged_road',
        'encroachment',
        'fallen_tree',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE issue_status AS ENUM ('reported', 'verified', 'assigned', 'in_progress', 'resolved', 'reopened');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE location_sensitivity AS ENUM ('standard', 'near_school', 'near_hospital', 'major_intersection', 'public_transit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT,
    full_name TEXT,
    role user_role DEFAULT 'citizen' NOT NULL,
    reputation_karma INTEGER DEFAULT 50 NOT NULL,
    ward_number INTEGER,
    department TEXT,
    is_verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Wards table (municipal boundary and administrative zones)
CREATE TABLE IF NOT EXISTS public.wards (
    id SERIAL PRIMARY KEY,
    ward_number INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    zone TEXT NOT NULL,
    officer_in_charge UUID REFERENCES public.profiles(id),
    boundary GEOMETRY(Polygon, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Civic Issues table
CREATE TABLE IF NOT EXISTS public.issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number TEXT UNIQUE NOT NULL,
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    category issue_category NOT NULL,
    severity issue_severity DEFAULT 'medium' NOT NULL,
    status issue_status DEFAULT 'reported' NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT NOT NULL,
    ward_number INTEGER NOT NULL,
    location_sensitivity location_sensitivity DEFAULT 'standard' NOT NULL,
    photo_url TEXT NOT NULL,
    photo_compressed_url TEXT,
    resolution_photo_url TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE NOT NULL,
    priority_score DOUBLE PRECISION DEFAULT 10.0 NOT NULL,
    upvotes_count INTEGER DEFAULT 1 NOT NULL,
    affected_count INTEGER DEFAULT 1 NOT NULL,
    assigned_dept TEXT,
    assigned_officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sla_hours INTEGER DEFAULT 48 NOT NULL,
    sla_deadline TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolution_rating INTEGER CHECK (resolution_rating BETWEEN 1 AND 5),
    resolution_feedback TEXT,
    is_reopened BOOLEAN DEFAULT FALSE NOT NULL,
    ai_confidence DOUBLE PRECISION,
    ai_raw_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Issue Upvotes & Affected confirmations table
CREATE TABLE IF NOT EXISTS public.issue_upvotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_affected BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_issue_upvote UNIQUE (issue_id, user_id)
);

-- 7. Community Comments & Official municipal notes
CREATE TABLE IF NOT EXISTS public.issue_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    is_official BOOLEAN DEFAULT FALSE NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. Audit Timeline log
CREATE TABLE IF NOT EXISTS public.issue_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    old_status issue_status,
    new_status issue_status NOT NULL,
    notes TEXT,
    evidence_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. Citizen Reputation Karma ledger
CREATE TABLE IF NOT EXISTS public.citizen_reputation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    issue_id UUID REFERENCES public.issues(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 10. Web Push Subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- PERFORMANCE & SPATIAL INDEXES
-- ============================================================================
-- PostGIS GIST spatial index for ultra-fast radius search & duplicate detection
CREATE INDEX IF NOT EXISTS idx_issues_location_gist ON public.issues USING GIST (location);

-- Filter & composite queries indexes
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues (status);
CREATE INDEX IF NOT EXISTS idx_issues_category ON public.issues (category);
CREATE INDEX IF NOT EXISTS idx_issues_ward ON public.issues (ward_number);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON public.issues (priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON public.issues (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_upvotes_issue ON public.issue_upvotes (issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue ON public.issue_comments (issue_id);

-- ============================================================================
-- POSTGIS DUPLICATE DETECTION STORED FUNCTION
-- Checks if an issue in the same category exists within R meters (e.g., 50m)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_duplicate_issues(
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_category issue_category,
    p_radius_meters DOUBLE PRECISION DEFAULT 65.0
)
RETURNS TABLE (
    id UUID,
    ticket_number TEXT,
    title VARCHAR,
    category issue_category,
    distance_meters DOUBLE PRECISION,
    status issue_status,
    upvotes_count INTEGER,
    photo_url TEXT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.ticket_number,
        i.title,
        i.category,
        ST_Distance(i.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) AS distance_meters,
        i.status,
        i.upvotes_count,
        i.photo_url
    FROM public.issues i
    WHERE i.category = p_category
      AND i.status != 'resolved'
      AND ST_DWithin(i.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_meters)
    ORDER BY distance_meters ASC
    LIMIT 5;
END;
$$;

-- ============================================================================
-- AUTOMATED PRIORITY SCORING FUNCTION & TRIGGER
-- f(upvotes, severity, location sensitivity, age)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_issue_priority(
    p_upvotes INTEGER,
    p_severity issue_severity,
    p_sensitivity location_sensitivity,
    p_created_at TIMESTAMPTZ
) RETURNS DOUBLE PRECISION LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_sev_score DOUBLE PRECISION;
    v_sens_score DOUBLE PRECISION;
    v_age_hours DOUBLE PRECISION;
BEGIN
    -- Severity weights
    v_sev_score := CASE p_severity
        WHEN 'critical' THEN 45.0
        WHEN 'high' THEN 30.0
        WHEN 'medium' THEN 18.0
        ELSE 8.0
    END;

    -- Location sensitivity weights (e.g. schools, hospitals)
    v_sens_score := CASE p_sensitivity
        WHEN 'near_school' THEN 30.0
        WHEN 'near_hospital' THEN 35.0
        WHEN 'major_intersection' THEN 25.0
        WHEN 'public_transit' THEN 20.0
        ELSE 0.0
    END;

    -- Age penalty (older unresolved issues gain urgent priority)
    v_age_hours := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 3600.0;

    RETURN (p_upvotes * 3.5) + v_sev_score + v_sens_score + (LEAST(v_age_hours, 168.0) * 0.4);
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizen_reputation_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: Public read, user can update their own
CREATE POLICY "Public profiles are viewable by everyone" 
    ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Issues: Viewable by everyone (public transparency)
CREATE POLICY "Issues are viewable by everyone" 
    ON public.issues FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create issues" 
    ON public.issues FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Reporters or Municipal staff can update issues"
    ON public.issues FOR UPDATE USING (
        auth.uid() = reporter_id OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.role IN ('field_officer', 'department_admin', 'super_admin')
        )
    );

-- 3. Upvotes: Anyone can read, authenticated can insert/delete own
CREATE POLICY "Upvotes viewable by all" 
    ON public.issue_upvotes FOR SELECT USING (true);

CREATE POLICY "Users can cast or remove upvotes" 
    ON public.issue_upvotes FOR ALL USING (auth.uid() = user_id);

-- 4. Comments: Public read, authenticated can comment
CREATE POLICY "Comments viewable by all" 
    ON public.issue_comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can comment" 
    ON public.issue_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 5. Timeline: Public read
CREATE POLICY "Timeline viewable by all" 
    ON public.issue_timeline FOR SELECT USING (true);

CREATE POLICY "Only staff can write to timeline"
    ON public.issue_timeline FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.role IN ('field_officer', 'department_admin', 'super_admin')
        )
    );
