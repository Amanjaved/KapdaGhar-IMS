import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { UserProfile } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'staff_profiles.json');

const DEFAULT_PROFILES: UserProfile[] = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    business_id: 'b0000000-0000-0000-0000-000000000001',
    full_name: 'Admin',
    phone: '+91 98765 43210',
    role: 'owner',
    pin_code: '9044',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function readProfiles(): UserProfile[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(PROFILES_FILE)) {
      fs.writeFileSync(PROFILES_FILE, JSON.stringify(DEFAULT_PROFILES, null, 2), 'utf-8');
      return DEFAULT_PROFILES;
    }
    const content = fs.readFileSync(PROFILES_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return DEFAULT_PROFILES;
  } catch (err) {
    console.error('Failed to read staff_profiles.json:', err);
    return DEFAULT_PROFILES;
  }
}

function writeProfiles(profiles: UserProfile[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write staff_profiles.json:', err);
  }
}

export async function GET() {
  const profiles = readProfiles();
  return NextResponse.json(profiles);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const profiles = readProfiles();

    if (!body || !body.id) {
      return NextResponse.json({ error: 'Missing profile ID' }, { status: 400 });
    }

    const index = profiles.findIndex((p) => p.id === body.id);
    if (index >= 0) {
      profiles[index] = { ...profiles[index], ...body, updated_at: new Date().toISOString() };
    } else {
      profiles.push(body);
    }

    writeProfiles(profiles);

    // Sync to Supabase if configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/profiles`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            id: body.id,
            business_id: body.business_id,
            full_name: body.full_name,
            phone: body.phone,
            role: body.role,
          }),
        });
      } catch (err) {
        console.warn('Supabase profile sync warning:', err);
      }
    }

    return NextResponse.json({ success: true, profile: body });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    let id = url.searchParams.get('id');

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body?.id;
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing profile ID to delete' }, { status: 400 });
    }

    // Delete from Supabase profiles if configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        });
      } catch (err) {
        console.warn('Supabase profile delete warning:', err);
      }
    }

    // Remove from local file store
    const profiles = readProfiles();
    const updated = profiles.filter((p) => p.id !== id);
    writeProfiles(updated);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
