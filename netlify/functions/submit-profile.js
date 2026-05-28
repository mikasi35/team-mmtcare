/**
 * POST /.netlify/functions/submit-profile
 *
 * Receives a JSON body with profile fields and a pre-uploaded image URL,
 * then inserts a new (pending) row into `team_members`.
 *
 * Body: { firstName, lastName, role, description, department, linkedinUrl, imageUrl }
 *
 * Image upload itself is handled client-side directly to Supabase Storage
 * using the public anon key — this function only does the DB insert.
 */

const { createClient } = require('@supabase/supabase-js');

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sanitize(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 1000);
}

function generateSlug(firstName, lastName) {
  return `${firstName}-${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: cors(),
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: cors(),
      body: JSON.stringify({ error: 'Invalid JSON' }),
    };
  }

  const { firstName, lastName, role, description, department, linkedinUrl, imageUrl } = body;

  if (!firstName || !lastName || !role || !description || !imageUrl) {
    return {
      statusCode: 400,
      headers: cors(),
      body: JSON.stringify({ error: 'Missing required fields: firstName, lastName, role, description, imageUrl' }),
    };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  );

  const slug = generateSlug(sanitize(firstName), sanitize(lastName));

  const { error } = await supabase.from('team_members').insert({
    first_name: sanitize(firstName),
    last_name: sanitize(lastName),
    role: sanitize(role),
    description: sanitize(description),
    image_url: imageUrl,
    department: sanitize(department),
    linkedin_url: sanitize(linkedinUrl),
    slug,
    approved: false,
    featured: false,
    sort_order: 0,
  });

  if (error) {
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: error.message }),
    };
  }

  return {
    statusCode: 200,
    headers: { ...cors(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
