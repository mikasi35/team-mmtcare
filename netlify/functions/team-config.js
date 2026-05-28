/**
 * GET /.netlify/functions/team-config
 *
 * Returns the shared config row from `team_capture_config` plus the public
 * Supabase URL and anon key so the browser never needs them hardcoded.
 */

const { createClient } = require('@supabase/supabase-js');

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_ANON_KEY env var not set' }),
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from('team_capture_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) {
      return {
        statusCode: 404,
        headers: cors(),
        body: JSON.stringify({ error: error?.message || 'Config row not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...cors(),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        ...data,
        supabase_url: supabaseUrl,
        supabase_anon_key: supabaseAnonKey,
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: err.message }),
    };
  }
};
