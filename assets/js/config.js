export const CONFIG = {
  // Netlify Function endpoint
  apiUrl: '/.netlify/functions/team',

  // Populated at runtime from /.netlify/functions/team-config (never hardcoded)
  supabaseUrl: '',
  supabaseAnonKey: '',

  // Storage
  bucketName: 'team-photos',

  // Database tables
  teamTable: 'team_members',
  configTable: 'team_capture_config',

  // Config
  configId: 1,
  maxImageSize: 5 * 1024 * 1024,
};
