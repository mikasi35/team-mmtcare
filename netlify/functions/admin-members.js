/**
 * POST /.netlify/functions/admin-members
 *
 * Returns all rows from `team_members` (approved and pending) for the admin panel.
 * Protected by the same SHA-256 password hash as the admin function.
 *
 * Body: { token }
 */

const { createClient } = require('@supabase/supabase-js');

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
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

  const { token } = body;

  const adminHash = process.env.ADMIN_PASS_HASH;
  if (!adminHash) {
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: 'ADMIN_PASS_HASH env var not set' }),
    };
  }

  if (!token || token !== adminHash) {
    return {
      statusCode: 401,
      headers: cors(),
      body: JSON.stringify({ error: 'Unauthorised' }),
    };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .order('approved', { ascending: true })   // pending first
    .order('sort_order', { ascending: true });

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
    body: JSON.stringify(data),
  };
};
