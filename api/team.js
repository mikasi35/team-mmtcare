/**
 * MMT Care — Public Team API Endpoint
 * Deploy this as a serverless function (Netlify, Vercel, Cloudflare Workers, etc.)
 *
 * GET /api/team
 * Returns all approved team members ordered by sort_order, then created_at.
 *
 * Usage on mmtcare.com.au/about:
 *   fetch('https://team.mmtcare.com.au/api/team')
 *
 * Environment variables required:
 *   SUPABASE_URL       — your Supabase project URL
 *   SUPABASE_ANON_KEY  — your Supabase anon/public key
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables");
}
const TABLE = 'team_members';

export default async function handler(req, res) {
  // CORS — allow mmtcare.com.au to fetch
  res.setHeader('Access-Control-Allow-Origin', 'https://mmtcare.com.au');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/${TABLE}` +
      `?approved=eq.true` +
      `&select=id,first_name,last_name,role,description,image_url,featured,sort_order,department,linkedin_url,slug` +
      `&order=sort_order.asc,created_at.asc`;

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }

    const members = await response.json();
    return res.status(200).json(members);

  } catch (err) {
    console.error('Team API error:', err);
    return res.status(500).json({ error: 'Failed to fetch team members' });
  }
}
