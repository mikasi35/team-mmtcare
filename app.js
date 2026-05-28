import { CONFIG } from './assets/js/config.js';

const orange = '#F5881F';
const dark = '#1B2A3B';

let state = {
  screen: 'loading',
  submitting: false,
  submitError: '',
  configError: '',
  configRow: null,
  adminAuthenticated: false,
  adminLoading: false,
  adminHash: '',   // SHA-256 of admin password, sent as token to Netlify admin function
};

let formData = {
  firstName: '',
  lastName: '',
  role: '',
  description: '',
  department: '',
  linkedinUrl: '',
  image: null,
  preview: null,
};

let members = [];
let errors = {};

function sanitize(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, 1000);
}

function generateSlug(firstName, lastName) {
  return `${firstName}-${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function $(id) { return document.getElementById(id); }

function setScreen(screen) {
  state.screen = screen;
  render();
}

function render() {
  $('app').innerHTML = buildScreen();
  bindEvents();
}

function buildScreen() {
  switch (state.screen) {
    case 'loading': return buildLoading();
    case 'setup': return buildSetup();
    case 'form': return buildForm();
    case 'review': return buildReview();
    case 'success': return buildSuccess();
    case 'adminLogin': return buildAdminLogin();
    case 'admin': return buildAdmin();
    default: return buildForm();
  }
}

function buildLoading() {
  return `
  <div class="section-card" style="text-align:center;max-width:480px">
    <i class="ti ti-loader-2 spin" style="font-size:36px;color:${orange};display:block;margin-bottom:18px"></i>
    <h2 style="font-size:20px;font-weight:600;color:var(--text);margin-bottom:10px">Loading configuration...</h2>
    <p style="color:var(--text3);font-size:14px;line-height:1.8">This app is fetching shared settings so your team can submit profiles without each person configuring anything.</p>
  </div>`;
}

function buildSetup() {
  return `
  <div class="section-card" style="max-width:680px">
    <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:24px">
      <div style="width:48px;height:48px;border-radius:14px;background:${dark};display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 6px 16px rgba(27,42,59,0.25)">
        <i class="ti ti-alert-circle" style="font-size:22px;color:#fff"></i>
      </div>
      <div>
        <h2 style="font-size:20px;font-weight:600;color:var(--text);margin-bottom:6px">Central setup required</h2>
        <p style="font-size:14px;color:var(--text3);line-height:1.75">The shared configuration row is not available yet. An administrator should create the config row in Supabase one time.</p>
      </div>
    </div>

    ${state.configError ? `<div class="alert-err"><i class="ti ti-alert-circle"></i> ${state.configError}</div>` : ''}

    <div class="accordion">
      <button id="toggleInstr" class="accordion-toggle">
        <i class="ti ti-book-2" style="font-size:15px"></i>
        Setup guide for Supabase
        <i class="ti ti-chevron-down chev" id="chevInstr"></i>
      </button>
      <div id="instrBody" class="accordion-body">
        <div class="step-label"><span class="step-num">1</span> Create or update this config table in Supabase</div>
        <pre>create table ${CONFIG.configTable} (
  id int primary key,
  admin_pass_hash text not null,
  bucket_name text not null default '${CONFIG.bucketName}',
  created_at timestamptz default now()
);

alter table ${CONFIG.configTable} enable row level security;
create policy "allow_select" on ${CONFIG.configTable} for select using (true);</pre>
        <div class="step-label"><span class="step-num">2</span> Create or update the team_members table</div>
        <pre>create table team_members (
  id bigint generated always as identity primary key,
  first_name text,
  last_name text,
  role text,
  description text,
  image_url text,
  approved boolean default false,
  featured boolean default false,
  sort_order int default 0,
  slug text,
  linkedin_url text,
  department text,
  created_at timestamptz default now()
);

-- If table already exists, add new columns:
alter table team_members add column if not exists approved boolean default false;
alter table team_members add column if not exists featured boolean default false;
alter table team_members add column if not exists sort_order int default 0;
alter table team_members add column if not exists slug text;
alter table team_members add column if not exists linkedin_url text;
alter table team_members add column if not exists department text;</pre>
        <div class="step-label"><span class="step-num">3</span> Insert the shared config row</div>
        <pre>insert into ${CONFIG.configTable} (id, admin_pass_hash, bucket_name)
values (1, 'YOUR_SHA256_HASH', '${CONFIG.bucketName}');</pre>
        <div class="step-label"><span class="step-num">4</span> Keep the anonymous key and project URL in <code>config.js</code></div>
        <div class="step-label" style="margin-top:8px"><span class="step-num">5</span> Reload this page once the row exists</div>
      </div>
    </div>

    <button class="btn-primary" id="retryConfig" style="margin-top:8px">
      <i class="ti ti-refresh" style="font-size:18px"></i> Retry configuration fetch
    </button>
  </div>`;
}

function buildForm() {
  const maxBio = 800;
  const charLeft = maxBio - (formData.description || '').length;
  const configBanner = state.configRow ?
    `<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;margin-bottom:18px;background:rgba(26,158,92,0.1);border:1px solid rgba(26,158,92,0.22);border-radius:14px;color:var(--text2);font-size:13px;line-height:1.6">
      <i class="ti ti-check" style="font-size:16px;color:var(--green)"></i>
      Shared setup loaded. Bucket: <strong>${CONFIG.bucketName}</strong>. Ready for team submissions.
    </div>` : '';
  return `
  <div class="section-card">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:26px;gap:12px">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="form-accent"></div>
        <div>
          <h2 style="font-size:19px;font-weight:600;color:var(--text);letter-spacing:-0.3px;margin-bottom:3px">Team Profile Submission</h2>
          <p style="font-size:13px;color:var(--text3)">Submit your profile and review it before final upload.</p>
        </div>
      </div>
      <div class="nav-pills">
        <button class="btn-ghost" id="goAdmin"><i class="ti ti-lock" style="font-size:13px"></i> Admin</button>
      </div>
    </div>
    ${configBanner}

    <div class="field-row">
      <div>
        <label class="lbl">First name <span style="color:var(--red)">*</span></label>
        <input class="inp${errors.firstName ? ' err' : ''}" id="fFirst" type="text" placeholder="Jane" maxlength="60" value="${formData.firstName || ''}">
        ${errors.firstName ? `<p class="errtxt"><i class="ti ti-alert-circle" style="font-size:12px"></i> ${errors.firstName}</p>` : ''}
      </div>
      <div>
        <label class="lbl">Last name <span style="color:var(--red)">*</span></label>
        <input class="inp${errors.lastName ? ' err' : ''}" id="fLast" type="text" placeholder="Turner" maxlength="60" value="${formData.lastName || ''}">
        ${errors.lastName ? `<p class="errtxt"><i class="ti ti-alert-circle" style="font-size:12px"></i> ${errors.lastName}</p>` : ''}
      </div>
    </div>

    <div style="margin-bottom:14px">
      <label class="lbl">Role / Title <span style="color:var(--red)">*</span></label>
      <input class="inp${errors.role ? ' err' : ''}" id="fRole" type="text" placeholder="e.g. Director of Practice and Service Excellence" maxlength="100" value="${formData.role || ''}">
      ${errors.role ? `<p class="errtxt"><i class="ti ti-alert-circle" style="font-size:12px"></i> ${errors.role}</p>` : ''}
    </div>

    <div style="margin-bottom:14px">
      <label class="lbl">Department <span style="font-weight:400;color:var(--text3)">(optional)</span></label>
      <select class="inp" id="fDept" style="background:var(--surface2)">
        <option value="">— Select department —</option>
        <option value="Leadership" ${formData.department === 'Leadership' ? 'selected' : ''}>Leadership</option>
        <option value="Clinical" ${formData.department === 'Clinical' ? 'selected' : ''}>Clinical</option>
        <option value="Support Coordination" ${formData.department === 'Support Coordination' ? 'selected' : ''}>Support Coordination</option>
        <option value="Operations" ${formData.department === 'Operations' ? 'selected' : ''}>Operations</option>
        <option value="Administration" ${formData.department === 'Administration' ? 'selected' : ''}>Administration</option>
        <option value="Advisory" ${formData.department === 'Advisory' ? 'selected' : ''}>Advisory</option>
      </select>
    </div>

    <div style="margin-bottom:14px">
      <label class="lbl">Short bio <span style="color:var(--red)">*</span> <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;color:${charLeft < 80 ? orange : 'var(--text3)'}">${charLeft} chars left</span></label>
      <textarea class="inp${errors.description ? ' err' : ''}" id="fDesc" placeholder="Describe your role and what you bring to the team…" maxlength="800" style="resize:vertical;min-height:120px;line-height:1.65">${formData.description || ''}</textarea>
      ${errors.description ? `<p class="errtxt"><i class="ti ti-alert-circle" style="font-size:12px"></i> ${errors.description}</p>` : ''}
    </div>

    <div style="margin-bottom:14px">
      <label class="lbl">LinkedIn URL <span style="font-weight:400;color:var(--text3)">(optional)</span></label>
      <input class="inp${errors.linkedinUrl ? ' err' : ''}" id="fLinkedin" type="url" placeholder="https://www.linkedin.com/in/your-name" maxlength="300" value="${formData.linkedinUrl || ''}">
      ${errors.linkedinUrl ? `<p class="errtxt"><i class="ti ti-alert-circle" style="font-size:12px"></i> ${errors.linkedinUrl}</p>` : ''}
    </div>

    <div style="margin-bottom:24px">
      <label class="lbl">Profile photo <span style="color:var(--red)">*</span></label>
      <div id="dropZone" class="drop-zone${errors.image ? ' err' : ''}">
        ${formData.preview ? `
          <div style="position:relative">
            <img src="${formData.preview}" alt="Preview" style="width:100%;max-height:280px;object-fit:cover;display:block">
            <button id="clearImg" style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.65);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;backdrop-filter:blur(4px)">
              <i class="ti ti-x" style="font-size:15px"></i>
            </button>
          </div>` : `
          <div class="drop-inner">
            <i class="ti ti-photo-up drop-icon"></i>
            <p class="drop-title">Drop photo here or click to browse</p>
            <p class="drop-sub">JPG, PNG, WebP · max ${CONFIG.maxImageSize / 1024 / 1024} MB</p>
          </div>`}
      </div>
      <input type="file" id="fileInput" accept="image/jpeg,image/png,image/webp" style="display:none">
      ${errors.image ? `<p class="errtxt" style="margin-top:6px"><i class="ti ti-alert-circle" style="font-size:12px"></i> ${errors.image}</p>` : ''}
    </div>

    ${state.submitError ? `
    <div class="alert-err">
      <i class="ti ti-alert-circle"></i> ${state.submitError}
    </div>` : ''}

    <button class="btn-primary" id="submitBtn" ${state.submitting ? 'disabled' : ''}>
      ${state.submitting ? `<i class="ti ti-loader-2 spin" style="font-size:18px"></i> Uploading…` : `<i class="ti ti-eye" style="font-size:18px"></i> Review details`}
    </button>
  </div>`;
}

function buildReview() {
  return `
  <div class="section-card" style="max-width:640px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="form-accent"></div>
        <div>
          <h2 style="font-size:19px;font-weight:600;color:var(--text);letter-spacing:-0.3px;margin-bottom:3px">Review your profile</h2>
          <p style="font-size:13px;color:var(--text3)">Confirm your details before submitting.</p>
        </div>
      </div>
      <button class="btn-ghost" id="editReview" style="padding:8px 10px"><i class="ti ti-pencil" style="font-size:14px"></i> Edit</button>
    </div>

    <div class="field-group">
      <div>
        <div class="step-label">Name</div>
        <div style="padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--surface2)">${sanitize(formData.firstName)} ${sanitize(formData.lastName)}</div>
      </div>
      <div>
        <div class="step-label">Role</div>
        <div style="padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--surface2)">${sanitize(formData.role)}</div>
      </div>
      ${formData.department ? `<div>
        <div class="step-label">Department</div>
        <div style="padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--surface2)">${sanitize(formData.department)}</div>
      </div>` : ''}
      <div>
        <div class="step-label">Bio</div>
        <div style="padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--surface2);white-space:pre-line;line-height:1.75">${sanitize(formData.description)}</div>
      </div>
      ${formData.linkedinUrl ? `<div>
        <div class="step-label">LinkedIn</div>
        <div style="padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--surface2)">${sanitize(formData.linkedinUrl)}</div>
      </div>` : ''}
      <div>
        <div class="step-label">Photo preview</div>
        <div style="border:1.5px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface)">${formData.preview ? `<img src="${formData.preview}" alt="Profile preview" style="width:100%;height:auto;display:block">` : 'No photo selected'}</div>
      </div>
    </div>

    ${state.submitError ? `
    <div class="alert-err">
      <i class="ti ti-alert-circle"></i> ${state.submitError}
    </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px">
      <button class="btn-ghost" id="editReviewBottom"><i class="ti ti-arrow-left" style="font-size:14px"></i> Back to edit</button>
      <button class="btn-primary" id="confirmSubmit" ${state.submitting ? 'disabled' : ''}>
        ${state.submitting ? `<i class="ti ti-loader-2 spin" style="font-size:18px"></i> Submitting…` : `<i class="ti ti-send" style="font-size:18px"></i> Confirm & submit`}
      </button>
    </div>
  </div>`;
}

function buildSuccess() {
  return `
  <div class="section-card" style="max-width:460px;text-align:center">
    <div class="success-icon">
      <i class="ti ti-check" style="font-size:40px;color:var(--green)"></i>
    </div>
    <h2 style="font-size:22px;font-weight:600;color:var(--text);margin-bottom:10px;letter-spacing:-0.3px">Profile submitted!</h2>
    <p style="font-size:14px;color:var(--text3);line-height:1.75;margin-bottom:32px">Your details have been saved and will be reviewed before going live on the team page.</p>
    <button class="btn-primary" id="newSubmit" style="width:auto;padding:12px 30px;margin:0 auto">
      <i class="ti ti-plus" style="font-size:17px"></i> Submit another profile
    </button>
  </div>`;
}

function buildAdminLogin() {
  return `
  <div class="section-card" style="max-width:380px">
    <button id="backToForm" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;margin-bottom:24px;display:flex;align-items:center;gap:6px;padding:0;font-weight:500">
      <i class="ti ti-arrow-left" style="font-size:15px"></i> Back to form
    </button>
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px">
      <div style="width:48px;height:48px;border-radius:12px;background:${dark};display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(27,42,59,0.25)">
        <i class="ti ti-shield-lock" style="font-size:22px;color:#fff"></i>
      </div>
      <div>
        <h2 style="font-size:18px;font-weight:600;color:var(--text);margin-bottom:2px">Admin Access</h2>
        <p style="font-size:13px;color:var(--text3)">View submitted profiles with the shared password.</p>
      </div>
    </div>
    <div style="margin-bottom:18px">
      <label class="lbl">Password</label>
      <input class="inp${errors.adminPass ? ' err' : ''}" id="adminPassInput" type="password" placeholder="Enter admin password">
      ${errors.adminPass ? `<p class="errtxt"><i class="ti ti-alert-circle" style="font-size:12px"></i> ${errors.adminPass}</p>` : ''}
    </div>
    <button class="btn-primary btn-dark" id="loginBtn">
      <i class="ti ti-lock-open" style="font-size:17px"></i> Login
    </button>
  </div>`;
}

function buildAdmin() {
  const count = members.length;
  const pending = members.filter(m => !m.approved).length;
  const approved = members.filter(m => m.approved).length;

  const cards = count === 0 ?
    `<div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--text3)">
      <i class="ti ti-users" style="font-size:48px;display:block;margin-bottom:14px"></i>
      <p style="font-size:14px;font-weight:500">No submissions yet</p>
    </div>` :
    members.map(m => {
      const initials = `${(m.first_name || '')[0] || ''}${(m.last_name || '')[0] || ''}`.toUpperCase();
      return `
      <div class="member-card">
        <div class="member-photo">
          ${m.image_url ? `<img src="${m.image_url}" alt="${m.first_name} ${m.last_name}" loading="lazy">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#F0EDE9"><div style="width:60px;height:60px;border-radius:50%;background:#E8E4DF;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;color:var(--text3)">${initials}</div></div>`}
          <div class="date-badge">${new Date(m.created_at).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}</div>
          ${m.approved ? `<div style="position:absolute;top:10px;left:10px;background:rgba(26,158,92,0.9);color:#fff;font-size:11px;font-weight:600;padding:4px 9px;border-radius:20px;backdrop-filter:blur(4px)">✓ Approved</div>` : `<div style="position:absolute;top:10px;left:10px;background:rgba(245,136,31,0.9);color:#fff;font-size:11px;font-weight:600;padding:4px 9px;border-radius:20px;backdrop-filter:blur(4px)">Pending</div>`}
          ${m.featured ? `<div style="position:absolute;top:36px;left:10px;background:rgba(27,42,59,0.9);color:#fff;font-size:11px;font-weight:600;padding:4px 9px;border-radius:20px;backdrop-filter:blur(4px)">★ Featured</div>` : ''}
        </div>
        <div class="member-body">
          <div class="member-name">${m.first_name} ${m.last_name}</div>
          <div class="member-role">${m.role}</div>
          ${m.department ? `<div style="font-size:12px;color:var(--text3);margin-bottom:6px;font-weight:500">${m.department}</div>` : ''}
          <div class="member-bio">${m.description}</div>
          ${m.linkedin_url ? `<a href="${m.linkedin_url}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:${orange};margin-bottom:10px;text-decoration:none"><i class="ti ti-brand-linkedin" style="font-size:13px"></i> LinkedIn</a>` : ''}
          <div style="margin-bottom:10px">
            <label style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Sort Order</label>
            <input type="number" class="inp sort-input" data-id="${m.id}" value="${m.sort_order || 0}" min="0" max="999" style="width:80px;padding:6px 10px;font-size:13px">
          </div>
          <div class="member-actions">
            ${!m.approved ? `<button data-approve="${m.id}" class="act-btn act-filled approve-btn" style="background:var(--green);border-color:var(--green)">
              <i class="ti ti-check" style="font-size:12px"></i> Approve
            </button>` : `<button data-unapprove="${m.id}" class="act-btn act-outline unapprove-btn">
              <i class="ti ti-x" style="font-size:12px"></i> Unapprove
            </button>`}
            ${!m.featured ? `<button data-feature="${m.id}" class="act-btn act-outline feature-btn">
              <i class="ti ti-star" style="font-size:12px"></i> Feature
            </button>` : `<button data-unfeature="${m.id}" class="act-btn act-outline unfeature-btn" style="color:${orange};border-color:${orange}">
              <i class="ti ti-star-filled" style="font-size:12px"></i> Unfeature
            </button>`}
            <button data-delete="${m.id}" class="act-btn act-outline delete-btn" style="color:var(--red);border-color:var(--red)">
              <i class="ti ti-trash" style="font-size:12px"></i> Delete
            </button>
            <button data-copy="${encodeURIComponent(`${m.first_name}|${m.last_name}|${m.role}|${m.description}|${m.image_url || ''}`)}" class="act-btn act-outline copy-btn">
              <i class="ti ti-copy" style="font-size:12px"></i> Copy
            </button>
            ${m.image_url ? `<a href="${m.image_url}" download target="_blank" rel="noreferrer" class="act-btn act-filled"><i class="ti ti-download" style="font-size:12px"></i> Photo</a>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

  return `
  <div class="admin-wrap">
    <div class="admin-header">
      <div>
        <div class="admin-title">Team Submissions <span class="count-badge">${count}</span></div>
        <div class="admin-sub">${approved} approved · ${pending} pending review</div>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn-ghost" id="csvBtn"><i class="ti ti-table-export" style="font-size:13px"></i> Export CSV</button>
        <button class="btn-ghost" id="refreshBtn"><i class="ti ti-refresh" style="font-size:13px"></i> Refresh</button>
        <button class="btn-ghost danger" id="logoutBtn"><i class="ti ti-logout" style="font-size:13px"></i> Logout</button>
      </div>
    </div>
    ${state.adminLoading ? `
      <div style="text-align:center;padding:4rem;color:var(--text3)">
        <i class="ti ti-loader-2 spin" style="font-size:34px;display:block;margin-bottom:12px"></i>
        <p style="font-size:14px">Loading profiles…</p>
      </div>` : `<div class="member-grid">${cards}</div>`}
  </div>`;
}

function bindEvents() {
  const s = state.screen;

  if (s === 'setup') {
    const tog = $('toggleInstr'), body = $('instrBody');
    if (tog) tog.onclick = () => {
      const open = body.classList.toggle('open');
      tog.classList.toggle('open', open);
    };
    $('retryConfig') && ($('retryConfig').onclick = fetchSharedConfig);
  }

  if (s === 'form') {
    $('goAdmin') && ($('goAdmin').onclick = () => { errors = {}; setScreen('adminLogin'); });

    const dz = $('dropZone'), fi = $('fileInput');
    if (dz) {
      dz.onclick = (e) => { if (e.target.id !== 'clearImg' && !e.target.closest('#clearImg')) fi.click(); };
      dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('active'); };
      dz.ondragleave = () => dz.classList.remove('active');
      dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('active'); handleFile(e.dataTransfer.files[0]); };
    }
    if (fi) fi.onchange = (e) => handleFile(e.target.files[0]);
    $('clearImg') && ($('clearImg').onclick = (e) => { e.stopPropagation(); formData.image = null; formData.preview = null; errors.image = ''; render(); });

    ['fFirst','fLast','fRole','fDesc','fDept','fLinkedin'].forEach(id => {
      const el = $(id);
      if (el) el.oninput = (e) => {
        const map = { fFirst:'firstName', fLast:'lastName', fRole:'role', fDesc:'description', fDept:'department', fLinkedin:'linkedinUrl' };
        formData[map[id]] = e.target.value;
        if (id === 'fDesc') {
          const lbl = el.previousElementSibling;
          if (lbl) {
            const sp = lbl.querySelector('span:last-child');
            if (sp) sp.textContent = `${800 - e.target.value.length} chars left`;
          }
        }
      };
    });
    // Also handle select change for department
    const deptEl = $('fDept');
    if (deptEl) deptEl.onchange = (e) => { formData.department = e.target.value; };

    $('submitBtn') && ($('submitBtn').onclick = handleSubmit);
  }

  if (s === 'review') {
    $('editReview') && ($('editReview').onclick = () => setScreen('form'));
    $('editReviewBottom') && ($('editReviewBottom').onclick = () => setScreen('form'));
    $('confirmSubmit') && ($('confirmSubmit').onclick = submitConfirmed);
  }

  if (s === 'success') {
    $('newSubmit') && ($('newSubmit').onclick = () => {
      formData = { firstName:'', lastName:'', role:'', description:'', department:'', linkedinUrl:'', image:null, preview:null };
      errors = {};
      state.submitError = '';
      setScreen('form');
    });
  }

  if (s === 'adminLogin') {
    $('backToForm') && ($('backToForm').onclick = () => { errors = {}; setScreen('form'); });
    const loginAction = async () => {
      const val = $('adminPassInput').value || '';
      if (!val) { errors.adminPass = 'Required'; render(); return; }
      const hash = await hashText(val);
      if (hash === state.configRow?.admin_pass_hash) {
        errors = {};
        state.adminHash = hash;
        fetchMembers();
      } else {
        errors.adminPass = 'Incorrect password'; render();
      }
    };
    $('adminPassInput') && ($('adminPassInput').onkeydown = (e) => { if (e.key === 'Enter') loginAction(); });
    $('loginBtn') && ($('loginBtn').onclick = loginAction);
  }

  if (s === 'admin') {
    $('logoutBtn') && ($('logoutBtn').onclick = () => { members = []; setScreen('form'); });
    $('refreshBtn') && ($('refreshBtn').onclick = fetchMembers);
    $('csvBtn') && ($('csvBtn').onclick = exportCSV);

    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.onclick = () => approveMember(btn.dataset.approve);
    });
    document.querySelectorAll('.unapprove-btn').forEach(btn => {
      btn.onclick = () => unapproveMember(btn.dataset.unapprove);
    });
    document.querySelectorAll('.feature-btn').forEach(btn => {
      btn.onclick = () => featureMember(btn.dataset.feature, true);
    });
    document.querySelectorAll('.unfeature-btn').forEach(btn => {
      btn.onclick = () => featureMember(btn.dataset.unfeature, false);
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = () => deleteMember(btn.dataset.delete);
    });
    document.querySelectorAll('.sort-input').forEach(input => {
      input.onchange = (e) => updateSortOrder(input.dataset.id, parseInt(e.target.value, 10) || 0);
    });
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.onclick = () => {
        const parts = decodeURIComponent(btn.dataset.copy).split('|');
        const text = `Name: ${parts[0]} ${parts[1]}\nRole: ${parts[2]}\nBio: ${parts[3]}\nPhoto: ${parts[4]}`;
        navigator.clipboard.writeText(text).then(() => {
          btn.innerHTML = '<i class="ti ti-check" style="font-size:12px"></i> Copied!';
          setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy" style="font-size:12px"></i> Copy'; }, 2000);
        });
      };
    });
  }
}

function handleFile(file) {
  if (!file) return;
  const allowed = ['image/jpeg','image/png','image/webp'];
  if (!allowed.includes(file.type)) { errors.image = 'Please upload a JPG, PNG, or WebP image'; render(); return; }
  if (file.size > CONFIG.maxImageSize) { errors.image = `Image must be under ${CONFIG.maxImageSize / 1024 / 1024} MB`; render(); return; }
  formData.image = file;
  errors.image = '';
  const reader = new FileReader();
  reader.onload = (e) => { formData.preview = e.target.result; render(); };
  reader.readAsDataURL(file);
}

function validate() {
  const e = {};
  if (!(formData.firstName || '').trim()) e.firstName = 'Required';
  if (!(formData.lastName || '').trim()) e.lastName = 'Required';
  if (!(formData.role || '').trim()) e.role = 'Required';
  if (!(formData.description || '').trim()) e.description = 'Required';
  if (!formData.image) e.image = 'Please upload a photo';
  if (formData.linkedinUrl && !formData.linkedinUrl.startsWith('http')) {
    e.linkedinUrl = 'Please enter a valid URL starting with https://';
  }
  errors = e;
  return Object.keys(e).length === 0;
}

async function handleSubmit() {
  if (!validate()) { render(); return; }
  state.submitError = '';
  setScreen('review');
}

async function getPublicImageUrl(storageBaseUrl, filePath) {
  const res = await fetch(
    `${storageBaseUrl}/storage/v1/object/public/${CONFIG.bucketName}/${filePath}`,
    { method: 'HEAD', headers: { apikey: CONFIG.supabaseAnonKey } }
  );
  // Return the direct public URL (no signed token needed for public buckets)
  return `${storageBaseUrl}/storage/v1/object/public/${CONFIG.bucketName}/${filePath}`;
}

async function uploadImageToStorage(fname, storageBaseUrl) {
  const upRes = await fetch(`${storageBaseUrl}/storage/v1/object/${CONFIG.bucketName}/${fname}`, {
    method: 'POST',
    headers: {
      apikey: CONFIG.supabaseAnonKey,
      Authorization: `Bearer ${CONFIG.supabaseAnonKey}`,
      'Content-Type': formData.image.type,
    },
    body: formData.image,
  });
  if (!upRes.ok) {
    const errorBody = await upRes.json().catch(() => null);
    const details = errorBody?.error || errorBody?.message || JSON.stringify(errorBody) || upRes.statusText;
    throw new Error(`Storage upload failed (${upRes.status}): ${details}`);
  }
  // Return the canonical public URL
  return `${CONFIG.supabaseUrl}/storage/v1/object/public/${CONFIG.bucketName}/${fname}`;
}

async function submitConfirmed() {
  state.submitting = true;
  state.submitError = '';
  render();

  try {
    // Step 1: Upload image directly to Supabase Storage from the browser
    const ext = (formData.image.name || 'photo').split('.').pop().toLowerCase() || 'jpg';
    const fname = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const imageUrl = await uploadImageToStorage(fname, CONFIG.supabaseUrl);

    // Step 2: Submit profile data (JSON + imageUrl) to the Netlify function for DB insert
    const res = await fetch('/.netlify/functions/submit-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: sanitize(formData.firstName),
        lastName: sanitize(formData.lastName),
        role: sanitize(formData.role),
        description: sanitize(formData.description),
        department: sanitize(formData.department),
        linkedinUrl: sanitize(formData.linkedinUrl),
        imageUrl,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Submission failed');
    }

    state.screen = 'success';

  } catch (err) {
    state.submitError = err.message || 'Submission failed';

  } finally {
    state.submitting = false;
    render();
  }
}

async function fetchMembers() {
  state.adminLoading = true;
  state.screen = 'admin';
  render();

  try {
    const res = await fetch('/.netlify/functions/admin-members', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: state.adminHash
      })
    });

    if (!res.ok) {
      throw new Error('Failed to load members');
    }

    const data = await res.json();

    members = Array.isArray(data) ? data : [];

  } catch (e) {
    members = [];
    showAdminError(e.message);

  } finally {
    state.adminLoading = false;
    render();
  }
}
function showAdminError(msg) {
  const wrap = document.querySelector('.admin-wrap');
  if (!wrap) return;
  const existing = document.getElementById('adminErr');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'adminErr';
  el.className = 'alert-err';
  el.style.cssText = 'margin:0 0 16px;white-space:pre-wrap;';
  el.innerHTML = `<i class="ti ti-alert-circle"></i> ${msg}`;
  wrap.insertBefore(el, wrap.querySelector('.admin-header').nextSibling);
  setTimeout(() => el.remove(), 10000);
}

function showAdminSuccess(msg) {
  const wrap = document.querySelector('.admin-wrap');
  if (!wrap) return;
  const existing = document.getElementById('adminOk');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'adminOk';
  el.style.cssText = 'margin:0 0 16px;padding:12px 16px;background:rgba(26,158,92,0.1);border:1px solid rgba(26,158,92,0.3);border-radius:12px;font-size:13px;color:var(--text2);display:flex;align-items:center;gap:8px;';
  el.innerHTML = `<i class="ti ti-check" style="color:var(--green)"></i> ${msg}`;
  wrap.insertBefore(el, wrap.querySelector('.admin-header').nextSibling);
  setTimeout(() => el.remove(), 3000);
}

// Route all admin writes through the secure Netlify function.
// Falls back to direct Supabase calls when running locally (no Netlify context).
async function adminAction(action, id, value) {
  const isNetlify = window.location.hostname !== 'localhost' &&
                    !window.location.hostname.startsWith('127.') &&
                    !window.location.hostname.startsWith('192.');

  if (isNetlify) {
    // Production path — goes through netlify/functions/admin.js (uses service key server-side)
    const res = await fetch('/.netlify/functions/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: state.adminHash,   // SHA-256 hash, never the raw password
        action,
        id,
        value,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json.error || `Request failed (${res.status})`);
    }
    if (json.ok === false && json.warning) {
      throw new Error(json.warning);
    }
    return json;

  } else {
    // Local dev path — direct Supabase REST (acceptable on localhost)
    if (action === 'delete') {
      const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${CONFIG.teamTable}?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          apikey: CONFIG.supabaseAnonKey,
          Authorization: `Bearer ${CONFIG.supabaseAnonKey}`,
          Prefer: 'return=representation',
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || body?.error || res.statusText);
      }
      return { ok: true };
    }

    const patches = {
      approve:   { approved: true },
      unapprove: { approved: false },
      feature:   { featured: true },
      unfeature: { featured: false },
      sort:      { sort_order: parseInt(value, 10) || 0 },
    };

    const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${CONFIG.teamTable}?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: CONFIG.supabaseAnonKey,
        Authorization: `Bearer ${CONFIG.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patches[action]),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || body?.error || res.statusText);
    }

    const updated = await res.json().catch(() => []);
    if (!Array.isArray(updated) || updated.length === 0) {
      throw new Error(
        'No rows updated — RLS may be blocking writes.\nRun in Supabase SQL editor:\n' +
        'CREATE POLICY "allow_all_anon" ON team_members FOR ALL USING (true) WITH CHECK (true);'
      );
    }
    return { ok: true };
  }
}

async function approveMember(id) {
  try {
    await adminAction('approve', id);
    showAdminSuccess('Profile approved.');
    fetchMembers();
  } catch (err) {
    showAdminError(err.message);
  }
}

async function unapproveMember(id) {
  try {
    await adminAction('unapprove', id);
    showAdminSuccess('Profile unapproved.');
    fetchMembers();
  } catch (err) {
    showAdminError(err.message);
  }
}

async function featureMember(id, featured) {
  try {
    await adminAction(featured ? 'feature' : 'unfeature', id);
    showAdminSuccess(featured ? 'Profile featured.' : 'Profile unfeatured.');
    fetchMembers();
  } catch (err) {
    showAdminError(err.message);
  }
}

async function deleteMember(id) {
  if (!confirm('Are you sure you want to permanently delete this profile?')) return;
  try {
    await adminAction('delete', id);
    fetchMembers();
  } catch (err) {
    showAdminError(`Delete failed: ${err.message}`);
  }
}

async function updateSortOrder(id, sortOrder) {
  try {
    await adminAction('sort', id, sortOrder);
    const member = members.find(m => String(m.id) === String(id));
    if (member) member.sort_order = sortOrder;
  } catch (err) {
    showAdminError(err.message);
  }
}

function exportCSV() {
  if (!members.length) return;
  const rows = [
    ['First Name','Last Name','Role','Department','Description','LinkedIn','Photo URL','Approved','Featured','Sort Order','Submitted At'],
    ...members.map(m => [
      m.first_name,
      m.last_name,
      m.role,
      m.department || '',
      `"${(m.description || '').replace(/"/g, '""')}"`,
      m.linkedin_url || '',
      m.image_url || '',
      m.approved ? 'Yes' : 'No',
      m.featured ? 'Yes' : 'No',
      m.sort_order || 0,
      m.created_at || '',
    ]),
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'team_members.csv';
  a.click();
}

async function hashText(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchSharedConfig() {
  state.configError = '';
  setScreen('loading');

  try {
    const res = await fetch('/.netlify/functions/team-config');

    if (!res.ok) {
      throw new Error('Unable to fetch shared setup.');
    }

    const data = await res.json();

    if (!data || !data.admin_pass_hash) {
      throw new Error('Shared config row not found.');
    }

    state.configRow = data;
    CONFIG.supabaseUrl = data.supabase_url || '';
    CONFIG.supabaseAnonKey = data.supabase_anon_key || '';
    state.screen = 'form';

  } catch (err) {
    state.configError = err.message || 'Failed to load configuration.';
    state.screen = 'setup';
  } finally {
    render();
  }
}

function init() {
  render();
  fetchSharedConfig();
}

init();
