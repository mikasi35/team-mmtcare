/**
 * Secure admin API — handles approve, unapprove, feature, delete, sort_order.
 * Protected by SHA-256 password hash (same as the portal login).
 *
 * POST /.netlify/functions/admin
 * Body: { token, action, id, [value] }
 *
 * Actions:
 *   approve   — set approved: true
 *   unapprove — set approved: false
 *   feature   — set featured: true
 *   unfeature — set featured: false
 *   delete    — delete row
 *   sort      — set sort_order: value (integer)
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

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
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { token, action, id, value } = body;

  // Verify password hash against env var
  const adminHash = process.env.ADMIN_PASS_HASH;
  if (!adminHash) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'ADMIN_PASS_HASH env var not set' }) };
  }
  if (!token || token !== adminHash) {
    return { statusCode: 401, headers: cors(), body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  if (!action || !id) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing action or id' }) };
  }

  // Use service role key for admin writes — never exposed to browser
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  );

  try {
    if (action === 'delete') {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true }) };
    }

    const patches = {
      approve:   { approved: true },
      unapprove: { approved: false },
      feature:   { featured: true },
      unfeature: { featured: false },
      sort:      { sort_order: parseInt(value, 10) || 0 },
    };

    if (!patches[action]) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: `Unknown action: ${action}` }) };
    }

    const { data, error } = await supabase
      .from('team_members')
      .update(patches[action])
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return {
        statusCode: 200,
        headers: cors(),
        body: JSON.stringify({ ok: false, warning: 'No rows updated — check RLS policies' }),
      };
    }

    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, data }) };

  } catch (err) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: err.message }) };
  }
};
