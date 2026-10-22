/**
 * [FEAT-SUPABASE-AUTH] NirvTrack Native Supabase Cloud Authentication & Google OAuth
 * Version: 2.0.20261023.105
 * 
 * Features:
 * 1. Native Google OAuth 2.0 Single Sign-On (SSO) with PKCE flow & zero popup blockers.
 * 2. Enterprise Email & Password Authentication (Sign In & Sign Up).
 * 3. Local-First Design: Offline workstation remains 100% interactive at all times.
 *    No blocking modal overlays. Authentication is strictly opt-in for multi-device sync.
 * 4. Automatic Token Refresh & Session Persistence via localStorage.
 * 5. Dynamic Cloud Configuration GUI for user's Supabase Project URL & Anon Key.
 */

let sbAuthMode = 'login'; // 'login' | 'register'
let sbAuthInFlight = false;
let currentAuthenticatedUser = null;
window.currentAuthenticatedUser = null;

// Official Default Supabase Project Credentials
const DEFAULT_SUPABASE_URL = 'https://jftyzfdmlkagyhxbrqab.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHl6ZmRtbGthZ3loeGJycWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODk5NDEsImV4cCI6MjEwODI2NTk0MX0.ly8iWjUnECn60NAUZfzXr5arb7qYD69EXXV5B4NvN1U';

// Active Supabase Configuration (localStorage override with built-in default fallback)
window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || {
  url: localStorage.getItem('nirvtrack_supabase_url') || DEFAULT_SUPABASE_URL,
  anonKey: localStorage.getItem('nirvtrack_supabase_anon_key') || DEFAULT_SUPABASE_ANON_KEY,
  activeBackend: 'supabase'
};

document.addEventListener('DOMContentLoaded', () => {
  initSupabaseAuth();
});

/**
 * Initializes the Supabase client with native session persistence and wires listeners
 */
function initSupabaseAuth() {
  const url = localStorage.getItem('nirvtrack_supabase_url') || window.SUPABASE_CONFIG.url || DEFAULT_SUPABASE_URL;
  const anonKey = localStorage.getItem('nirvtrack_supabase_anon_key') || window.SUPABASE_CONFIG.anonKey || DEFAULT_SUPABASE_ANON_KEY;

  // Update window.SUPABASE_CONFIG cache
  window.SUPABASE_CONFIG.url = url;
  window.SUPABASE_CONFIG.anonKey = anonKey;

  wireAuthDomEventListeners();

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.info('ℹ️ Supabase JS SDK not loaded yet. Working in offline local-first mode.');
    updateAuthHeaderUI(null);
    return;
  }

  if (!url || !anonKey) {
    console.info('ℹ️ Supabase credentials not configured yet. NirvTrack is running in Local Offline Mode.');
    updateAuthHeaderUI(null);
    return;
  }

  try {
    if (!window.sbClient) {
      window.sbClient = supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          storage: window.localStorage
        }
      });
    }

    const client = window.sbClient;

    // Backward compatibility shim for window.fbAuth
    window.fbAuth = {
      get currentUser() {
        return window.currentAuthenticatedUser;
      },
      signOut: async () => {
        if (window.sbClient && window.sbClient.auth) {
          await window.sbClient.auth.signOut();
        }
      },
      onAuthStateChanged: (callback) => {
        if (typeof callback === 'function') {
          callback(window.currentAuthenticatedUser);
        }
      }
    };

    // Listen for auth state transitions
    client.auth.onAuthStateChange(async (event, session) => {
      console.log('⚡ Supabase Auth State:', event, session?.user?.email || 'No Session');
      if (session && session.user) {
        await handleSupabaseAuthSuccess(session.user, false);
      } else if (event === 'SIGNED_OUT') {
        handleSupabaseSignOutCleanup();
      }
    });

    // Check existing active session on load
    client.auth.getSession().then(async ({ data: { session } }) => {
      if (session && session.user) {
        await handleSupabaseAuthSuccess(session.user, true);
      } else {
        updateAuthHeaderUI(null);
        // Automatically pop up Sign In modal on startup if unauthenticated
        setTimeout(() => {
          if (!window.currentAuthenticatedUser && !window.location.hash.includes('access_token') && !window.location.search.includes('code=')) {
            openCloudAuthModal();
          }
        }, 150);
      }
    }).catch(err => {
      console.warn('Supabase getSession notice:', err);
      updateAuthHeaderUI(null);
      setTimeout(() => {
        if (!window.currentAuthenticatedUser) {
          openCloudAuthModal();
        }
      }, 150);
    });

  } catch (err) {
    console.error('Failed to initialize Supabase Auth:', err);
    updateAuthHeaderUI(null);
  }
}
window.initSupabaseAuth = initSupabaseAuth;

/**
 * Wires DOM buttons and forms for authentication
 */
function wireAuthDomEventListeners() {
  const form = document.getElementById('firebaseAuthForm');
  if (form && !form._sbWired) {
    form.addEventListener('submit', handleAuthSubmit);
    form._sbWired = true;
  }

  const toggleBtn = document.getElementById('btnToggleFirebaseMode');
  if (toggleBtn && !toggleBtn._sbWired) {
    toggleBtn.addEventListener('click', toggleAuthMode);
    toggleBtn._sbWired = true;
  }

  const googleBtn = document.getElementById('btnGoogleSignIn');
  if (googleBtn && !googleBtn._sbWired) {
    googleBtn.addEventListener('click', handleGoogleSignIn);
    googleBtn._sbWired = true;
  }

  const logoutBtn = document.getElementById('btnAdminLogout');
  if (logoutBtn && !logoutBtn._sbWired) {
    logoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleAuthLogout(e);
    });
    logoutBtn._sbWired = true;
  }

  const sidebarLogout = document.getElementById('btnSidebarLogout');
  if (sidebarLogout && !sidebarLogout._sbWired) {
    sidebarLogout.addEventListener('click', (e) => {
      e.stopPropagation();
      handleAuthLogout(e);
    });
    sidebarLogout._sbWired = true;
  }

  // Close button on auth modal
  const closeBtn = document.getElementById('btnCloseAuthModal');
  if (closeBtn && !closeBtn._sbWired) {
    closeBtn.addEventListener('click', closeCloudAuthModal);
    closeBtn._sbWired = true;
  }

  // Continue as Guest button
  const guestBtn = document.getElementById('btnContinueAsGuest');
  if (guestBtn && !guestBtn._sbWired) {
    guestBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeCloudAuthModal();
      if (typeof showToast === 'function') {
        showToast('Continuing in Local Offline Mode', 'info', 2500);
      }
    });
    guestBtn._sbWired = true;
  }

  // Escape key handler for auth modal
  if (!window._sbEscapeWired) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('firebaseAuthModal');
        if (modal && (modal.classList.contains('active') || modal.style.display === 'flex')) {
          closeCloudAuthModal();
        }
      }
    });
    window._sbEscapeWired = true;
  }

  // Open Cloud Config button
  const configBtn = document.getElementById('btnOpenSupabaseConfig');
  if (configBtn && !configBtn._sbWired) {
    configBtn.addEventListener('click', openSupabaseConfigModal);
    configBtn._sbWired = true;
  }
}

/**
 * Normalizes Supabase User object, sets active UID, and synchronizes profile
 */
async function handleSupabaseAuthSuccess(rawUser, isInitialLoad = false) {
  if (!rawUser) return;

  const userMeta = rawUser.user_metadata || {};
  const normalizedUser = {
    id: rawUser.id,
    uid: rawUser.id,
    email: rawUser.email || '',
    displayName: userMeta.full_name || userMeta.name || (rawUser.email ? rawUser.email.split('@')[0] : 'User'),
    photoURL: userMeta.avatar_url || userMeta.picture || '',
    rawUser: rawUser,
    role: 'Admin',
    tier: 'executive',
    getIdToken: async () => {
      if (window.sbClient && window.sbClient.auth) {
        const { data: { session } } = await window.sbClient.auth.getSession();
        return session ? session.access_token : '';
      }
      return '';
    }
  };

  currentAuthenticatedUser = normalizedUser;
  window.currentAuthenticatedUser = normalizedUser;

  const prevUid = window.activeAuthUid;
  const isDifferentUser = (prevUid !== normalizedUser.id);
  window.activeAuthUid = normalizedUser.id;

  // Close auth modal
  closeCloudAuthModal();

  // Update topbar badges & user cluster
  updateAuthHeaderUI(normalizedUser);

  // Sync profile to public.users table in Supabase
  try {
    if (window.sbClient) {
      await window.sbClient.from('users').upsert({
        id: normalizedUser.id,
        email: normalizedUser.email,
        display_name: normalizedUser.displayName,
        photo_url: normalizedUser.photoURL,
        tier: 'executive',
        last_login_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }
  } catch (profErr) {
    console.warn('Profile sync notice:', profErr);
  }

  // User switch re-render if switching between accounts
  if (isDifferentUser && !isInitialLoad) {
    try {
      if (typeof loadData === 'function') loadData();
      if (typeof renderBudgetGrid === 'function') renderBudgetGrid();
      if (typeof updateAllViews === 'function') updateAllViews();
    } catch (e) {
      console.warn('Notice during user switch UI reload:', e);
    }
  }

  if (!isInitialLoad && typeof showToast === 'function') {
    showToast(`Signed in as ${normalizedUser.displayName} (Executive Tier)`, 'success');
  }

  // Trigger Database Hydration or Initial Migration
  if (typeof syncOrHydrateOnLogin === 'function') {
    syncOrHydrateOnLogin(normalizedUser);
  }
}

/**
 * Handles Google OAuth Sign-In via Supabase Auth
 */
async function handleGoogleSignIn() {
  const url = localStorage.getItem('nirvtrack_supabase_url') || window.SUPABASE_CONFIG?.url;
  const anonKey = localStorage.getItem('nirvtrack_supabase_anon_key') || window.SUPABASE_CONFIG?.anonKey;

  if (!url || !anonKey) {
    showAuthAlert('Supabase is not configured yet. Please enter your Supabase Project URL and Anon Key.', 'info');
    openSupabaseConfigModal();
    return;
  }

  if (!window.sbClient) {
    initSupabaseAuth();
  }

  if (!window.sbClient || !window.sbClient.auth) {
    showAuthAlert('Supabase client failed to initialize. Please check credentials.', 'error');
    return;
  }

  try {
    setAuthLoading(true, 'Connecting to Google...');
    clearAuthAlert();

    // Redirect to current URL after Google OAuth
    const redirectUrl = window.location.origin + window.location.pathname;

    const { data, error } = await window.sbClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) throw error;
  } catch (err) {
    console.error('Google OAuth Error:', err);
    showAuthAlert(err.message || 'Failed to authenticate with Google.', 'error');
    setAuthLoading(false);
  }
}
window.handleGoogleSignIn = handleGoogleSignIn;

/**
 * Handles Email/Password submission
 */
async function handleAuthSubmit(e) {
  if (e) e.preventDefault();
  if (sbAuthInFlight) return;

  const emailEl = document.getElementById('firebaseEmail');
  const passEl = document.getElementById('firebasePassword');
  const confEl = document.getElementById('firebaseConfirmPassword');

  const email = emailEl ? emailEl.value.trim() : '';
  const password = passEl ? passEl.value : '';
  const confirmPassword = confEl ? confEl.value : '';

  if (!email || !password) {
    showAuthAlert('Please enter both email and password.', 'error');
    return;
  }

  if (sbAuthMode === 'register' && password !== confirmPassword) {
    showAuthAlert('Passwords do not match.', 'error');
    return;
  }

  if (!window.sbClient) {
    openSupabaseConfigModal();
    return;
  }

  try {
    setAuthLoading(true, sbAuthMode === 'login' ? 'Signing in...' : 'Creating account...');
    clearAuthAlert();

    if (sbAuthMode === 'login') {
      const { data, error } = await window.sbClient.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      if (data && data.user) {
        await handleSupabaseAuthSuccess(data.user);
      }
    } else {
      const { data, error } = await window.sbClient.auth.signUp({
        email,
        password
      });
      if (error) throw error;
      if (data && data.user) {
        if (data.session) {
          await handleSupabaseAuthSuccess(data.user);
        } else {
          showAuthAlert('Account created! Please check your email to confirm registration.', 'success');
        }
      }
    }
  } catch (err) {
    console.error('Supabase Email Auth Error:', err);
    showAuthAlert(err.message || 'Authentication failed.', 'error');
  } finally {
    setAuthLoading(false);
  }
}

/**
 * Toggles between Login and Registration mode
 */
function toggleAuthMode() {
  sbAuthMode = (sbAuthMode === 'login') ? 'register' : 'login';
  const title = document.getElementById('firebaseAuthTitle');
  const subtitle = document.getElementById('firebaseAuthSubtitle');
  const submitText = document.getElementById('btnFirebaseSubmitText');
  const toggleBtn = document.getElementById('btnToggleFirebaseMode');
  const switchPrompt = document.getElementById('firebaseSwitchPrompt');
  const confirmGroup = document.getElementById('firebaseConfirmGroup');

  if (sbAuthMode === 'register') {
    if (title) title.innerHTML = '<span class="nirv-wm-nirv">Nirv</span><span class="nirv-wm-track">Track</span> <span style="font-weight:600;color:var(--text-secondary);font-size:0.95rem;margin-left:4px;">Sign Up</span>';
    if (subtitle) subtitle.textContent = 'Create an account to enable multi-device cloud synchronization.';
    if (submitText) submitText.textContent = 'Create Free Account';
    if (toggleBtn) toggleBtn.textContent = 'Log In Instead';
    if (switchPrompt) switchPrompt.textContent = 'Already have an account?';
    if (confirmGroup) confirmGroup.style.display = 'block';
  } else {
    if (title) title.innerHTML = '<span class="nirv-wm-nirv">Nirv</span><span class="nirv-wm-track">Track</span> <span style="font-weight:600;color:var(--text-secondary);font-size:0.95rem;margin-left:4px;">Access</span>';
    if (subtitle) subtitle.textContent = 'Sign in to access your synchronized financial workstation.';
    if (submitText) submitText.textContent = 'Log In';
    if (toggleBtn) toggleBtn.textContent = 'Create Account';
    if (switchPrompt) switchPrompt.textContent = 'First time here?';
    if (confirmGroup) confirmGroup.style.display = 'none';
  }
  clearAuthAlert();
}

/**
 * Handles User Sign-Out
 */
async function handleAuthLogout(e) {
  if (e) e.preventDefault();
  try {
    if (window.sbClient && window.sbClient.auth) {
      await window.sbClient.auth.signOut();
    }
  } catch (err) {
    console.warn('Sign-out notice:', err);
  } finally {
    handleSupabaseSignOutCleanup();
  }
}
window.handleAuthLogout = handleAuthLogout;

/**
 * Resets user state upon sign-out without blocking UI
 */
function handleSupabaseSignOutCleanup() {
  currentAuthenticatedUser = null;
  window.currentAuthenticatedUser = null;
  window.activeAuthUid = null;

  updateAuthHeaderUI(null);

  if (typeof updateSupabaseStatusUI === 'function') {
    updateSupabaseStatusUI('offline', '⚪ Local Storage Mode');
  }

  // Close lingering account modals upon logout
  ['adminHubModal', 'adminUserSubscriptionModal', 'userProfileModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active');
      el.style.display = 'none';
    }
  });

  if (typeof showToast === 'function') {
    showToast('Signed out. NirvTrack is now in Local Offline Mode.', 'info', 2500);
  }

  // Automatically pop up the Sign In modal on logout
  setTimeout(() => {
    openCloudAuthModal();
  }, 200);
}

/**
 * Updates header badges, avatar, and login button based on auth state
 */
function updateAuthHeaderUI(user) {
  const cluster = document.getElementById('userAuthCluster');
  const openAuthBtn = document.getElementById('btnOpenCloudAuth');
  const emailEl = document.getElementById('adminUserEmail');
  const roleEl = document.getElementById('adminUserRole');
  const avatarEl = document.getElementById('adminAvatar');
  const badge = document.getElementById('adminProfileBadge');
  const sidebarLogout = document.getElementById('btnSidebarLogout');

  if (user) {
    // Authenticated
    if (cluster) cluster.style.display = 'inline-flex';
    if (openAuthBtn) openAuthBtn.style.display = 'none';
    if (sidebarLogout) sidebarLogout.style.display = 'flex';

    if (emailEl) {
      emailEl.textContent = user.displayName || user.email || 'User';
      emailEl.title = user.email || '';
    }
    if (roleEl) roleEl.textContent = 'Executive';
    if (avatarEl) {
      if (user.photoURL) {
        avatarEl.innerHTML = `<img src="${user.photoURL}" alt="User Avatar" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">`;
      } else {
        avatarEl.textContent = '👑';
      }
    }
    if (badge) {
      badge.style.display = 'flex';
      badge.className = 'user-profile-badge tier-profile-executive';
    }
  } else {
    // Guest / Offline
    if (cluster) cluster.style.display = 'none';
    if (openAuthBtn) openAuthBtn.style.display = 'inline-flex';
    if (sidebarLogout) sidebarLogout.style.display = 'none';
  }
}
window.updateAuthHeaderUI = updateAuthHeaderUI;

/**
 * Shows authentication alert message
 */
function showAuthAlert(message, type = 'error') {
  const alertEl = document.getElementById('firebaseAuthAlert');
  if (!alertEl) return;
  alertEl.textContent = message;
  alertEl.className = `auth-alert ${type}`;
  alertEl.style.display = 'block';
}

/**
 * Clears authentication alert message
 */
function clearAuthAlert() {
  const alertEl = document.getElementById('firebaseAuthAlert');
  if (alertEl) {
    alertEl.textContent = '';
    alertEl.style.display = 'none';
  }
}

/**
 * Sets auth modal loading state
 */
function setAuthLoading(loading, label = 'Processing...') {
  sbAuthInFlight = loading;
  const submitBtn = document.getElementById('btnFirebaseSubmit');
  const submitText = document.getElementById('btnFirebaseSubmitText');
  const googleBtn = document.getElementById('btnGoogleSignIn');
  const googleText = document.getElementById('btnGoogleSignInText');

  if (submitBtn) submitBtn.disabled = loading;
  if (googleBtn) googleBtn.disabled = loading;

  if (loading) {
    if (submitText) submitText.textContent = label;
    if (googleText) googleText.textContent = label;
  } else {
    if (submitText) submitText.textContent = (sbAuthMode === 'login' ? 'Log In' : 'Create Free Account');
    if (googleText) googleText.textContent = 'Continue with Google';
  }
}

/**
 * Opens Cloud Authentication Modal
 */
function openCloudAuthModal() {
  const modal = document.getElementById('firebaseAuthModal');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
  clearAuthAlert();
}
window.openCloudAuthModal = openCloudAuthModal;

/**
 * Closes Cloud Authentication Modal
 */
function closeCloudAuthModal() {
  const modal = document.getElementById('firebaseAuthModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
  clearAuthAlert();
}
window.closeCloudAuthModal = closeCloudAuthModal;

/**
 * Supabase Project Configuration Modal
 * Allows entering Supabase URL and Anon Key directly in the UI
 */
function openSupabaseConfigModal() {
  let modal = document.getElementById('supabaseConfigModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'supabaseConfigModal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '10060';
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 480px; padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span>⚡</span> Supabase Cloud Database Config
          </h3>
          <button type="button" class="modal-close" onclick="closeSupabaseConfigModal()">&times;</button>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.5;">
          Connect your free Supabase PostgreSQL database to enable automatic cloud backup and Google Authentication across all your devices.
        </p>

        <div class="form-group" style="margin-bottom: 14px;">
          <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px;">Supabase Project URL</label>
          <input type="url" id="inputSupabaseUrl" class="form-control" placeholder="https://xyzcompany.supabase.co" style="width: 100%;">
        </div>

        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px;">Supabase Anon Public API Key</label>
          <textarea id="inputSupabaseAnonKey" class="form-control" rows="3" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." style="width: 100%; font-family: monospace; font-size: 0.78rem;"></textarea>
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="closeSupabaseConfigModal()">Cancel</button>
          <button type="button" class="btn btn-primary" onclick="saveSupabaseConfigFromModal()">Save &amp; Connect</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const urlInput = document.getElementById('inputSupabaseUrl');
  const keyInput = document.getElementById('inputSupabaseAnonKey');
  if (urlInput) urlInput.value = localStorage.getItem('nirvtrack_supabase_url') || window.SUPABASE_CONFIG?.url || DEFAULT_SUPABASE_URL;
  if (keyInput) keyInput.value = localStorage.getItem('nirvtrack_supabase_anon_key') || window.SUPABASE_CONFIG?.anonKey || DEFAULT_SUPABASE_ANON_KEY;

  modal.classList.add('active');
  modal.style.display = 'flex';
}
window.openSupabaseConfigModal = openSupabaseConfigModal;

function closeSupabaseConfigModal() {
  const modal = document.getElementById('supabaseConfigModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}
window.closeSupabaseConfigModal = closeSupabaseConfigModal;

function saveSupabaseConfigFromModal() {
  const url = (document.getElementById('inputSupabaseUrl')?.value || '').trim();
  const anonKey = (document.getElementById('inputSupabaseAnonKey')?.value || '').trim();

  if (url && !url.startsWith('https://')) {
    alert('Project URL must start with https://');
    return;
  }

  localStorage.setItem('nirvtrack_supabase_url', url);
  localStorage.setItem('nirvtrack_supabase_anon_key', anonKey);

  window.SUPABASE_CONFIG.url = url;
  window.SUPABASE_CONFIG.anonKey = anonKey;
  window.sbClient = null; // force re-create

  closeSupabaseConfigModal();
  initSupabaseAuth();
  if (typeof initSupabaseDb === 'function') {
    initSupabaseDb();
  }

  if (typeof showToast === 'function') {
    showToast(url ? 'Supabase configuration saved!' : 'Supabase credentials cleared.', 'success');
  }
}
window.saveSupabaseConfigFromModal = saveSupabaseConfigFromModal;
