/**
 * ==========================================================================
 * [FEAT-MODULAR-DOMAIN] NIRVTRACK AI COPILOT & AUTOMATION ENGINE
 * Domain Module: ai-copilot-engine.js
 * Encapsulates: Gemini API, FAQ Copilot, Feature Wishlist Hub,
 * Multi-Item NLP Commands, Gmail & Bank Alert Transaction Scanner.
 * ==========================================================================
 */

// ==========================================================================
// 46. [FEAT-61] AI-POWERED FAQ COPILOT (BYOK GOOGLE GEMINI)
//     [FEAT-62] AI FEATURE RECOMMENDATION COLLECTOR & ADMIN WISHLIST HUB
// ==========================================================================

const STORAGE_GEMINI_API_KEY = 'budget_master_gemini_api_key';
const STORAGE_GEMINI_MODEL = 'budget_master_gemini_model';
const STORAGE_FEATURE_WISHLIST = 'budget_master_feature_wishlist';

// Default App AI Engine credentials operated securely via serverless Cloudflare proxy (/api/ai-chat)
const DEFAULT_APP_GEMINI_KEY = 'server-proxy';
const DEFAULT_APP_GEMINI_MODEL = 'gemini-3.8-flash';

let faqAiConversationHistory = [];
let cachedFeatureWishlist = [];
let pendingRecommendationsMap = {};

/**
 * Default seeded AI-gathered wishlist items so the Admin Wishlist & Ranking Hub
 * is immediately populated for demonstration and ranking tests.
 */
function getInitialSeededWishlist() {
  return [
    {
      id: 'wish_seed_ocr_receipts',
      title: 'Camera Receipt OCR Scanner & Auto-Itemizer',
      description: 'Allow users to snap a photo of a paper receipt using their phone or webcam and automatically extract merchant name, date, and total amount into the Expense Tracker.',
      category: 'Automation & AI',
      source: 'NirvTrack AI',
      userQuery: 'Can I scan paper receipts with my phone camera so I do not have to type them?',
      requestedByEmail: 'maria.santos@gmail.com',
      requestedByName: 'Maria Santos',
      requestedByUid: 'usr_sample_pro_01',
      userTier: 'pro',
      createdAt: '2026-10-14T09:20:00.000Z',
      updatedAt: '2026-10-14T09:20:00.000Z',
      votes: 7,
      rank: 1,
      status: 'planned',
      adminNotes: 'High-value Pro/Executive automation feature.'
    },
    {
      id: 'wish_seed_bank_plaid_sync',
      title: 'Direct Open-Banking / Plaid Live Transaction Sync',
      description: 'Connect bank accounts and credit cards directly for automatic background transaction syncing alongside the existing CSV Bank Statement Importer.',
      category: 'Cloud & Integrations',
      source: 'NirvTrack AI',
      userQuery: 'Does NirvTrack link directly to my bank account automatically without CSV?',
      requestedByEmail: 'alex.chen.cfo@outlook.com',
      requestedByName: 'Alex Chen',
      requestedByUid: 'usr_sample_exec_02',
      userTier: 'executive',
      createdAt: '2026-10-15T14:45:00.000Z',
      updatedAt: '2026-10-15T14:45:00.000Z',
      votes: 5,
      rank: 2,
      status: 'review',
      adminNotes: 'Evaluating API costs vs BYOK bank webhooks.'
    },
    {
      id: 'wish_seed_shared_family_ws',
      title: 'Shared Partner / Family Multi-User Collaborative Workspace',
      description: 'Invite a spouse or business partner via email to collaborate on a single shared Workspace in real time with role permissions.',
      category: 'Cloud & Integrations',
      source: 'Direct User Request',
      userQuery: 'How can my wife and I share the same household workspace from two different Google accounts?',
      requestedByEmail: 'david.reyes@yahoo.com',
      requestedByName: 'David Reyes',
      requestedByUid: 'usr_sample_free_03',
      userTier: 'free',
      createdAt: '2026-10-16T18:10:00.000Z',
      updatedAt: '2026-10-16T18:10:00.000Z',
      votes: 4,
      rank: 3,
      status: 'review',
      adminNotes: ''
    }
  ];
}

/**
 * Loads the feature wishlist from LocalStorage and merges with Cloud Firestore (/feature_wishlist) if online.
 */
async function loadFeatureWishlist() {
  let localList = [];
  try {
    const raw = localStorage.getItem(STORAGE_FEATURE_WISHLIST);
    if (raw) {
      localList = JSON.parse(raw);
    } else {
      localList = getInitialSeededWishlist();
      localStorage.setItem(STORAGE_FEATURE_WISHLIST, JSON.stringify(localList));
    }
  } catch (e) {
    localList = getInitialSeededWishlist();
  }

  const mapById = {};
  localList.forEach(item => {
    if (item && item.id) mapById[item.id] = item;
  });

  // Merge from Cloud Firestore if authenticated and connected
  const activeDb = (typeof window !== 'undefined' && window.fbDb) ? window.fbDb : (typeof fbDb !== 'undefined' && fbDb ? fbDb : null);
  const currentUser = (typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser)
    ? fbAuth.currentUser
    : (typeof currentAuthenticatedUser !== 'undefined' ? currentAuthenticatedUser : null);

  if (activeDb && currentUser) {
    try {
      const snap = await Promise.race([
        activeDb.collection('feature_wishlist').limit(150).get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Wishlist sync timeout')), 5000))
      ]);
      if (snap && !snap.empty) {
        snap.forEach(doc => {
          const data = doc.data() || {};
          const id = data.id || doc.id;
          mapById[id] = {
            ...mapById[id],
            ...data,
            id
          };
        });
        // Persist merged list locally
        try {
          localStorage.setItem(STORAGE_FEATURE_WISHLIST, JSON.stringify(Object.values(mapById)));
        } catch (err) {}
      }
    } catch (err) {
      // Quietly fall back to local wishlist if offline or rules not yet deployed
    }
  }

  cachedFeatureWishlist = Object.values(mapById);
  updateAdminWishlistCountBadge();
  return cachedFeatureWishlist;
}

function saveFeatureWishlistLocally() {
  try {
    localStorage.setItem(STORAGE_FEATURE_WISHLIST, JSON.stringify(cachedFeatureWishlist));
  } catch (e) {}
  updateAdminWishlistCountBadge();
}

function updateAdminWishlistCountBadge() {
  const badge = document.getElementById('adminWishlistCountBadge');
  if (!badge) return;
  if (!cachedFeatureWishlist || cachedFeatureWishlist.length === 0) {
    try {
      const raw = localStorage.getItem(STORAGE_FEATURE_WISHLIST);
      cachedFeatureWishlist = raw ? JSON.parse(raw) : getInitialSeededWishlist();
    } catch (e) {
      cachedFeatureWishlist = getInitialSeededWishlist();
    }
  }
  badge.textContent = String(cachedFeatureWishlist.length);
}

let userFaqDockPreference = true; // Default to Bottom-Right Docked across all 3 tabs (Browse, Ask AI, Recommend) unless toggled to Center View

function updateFaqWindowControlsUI() {
  const faqModal = document.getElementById('faqModal');
  if (!faqModal) return;
  const isDockedRight = faqModal.classList.contains('faq-docked-right');
  const isExpandedWide = faqModal.classList.contains('faq-expanded-wide');

  const btnDock = document.getElementById('btnFaqDockRightToggle');
  const dockIcon = document.getElementById('faqDockToggleIcon');
  const dockLabel = document.getElementById('faqDockToggleLabel');
  if (btnDock) {
    btnDock.classList.toggle('active', isDockedRight);
  }
  if (dockIcon) dockIcon.textContent = isDockedRight ? '🎯' : '↘️';
  if (dockLabel) dockLabel.textContent = isDockedRight ? 'Center View' : 'Bottom-Right';

  const btnExpand = document.getElementById('btnFaqExpandToggle');
  const expIcon = document.getElementById('faqExpandToggleIcon');
  const expLabel = document.getElementById('faqExpandToggleLabel');
  if (btnExpand) {
    btnExpand.classList.toggle('active', isExpandedWide);
  }
  if (expIcon) expIcon.textContent = isExpandedWide ? '⤡' : '⤢';
  if (expLabel) expLabel.textContent = isExpandedWide ? 'Compact' : 'Expand';
}

/**
 * Switches between the 3 tabs inside #faqModal:
 * 'browse' | 'ai' | 'request'
 */
function switchFaqMode(mode) {
  const faqModal = document.getElementById('faqModal');
  if (faqModal) {
    faqModal.setAttribute('data-active-mode', mode);
    faqModal.classList.toggle('faq-docked-right', userFaqDockPreference !== false);
    updateFaqWindowControlsUI();
  }

  const buttons = document.querySelectorAll('#faqModeSwitcher .faq-mode-btn');
  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-faq-mode') === mode);
  });

  const browseToolbar = document.getElementById('faqBrowseToolbar');
  const accordionList = document.getElementById('faqAccordionList');
  const aiPanel = document.getElementById('faqAiCopilotPanel');
  const reqPanel = document.getElementById('faqFeatureRequestPanel');

  if (browseToolbar) browseToolbar.style.display = mode === 'browse' ? 'block' : 'none';
  if (accordionList) accordionList.style.display = mode === 'browse' ? 'block' : 'none';
  if (aiPanel) aiPanel.style.display = mode === 'ai' ? 'flex' : 'none';
  if (reqPanel) reqPanel.style.display = mode === 'request' ? 'flex' : 'none';

  if (mode === 'ai') {
    updateFaqAiKeyUI();
    loadFaqChatHistory();
    renderFaqAiChatHistory();
    // Automatically check Cloud Firestore profile or clipboard silently when opening AI Copilot tab
    const existingKey = (localStorage.getItem(STORAGE_GEMINI_API_KEY) || '').trim();
    if (!existingKey) {
      tryAutoPullOrGrabGeminiKey({ silent: true, openStudioIfMissing: false });
    }
    const qInput = document.getElementById('faqAiQuestionInput');
    if (qInput) setTimeout(() => qInput.focus(), 80);
  } else if (mode === 'request') {
    const adminBtn = document.getElementById('btnFaqOpenAdminWishlist');
    const isAdmin = (typeof isCurrentUserAdmin === 'function') ? isCurrentUserAdmin() : false;
    if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    renderUserWishlistPreview();
  }
}

const MAX_FAQ_CHAT_HISTORY = 24;

/**
 * Loads the current user's persistent FAQ AI conversation history from UID-scoped localStorage.
 */
function loadFaqChatHistory() {
  try {
    const key = typeof getFaqChatHistoryStorageKey === 'function'
      ? getFaqChatHistoryStorageKey()
      : 'budgetMaster_guest_faqChatHistory';
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        faqAiConversationHistory = parsed.slice(-MAX_FAQ_CHAT_HISTORY);
        return faqAiConversationHistory;
      }
    }
  } catch (e) {}
  faqAiConversationHistory = [];
  return faqAiConversationHistory;
}

/**
 * Saves the current user's FAQ AI conversation history to UID-scoped localStorage
 * and syncs it to their private Cloud Firestore profile inside workspaceContainers._aiCopilotMeta.
 */
function saveFaqChatHistory(syncToCloud = true) {
  try {
    faqAiConversationHistory = (faqAiConversationHistory || []).slice(-MAX_FAQ_CHAT_HISTORY);
    const key = typeof getFaqChatHistoryStorageKey === 'function'
      ? getFaqChatHistoryStorageKey()
      : 'budgetMaster_guest_faqChatHistory';
    localStorage.setItem(key, JSON.stringify(faqAiConversationHistory));
  } catch (e) {}

  if (syncToCloud) {
    try {
      const activeDb = (typeof window !== 'undefined' && window.fbDb) ? window.fbDb : (typeof fbDb !== 'undefined' && fbDb ? fbDb : null);
      const currentUser = (typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser)
        ? fbAuth.currentUser
        : (typeof currentAuthenticatedUser !== 'undefined' ? currentAuthenticatedUser : null);
      if (activeDb && currentUser && currentUser.uid) {
        activeDb.collection('users').doc(currentUser.uid).set({
          workspaceContainers: {
            _aiCopilotMeta: {
              geminiApiKey: (localStorage.getItem(STORAGE_GEMINI_API_KEY) || '').trim(),
              geminiModel: localStorage.getItem(STORAGE_GEMINI_MODEL) || 'auto',
              faqChatHistory: faqAiConversationHistory.slice(-MAX_FAQ_CHAT_HISTORY),
              updatedAt: new Date().toISOString()
            }
          }
        }, { merge: true }).catch(() => {});
      }
    } catch (e) {}
  }
}

function getSavedFaqChatHistoryForCloud() {
  if (!Array.isArray(faqAiConversationHistory) || faqAiConversationHistory.length === 0) {
    loadFaqChatHistory();
  }
  return (faqAiConversationHistory || []).slice(-MAX_FAQ_CHAT_HISTORY);
}
window.getSavedFaqChatHistoryForCloud = getSavedFaqChatHistoryForCloud;

/**
 * Restores a user's FAQ AI conversation history from Cloud Firestore on login / cross-device sync.
 */
function restoreFaqChatHistoryFromCloud(cloudHistory) {
  if (!Array.isArray(cloudHistory) || cloudHistory.length === 0) return;
  loadFaqChatHistory();
  // Merge by timestamp/content or prefer whichever has more recent turns
  if (cloudHistory.length >= faqAiConversationHistory.length) {
    faqAiConversationHistory = cloudHistory.slice(-MAX_FAQ_CHAT_HISTORY);
    saveFaqChatHistory(false);
    const chatStream = document.getElementById('faqAiChatStream');
    if (chatStream) {
      renderFaqAiChatHistory();
    }
  }
}
window.restoreFaqChatHistoryFromCloud = restoreFaqChatHistoryFromCloud;

let isAutoKeyRadarActive = false;
let autoKeyPopupRef = null;
let autoKeyPollTimer = null;

/**
 * Extracts a valid Google Gemini API key (AIza...) or Google OAuth/Account token (AQ..., ya29...) from any raw text.
 */
function extractValidGeminiKey(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  const match = rawText.match(/(?:AIza[0-9A-Za-z\-_]{29,45}|AQ\.[0-9A-Za-z\-_.]{20,180}|ya29\.[0-9A-Za-z\-_.]{20,250})/);
  if (match && match[0]) return match[0].trim();
  const trimmed = rawText.trim();
  if (trimmed.length >= 20 && !/\s/.test(trimmed)) {
    return trimmed;
  }
  return '';
}

/**
 * Ensures that whenever a user is logged in, the backend automatically populates and connects
 * their AI key/token so they never have to manually copy and paste.
 */
function ensureAutoProvisionedAiKey() {
  let savedKey = (localStorage.getItem(STORAGE_GEMINI_API_KEY) || '').trim();
  // Clean legacy exposed key if present in local storage
  if (savedKey && savedKey.startsWith('AQ.Ab8RN6')) {
    localStorage.removeItem(STORAGE_GEMINI_API_KEY);
    savedKey = '';
  }
  const keyInput = document.getElementById('faqGeminiApiKeyInput');
  if (keyInput) {
    if (savedKey) {
      keyInput.value = savedKey;
    } else {
      keyInput.placeholder = '⚡ Dedicated NirvTrack AI Active (Cloud Edge)';
    }
  }
  return savedKey || DEFAULT_APP_GEMINI_KEY;
}

/**
 * Saves the Gemini API Key locally, updates the UI immediately, and syncs it to the user's
 * private /users/{uid} Cloud Firestore profile so future logins auto-pull it on any device.
 */
function saveAndSyncGeminiKey(rawKey, sourceLabel = 'Connected') {
  const cleanKey = extractValidGeminiKey(rawKey) || String(rawKey || '').trim();
  if (!cleanKey || cleanKey.length < 15) return false;

  const modelSel = document.getElementById('faqGeminiModelSelect');
  const chosenModel = modelSel ? modelSel.value : (localStorage.getItem(STORAGE_GEMINI_MODEL) || 'auto');

  localStorage.setItem(STORAGE_GEMINI_API_KEY, cleanKey);
  localStorage.setItem(STORAGE_GEMINI_MODEL, chosenModel);

  const keyInput = document.getElementById('faqGeminiApiKeyInput');
  if (keyInput) keyInput.value = cleanKey;

  stopAutoKeyGrabberRadar();
  updateFaqAiKeyUI(false);

  // Sync to logged-in user's private Cloud Firestore profile (/users/{uid}) inside workspaceContainers._aiCopilotMeta
  try {
    const activeDb = (typeof window !== 'undefined' && window.fbDb) ? window.fbDb : (typeof fbDb !== 'undefined' && fbDb ? fbDb : null);
    const currentUser = (typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser)
      ? fbAuth.currentUser
      : (typeof currentAuthenticatedUser !== 'undefined' ? currentAuthenticatedUser : null);
    if (activeDb && currentUser && currentUser.uid) {
      activeDb.collection('users').doc(currentUser.uid).set({
        workspaceContainers: {
          _aiCopilotMeta: {
            geminiApiKey: cleanKey,
            geminiModel: chosenModel,
            faqChatHistory: getSavedFaqChatHistoryForCloud(),
            updatedAt: new Date().toISOString()
          }
        }
      }, { merge: true }).catch(() => {});
    }
  } catch (e) {}

  if (typeof showToast === 'function') {
    showToast(`🟢 Google Gemini AI Key ${sourceLabel}! Saved to your account ($0 cost).`);
  }
  return true;
}

function stopAutoKeyGrabberRadar() {
  isAutoKeyRadarActive = false;
  if (autoKeyPollTimer) {
    clearInterval(autoKeyPollTimer);
    autoKeyPollTimer = null;
  }
  const radarBanner = document.getElementById('faqAiAutoRadarBanner');
  if (radarBanner) radarBanner.style.display = 'none';
}

/**
 * Automatically checks:
 * 1) User's private Cloud Firestore /users/{uid} profile (if logged in)
 * 2) User's system clipboard (for an AIzaSy... or AQ... key they just copied)
 * 3) Auto-provisions from their active login session if none found
 */
async function tryAutoPullOrGrabGeminiKey({ silent = false, openStudioIfMissing = false } = {}) {
  // 1. Check if key is already in input box or localStorage
  const keyInputEl = document.getElementById('faqGeminiApiKeyInput');
  if (keyInputEl && keyInputEl.value && extractValidGeminiKey(keyInputEl.value) && !openStudioIfMissing) {
    saveAndSyncGeminiKey(keyInputEl.value, 'Auto-Connected');
    return true;
  }

  const currentLocal = extractValidGeminiKey(localStorage.getItem(STORAGE_GEMINI_API_KEY) || '');
  if (currentLocal && !openStudioIfMissing) {
    updateFaqAiKeyUI(false);
    return true;
  }

  // 2. Check logged-in user's Cloud Firestore /users/{uid} document
  try {
    const activeDb = (typeof window !== 'undefined' && window.fbDb) ? window.fbDb : (typeof fbDb !== 'undefined' && fbDb ? fbDb : null);
    const currentUser = (typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser)
      ? fbAuth.currentUser
      : (typeof currentAuthenticatedUser !== 'undefined' ? currentAuthenticatedUser : null);
    if (activeDb && currentUser && currentUser.uid) {
      const docSnap = await activeDb.collection('users').doc(currentUser.uid).get();
      if (docSnap && docSnap.exists) {
        const data = docSnap.data() || {};
        const aiMeta = (data.workspaceContainers && data.workspaceContainers._aiCopilotMeta) || {};
        const cloudKey = extractValidGeminiKey(aiMeta.geminiApiKey || data.geminiApiKey || '');
        if (Array.isArray(aiMeta.faqChatHistory) && aiMeta.faqChatHistory.length > 0) {
          restoreFaqChatHistoryFromCloud(aiMeta.faqChatHistory);
        }
        if (cloudKey) {
          saveAndSyncGeminiKey(cloudKey, 'Auto-Pulled from Your Account');
          return true;
        }
      }
    }
  } catch (cloudErr) {}

  // 3. Check Clipboard for an AIzaSy... or AQ... key
  if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
    try {
      const clipText = await navigator.clipboard.readText();
      const clipKey = extractValidGeminiKey(clipText);
      if (clipKey) {
        saveAndSyncGeminiKey(clipKey, 'Auto-Grabbed from Clipboard');
        try {
          if (autoKeyPopupRef && !autoKeyPopupRef.closed) {
            autoKeyPopupRef.close();
          }
        } catch (e) {}
        return true;
      }
    } catch (clipErr) {
      // Clipboard read permission not granted yet or no focus
    }
  }

  // 4. If user clicked "1-Click Auto-Get & Grab Key", open Google AI Studio popup and start Radar
  if (openStudioIfMissing) {
    const radarBanner = document.getElementById('faqAiAutoRadarBanner');
    if (radarBanner) radarBanner.style.display = 'flex';
    isAutoKeyRadarActive = true;

    const width = 960;
    const height = 700;
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));
    autoKeyPopupRef = window.open(
      'https://aistudio.google.com/app/apikey',
      'GoogleAIStudioKeyPopup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (typeof showToast === 'function') {
      showToast('📡 Auto-Grab Radar Active! Click "Copy API key" in the Google window and return here.');
    }

    if (autoKeyPollTimer) clearInterval(autoKeyPollTimer);
    autoKeyPollTimer = setInterval(async () => {
      if (!isAutoKeyRadarActive) {
        clearInterval(autoKeyPollTimer);
        return;
      }
      if (document.hasFocus()) {
        await tryAutoPullOrGrabGeminiKey({ silent: true, openStudioIfMissing: false });
      }
    }, 1500);
    return false;
  }

  // 5. Fallback: Auto-provision from login session so the user never gets stuck
  const provisioned = ensureAutoProvisionedAiKey();
  if (provisioned) {
    updateFaqAiKeyUI(false);
    return true;
  }

  return false;
}

/**
 * Updates the API Key setup card vs. connected bar inside the FAQ AI Copilot panel.
 * Automatically provisions & pre-pastes the key on login so the setup card stays hidden by default.
 */
function updateFaqAiKeyUI(forceShowEdit = false) {
  const savedKey = ensureAutoProvisionedAiKey();
  const savedModel = localStorage.getItem(STORAGE_GEMINI_MODEL) || 'auto';
  const isAdmin = (typeof isCurrentUserAdmin === 'function') ? isCurrentUserAdmin() : false;

  const setupCard = document.getElementById('faqAiSetupCard');
  const connectedBar = document.getElementById('faqAiConnectedBar');
  const statusBadge = document.getElementById('faqAiStatusBadge');
  const maskedLabel = document.getElementById('faqAiMaskedKeyLabel');
  const keyInput = document.getElementById('faqGeminiApiKeyInput');
  const modelSelect = document.getElementById('faqGeminiModelSelect');
  const activeModelSelect = document.getElementById('faqGeminiActiveModelSelect');
  const cancelBtn = document.getElementById('btnCancelGeminiKeyEdit');

  if (modelSelect) modelSelect.value = savedModel;
  if (activeModelSelect) activeModelSelect.value = savedModel;
  if (keyInput && savedKey) keyInput.value = savedKey;

  // Hide Gemini API key settings bar & setup card from non-Admin users
  if (!isAdmin) {
    stopAutoKeyGrabberRadar();
    if (setupCard) setupCard.style.display = 'none';
    if (connectedBar) connectedBar.style.display = 'none';
    if (statusBadge) {
      statusBadge.textContent = savedKey ? '🟢 Gemini Live' : 'Google AI • $0';
      statusBadge.classList.toggle('connected', Boolean(savedKey));
    }
    return;
  }

  if (savedKey && !forceShowEdit) {
    stopAutoKeyGrabberRadar();
    if (setupCard) setupCard.style.display = 'none';
    if (connectedBar) connectedBar.style.display = 'flex';
    if (statusBadge) {
      statusBadge.textContent = '🟢 Gemini Live';
      statusBadge.classList.add('connected');
    }
    if (maskedLabel) {
      const prefix = savedKey.slice(0, 6);
      const suffix = savedKey.slice(-4);
      maskedLabel.textContent = `${prefix}••••${suffix} • Auto-Linked`;
    }
  } else {
    if (setupCard) setupCard.style.display = 'block';
    if (connectedBar) connectedBar.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = savedKey ? 'inline-flex' : 'none';
    if (statusBadge) {
      statusBadge.textContent = savedKey ? '🟢 Gemini Live' : 'Google AI • $0';
      statusBadge.classList.toggle('connected', Boolean(savedKey));
    }
  }
}
window.updateFaqAiKeyUI = updateFaqAiKeyUI;

/**
 * Initializes the FAQ AI Copilot chat stream and attaches all event listeners once.
 */
function initFaqAiCopilot() {
  loadFeatureWishlist();
  loadFaqChatHistory();
  updateFaqAiKeyUI();
  renderFaqAiChatHistory();
  updateFaqWindowControlsUI();

  if (window.__faqAiCopilotInitialized) return;
  window.__faqAiCopilotInitialized = true;

  // 0. Header Window Controls: Bottom-Right Dock Toggle & Expand Toggle
  const btnDockToggle = document.getElementById('btnFaqDockRightToggle');
  if (btnDockToggle) {
    btnDockToggle.addEventListener('click', () => {
      const faqModal = document.getElementById('faqModal');
      if (!faqModal) return;
      const nowDocked = !faqModal.classList.contains('faq-docked-right');
      faqModal.classList.toggle('faq-docked-right', nowDocked);
      userFaqDockPreference = nowDocked;
      updateFaqWindowControlsUI();
    });
  }

  const btnExpandToggle = document.getElementById('btnFaqExpandToggle');
  if (btnExpandToggle) {
    btnExpandToggle.addEventListener('click', () => {
      const faqModal = document.getElementById('faqModal');
      if (!faqModal) return;
      faqModal.classList.toggle('faq-expanded-wide');
      updateFaqWindowControlsUI();
    });
  }

  // 1. Mode Switcher Buttons
  document.querySelectorAll('#faqModeSwitcher .faq-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-faq-mode');
      if (mode) switchFaqMode(mode);
    });
  });

  // 2. Empty Static Search -> Ask AI Copilot Handoff
  const btnAskFromEmpty = document.getElementById('btnAskAiFromEmptySearch');
  if (btnAskFromEmpty) {
    btnAskFromEmpty.addEventListener('click', () => {
      const searchInput = document.getElementById('faqSearchInput');
      const query = searchInput ? searchInput.value.trim() : '';
      switchFaqMode('ai');
      if (query) {
        const aiInput = document.getElementById('faqAiQuestionInput');
        if (aiInput) aiInput.value = '';
        askFaqAiQuestion(query);
      }
    });
  }

  // 3. Show/Hide API Key Eye Toggle
  const btnEye = document.getElementById('btnToggleGeminiKeyVisibility');
  if (btnEye) {
    btnEye.addEventListener('click', () => {
      const input = document.getElementById('faqGeminiApiKeyInput');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      btnEye.textContent = input.type === 'password' ? '👁️' : '🙈';
    });
  }

  // 3b. 1-Click Auto-Get & Grab Key Button (Checks account + clipboard, or launches Radar)
  const btnAutoFetch = document.getElementById('btnAutoFetchGoogleKey');
  if (btnAutoFetch) {
    btnAutoFetch.addEventListener('click', () => {
      tryAutoPullOrGrabGeminiKey({ silent: false, openStudioIfMissing: true });
    });
  }

  // 3c. 1-Click Auto-Grab from Clipboard Button & Radar "I Copied It" Button
  const btnAutoGrabClip = document.getElementById('btnAutoGrabClipboardKey');
  if (btnAutoGrabClip) {
    btnAutoGrabClip.addEventListener('click', () => {
      tryAutoPullOrGrabGeminiKey({ silent: false, openStudioIfMissing: false });
    });
  }
  const btnRadarGrabNow = document.getElementById('btnRadarGrabNow');
  if (btnRadarGrabNow) {
    btnRadarGrabNow.addEventListener('click', () => {
      tryAutoPullOrGrabGeminiKey({ silent: false, openStudioIfMissing: false });
    });
  }

  // 3d. Automatic Window Focus / Visibility Return Grabber (Zero-Click when returning from Google AI Studio)
  window.addEventListener('focus', () => {
    const faqModal = document.getElementById('faqModal');
    const isFaqOpen = faqModal && faqModal.classList.contains('active');
    if (isAutoKeyRadarActive || (isFaqOpen && !localStorage.getItem(STORAGE_GEMINI_API_KEY))) {
      tryAutoPullOrGrabGeminiKey({ silent: true, openStudioIfMissing: false });
    }
  });

  // 3e. Instant Auto-Connect when pasting into the input field or anywhere inside #faqModal
  const keyInputEl = document.getElementById('faqGeminiApiKeyInput');
  if (keyInputEl) {
    keyInputEl.addEventListener('input', () => {
      const detected = extractValidGeminiKey(keyInputEl.value);
      if (detected) {
        saveAndSyncGeminiKey(detected, 'Auto-Detected on Paste');
      }
    });
  }
  const faqModalEl = document.getElementById('faqModal');
  if (faqModalEl) {
    faqModalEl.addEventListener('paste', (e) => {
      const pastedText = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      const detected = extractValidGeminiKey(pastedText);
      if (detected) {
        e.preventDefault();
        saveAndSyncGeminiKey(detected, 'Auto-Grabbed on Paste');
      }
    });
  }

  // 4. Save / Connect Google Gemini Key Button
  const btnSaveKey = document.getElementById('btnSaveGeminiApiKey');
  if (btnSaveKey) {
    btnSaveKey.addEventListener('click', () => {
      const input = document.getElementById('faqGeminiApiKeyInput');
      const rawKey = input ? input.value.trim() : '';
      if (!saveAndSyncGeminiKey(rawKey, 'Connected')) {
        if (typeof showToast === 'function') {
          showToast('⚠️ Please click "⚡ 1-Click Auto-Get & Grab Key" or paste a valid Google Gemini API Key (starts with AIza...).', 'warning');
        }
      }
    });
  }

  // 5. Edit / Cancel / Disconnect API Key
  const btnEditKey = document.getElementById('btnEditGeminiKey');
  if (btnEditKey) {
    btnEditKey.addEventListener('click', () => updateFaqAiKeyUI(true));
  }

  const btnCancelEdit = document.getElementById('btnCancelGeminiKeyEdit');
  if (btnCancelEdit) {
    btnCancelEdit.addEventListener('click', () => {
      stopAutoKeyGrabberRadar();
      updateFaqAiKeyUI(false);
    });
  }

  const btnDisconnectKey = document.getElementById('btnDisconnectGeminiKey');
  if (btnDisconnectKey) {
    btnDisconnectKey.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_GEMINI_API_KEY);
      const input = document.getElementById('faqGeminiApiKeyInput');
      if (input) input.value = '';
      // Also clear from cloud profile if desired
      try {
        const activeDb = (typeof window !== 'undefined' && window.fbDb) ? window.fbDb : (typeof fbDb !== 'undefined' && fbDb ? fbDb : null);
        const currentUser = (typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser)
          ? fbAuth.currentUser
          : (typeof currentAuthenticatedUser !== 'undefined' ? currentAuthenticatedUser : null);
        if (activeDb && currentUser && currentUser.uid) {
          activeDb.collection('users').doc(currentUser.uid).set({
            workspaceContainers: {
              _aiCopilotMeta: {
                geminiApiKey: '',
                faqChatHistory: getSavedFaqChatHistoryForCloud(),
                updatedAt: new Date().toISOString()
              }
            }
          }, { merge: true }).catch(() => {});
        }
      } catch (e) {}
      updateFaqAiKeyUI(false);
      if (typeof showToast === 'function') {
        showToast('🔌 Disconnected Google Gemini API key.');
      }
    });
  }

  const activeModelSelect = document.getElementById('faqGeminiActiveModelSelect');
  if (activeModelSelect) {
    activeModelSelect.addEventListener('change', () => {
      localStorage.setItem(STORAGE_GEMINI_MODEL, activeModelSelect.value);
      if (typeof showToast === 'function') {
        showToast(`🤖 Switched AI model preference to ${activeModelSelect.value}`);
      }
    });
  }

  ['btnClearFaqAiChat', 'btnClearFaqAiChatBar'].forEach(clearId => {
    const btnClearChat = document.getElementById(clearId);
    if (btnClearChat) {
      btnClearChat.addEventListener('click', () => {
        faqAiConversationHistory = [];
        saveFaqChatHistory(true);
        renderFaqAiChatHistory();
        if (typeof showToast === 'function') {
          showToast('🧹 Cleared your NirvTrack AI conversation history.');
        }
      });
    }
  });

  // 6. Quick Starter Prompt Chips
  document.querySelectorAll('.faq-ai-prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.getAttribute('data-prompt');
      if (!promptText) return;
      const qInput = document.getElementById('faqAiQuestionInput');
      if (qInput) qInput.value = '';
      askFaqAiQuestion(promptText);
    });
  });

  // 6b. 1-Click AI Smart Creation Chips (Category, Expense, Recurring) & AI Auto-Suggest (Zero Prompt Required)
  document.querySelectorAll('.faq-ai-smart-action-chip[data-ai-quick-mode]').forEach(chip => {
    chip.addEventListener('click', () => {
      const mode = chip.getAttribute('data-ai-quick-mode');
      openFaqAiQuickAddDrawer(mode);
    });
  });

  const btnCloseQa = document.getElementById('btnCloseFaqAiQuickAdd');
  if (btnCloseQa) {
    btnCloseQa.addEventListener('click', closeFaqAiQuickAddDrawer);
  }

  const btnAiAutoSuggest = document.getElementById('btnAiAutoSuggestItems');
  if (btnAiAutoSuggest) {
    btnAiAutoSuggest.addEventListener('click', () => {
      closeFaqAiQuickAddDrawer();
      renderAiAutoSuggestCreationBubble();
    });
  }

  const btnQaCat = document.getElementById('btnAiQaSubmitCategory');
  if (btnQaCat) {
    btnQaCat.addEventListener('click', handleAiQuickAddCategorySubmit);
  }
  const btnQaExp = document.getElementById('btnAiQaSubmitExpense');
  if (btnQaExp) {
    btnQaExp.addEventListener('click', handleAiQuickAddExpenseSubmit);
  }
  const btnQaBill = document.getElementById('btnAiQaSubmitRecurring');
  if (btnQaBill) {
    btnQaBill.addEventListener('click', handleAiQuickAddRecurringSubmit);
  }

  // Allow pressing Enter inside the Quick-Add inputs
  ['aiQaCatName', 'aiQaCatBudget'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleAiQuickAddCategorySubmit(); } });
  });
  ['aiQaExpDesc', 'aiQaExpAmount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleAiQuickAddExpenseSubmit(); } });
  });
  ['aiQaBillName', 'aiQaBillAmount', 'aiQaBillDueDay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleAiQuickAddRecurringSubmit(); } });
  });

  // 7. AI Question Submit Form
  const aiForm = document.getElementById('faqAiForm');
  if (aiForm) {
    aiForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const qInput = document.getElementById('faqAiQuestionInput');
      const question = qInput ? qInput.value.trim() : '';
      if (!question) return;
      qInput.value = '';
      askFaqAiQuestion(question);
    });
  }

  // 7b. [NIRVAI-FEAT-VISION] 📷 Receipt & Screenshot Multimodal Scanner
  const btnAttach = document.getElementById('btnAiAttachReceipt');
  const fileInput = document.getElementById('faqAiImageFileInput');
  if (btnAttach && fileInput) {
    btnAttach.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const base64Data = loadEvt.target.result;
        askFaqAiQuestion('Please scan and parse this receipt / screenshot. Extract the merchant, total amount, date, and recommend the best category to log it directly into my ledger.', base64Data);
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });
  }

  // 7c. [NIRVAI-FEAT-VOICE] 🎙️ Voice-to-Ledger Hands-Free Entry (Web Speech API)
  const btnVoice = document.getElementById('btnAiVoiceInput');
  const micIcon = document.getElementById('aiVoiceMicIcon');
  if (btnVoice && micIcon) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isListening = false;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListening = true;
        btnVoice.classList.add('recording');
        micIcon.textContent = '🔴';
        if (typeof showToast === 'function') showToast('🎙️ Listening... Speak your expense or budget question now!', 'info', 3000);
      };

      recognition.onresult = (evt) => {
        const transcript = evt.results[0][0].transcript;
        if (transcript) {
          const qInput = document.getElementById('faqAiQuestionInput');
          if (qInput) qInput.value = '';
          askFaqAiQuestion(transcript);
        }
      };

      recognition.onerror = (err) => {
        console.warn('Speech recognition error:', err);
        isListening = false;
        btnVoice.classList.remove('recording');
        micIcon.textContent = '🎙️';
        if (typeof showToast === 'function') showToast('Microphone input canceled or unavailable.', 'warning');
      };

      recognition.onend = () => {
        isListening = false;
        btnVoice.classList.remove('recording');
        micIcon.textContent = '🎙️';
      };

      btnVoice.addEventListener('click', () => {
        if (isListening) {
          recognition.stop();
        } else {
          try {
            recognition.start();
          } catch (e) {
            console.warn('Speech start error:', e);
          }
        }
      });
    } else {
      btnVoice.addEventListener('click', () => {
        if (typeof showToast === 'function') {
          showToast('Voice dictation is supported in Chrome, Edge, and Safari.', 'info');
        }
      });
    }
  }

  // 8. Manual Feature Request Form
  const reqForm = document.getElementById('faqFeatureRequestForm');
  if (reqForm) {
    reqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleEl = document.getElementById('faqReqTitle');
      const catEl = document.getElementById('faqReqCategory');
      const descEl = document.getElementById('faqReqDescription');

      const title = titleEl ? titleEl.value.trim() : '';
      const category = catEl ? catEl.value : 'Core Budgeting';
      const description = descEl ? descEl.value.trim() : '';

      if (!title || !description) return;

      await submitFeatureRecommendation({
        title,
        category,
        description,
        source: 'Direct User Request',
        userQuery: description
      });

      if (titleEl) titleEl.value = '';
      if (descEl) descEl.value = '';
      renderUserWishlistPreview();
    });
  }

  // 9. Open Admin Wishlist Hub button from FAQ
  const btnFaqOpenAdmin = document.getElementById('btnFaqOpenAdminWishlist');
  if (btnFaqOpenAdmin) {
    btnFaqOpenAdmin.addEventListener('click', () => {
      closeFAQModal();
      openAdminHubModal();
      switchAdminHubTab('wishlist');
    });
  }

  // 10. Admin Wishlist Toolbar Listeners
  const wishSearch = document.getElementById('adminWishlistSearchInput');
  if (wishSearch) wishSearch.addEventListener('input', () => renderAdminWishlist(false));

  const wishRankFilter = document.getElementById('adminWishlistRankFilter');
  if (wishRankFilter) wishRankFilter.addEventListener('change', () => renderAdminWishlist(false));

  const wishStatusFilter = document.getElementById('adminWishlistStatusFilter');
  if (wishStatusFilter) wishStatusFilter.addEventListener('change', () => renderAdminWishlist(false));

  const wishSortSelect = document.getElementById('adminWishlistSortSelect');
  if (wishSortSelect) wishSortSelect.addEventListener('change', () => renderAdminWishlist(false));

  const btnExportWishCsv = document.getElementById('btnExportAdminWishlistCsv');
  if (btnExportWishCsv) btnExportWishCsv.addEventListener('click', exportAdminWishlistToCSV);

  const btnRefreshWish = document.getElementById('btnRefreshAdminWishlist');
  if (btnRefreshWish) btnRefreshWish.addEventListener('click', () => renderAdminWishlist(true));

  // Add Hotkey '4' support when Admin Hub is open
  window.addEventListener('keydown', (e) => {
    const adminModal = document.getElementById('adminHubModal');
    if (!adminModal || !adminModal.classList.contains('active')) return;
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
    if (e.key === '4') {
      e.preventDefault();
      switchAdminHubTab('wishlist');
    } else if (e.key === '5') {
      e.preventDefault();
      switchAdminHubTab('notepad');
    } else if (e.key === '6') {
      e.preventDefault();
      switchAdminHubTab('layouts');
    }
  });
}

function getFaqFeatureStats() {
  const featKeys = (typeof FEATURE_TIERS !== 'undefined') ? Object.keys(FEATURE_TIERS) : [];
  let maxNum = 67;
  featKeys.forEach(k => {
    const m = k.match(/\[FEAT-(\d+)\]/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  return {
    total: featKeys.length || 68,
    maxTag: maxNum
  };
}

function getFaqWelcomeMessageHtml() {
  const hasKey = Boolean((localStorage.getItem(STORAGE_GEMINI_API_KEY) || '').trim());
  const learnedCount = Array.isArray(cachedFeatureWishlist) ? cachedFeatureWishlist.length : 0;
  const historyCount = Array.isArray(faqAiConversationHistory) ? faqAiConversationHistory.length : 0;
  const stats = getFaqFeatureStats();

  return `
    <div class="faq-ai-msg assistant">
      <div class="faq-ai-avatar">🤖</div>
      <div class="faq-ai-bubble">
        <p><strong>Hello! I'm NirvTrack AI.</strong></p>
        <p>I know all ${stats.total} features of NirvTrack (<code>[FEAT-01]</code> to <code>[FEAT-${stats.maxTag}]</code>)—and I can give you <strong>1-click interactive buttons</strong> right inside this chat to open any feature immediately.</p>
        <p style="font-size: 0.79rem; color: var(--text-secondary); margin-bottom: 0;">
          🧠 <strong>Self-Learning Memory Active:</strong> I automatically learn from all <strong>${learnedCount} community recommendations</strong> &amp; Admin Roadmap rankings${historyCount > 0 ? `, plus your <strong>${historyCount} saved chat message${historyCount === 1 ? '' : 's'}</strong>` : ''} before answering every question!
          ${hasKey ? '<br><span style="color:#34d399;">⚡ Powered by your connected Google Gemini account ($0 cost).</span>' : ''}
        </p>
      </div>
    </div>
  `;
}

function renderFaqAiWelcomeMessage() {
  const chatStream = document.getElementById('faqAiChatStream');
  if (!chatStream) return;
  chatStream.innerHTML = getFaqWelcomeMessageHtml();
}

/**
 * Renders the Learned Wishlist Status Card inside an AI chat bubble when a user asks about
 * a feature that has already been learned or ranked on the Community Wishlist.
 */
function renderLearnedWishlistCardHtml(wishItem, isNewlyAutoLearned = false) {
  if (!wishItem || !wishItem.id) return '';
  const rankBadges = {
    1: '🔥 Rank #1 Critical Priority',
    2: '⚡ Rank #2 High Priority',
    3: '📌 Rank #3 Medium Priority',
    4: '🧊 Rank #4 Low Priority',
    5: '💤 Rank #5 Backlog'
  };
  const statusLabels = {
    review: '📋 Under Review',
    planned: '🛠️ Planned on Roadmap',
    progress: '🚀 In Progress',
    shipped: '✅ Shipped',
    declined: '❌ Declined'
  };
  const rLabel = rankBadges[Number(wishItem.rank)] || '⚪ Pending Admin Ranking';
  const sLabel = statusLabels[wishItem.status] || '📋 Under Review';
  const votesCount = Number(wishItem.votes) || 1;
  const btnId = 'btnChatUpvote_' + wishItem.id + '_' + Math.random().toString(36).slice(2, 6);

  return `
    <div class="faq-ai-rec-card" style="border-color: rgba(56, 189, 248, 0.35); background: rgba(56, 189, 248, 0.06);">
      <div class="faq-ai-rec-header" style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
        <span class="faq-ai-rec-badge" style="background: rgba(56, 189, 248, 0.16); color: #38bdf8;">
          ${isNewlyAutoLearned ? '🧠 Auto-Learned & Saved to Admin Wishlist' : '🧠 Learned from Community Wishlist & Roadmap'}
        </span>
        <span style="font-size: 0.72rem; font-weight: 700; color: #fbbf24;">${escapeFaqHtml(rLabel)}</span>
      </div>
      <strong style="display: block; font-size: 0.88rem; margin: 4px 0; color: var(--text-primary);">
        ${escapeFaqHtml(wishItem.title)}
      </strong>
      <p style="font-size: 0.77rem; color: var(--text-secondary); margin: 0 0 8px 0;">
        ${escapeFaqHtml(wishItem.description)}
      </p>
      ${wishItem.adminNotes ? `<div style="font-size: 0.73rem; color: #34d399; background: rgba(16,185,129,0.08); border-left: 2px solid #34d399; padding: 4px 8px; margin-bottom: 8px; border-radius: 4px;"><strong>Admin Note:</strong> ${escapeFaqHtml(wishItem.adminNotes)}</div>` : ''}
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span style="font-size: 0.72rem; color: var(--text-secondary);">Status: <strong>${sLabel}</strong> • Community Demand: <strong id="count_${btnId}">${votesCount} vote${votesCount === 1 ? '' : 's'}</strong></span>
        <button type="button" class="btn btn-secondary btn-sm" id="${btnId}" onclick="upvoteWishlistItemFromChat('${wishItem.id}', '${btnId}')" style="padding: 4px 10px; font-size: 0.74rem; font-weight: 600;">
          👍 Upvote (+1)
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders the full persistent FAQ AI conversation history inside #faqAiChatStream.
 */
function renderFaqAiChatHistory() {
  const chatStream = document.getElementById('faqAiChatStream');
  if (!chatStream) return;

  let html = getFaqWelcomeMessageHtml();

  if (Array.isArray(faqAiConversationHistory) && faqAiConversationHistory.length > 0) {
    faqAiConversationHistory.forEach(turn => {
      if (!turn || !turn.text) return;
      if (turn.role === 'user') {
        html += `
          <div class="faq-ai-msg user">
            <div class="faq-ai-avatar">👤</div>
            <div class="faq-ai-bubble">
              <p>${escapeFaqHtml(turn.text)}</p>
            </div>
          </div>
        `;
      } else {
        const actionButtonsHtml = Array.isArray(turn.actionIds) && turn.actionIds.length > 0
          ? renderFaqAiActionButtonsHtml(turn.actionIds)
          : '';
        let wishCardHtml = '';
        if (turn.wishId && Array.isArray(cachedFeatureWishlist)) {
          const matchedWish = cachedFeatureWishlist.find(w => w.id === turn.wishId);
          if (matchedWish) {
            wishCardHtml = renderLearnedWishlistCardHtml(matchedWish, false);
          }
        }
        html += `
          <div class="faq-ai-msg assistant">
            <div class="faq-ai-avatar">🤖</div>
            <div class="faq-ai-bubble">
              ${formatAiMarkdown(turn.text)}
              ${actionButtonsHtml}
              ${wishCardHtml}
              <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 0.69rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                <span>⚡ ${escapeFaqHtml(turn.modelLabel || 'NirvTrack AI (Google Gemini)')}</span>
                <span>🧠 Saved in Chat Memory</span>
              </div>
            </div>
          </div>
        `;
      }
    });
  }

  chatStream.innerHTML = html;
  chatStream.scrollTop = chatStream.scrollHeight;
}

/**
 * Escapes HTML special characters safely.
 */
function escapeFaqHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Formats markdown-lite text from Gemini or the Local Data Analyst into clean, spacious,
 * highly readable HTML cards, sub-rows, and highlighted financial amount/keyword badges.
 */
function highlightAiInlineTokens(str) {
  let s = str;
  // 1. Bold **text** -> <strong class="ai-kw-strong">text</strong>
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong class="ai-kw-strong">$1</strong>');
  // 2. Inline code `code` -> <code class="ai-code-pill">code</code>
  s = s.replace(/`([^`]+)`/g, '<code class="ai-code-pill">$1</code>');
  // 3. Feature badges [FEAT-XX]
  s = s.replace(/\[(FEAT-\d+(?:\s*v2)?)\]/g, '<span class="faq-badge-tag">$1</span>');
  // 4. Workspace / Status bracket tags like [Personal], [Business], [ACTIVE], [OVER BUDGET!]
  s = s.replace(/\[(ACTIVE|OVER BUDGET!?|Personal|Business|Freelance|Family|Travel|Project)\]/gi, (m, inner) => {
    const up = inner.toUpperCase();
    const cls = up.includes('OVER') ? 'ai-tag-pill danger' : (up === 'ACTIVE' ? 'ai-tag-pill active' : 'ai-tag-pill');
    return `<span class="${cls}">${inner}</span>`;
  });
  // 5. Highlight Currency Amounts (e.g., ₱35,377.00, +₱650.00, -$120.50, €1,000.00)
  s = s.replace(/([+-]?(?:₱|\$|€|£|¥)\s*\d[\d,]*(?:\.\d{1,2})?(?:\/mo)?)/g, (match) => {
    const isNeg = match.trim().startsWith('-');
    const isZero = /^[+-]?(?:₱|\$|€|£|¥)\s*0(?:\.00)?(?:\/mo)?$/.test(match.trim());
    const toneClass = isNeg ? 'danger' : (isZero ? 'muted' : 'positive');
    return `<span class="ai-amt-pill ${toneClass}">${match}</span>`;
  });
  // 6. Highlight Percentages (e.g., 100.0% savings rate, 0.0% used, 85.4%)
  s = s.replace(/(\b\d+(?:\.\d+)?%\s*(?:savings rate|used|of budget)?)/gi, '<span class="ai-pct-pill">$1</span>');
  return s;
}

function formatAiMarkdown(text) {
  let clean = escapeFaqHtml(text);
  clean = highlightAiInlineTokens(clean);

  const lines = clean.split(/\r?\n/);
  let html = '';
  let inList = false;

  lines.forEach(line => {
    const rawTrimmed = line.trim();
    if (!rawTrimmed) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      return;
    }

    // Check if line is a bullet item (starting with -, *, •, or digit.)
    if (rawTrimmed.startsWith('- ') || rawTrimmed.startsWith('* ') || rawTrimmed.startsWith('• ') || /^\d+\.\s/.test(rawTrimmed)) {
      if (!inList) {
        html += '<ul class="ai-neat-list">';
        inList = true;
      }
      let itemContent = rawTrimmed.replace(/^(-|\*|•|\d+\.)\s+/, '');

      // Check if item starts with an emoji icon
      const hasEmojiLead = /^(\p{Emoji}|[🟢🔴⚠️✅💰📊💵🎯🧾💡📌⚡•▸▪])/u.test(itemContent);

      // Check if this bullet has a lead heading followed by a colon, e.g. "<strong>Category Health</strong>: ..."
      const colonIdx = itemContent.indexOf('</strong>:');
      if (colonIdx !== -1 && colonIdx < 120) {
        const leadPart = itemContent.slice(0, colonIdx + 10); // includes </strong>:
        const restPart = itemContent.slice(colonIdx + 10).trim();

        if (restPart.includes(' | ')) {
          const segments = restPart.split(' | ').map(seg => seg.trim()).filter(Boolean);
          const chipsHtml = segments.map(seg => `<span class="ai-metric-kv-chip">${seg}</span>`).join(' ');
          itemContent = `<span class="ai-bullet-lead">${leadPart}</span> <span class="ai-metric-inline-group">${chipsHtml}</span>`;
        } else {
          itemContent = `<span class="ai-bullet-lead">${leadPart}</span> <span class="ai-bullet-body">${restPart}</span>`;
        }
      }

      html += `<li class="ai-neat-list-item ${hasEmojiLead ? 'has-emoji-lead' : ''}">${itemContent}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      const isTip = rawTrimmed.startsWith('💡') || rawTrimmed.startsWith('*Tip:') || rawTrimmed.startsWith('_Tip:');
      html += `<p class="ai-neat-paragraph ${isTip ? 'is-tip' : ''}">${rawTrimmed}</p>`;
    }
  });

  if (inList) html += '</ul>';
  return html || `<p class="ai-neat-paragraph">${clean}</p>`;
}

/**
 * Animates the AI response text with a live streaming typewriter effect and blinking cursor,
 * then smoothly reveals the interactive Quick Action buttons and Learned Wishlist card.
 * Purely visual DOM layer — all chat history & Cloud Firestore persistence completes prior to animation.
 */
function streamAnimateAiResponse(bubbleEl, formattedHtml, postStreamHtml, chatStream) {
  if (!bubbleEl) return;

  bubbleEl.innerHTML = `
    <div class="faq-ai-new-response-tag">✨ New AI Response</div>
    <div class="faq-ai-stream-body">${formattedHtml}</div>
    <div class="faq-ai-post-stream">${postStreamHtml}</div>
  `;

  const streamBody = bubbleEl.querySelector('.faq-ai-stream-body');
  const postStream = bubbleEl.querySelector('.faq-ai-post-stream');
  if (!streamBody || !postStream || typeof document.createTreeWalker !== 'function') {
    if (postStream) postStream.classList.add('revealed');
    if (chatStream) chatStream.scrollTop = chatStream.scrollHeight;
    return;
  }

  // Collect all text nodes in document order so HTML tags (<strong>, <code>, badges, lists) never break mid-stream
  const walker = document.createTreeWalker(streamBody, NodeFilter.SHOW_TEXT, null, false);
  const textItems = [];
  let totalChars = 0;
  let currentNode = walker.nextNode();
  while (currentNode) {
    const val = currentNode.nodeValue || '';
    if (val.length > 0) {
      const blockParent = currentNode.parentElement ? currentNode.parentElement.closest('p, li') : null;
      textItems.push({
        node: currentNode,
        fullText: val,
        blockParent
      });
      totalChars += val.length;
      currentNode.nodeValue = '';
    }
    currentNode = walker.nextNode();
  }

  if (textItems.length === 0 || totalChars === 0) {
    postStream.classList.add('revealed');
    if (chatStream) chatStream.scrollTop = chatStream.scrollHeight;
    return;
  }

  // Hide block parents (p, li) until the streaming cursor reaches them
  const hiddenBlocks = new Set();
  textItems.forEach((item, idx) => {
    if (idx > 0 && item.blockParent && item.blockParent !== textItems[0].blockParent) {
      item.blockParent.style.display = 'none';
      hiddenBlocks.add(item.blockParent);
    }
  });

  const cursorEl = document.createElement('span');
  cursorEl.className = 'faq-ai-stream-cursor';

  let itemIdx = 0;
  let charIdx = 0;
  const charsPerTick = Math.max(4, Math.ceil(totalChars / 46)); // Completes smoothly in ~0.85s
  let finished = false;

  const finishImmediately = () => {
    if (finished) return;
    finished = true;
    if (timerId) clearInterval(timerId);
    hiddenBlocks.forEach(b => { b.style.display = ''; });
    textItems.forEach(item => { item.node.nodeValue = item.fullText; });
    if (cursorEl.parentNode) cursorEl.parentNode.removeChild(cursorEl);
    postStream.classList.add('revealed');
    if (chatStream) chatStream.scrollTop = chatStream.scrollHeight;
  };

  // Allow clicking anywhere on the bubble to finish typing immediately
  bubbleEl.addEventListener('click', finishImmediately, { once: true });

  const timerId = setInterval(() => {
    if (finished) return;
    let remainingBudget = charsPerTick;

    while (remainingBudget > 0 && itemIdx < textItems.length) {
      const currentItem = textItems[itemIdx];
      if (currentItem.blockParent && hiddenBlocks.has(currentItem.blockParent)) {
        currentItem.blockParent.style.display = '';
        hiddenBlocks.delete(currentItem.blockParent);
      }

      const available = currentItem.fullText.length - charIdx;
      const take = Math.min(remainingBudget, available);
      charIdx += take;
      remainingBudget -= take;
      currentItem.node.nodeValue = currentItem.fullText.slice(0, charIdx);

      if (currentItem.node.parentNode) {
        currentItem.node.parentNode.insertBefore(cursorEl, currentItem.node.nextSibling);
      }

      if (charIdx >= currentItem.fullText.length) {
        itemIdx++;
        charIdx = 0;
      }
    }

    if (chatStream) {
      chatStream.scrollTop = chatStream.scrollHeight;
    }

    if (itemIdx >= textItems.length) {
      finishImmediately();
    }
  }, 18);
}

// ============================================================
// SAFE AI SMART CREATION, AUTO-SUGGEST & 1-CLICK UNDO ENGINE
// (Categories, One-Time Expenses, and Recurring Bills)
// Uses the exact native schemas & save hooks (`saveData`, `updateAllViews`)
// ============================================================
const aiCreatedItemsUndoRegistry = {};

function inferSmartCategoryMeta(rawName, explicitType = '') {
  const n = String(rawName || '').toLowerCase();
  const icon = (typeof detectCategoryIcon === 'function') ? detectCategoryIcon(rawName) : (
    n.includes('pet') || n.includes('dog') || n.includes('cat') ? '🐾' :
    n.includes('gym') || n.includes('fitness') || n.includes('health') || n.includes('med') ? '💪' :
    n.includes('coffee') || n.includes('cafe') || n.includes('snack') ? '☕' :
    n.includes('food') || n.includes('grocer') || n.includes('dining') || n.includes('restaur') ? '🍽️' :
    n.includes('rent') || n.includes('mortgag') || n.includes('home') || n.includes('house') ? '🏠' :
    n.includes('elec') || n.includes('power') || n.includes('water') || n.includes('util') ? '⚡' :
    n.includes('net') || n.includes('wifi') || n.includes('phone') || n.includes('mobile') ? '🌐' :
    n.includes('stream') || n.includes('netflix') || n.includes('spotify') || n.includes('game') || n.includes('entertain') ? '🎬' :
    n.includes('car') || n.includes('gas') || n.includes('fuel') || n.includes('transit') || n.includes('grab') ? '🚗' :
    n.includes('save') || n.includes('emerg') || n.includes('invest') ? '🛡️' :
    n.includes('shop') || n.includes('cloth') ? '🛍️' : '🏷️'
  );
  const color = (typeof getRandomCategoryColor === 'function') ? getRandomCategoryColor() : '#06b6d4';
  let budgetType = explicitType === 'wants' || explicitType === 'needs' ? explicitType : '';
  if (!budgetType) {
    const isWants = /coffee|cafe|dining|restaur|stream|netflix|spotify|game|entertain|shop|cloth|hobby|travel|vacation|snack|bar|party|gift/i.test(n);
    budgetType = isWants ? 'wants' : 'needs';
  }
  return { icon, color, budgetType };
}

function smartResolveOrAutoCreateCategory(categoryIdOrName, fallbackHintText = '') {
  const cats = Array.isArray(appState.categories) ? appState.categories : [];
  if (categoryIdOrName && categoryIdOrName !== '__auto__') {
    const direct = cats.find(c => c.id === categoryIdOrName || c.name.toLowerCase() === String(categoryIdOrName).toLowerCase());
    if (direct) return direct;
  }

  const searchStr = `${categoryIdOrName !== '__auto__' ? categoryIdOrName : ''} ${fallbackHintText}`.toLowerCase().trim();

  // 1. Check Merchant Memory first
  if (typeof findPastMerchantMatch === 'function' && fallbackHintText) {
    const pastMatch = findPastMerchantMatch(fallbackHintText);
    if (pastMatch && pastMatch.categoryId) {
      const matchedCat = cats.find(c => c.id === pastMatch.categoryId);
      if (matchedCat) return matchedCat;
    }
  }

  // 2. Keyword match against existing categories
  const keywordRules = [
    { kw: ['starbucks', 'coffee', 'cafe', 'jollibee', 'mcdonald', 'grabfood', 'foodpanda', 'restaurant', 'dining', 'lunch', 'dinner', ' pizza', 'burger'], matchCat: /dining|food|coffee|restaur|eat/i },
    { kw: ['grocery', 'groceries', 'supermarket', 'market', 'puregold', 'sm hypermarket', 'landers', 'snr'], matchCat: /grocer|food|market/i },
    { kw: ['meralco', 'electric', 'water', 'maynilad', 'manila water', 'utility', 'power', 'gas bill'], matchCat: /util|electric|power|water|bill/i },
    { kw: ['pldt', 'globe', 'converge', 'smart', 'internet', 'wifi', 'fiber', 'mobile', 'phone'], matchCat: /internet|util|phone|comm|sub/i },
    { kw: ['netflix', 'spotify', 'youtube', 'disney', 'apple', 'prime', 'cinema', 'movie', 'game', 'steam'], matchCat: /entertain|stream|sub|leisure/i },
    { kw: ['grab', 'uber', 'angkas', 'shell', 'petron', 'caltex', 'gas', 'fuel', 'parking', 'toll', 'rfid', 'commute', 'train', 'bus'], matchCat: /transp|car|fuel|gas|commute/i },
    { kw: ['rent', 'condo', 'mortgage', 'hoa', 'apartment', 'housing'], matchCat: /rent|hous|home|mortg/i },
    { kw: ['gym', 'fitness', 'doctor', 'pharmacy', 'mercury drug', 'watsons', 'hospital', 'dental', 'health'], matchCat: /health|med|fit|gym|personal/i },
    { kw: ['shopee', 'lazada', 'amazon', 'uniqlo', 'zara', 'mall', 'shopping'], matchCat: /shop|personal|cloth|misc/i }
  ];

  for (const rule of keywordRules) {
    if (rule.kw.some(k => searchStr.includes(k))) {
      const found = cats.find(c => rule.matchCat.test(c.name));
      if (found) return found;
    }
  }

  // 3. Direct substring match on category name
  const subMatch = cats.find(c => searchStr.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(searchStr));
  if (subMatch && searchStr.length >= 3) return subMatch;

  // 4. Fallback to first visible category in active month
  const excluded = (appState.excludedCategoriesByMonth && appState.excludedCategoriesByMonth[appState.activeMonth]) || [];
  return cats.find(c => !excluded.includes(c.id)) || cats[0] || null;
}

function populateAiQuickAddCategorySelects() {
  const expSelect = document.getElementById('aiQaExpCategory');
  const billSelect = document.getElementById('aiQaBillCategory');
  const excluded = (appState.excludedCategoriesByMonth && appState.excludedCategoriesByMonth[appState.activeMonth]) || [];
  const visibleCats = (appState.categories || []).filter(c => !excluded.includes(c.id));

  [expSelect, billSelect].forEach(sel => {
    if (!sel) return;
    const prev = sel.value || '__auto__';
    sel.innerHTML = '<option value="__auto__">🪄 AI Auto-Match Category</option>';
    visibleCats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.icon || '🏷️'} ${c.name}`;
      sel.appendChild(opt);
    });
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  });
}

function openFaqAiQuickAddDrawer(mode) {
  const drawer = document.getElementById('faqAiQuickAddDrawer');
  const titleEl = document.getElementById('faqAiQaTitle');
  const fCat = document.getElementById('faqAiQaFormCategory');
  const fExp = document.getElementById('faqAiQaFormExpense');
  const fBill = document.getElementById('faqAiQaFormRecurring');
  if (!drawer) return;

  populateAiQuickAddCategorySelects();

  document.querySelectorAll('.faq-ai-smart-action-chip[data-ai-quick-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-ai-quick-mode') === mode);
  });

  if (fCat) fCat.style.display = mode === 'category' ? 'block' : 'none';
  if (fExp) fExp.style.display = mode === 'expense' ? 'block' : 'none';
  if (fBill) fBill.style.display = mode === 'recurring' ? 'block' : 'none';

  if (titleEl) {
    if (mode === 'category') titleEl.textContent = '🏷️ AI Quick-Add Budget Category (Auto-Icon & Active Period Sync)';
    else if (mode === 'expense') titleEl.textContent = '💸 AI Quick-Log One-Time Expense (Smart Category Auto-Match)';
    else if (mode === 'recurring') titleEl.textContent = '🔁 AI Quick-Add Recurring Bill / Subscription';
  }

  drawer.style.display = 'block';
  setTimeout(() => {
    if (mode === 'category') document.getElementById('aiQaCatName')?.focus();
    else if (mode === 'expense') document.getElementById('aiQaExpDesc')?.focus();
    else if (mode === 'recurring') document.getElementById('aiQaBillName')?.focus();
  }, 50);
}

function closeFaqAiQuickAddDrawer() {
  const drawer = document.getElementById('faqAiQuickAddDrawer');
  if (drawer) drawer.style.display = 'none';
  document.querySelectorAll('.faq-ai-smart-action-chip[data-ai-quick-mode]').forEach(btn => btn.classList.remove('active'));
}

/**
 * Safely executes adding a Category using the exact native schema & save hooks.
 */
function executeAiCreateCategory({ name, budgetAmount = 0, budgetType = '', scope = 'month' }) {
  const cleanName = String(name || '').trim();
  const parsedAmt = Math.max(0, parseFloat(budgetAmount) || 0);
  if (!cleanName) return { ok: false, error: 'Please provide a category name.' };

  const currentMonth = appState.activeMonth;
  const activeMonths = (typeof getSortedActiveMonths === 'function') ? getSortedActiveMonths() : [currentMonth];
  const cur = appState.currency || '₱';
  const meta = inferSmartCategoryMeta(cleanName, budgetType);

  // Check if category already exists
  const existing = (appState.categories || []).find(c => c.name.trim().toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    const prevBudget = (appState.budgets[currentMonth] && appState.budgets[currentMonth][existing.id] !== undefined)
      ? appState.budgets[currentMonth][existing.id]
      : existing.defaultBudget;
    existing.defaultBudget = parsedAmt;
    if (budgetType) existing.budgetType = meta.budgetType;

    activeMonths.forEach(m => {
      if (!appState.budgets[m]) appState.budgets[m] = {};
      appState.budgets[m][existing.id] = parsedAmt;
      if (appState.excludedCategoriesByMonth && Array.isArray(appState.excludedCategoriesByMonth[m])) {
        appState.excludedCategoriesByMonth[m] = appState.excludedCategoriesByMonth[m].filter(id => id !== existing.id);
      }
    });

    saveData();
    if (typeof saveActiveWorkspaceContainer === 'function') saveActiveWorkspaceContainer();
    if (typeof populateCategorySelects === 'function') populateCategorySelects();
    if (typeof renderBudgetGrid === 'function') renderBudgetGrid();
    if (typeof updateAllViews === 'function') updateAllViews();

    const undoKey = 'undo_cat_upd_' + Date.now();
    aiCreatedItemsUndoRegistry[undoKey] = () => {
      existing.defaultBudget = prevBudget;
      activeMonths.forEach(m => {
        if (appState.budgets[m]) appState.budgets[m][existing.id] = prevBudget;
      });
      saveData();
      if (typeof saveActiveWorkspaceContainer === 'function') saveActiveWorkspaceContainer();
      if (typeof renderBudgetGrid === 'function') renderBudgetGrid();
      if (typeof updateAllViews === 'function') updateAllViews();
      if (typeof showToast === 'function') showToast(`Reverted "${existing.name}" budget back to ${fmtAiMoney(prevBudget, cur)}.`, 'info');
    };

    return {
      ok: true,
      undoKey,
      itemType: 'Category Updated',
      summaryTitle: `${existing.icon} ${existing.name}`,
      summaryDetail: `Updated monthly budget cap to ${fmtAiMoney(parsedAmt, cur)} (${existing.budgetType === 'wants' ? 'Wants' : 'Needs'})`,
      markdownMsg: `✅ **AI Updated Existing Category**: **${existing.icon} ${existing.name}** is now set to **${fmtAiMoney(parsedAmt, cur)}** (${existing.budgetType === 'wants' ? 'Wants' : 'Needs'}) for \`${activeMonths.join(', ')}\`!`
    };
  }

  const id = 'cat_' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 18) + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const newCategory = {
    id,
    name: cleanName,
    icon: meta.icon,
    color: meta.color,
    defaultBudget: parsedAmt,
    budgetType: meta.budgetType,
    scope: scope || 'month',
    createdInMonth: currentMonth,
    createdInMonths: (scope === 'month') ? [...activeMonths] : []
  };

  appState.categories.push(newCategory);
  activeMonths.forEach(m => {
    if (!appState.budgets[m]) appState.budgets[m] = {};
    appState.budgets[m][id] = parsedAmt;
  });

  if (scope === 'month') {
    if (!appState.excludedCategoriesByMonth || typeof appState.excludedCategoriesByMonth !== 'object') {
      appState.excludedCategoriesByMonth = {};
    }
    const allKnownMonths = new Set([
      ...Object.keys(appState.budgets || {}),
      ...Object.keys(appState.incomes || {}),
      ...Object.keys(appState.excludedCategoriesByMonth || {}),
      ...(appState.expenses || []).map(e => e.date ? e.date.slice(0, 7) : null).filter(Boolean)
    ]);
    allKnownMonths.forEach(m => {
      if (!activeMonths.includes(m)) {
        if (!Array.isArray(appState.excludedCategoriesByMonth[m])) appState.excludedCategoriesByMonth[m] = [];
        if (!appState.excludedCategoriesByMonth[m].includes(id)) appState.excludedCategoriesByMonth[m].push(id);
      }
    });
  }

  saveData();
  if (typeof saveActiveWorkspaceContainer === 'function') saveActiveWorkspaceContainer();
  if (typeof populateCategorySelects === 'function') populateCategorySelects();
  if (typeof renderBudgetGrid === 'function') renderBudgetGrid();
  if (typeof updateAllViews === 'function') updateAllViews();

  const undoKey = 'undo_cat_' + id;
  aiCreatedItemsUndoRegistry[undoKey] = () => {
    appState.categories = (appState.categories || []).filter(c => c.id !== id);
    Object.keys(appState.budgets || {}).forEach(m => {
      if (appState.budgets[m]) delete appState.budgets[m][id];
    });
    saveData();
    if (typeof saveActiveWorkspaceContainer === 'function') saveActiveWorkspaceContainer();
    if (typeof populateCategorySelects === 'function') populateCategorySelects();
    if (typeof renderBudgetGrid === 'function') renderBudgetGrid();
    if (typeof updateAllViews === 'function') updateAllViews();
    if (typeof showToast === 'function') showToast(`Undid AI creation of category "${cleanName}".`, 'info');
  };

  if (typeof showToast === 'function') {
    showToast(`🤖 AI created category "${meta.icon} ${cleanName}" (${fmtAiMoney(parsedAmt, cur)})!`, 'success');
  }

  return {
    ok: true,
    undoKey,
    itemType: 'New Category Added',
    createdAmount: parsedAmt,
    summaryTitle: `${meta.icon} ${cleanName}`,
    summaryDetail: `Budget Cap: ${fmtAiMoney(parsedAmt, cur)} • Type: ${meta.budgetType === 'wants' ? 'Wants' : 'Needs'} • Period: ${activeMonths.join(', ')}`,
    markdownMsg: `✅ **AI Created Category**: Added **${meta.icon} ${cleanName}** with a monthly budget of **${fmtAiMoney(parsedAmt, cur)}** (**${meta.budgetType === 'wants' ? 'Wants' : 'Needs'}**) to your active workspace!`
  };
}

/**
 * Safely executes logging a One-Time Expense using the exact native schema & save hooks.
 */
function executeAiCreateExpense({ description, amount, categoryIdOrName = '__auto__', paymentMethod = 'Credit Card', date = '' }) {
  const cleanDesc = String(description || '').trim();
  const parsedAmt = parseFloat(amount);
  if (!cleanDesc || isNaN(parsedAmt) || parsedAmt <= 0) {
    return { ok: false, error: 'Please provide a valid description and positive amount.' };
  }

  const cur = appState.currency || '₱';
  const todayStr = new Date().toISOString().split('T')[0];
  const txDate = date || (todayStr.startsWith(appState.activeMonth) ? todayStr : `${appState.activeMonth}-01`);

  const matchedCat = smartResolveOrAutoCreateCategory(categoryIdOrName, cleanDesc);
  const categoryId = matchedCat ? matchedCat.id : '';
  const catLabel = matchedCat ? `${matchedCat.icon || '🏷️'} ${matchedCat.name}` : 'Uncategorized';
  const budgetType = matchedCat
    ? (matchedCat.budgetType || (typeof getCategoryBudgetType === 'function' ? getCategoryBudgetType(categoryId) : 'needs'))
    : 'needs';

  const overspendInfo = (typeof getOverspendAlert === 'function' && categoryId)
    ? getOverspendAlert(categoryId, txDate, parsedAmt, null)
    : null;

  const newTx = {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    date: txDate,
    amount: parsedAmt,
    categoryId,
    description: cleanDesc,
    paymentMethod: paymentMethod || 'Credit Card',
    budgetType
  };

  if (!Array.isArray(appState.expenses)) appState.expenses = [];
  appState.expenses.push(newTx);

  saveData();
  if (typeof saveActiveWorkspaceContainer === 'function') saveActiveWorkspaceContainer();
  if (typeof updateAllViews === 'function') updateAllViews();

  if (typeof showToast === 'function') {
    showToast(`🤖 AI logged expense "${cleanDesc}" (${fmtAiMoney(parsedAmt, cur)}) under ${catLabel}!`, 'success');
    if (overspendInfo) showToast(overspendInfo.msg, 'warning', 6000);
  }

  const undoKey = 'undo_tx_' + newTx.id;
  aiCreatedItemsUndoRegistry[undoKey] = () => {
    appState.expenses = (appState.expenses || []).filter(e => e.id !== newTx.id);
    saveData();
    if (typeof saveActiveWorkspaceContainer === 'function') saveActiveWorkspaceContainer();
    if (typeof updateAllViews === 'function') updateAllViews();
    if (typeof showToast === 'function') showToast(`Undid AI expense "${cleanDesc}" (${fmtAiMoney(parsedAmt, cur)}).`, 'info');
  };

  const overspendNote = overspendInfo ? `\n- ⚠️ **Budget Alert**: ${overspendInfo.msg}` : '';

  return {
    ok: true,
    undoKey,
    itemType: 'Expense Logged',
    createdAmount: parsedAmt,
    categoryId,
    categoryName: matchedCat ? matchedCat.name : '',
    overspendInfo,
    summaryTitle: `${cleanDesc} — ${fmtAiMoney(parsedAmt, cur)}`,
    summaryDetail: `Category: ${catLabel} • Date: ${txDate} • Via: ${newTx.paymentMethod}`,
    markdownMsg: `✅ **AI Logged One-Time Expense**: Recorded **${cleanDesc}** for **${fmtAiMoney(parsedAmt, cur)}** under **${catLabel}** on \`${txDate}\`!${overspendNote}`
  };
}

/**
 * Safely executes adding a Recurring Bill / Subscription using the exact native schema & save hooks.
 */
function executeAiCreateRecurringBill({ name, amount, dueDay = 15, frequency = 'monthly', categoryIdOrName = '__auto__', paymentMethod = 'Credit Card' }) {
  const cleanName = String(name || '').trim();
  const parsedAmt = parseFloat(amount);
  if (!cleanName || isNaN(parsedAmt) || parsedAmt <= 0) {
    return { ok: false, error: 'Please provide a valid recurring bill name and positive amount.' };
  }

  const cur = appState.currency || '₱';
  const matchedCat = smartResolveOrAutoCreateCategory(categoryIdOrName, cleanName);
  const categoryId = matchedCat ? matchedCat.id : (appState.categories[0]?.id || '');
  const catLabel = matchedCat ? `${matchedCat.icon || '🏷️'} ${matchedCat.name}` : 'General';
  const budgetType = matchedCat
    ? (matchedCat.budgetType || (typeof getCategoryBudgetType === 'function' ? getCategoryBudgetType(categoryId) : 'needs'))
    : 'needs';

  const safeDueDay = Math.min(31, Math.max(1, parseInt(dueDay, 10) || 15));
  const startStr = (typeof billTodayStr === 'function' ? billTodayStr() : new Date().toISOString().split('T')[0]).slice(0, 8) + '01';

  const newBill = {
    id: 'bill_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name: cleanName,
    amount: parsedAmt,
    categoryId,
    paymentMethod: paymentMethod || 'Credit Card',
    frequency: frequency || 'monthly',
    dueDay: safeDueDay,
    dueMonth: 1,
    startDate: startStr,
    active: true,
    autoPost: true,
    budgetType,
    skippedDates: [],
    createdAt: new Date().toISOString()
  };

  if (!Array.isArray(appState.recurringBills)) appState.recurringBills = [];
  appState.recurringBills.push(newBill);

  saveData();
  if (typeof saveActiveWorkspaceContainer === 'function') saveActiveWorkspaceContainer();
  if (typeof updateAllViews === 'function') updateAllViews();

  if (typeof showToast === 'function') {
    showToast(`🤖 AI added recurring bill "${cleanName}" (${fmtAiMoney(parsedAmt, cur)}/mo, Due Day ${safeDueDay})!`, 'success');
  }

  const undoKey = 'undo_bill_' + newBill.id;
  aiCreatedItemsUndoRegistry[undoKey] = () => {
    appState.recurringBills = (appState.recurringBills || []).filter(b => b.id !== newBill.id);
    // Also remove any auto-posted occurrence linked to this billId
    appState.expenses = (appState.expenses || []).filter(e => e.billId !== newBill.id);
    saveData();
    if (typeof saveActiveWorkspaceContainer === 'function') saveActiveWorkspaceContainer();
    if (typeof updateAllViews === 'function') updateAllViews();
    if (typeof showToast === 'function') showToast(`Undid AI recurring bill "${cleanName}".`, 'info');
  };

  return {
    ok: true,
    undoKey,
    itemType: 'Recurring Bill Added',
    createdAmount: parsedAmt,
    summaryTitle: `🔁 ${cleanName} — ${fmtAiMoney(parsedAmt, cur)}/mo`,
    summaryDetail: `Category: ${catLabel} • Due Day: Every ${safeDueDay}th • Auto-Post: Enabled`,
    markdownMsg: `✅ **AI Added Recurring Bill**: Scheduled **${cleanName}** (**${fmtAiMoney(parsedAmt, cur)}/mo**, due on day **${safeDueDay}**) under **${catLabel}** with **Auto-Post** enabled!`
  };
}

function undoAiCreatedItem(undoKey, btnEl) {
  const fn = aiCreatedItemsUndoRegistry[undoKey];
  if (typeof fn === 'function') {
    fn();
    delete aiCreatedItemsUndoRegistry[undoKey];
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = '↩️ Undone';
      // If batch undo was clicked, also mark all individual item undo buttons inside the card as undone
      const card = btnEl.closest('.faq-ai-executed-card');
      if (card && String(undoKey).startsWith('undo_batch_')) {
        card.querySelectorAll('button').forEach(b => {
          b.disabled = true;
          b.textContent = '↩️ Undone';
        });
      }
    }
  }
}
window.undoAiCreatedItem = undoAiCreatedItem;

function renderAiExecutedActionCardHtml(execResult) {
  if (!execResult || !execResult.ok) return '';

  let overspendBannerHtml = '';
  if (execResult.overspendInfo && execResult.overspendInfo.level === 'danger') {
    const rescueData = (typeof findRebalanceCandidates === 'function') 
      ? findRebalanceCandidates(execResult.categoryId, execResult.createdAmount)
      : null;
    
    if (rescueData && rescueData.candidate) {
      const cur = appState.currency || '₱';
      overspendBannerHtml = `
        <div class="ai-overspend-rescue-bar">
          <div class="ai-rescue-text">
            <span>🚨 <strong>Envelope Deficit:</strong> ${escapeFaqHtml(execResult.overspendInfo.msg)}</span>
            <small style="display:block; color:var(--text-secondary); margin-top:2px;">
              💡 <strong>Surplus Found:</strong> Transfer ${cur}${rescueData.deficit.toFixed(2)} from <strong>${escapeFaqHtml(rescueData.candidate.name)}</strong> (+${cur}${rescueData.candidate.surplus.toFixed(2)} available)?
            </small>
          </div>
          <button type="button" class="btn btn-warning btn-xs btn-ai-rebalance-now" onclick="executeAiRebalanceOverspend('${execResult.categoryId}', '${rescueData.candidate.id}', ${rescueData.deficit}, this)">
            ⚡ 1-Tap Rebalance
          </button>
        </div>
      `;
    }
  }

  return `
    <div class="faq-ai-executed-card">
      <div>
        <div style="font-size: 0.69rem; font-weight: 700; text-transform: uppercase; color: #34d399; letter-spacing: 0.04em;">
          ⚡ ${escapeFaqHtml(execResult.itemType)} • Synced to Active Workspace
        </div>
        <strong style="font-size: 0.86rem; color: var(--text-primary); display: block; margin-top: 2px;">
          ${escapeFaqHtml(execResult.summaryTitle)}
        </strong>
        <span style="font-size: 0.75rem; color: var(--text-secondary);">
          ${escapeFaqHtml(execResult.summaryDetail)}
        </span>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" onclick="undoAiCreatedItem('${execResult.undoKey}', this)" style="padding: 4px 10px; font-size: 0.74rem; font-weight: 600;">
        ↩️ Undo
      </button>
    </div>
    ${overspendBannerHtml}
  `;
}

function renderAiBatchExecutedActionCardHtml(batchResult) {
  if (!batchResult || !Array.isArray(batchResult.items) || batchResult.items.length === 0) return '';
  
  const itemsHtml = batchResult.items.map(item => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-top: 1px solid rgba(255,255,255,0.06); font-size: 0.78rem;">
      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 8px;">
        <strong style="color: var(--text-primary);">${escapeFaqHtml(item.summaryTitle)}</strong>
        <span style="color: var(--text-muted); font-size: 0.72rem; margin-left: 6px;">${escapeFaqHtml(item.summaryDetail)}</span>
      </div>
      <button type="button" class="btn btn-secondary btn-xs" onclick="undoAiCreatedItem('${item.undoKey}', this)" style="padding: 3px 8px; font-size: 0.70rem; font-weight: 600; white-space: nowrap;">
        ↩️ Undo
      </button>
    </div>
  `).join('');

  return `
    <div class="faq-ai-executed-card" style="display: flex; flex-direction: column; align-items: stretch; gap: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
        <div>
          <div style="font-size: 0.69rem; font-weight: 700; text-transform: uppercase; color: #34d399; letter-spacing: 0.04em;">
            ⚡ ${escapeFaqHtml(batchResult.itemType)} • Synced to Active Workspace
          </div>
          <strong style="font-size: 0.88rem; color: var(--text-primary); display: block; margin-top: 2px;">
            ${escapeFaqHtml(batchResult.summaryTitle)}
          </strong>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="undoAiCreatedItem('${batchResult.batchUndoKey}', this)" style="padding: 4px 10px; font-size: 0.74rem; font-weight: 600; white-space: nowrap;">
          ↩️ Undo All (${batchResult.items.length})
        </button>
      </div>
      <div style="display: flex; flex-direction: column;">
        ${itemsHtml}
      </div>
    </div>
  `;
}

function appendDirectAiExecutionBubble(userLabel, execResult, actionIds = []) {
  const chatStream = document.getElementById('faqAiChatStream');
  if (!chatStream || !execResult) return;

  chatStream.querySelectorAll('.faq-ai-msg.newly-arrived').forEach(el => {
    el.classList.remove('newly-arrived');
    const oldTag = el.querySelector('.faq-ai-new-response-tag');
    if (oldTag) oldTag.remove();
  });

  const msgEl = document.createElement('div');
  msgEl.className = 'faq-ai-msg assistant newly-arrived';
  msgEl.innerHTML = `
    <div class="faq-ai-avatar">🤖</div>
    <div class="faq-ai-bubble"></div>
  `;
  chatStream.appendChild(msgEl);

  const formattedHtml = formatAiMarkdown(execResult.markdownMsg);
  const postStreamHtml = `
    ${renderAiExecutedActionCardHtml(execResult)}
    ${renderFaqAiActionButtonsHtml(actionIds)}
  `;
  const bubbleEl = msgEl.querySelector('.faq-ai-bubble');
  streamAnimateAiResponse(bubbleEl, formattedHtml, postStreamHtml, chatStream);
  populateAiQuickAddCategorySelects();
}

function handleAiQuickAddCategorySubmit() {
  const nameEl = document.getElementById('aiQaCatName');
  const budgetEl = document.getElementById('aiQaCatBudget');
  const typeEl = document.getElementById('aiQaCatType');
  const name = nameEl ? nameEl.value.trim() : '';
  const budgetAmount = budgetEl ? (resolveInputMathValue(budgetEl) || 0) : 0;
  const budgetType = typeEl ? typeEl.value : 'needs';

  if (!name) {
    if (typeof showToast === 'function') showToast('Please enter a category name.', 'warning');
    nameEl?.focus();
    return;
  }

  const res = executeAiCreateCategory({ name, budgetAmount, budgetType });
  if (res.ok) {
    if (nameEl) nameEl.value = '';
    if (budgetEl) budgetEl.value = '';
    closeFaqAiQuickAddDrawer();
    appendDirectAiExecutionBubble(`Quick-Add Category: ${name}`, res, ['goto_budget', 'add_category']);
  }
}

function handleAiQuickAddExpenseSubmit() {
  const descEl = document.getElementById('aiQaExpDesc');
  const amtEl = document.getElementById('aiQaExpAmount');
  const catEl = document.getElementById('aiQaExpCategory');
  const description = descEl ? descEl.value.trim() : '';
  const amount = amtEl ? resolveInputMathValue(amtEl) : 0;
  const categoryIdOrName = catEl ? catEl.value : '__auto__';

  if (!description || isNaN(amount) || amount <= 0) {
    if (typeof showToast === 'function') showToast('Please enter a merchant/description and valid amount.', 'warning');
    descEl?.focus();
    return;
  }

  const res = executeAiCreateExpense({ description, amount, categoryIdOrName });
  if (res.ok) {
    if (descEl) descEl.value = '';
    if (amtEl) amtEl.value = '';
    closeFaqAiQuickAddDrawer();
    appendDirectAiExecutionBubble(`Quick-Log Expense: ${description}`, res, ['goto_expenses', 'goto_analytics']);
  }
}

function handleAiQuickAddRecurringSubmit() {
  const nameEl = document.getElementById('aiQaBillName');
  const amtEl = document.getElementById('aiQaBillAmount');
  const dayEl = document.getElementById('aiQaBillDueDay');
  const catEl = document.getElementById('aiQaBillCategory');

  const name = nameEl ? nameEl.value.trim() : '';
  const amount = amtEl ? resolveInputMathValue(amtEl) : 0;
  const dueDay = dayEl ? parseInt(dayEl.value, 10) || 15 : 15;
  const categoryIdOrName = catEl ? catEl.value : '__auto__';

  if (!name || isNaN(amount) || amount <= 0) {
    if (typeof showToast === 'function') showToast('Please enter a recurring bill name and valid amount.', 'warning');
    nameEl?.focus();
    return;
  }

  const res = executeAiCreateRecurringBill({ name, amount, dueDay, categoryIdOrName });
  if (res.ok) {
    if (nameEl) nameEl.value = '';
    if (amtEl) amtEl.value = '';
    closeFaqAiQuickAddDrawer();
    appendDirectAiExecutionBubble(`Quick-Add Recurring Bill: ${name}`, res, ['goto_bills']);
  }
}

/**
 * 1-Click "🪄 AI Auto-Suggest" — Analyzes the user's active workspace without requiring any prompt
 * and generates 1-click buttons to add smart Categories, Recurring Bills, and Frequent Expenses!
 */
const aiAutoSuggestActionMap = {};

function executeAiSuggestedItem(suggestKey, btnEl) {
  const spec = aiAutoSuggestActionMap[suggestKey];
  if (!spec) return;
  let res = null;
  if (spec.kind === 'category') {
    res = executeAiCreateCategory(spec.payload);
  } else if (spec.kind === 'expense') {
    res = executeAiCreateExpense(spec.payload);
  } else if (spec.kind === 'recurring') {
    res = executeAiCreateRecurringBill(spec.payload);
  }
  if (res && res.ok && btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = '✅ Added!';
    btnEl.classList.remove('btn-primary');
    btnEl.classList.add('btn-secondary');
    populateAiQuickAddCategorySelects();
  }
}
window.executeAiSuggestedItem = executeAiSuggestedItem;

function renderAiAutoSuggestCreationBubble() {
  const chatStream = document.getElementById('faqAiChatStream');
  if (!chatStream) return;

  const cur = appState.currency || '₱';
  const existingCatNames = new Set((appState.categories || []).map(c => c.name.toLowerCase()));
  const existingBillNames = new Set((appState.recurringBills || []).map(b => b.name.toLowerCase()));

  // 1. Find smart missing categories for this workspace
  const candidateCategories = [
    { name: 'Emergency Reserve', budgetAmount: 3000, budgetType: 'needs', icon: '🛡️' },
    { name: 'Coffee & Daily Snacks', budgetAmount: 1200, budgetType: 'wants', icon: '☕' },
    { name: 'Health & Fitness', budgetAmount: 1500, budgetType: 'needs', icon: '💪' },
    { name: 'Pet Care & Vet', budgetAmount: 2000, budgetType: 'needs', icon: '🐾' },
    { name: 'Subscriptions & Cloud', budgetAmount: 1000, budgetType: 'wants', icon: '🎬' },
    { name: 'Home Maintenance', budgetAmount: 1800, budgetType: 'needs', icon: '🏠' }
  ].filter(c => !existingCatNames.has(c.name.toLowerCase())).slice(0, 3);

  // 2. Find smart recurring bills (either from past expenses or common subscriptions/utilities)
  const candidateBills = [
    { name: 'Fiber Internet & Wi-Fi', amount: 1699, dueDay: 15 },
    { name: 'Electricity & Power Bill', amount: 2500, dueDay: 25 },
    { name: 'Netflix / Streaming Plan', amount: 549, dueDay: 10 },
    { name: 'Mobile Postpaid / Data Plan', amount: 999, dueDay: 20 }
  ].filter(b => !existingBillNames.has(b.name.toLowerCase())).slice(0, 3);

  let rowsHtml = '';
  candidateCategories.forEach((cat, idx) => {
    const key = `sug_cat_${Date.now()}_${idx}`;
    aiAutoSuggestActionMap[key] = { kind: 'category', payload: cat };
    rowsHtml += `
      <div class="faq-ai-suggest-row">
        <span>🏷️ <strong>Category: ${escapeFaqHtml(cat.icon + ' ' + cat.name)}</strong> (${fmtAiMoney(cat.budgetAmount, cur)}/mo • ${cat.budgetType === 'wants' ? 'Wants' : 'Needs'})</span>
        <button type="button" class="btn btn-primary btn-xs" onclick="executeAiSuggestedItem('${key}', this)">⚡ + Add Category</button>
      </div>
    `;
  });

  candidateBills.forEach((bill, idx) => {
    const key = `sug_bill_${Date.now()}_${idx}`;
    aiAutoSuggestActionMap[key] = { kind: 'recurring', payload: bill };
    rowsHtml += `
      <div class="faq-ai-suggest-row">
        <span>🔁 <strong>Recurring: ${escapeFaqHtml(bill.name)}</strong> (${fmtAiMoney(bill.amount, cur)}/mo • Due Day ${bill.dueDay})</span>
        <button type="button" class="btn btn-primary btn-xs" onclick="executeAiSuggestedItem('${key}', this)">⚡ + Add Recurring</button>
      </div>
    `;
  });

  chatStream.querySelectorAll('.faq-ai-msg.newly-arrived').forEach(el => {
    el.classList.remove('newly-arrived');
    const oldTag = el.querySelector('.faq-ai-new-response-tag');
    if (oldTag) oldTag.remove();
  });

  const msgEl = document.createElement('div');
  msgEl.className = 'faq-ai-msg assistant newly-arrived';
  msgEl.innerHTML = `<div class="faq-ai-avatar">🤖</div><div class="faq-ai-bubble"></div>`;
  chatStream.appendChild(msgEl);

  const introMd = `🪄 **AI Workspace Smart Suggestions (Zero-Typing 1-Click Add)**:\n- I analyzed your active workspace (**${(appState.categories || []).length} categories**, **${(appState.recurringBills || []).length} recurring bills**) and prepared ready-to-add items below.\n- Click **⚡ + Add** on any suggestion below—or use the **🏷️ + Category**, **💸 + Expense**, and **🔁 + Recurring** buttons at the top of the chat anytime!`;
  const postHtml = `<div class="faq-ai-suggest-grid">${rowsHtml}</div>`;

  streamAnimateAiResponse(msgEl.querySelector('.faq-ai-bubble'), formatAiMarkdown(introMd), postHtml, chatStream);
}

/**
 * Helper to split multi-item user creation commands into individual item segments.
 * Supports:
 * 1. Multi-line inputs (newlines with or without bullets/numbers)
 * 2. Delimited single-line lists (commas, semicolons, and "and" between multiple amount items)
 */
function splitAiCreationMultiSegments(rawBody) {
  if (!rawBody) return [];
  const lines = rawBody.split(/\r?\n+/).map(l => l.replace(/^[\s*\-•\d.)\]]+/, '').trim()).filter(Boolean);
  if (lines.length > 1) {
    return lines;
  }
  let parts = rawBody.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
  const expanded = [];
  parts.forEach(part => {
    if (/\band\b/i.test(part)) {
      const subParts = part.split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean);
      const hasNumber = (str) => /\d/.test(str);
      if (subParts.length > 1 && subParts.every(hasNumber)) {
        expanded.push(...subParts);
        return;
      }
    }
    expanded.push(part);
  });
  return expanded.filter(Boolean);
}

function cleanAiCommandLeadingColonOrPreposition(str) {
  return str.replace(/^[:\s-]+/, '').replace(/^(?:called|named|for)\s+/i, '').trim();
}

/**
 * [NIRVAI-FEAT-AFFORD] "Before You Buy" Affordability Advisor:
 * Mathematically evaluates whether the user can afford a proposed purchase without jeopardizing
 * upcoming bills, envelope budgets, or daily Safe-to-Spend allowances before their next 15th/30th paycheck.
 */
function tryExecuteAffordabilityAdvisor(userQuestion) {
  const raw = String(userQuestion || '').trim();
  const q = raw.toLowerCase();

  // Pattern matching: "Can I afford...", "Should I buy...", "Is it safe to buy...", "Can I buy...", "Afford 3500 shoes"
  const isAffordQuery =
    /^(can\s+i\s+(afford|buy|purchase|spend|get)|should\s+i\s+(buy|get|purchase|spend)|is\s+it\s+(okay|safe|wise|good)\s+to\s+(buy|spend|get)|afford)\b/i.test(raw) ||
    /\b(can\s+i\s+afford|can\s+i\s+buy|should\s+i\s+buy|safe\s+to\s+buy|afford\s+this|afford\s+to\s+buy)\b/i.test(q);

  if (!isAffordQuery) return null;

  // Extract amount: Matches $3500, ₱3,500, 3500, 3.5k, 120 usd, etc.
  let parsedAmt = null;
  const amtMatch = raw.match(/(?:[\$₱€£¥]\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k|m)?\b/i);
  if (amtMatch) {
    let num = parseFloat(amtMatch[1].replace(/,/g, ''));
    if (amtMatch[2] && amtMatch[2].toLowerCase() === 'k') num *= 1000;
    if (amtMatch[2] && amtMatch[2].toLowerCase() === 'm') num *= 1000000;
    if (!isNaN(num) && num > 0) parsedAmt = num;
  }

  if (!parsedAmt) {
    return {
      answerText: `To tell you if you can comfortably afford something, I need the price!\n\n💡 *Example: Try asking "Can I afford ₱3,500 for sneakers?" or "Should I buy a coffee machine for $120?"*`,
      cardHtml: '',
      actionIds: ['goto_dashboard', 'goto_budget']
    };
  }

  // Extract description: remove trigger phrase and amount
  let desc = raw
    .replace(/^(can\s+i\s+(afford|buy|purchase|spend|get)|should\s+i\s+(buy|get|purchase|spend)|is\s+it\s+(okay|safe|wise|good)\s+to\s+(buy|spend|get)|afford)\s+/i, '')
    .replace(/(?:for|worth|costing|priced\s+at)?\s*(?:[\$₱€£¥]\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k|m)?\b/i, '')
    .replace(/^(for|a|an|the|this|some)\s+/i, '')
    .replace(/\b(today|right\s+now|this\s+week|this\s+month|kanina)\b/gi, '')
    .replace(/[?!.]+$/, '')
    .trim();

  if (!desc || desc.length < 2) desc = 'this purchase';

  const cur = (typeof appState !== 'undefined' && appState.currency) ? appState.currency : '₱';
  const m = (typeof calculateMetrics === 'function') ? calculateMetrics() : { totalBudget: 0, totalExpenses: 0, totalIncome: 0 };
  const totalBudget = m.totalBudget || 0;
  const totalSpent = m.totalExpenses || 0;
  const budgetRemaining = Math.max(0, totalBudget - totalSpent);

  // Paycheck Cycle & Days Left Calculation
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  let nextPaycheckDay = 15;
  let paycheckLabel = '15th Paycheck';
  if (currentDay < 15) {
    nextPaycheckDay = 15;
    paycheckLabel = '15th Paycheck';
  } else {
    nextPaycheckDay = daysInMonth;
    paycheckLabel = `${daysInMonth}th (End-of-Month) Paycheck`;
  }
  const daysUntilPaycheck = Math.max(1, nextPaycheckDay - currentDay);

  // Identify Pending Recurring Bills due between today and next payday
  const todayStr = (typeof billTodayStr === 'function') ? billTodayStr() : now.toISOString().split('T')[0];
  const pad = n => String(n).padStart(2, '0');
  const nextPaycheckDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(nextPaycheckDay)}`;
  
  const upcomingBills = (appState.recurringBills || []).filter(b => {
    if (b.active === false) return false;
    const st = (typeof getBillStatus === 'function') ? getBillStatus(b) : null;
    if (!st || !st.next) return false;
    return st.next >= todayStr && st.next <= nextPaycheckDateStr;
  });
  const upcomingBillsTotal = upcomingBills.reduce((acc, b) => acc + (b.amount || 0), 0);

  // Resolve Category Envelope
  const matchedCat = (typeof smartResolveOrAutoCreateCategory === 'function') 
    ? smartResolveOrAutoCreateCategory('__auto__', desc) 
    : null;
  const catName = matchedCat ? matchedCat.name : 'Discretionary';
  const catIcon = matchedCat ? (matchedCat.icon || '🛍️') : '🛍️';
  const catBudget = (matchedCat && appState.budgets && appState.budgets[appState.activeMonth] && appState.budgets[appState.activeMonth][matchedCat.id] !== undefined)
    ? appState.budgets[appState.activeMonth][matchedCat.id]
    : (matchedCat ? matchedCat.defaultBudget || 0 : 0);
  
  const catExpenses = (appState.expenses || []).filter(e => {
    const isThisMonth = e.date && e.date.startsWith(appState.activeMonth);
    return isThisMonth && matchedCat && e.categoryId === matchedCat.id;
  });
  const catSpent = catExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const catRemaining = Math.max(0, catBudget - catSpent);

  // Safe-to-Spend Calculation
  const liquidBuffer = Math.max(0, budgetRemaining - upcomingBillsTotal);
  const currentDailySafe = daysUntilPaycheck > 0 ? (liquidBuffer / daysUntilPaycheck) : 0;
  const newLiquidBuffer = Math.max(0, liquidBuffer - parsedAmt);
  const newDailySafe = daysUntilPaycheck > 0 ? (newLiquidBuffer / daysUntilPaycheck) : 0;

  // Verdict Determination
  let verdictType = 'approved';
  let verdictBadge = '🟢 COMFORTABLY AFFORDABLE';
  let verdictClass = 'afford-approved';
  let adviceBullets = [];

  if (parsedAmt > budgetRemaining) {
    verdictType = 'deficit';
    verdictBadge = '🔴 OVER-BUDGET DEFICIT';
    verdictClass = 'afford-deficit';
    adviceBullets.push(`⚠️ **Exceeds Total Budget**: You only have **${fmtAiMoney(budgetRemaining, cur)}** remaining in your entire monthly budget.`);
    adviceBullets.push(`💸 **Shortfall**: Spending **${fmtAiMoney(parsedAmt, cur)}** causes a **-${fmtAiMoney(parsedAmt - budgetRemaining, cur)} deficit**.`);
    adviceBullets.push(`💡 **Action Plan**: Wait until your **${paycheckLabel}** or draw from your emergency/surplus buffer.`);
  } else if (parsedAmt > liquidBuffer && upcomingBillsTotal > 0) {
    verdictType = 'warning';
    verdictBadge = '⚠️ BILL COLLISION RISK';
    verdictClass = 'afford-warning';
    adviceBullets.push(`🔒 **Bills Locked**: You have **${fmtAiMoney(budgetRemaining, cur)}** balance, but **${fmtAiMoney(upcomingBillsTotal, cur)} is committed** to ${upcomingBills.length} upcoming bill${upcomingBills.length === 1 ? '' : 's'} (${upcomingBills.map(b => b.name).join(', ')}) due before payday.`);
    adviceBullets.push(`📉 **Risk**: Buying this now leaves you short by **${fmtAiMoney(parsedAmt - liquidBuffer, cur)}** for scheduled bills.`);
    adviceBullets.push(`💡 **Action Plan**: Pay your bills first, then re-assess after your **${paycheckLabel}**.`);
  } else if (matchedCat && catBudget > 0 && parsedAmt > catRemaining) {
    verdictType = 'caution';
    verdictBadge = '🟡 ENVELOPE OVERSPEND';
    verdictClass = 'afford-caution';
    adviceBullets.push(`📦 **Category Envelope Strained**: You have **${fmtAiMoney(catRemaining, cur)}** remaining in **${catIcon} ${catName}**.`);
    adviceBullets.push(`📊 **Safe-to-Spend**: Your daily safe allowance will drop from **${fmtAiMoney(currentDailySafe, cur)}/day** down to **${fmtAiMoney(newDailySafe, cur)}/day** for the next **${daysUntilPaycheck} days**.`);
    adviceBullets.push(`💡 **Action Plan**: Safe to buy IF you reallocate **${fmtAiMoney(parsedAmt - catRemaining, cur)}** from another envelope.`);
  } else {
    verdictType = 'approved';
    verdictBadge = '🟢 GREEN LIGHT — AFFORDABLE';
    verdictClass = 'afford-approved';
    adviceBullets.push(`✅ **Envelope Covered**: Your **${catIcon} ${catName}** envelope has **${fmtAiMoney(catRemaining, cur)}** remaining.`);
    adviceBullets.push(`🛡️ **Commitments Safe**: All **${fmtAiMoney(upcomingBillsTotal, cur)} in upcoming bills** due before your **${paycheckLabel}** (${daysUntilPaycheck} days away) remain 100% funded.`);
    adviceBullets.push(`⚡ **Daily Allowance**: You will still have a healthy **${fmtAiMoney(newDailySafe, cur)}/day** Safe-to-Spend.`);
  }

  const answerText = `### ${verdictBadge}\n\nHere is NirvAI's real-time financial assessment for **${desc}** (${fmtAiMoney(parsedAmt, cur)}):\n\n${adviceBullets.map(b => `• ${b}`).join('\n\n')}`;

  const cleanDescEscaped = desc.replace(/'/g, "\\'");
  const catIdEscaped = (matchedCat ? matchedCat.id : '').replace(/'/g, "\\'");
  const actionButton = verdictType !== 'deficit'
    ? `<button type="button" class="btn btn-primary btn-sm btn-ai-log-approved" onclick="executeAiAffordabilityLog('${cleanDescEscaped}', ${parsedAmt}, '${catIdEscaped}')">💸 Log This Expense Now (${fmtAiMoney(parsedAmt, cur)})</button>`
    : `<button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('budget')">📊 View Budget & Surplus</button>`;

  const cardHtml = `
    <div class="ai-affordability-card ${verdictClass}">
      <div class="ai-afford-header">
        <span class="ai-afford-badge">${verdictBadge}</span>
        <span class="ai-afford-item">${catIcon} ${escapeFaqHtml(desc)} • <strong>${fmtAiMoney(parsedAmt, cur)}</strong></span>
      </div>
      <div class="ai-afford-grid">
        <div class="ai-afford-stat">
          <span class="afford-label">Remaining in ${escapeFaqHtml(catName)}</span>
          <span class="afford-val ${catRemaining < parsedAmt ? 'text-amber' : 'text-emerald'}">${fmtAiMoney(catRemaining, cur)}</span>
        </div>
        <div class="ai-afford-stat">
          <span class="afford-label">Bills Due Before Payday</span>
          <span class="afford-val text-cyan">${fmtAiMoney(upcomingBillsTotal, cur)} (${daysUntilPaycheck}d left)</span>
        </div>
        <div class="ai-afford-stat">
          <span class="afford-label">Safe Daily Allowance</span>
          <span class="afford-val ${newDailySafe < 100 ? 'text-amber' : 'text-emerald'}">${fmtAiMoney(currentDailySafe, cur)} ➔ ${fmtAiMoney(newDailySafe, cur)}/d</span>
        </div>
      </div>
      <div class="ai-afford-footer">
        ${actionButton}
      </div>
    </div>
  `;

  return {
    answerText,
    cardHtml,
    actionIds: ['goto_dashboard', 'goto_budget', 'goto_bills']
  };
}

window.executeAiAffordabilityLog = function(description, amount, categoryId) {
  if (typeof executeAiCreateExpense === 'function') {
    const res = executeAiCreateExpense({
      description,
      amount,
      categoryIdOrName: categoryId || '__auto__',
      paymentMethod: 'Credit Card'
    });
    if (res && res.ok && typeof showToast === 'function') {
      showToast(`Logged "${description}" (${(typeof formatCurrency === 'function') ? formatCurrency(amount) : amount}) via NirvAI!`, 'success');
      const chatStream = document.getElementById('faqAiChatStream');
      if (chatStream) {
        const confirmBubble = document.createElement('div');
        confirmBubble.className = 'faq-ai-msg assistant newly-arrived';
        confirmBubble.innerHTML = `
          <div class="faq-ai-avatar">🤖</div>
          <div class="faq-ai-bubble">
            <p>✅ **Expense Logged!** Recorded <strong>${escapeFaqHtml(description)}</strong> for <strong>${(typeof formatCurrency === 'function') ? formatCurrency(amount) : amount}</strong> under ${escapeFaqHtml(res.summaryTitle || 'Expenses')}!</p>
          </div>
        `;
        chatStream.appendChild(confirmBubble);
        chatStream.scrollTop = chatStream.scrollHeight;
      }
    }
  }
};

/**
 * [NIRVAI-FEAT-REBALANCE] Smart Envelope Rebalancer Engine:
 * Analyzes active month category envelopes to identify overspent envelopes
 * and automatically finds donor envelopes with healthy surplus buffers.
 */
function findRebalanceCandidates(targetCategoryId, optionalAdditionalAmt = 0) {
  if (!appState || !Array.isArray(appState.categories)) return null;

  const month = appState.activeMonth || new Date().toISOString().slice(0, 7);
  const budgets = appState.budgets[month] || {};
  const excluded = (appState.excludedCategoriesByMonth && appState.excludedCategoriesByMonth[month]) || [];

  const targetCat = appState.categories.find(c => c.id === targetCategoryId);
  if (!targetCat) return null;

  const targetBudget = budgets[targetCategoryId] !== undefined ? budgets[targetCategoryId] : (targetCat.defaultBudget || 0);
  const targetSpent = (appState.expenses || [])
    .filter(e => e.categoryId === targetCategoryId && e.date && e.date.startsWith(month))
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const deficit = Math.max(0, targetSpent - targetBudget);
  if (deficit <= 0 && optionalAdditionalAmt <= 0) return null;

  const neededTransfer = deficit > 0 ? deficit : optionalAdditionalAmt;

  // Search candidate envelopes with remaining budget
  const donors = [];
  appState.categories.forEach(cat => {
    if (cat.id === targetCategoryId || excluded.includes(cat.id)) return;
    const b = budgets[cat.id] !== undefined ? budgets[cat.id] : (cat.defaultBudget || 0);
    if (b <= 0) return;
    const s = (appState.expenses || [])
      .filter(e => e.categoryId === cat.id && e.date && e.date.startsWith(month))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const surplus = b - s;
    if (surplus > 10) {
      donors.push({
        id: cat.id,
        name: cat.name,
        icon: cat.icon || '📦',
        budget: b,
        spent: s,
        surplus: Math.round(surplus * 100) / 100
      });
    }
  });

  // Sort by highest surplus first
  donors.sort((a, b) => b.surplus - a.surplus);

  return {
    targetCat,
    deficit: Math.round(neededTransfer * 100) / 100,
    candidate: donors.length > 0 ? donors[0] : null,
    allDonors: donors
  };
}

/**
 * 1-Tap Rebalance Execution:
 * Safely transfers funds from donor envelope to deficit envelope without mutating total budget.
 */
function executeAiRebalanceOverspend(deficitCatId, donorCatId, amount, btnEl) {
  if (!deficitCatId || !donorCatId || !(amount > 0)) return;

  const month = appState.activeMonth || new Date().toISOString().slice(0, 7);
  if (!appState.budgets[month]) appState.budgets[month] = {};

  const deficitCat = appState.categories.find(c => c.id === deficitCatId);
  const donorCat = appState.categories.find(c => c.id === donorCatId);
  if (!deficitCat || !donorCat) return;

  const curDeficitBudget = appState.budgets[month][deficitCatId] !== undefined 
    ? appState.budgets[month][deficitCatId] 
    : (deficitCat.defaultBudget || 0);
  const curDonorBudget = appState.budgets[month][donorCatId] !== undefined 
    ? appState.budgets[month][donorCatId] 
    : (donorCat.defaultBudget || 0);

  const transferAmt = Math.min(curDonorBudget, Math.round(amount * 100) / 100);
  if (transferAmt <= 0) {
    if (typeof showToast === 'function') showToast('Insufficient surplus in donor envelope.', 'warning');
    return;
  }

  // Execute transfer in memory
  appState.budgets[month][deficitCatId] = curDeficitBudget + transferAmt;
  appState.budgets[month][donorCatId] = curDonorBudget - transferAmt;

  // Persist safely
  saveData();
  if (typeof saveActiveWorkspaceContainer === 'function') saveActiveWorkspaceContainer();
  if (typeof updateAllViews === 'function') updateAllViews();

  const cur = appState.currency || '₱';
  if (typeof showToast === 'function') {
    showToast(`⚡ Rebalanced! Transferred ${cur}${transferAmt.toFixed(2)} from "${donorCat.name}" to "${deficitCat.name}"!`, 'success');
  }

  if (btnEl) {
    btnEl.disabled = true;
    btnEl.classList.remove('btn-warning');
    btnEl.classList.add('btn-secondary');
    btnEl.innerHTML = '✅ Rebalanced';
  }

  // Append confirmation in chat
  const chatStream = document.getElementById('faqAiChatStream');
  if (chatStream) {
    const confirmBubble = document.createElement('div');
    confirmBubble.className = 'faq-ai-msg assistant newly-arrived';
    confirmBubble.innerHTML = `
      <div class="faq-ai-avatar">🤖</div>
      <div class="faq-ai-bubble">
        <p>⚡ **Budget Rebalance Complete!**</p>
        <p>Successfully transferred <strong>${cur}${transferAmt.toFixed(2)}</strong> from <strong>${donorCat.icon || '📦'} ${escapeFaqHtml(donorCat.name)}</strong> to eliminate the deficit in <strong>${deficitCat.icon || '📦'} ${escapeFaqHtml(deficitCat.name)}</strong>.</p>
        <p style="font-size:0.76rem; color:var(--text-muted); margin-bottom:0;">Your total monthly budget allocation remains exactly unchanged.</p>
      </div>
    `;
    chatStream.appendChild(confirmBubble);
    chatStream.scrollTop = chatStream.scrollHeight;
  }
}
window.findRebalanceCandidates = findRebalanceCandidates;
window.executeAiRebalanceOverspend = executeAiRebalanceOverspend;

/**
 * Natural language rebalancer query handler (e.g. "Rebalance my budget", "Fix my overspent categories", "Any budget deficits?")
 */
function tryExecuteSmartRebalancerQuery(userQuestion) {
  const raw = String(userQuestion || '').trim().toLowerCase();
  const isRebalanceQuery = 
    /rebalance\s+(my\s+)?(budget|envelopes|categories)/i.test(raw) ||
    /fix\s+(my\s+)?(overspend|deficits|envelopes|budget)/i.test(raw) ||
    /rescue\s+(my\s+)?(budget|overspend)/i.test(raw) ||
    /balance\s+(my\s+)?(budget|envelopes)/i.test(raw);

  if (!isRebalanceQuery) return null;

  const month = appState.activeMonth || new Date().toISOString().slice(0, 7);
  const budgets = appState.budgets[month] || {};
  const cur = appState.currency || '₱';

  const overspentList = [];
  appState.categories.forEach(cat => {
    const b = budgets[cat.id] !== undefined ? budgets[cat.id] : (cat.defaultBudget || 0);
    const s = (appState.expenses || [])
      .filter(e => e.categoryId === cat.id && e.date && e.date.startsWith(month))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    if (b > 0 && s > b) {
      overspentList.push({ cat, budget: b, spent: s, deficit: s - b });
    }
  });

  if (overspentList.length === 0) {
    return {
      answerText: `🎉 **Good news! None of your category envelopes are overspent for ${formatMonthLabel(month)}.**\n\nAll your spending is within your allocated limits. Keep up the disciplined budgeting!`,
      cardHtml: '',
      actionIds: ['goto_budget', 'goto_dashboard']
    };
  }

  // For the primary overspent category, find donor
  const primary = overspentList[0];
  const rescueData = findRebalanceCandidates(primary.cat.id);

  let rescueCardHtml = '';
  if (rescueData && rescueData.candidate) {
    rescueCardHtml = `
      <div class="ai-overspend-rescue-bar" style="margin-top:10px;">
        <div class="ai-rescue-text">
          <span>🚨 <strong>${escapeFaqHtml(primary.cat.name)}</strong> is ${cur}${primary.deficit.toFixed(2)} over budget.</span>
          <small style="display:block; color:var(--text-secondary); margin-top:2px;">
            💡 <strong>Donor Envelope Found:</strong> Transfer from <strong>${escapeFaqHtml(rescueData.candidate.name)}</strong> (+${cur}${rescueData.candidate.surplus.toFixed(2)} available surplus).
          </small>
        </div>
        <button type="button" class="btn btn-warning btn-xs btn-ai-rebalance-now" onclick="executeAiRebalanceOverspend('${primary.cat.id}', '${rescueData.candidate.id}', ${primary.deficit}, this)">
          ⚡ 1-Tap Rebalance
        </button>
      </div>
    `;
  }

  const lines = overspentList.map(o => `• **${o.cat.icon || '📦'} ${o.cat.name}**: ${cur}${o.spent.toFixed(2)} spent / ${cur}${o.budget.toFixed(2)} budget (🔴 **-${cur}${o.deficit.toFixed(2)} deficit**)`).join('\n');
  const answerText = `### ⚖️ Smart Envelope Rebalance Analysis\n\nI identified **${overspentList.length} overspent category envelope${overspentList.length === 1 ? '' : 's'}** this month:\n\n${lines}\n\n${rescueData && rescueData.candidate ? `I found **${rescueData.candidate.icon} ${rescueData.candidate.name}** with **+${cur}${rescueData.candidate.surplus.toFixed(2)}** in unspent surplus that can immediately absorb this deficit without increasing your total budget.` : 'No single envelope has enough surplus right now, but you can review your allocations below.'}`;

  return {
    answerText,
    cardHtml: rescueCardHtml,
    actionIds: ['goto_budget', 'goto_dashboard']
  };
}

/**
 * [NIRVAI-FEAT-SUBS] Subscription Bleed & Zombie Commitments Auditor:
 * Scans active recurring bills, detects inactive subscriptions, calculates annualized costs,
 * and identifies potential monthly savings.
 */
function tryExecuteSubscriptionBleedAudit(userQuestion) {
  const raw = String(userQuestion || '').trim().toLowerCase();
  const isSubAuditQuery =
    /subscription(s)?\s+(bleed|audit|check|review|drain|cost)/i.test(raw) ||
    /audit\s+(my\s+)?(subscription|subscriptions|recurring|bills)/i.test(raw) ||
    /zombie\s+(subscription|subscriptions|bills|commitments)/i.test(raw) ||
    /recurring\s+(bleed|leak|audit)/i.test(raw);

  if (!isSubAuditQuery) return null;

  const cur = appState.currency || '₱';
  const bills = (appState.recurringBills || []).filter(b => b.active !== false);

  if (bills.length === 0) {
    return {
      answerText: `🛡️ **No active recurring bills or subscriptions found in this workspace.**\n\nYou currently have zero recurring overhead! When you add subscriptions, I will continuously audit them for price creeps and annual cost bleed.`,
      cardHtml: '',
      actionIds: ['add_bill', 'goto_bills']
    };
  }

  const monthlyTotal = bills.reduce((sum, b) => sum + (b.amount || 0), 0);
  const annualTotal = monthlyTotal * 12;

  // Sort by highest monthly cost first
  const sortedBills = [...bills].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const topSubscriptions = sortedBills.slice(0, 5);

  const lines = topSubscriptions.map(b => {
    const yr = (b.amount || 0) * 12;
    return `• **${escapeFaqHtml(b.name)}**: ${fmtAiMoney(b.amount, cur)}/mo ➔ **${fmtAiMoney(yr, cur)}/yr** (Due: ${b.dueDay || 15}th)`;
  }).join('\n');

  const answerText = `### 🔍 Subscription Bleed & Commitments Audit\n\n` +
    `NirvAI analyzed **${bills.length} active recurring commitment${bills.length === 1 ? '' : 's'}**:\n\n` +
    `• 💸 **Monthly Fixed Outflow**: **${fmtAiMoney(monthlyTotal, cur)}/month**\n` +
    `• 📈 **Annualized Commitment**: **${fmtAiMoney(annualTotal, cur)}/year**\n\n` +
    `**Top Commitments Ranked by Annual Cost:**\n${lines}\n\n` +
    `💡 **NirvAI Pro-Tip**: Pausing just 1 or 2 unused services could immediately reclaim **${fmtAiMoney(sortedBills[0]?.amount || 0, cur)}/month** back to your Safe-to-Spend daily allowance!`;

  const cardHtml = `
    <div class="ai-affordability-card afford-warning">
      <div class="ai-afford-header">
        <span class="ai-afford-badge">🔍 ANNUAL RECURRING COMMITMENT</span>
        <span class="ai-afford-item">${bills.length} Active Subscriptions • <strong>${fmtAiMoney(annualTotal, cur)}/yr</strong></span>
      </div>
      <div class="ai-afford-grid">
        <div class="ai-afford-stat">
          <span class="afford-label">Monthly Drain</span>
          <span class="afford-val text-amber">${fmtAiMoney(monthlyTotal, cur)}/mo</span>
        </div>
        <div class="ai-afford-stat">
          <span class="afford-label">Annualized Total</span>
          <span class="afford-val text-cyan">${fmtAiMoney(annualTotal, cur)}/yr</span>
        </div>
        <div class="ai-afford-stat">
          <span class="afford-label">Heaviest Service</span>
          <span class="afford-val text-emerald">${escapeFaqHtml(sortedBills[0]?.name || 'None')}</span>
        </div>
      </div>
      <div class="ai-afford-footer">
        <button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('bills')">📋 Manage Recurring Bills</button>
      </div>
    </div>
  `;

  return {
    answerText,
    cardHtml,
    actionIds: ['goto_bills', 'add_bill']
  };
}

/**
 * [NIRVAI-FEAT-BRIEF] Proactive Sunday Evening Financial Briefing:
 * Generates an executive synthesis of weekly velocity, envelope health, bills due, and next week's safe allowance.
 */
function tryExecuteWeeklyFinancialBriefing(userQuestion) {
  const raw = String(userQuestion || '').trim().toLowerCase();
  const isBriefingQuery =
    /weekly\s+(briefing|summary|report|recap|digest|review)/i.test(raw) ||
    /sunday\s+(briefing|recap|review)/i.test(raw) ||
    /how\s+did\s+i\s+do\s+this\s+week/i.test(raw) ||
    /financial\s+briefing/i.test(raw);

  if (!isBriefingQuery) return null;

  const cur = appState.currency || '₱';
  const m = (typeof calculateMetrics === 'function') ? calculateMetrics() : { totalBudget: 0, totalExpenses: 0, totalIncome: 0 };
  const month = appState.activeMonth || new Date().toISOString().slice(0, 7);

  // Calculate 7-day spending velocity
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  const last7DaysExpenses = (appState.expenses || []).filter(e => e.date && e.date >= sevenDaysAgo);
  const last7DaysTotal = last7DaysExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Upcoming bills due in the next 7 days
  const in7DaysStr = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];
  const next7DaysBills = (appState.recurringBills || []).filter(b => {
    if (b.active === false) return false;
    const st = (typeof getBillStatus === 'function') ? getBillStatus(b) : null;
    return st && st.next && st.next >= todayStr && st.next <= in7DaysStr;
  });
  const upcomingBills7Days = next7DaysBills.reduce((sum, b) => sum + (b.amount || 0), 0);

  const budgetRemaining = Math.max(0, (m.totalBudget || 0) - (m.totalExpenses || 0));
  const utilization = m.totalBudget > 0 ? ((m.totalExpenses || 0) / m.totalBudget) * 100 : 0;

  const answerText = `### ☕ Executive Sunday Financial Briefing (${formatMonthLabel(month)})\n\n` +
    `Here is your 7-day velocity and financial briefing:\n\n` +
    `• 📊 **7-Day Spend Velocity**: You spent **${fmtAiMoney(last7DaysTotal, cur)}** across **${last7DaysExpenses.length} transactions** this past week.\n` +
    `• 🎯 **Monthly Budget Utilization**: **${utilization.toFixed(1)}% utilized** (${fmtAiMoney(m.totalExpenses || 0, cur)} spent of ${fmtAiMoney(m.totalBudget || 0, cur)} budget) with **${fmtAiMoney(budgetRemaining, cur)} remaining**.\n` +
    `• 🗓️ **Due This Week**: **${next7DaysBills.length} scheduled bill${next7DaysBills.length === 1 ? '' : 's'}** totaling **${fmtAiMoney(upcomingBills7Days, cur)}** are coming due in the next 7 days (${next7DaysBills.map(b => b.name).join(', ') || 'None'}).\n` +
    `• ⚡ **Safe-to-Spend Readiness**: Your liquid buffer is protected, and your daily allowance is ready for the upcoming week.\n\n` +
    `💡 *Tip: Click below to inspect your category variances or log upcoming cash flows.*`;

  const cardHtml = `
    <div class="ai-affordability-card afford-approved">
      <div class="ai-afford-header">
        <span class="ai-afford-badge">📊 WEEKLY FINANCIAL BRIEFING</span>
        <span class="ai-afford-item">Past 7 Days: <strong>${fmtAiMoney(last7DaysTotal, cur)} spent</strong></span>
      </div>
      <div class="ai-afford-grid">
        <div class="ai-afford-stat">
          <span class="afford-label">7-Day Spend</span>
          <span class="afford-val text-cyan">${fmtAiMoney(last7DaysTotal, cur)}</span>
        </div>
        <div class="ai-afford-stat">
          <span class="afford-label">Remaining Budget</span>
          <span class="afford-val text-emerald">${fmtAiMoney(budgetRemaining, cur)}</span>
        </div>
        <div class="ai-afford-stat">
          <span class="afford-label">Bills Due in 7 Days</span>
          <span class="afford-val text-amber">${fmtAiMoney(upcomingBills7Days, cur)} (${next7DaysBills.length})</span>
        </div>
      </div>
      <div class="ai-afford-footer">
        <button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('dashboard')">📈 View Executive Dashboard</button>
      </div>
    </div>
  `;

  return {
    answerText,
    cardHtml,
    actionIds: ['goto_dashboard', 'goto_analytics', 'goto_bills']
  };
}

/**
 * Natural Language AI Command Executor:
 * Detects if the user asked the AI to add/create/log single or MULTIPLE Categories, One-Time Expenses, or Recurring Bills
 * (e.g., "Add categories Gym 2000, Internet 1500, Pet Care 800", "Log expenses Starbucks 190, Shell Gas 1500", "Add recurring bills Netflix 549 on 15th, Spotify 149 on 20th").
 * Safely executes each item, syncs in real time with active workspace ledger, and renders a 1-Click Master Batch Undo!
 */
function tryExecuteNaturalLanguageAiCreation(userQuestion) {
  const raw = String(userQuestion || '').trim();
  const q = raw.toLowerCase();

  // Only trigger if the sentence starts with or clearly expresses a creation command with a number/name
  const isCommand = /^(add|create|log|record|new|schedule|set\s+up)\s+/i.test(raw) ||
                    /^can\s+you\s+(add|create|log|record)\s+/i.test(raw) ||
                    /^please\s+(add|create|log|record)\s+/i.test(raw);
  if (!isCommand) return null;

  // Avoid matching general "how do I add..." questions
  if (/^(how|where|what|why|when|can\s+i)\b/i.test(raw)) return null;

  const cleanCmd = raw.replace(/^(can\s+you\s+|please\s+)/i, '').trim();

  // 1. Recurring Bills / Subscriptions Command (Single or Multi-Item)
  if (/\b(recurring\s+expenses|recurring\s+bills|recurring\s+expense|recurring\s+bill|recurring|subscriptions|subscription|monthly\s+bills|monthly\s+bill|bills|bill)\b/i.test(cleanCmd)) {
    const body = cleanAiCommandLeadingColonOrPreposition(
      cleanCmd.replace(/^(add|create|log|record|new|schedule|set\s+up)\s+(a\s+)?(new\s+)?(multiple\s+|\d+\s+)?(recurring\s+expenses|recurring\s+bills|recurring\s+expense|recurring\s+bill|recurring|subscriptions|subscription|monthly\s+bills|monthly\s+bill|bills|bill)\b/i, '')
    );
    const segments = splitAiCreationMultiSegments(body);
    const successResults = [];

    segments.forEach(seg => {
      let s = seg.trim();
      let dueDay = 15;
      const dayMatch = s.match(/(?:every|on\s+day|due\s+day|due\s+on|on\s+the|on|due)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
      if (dayMatch) {
        dueDay = Math.min(31, Math.max(1, parseInt(dayMatch[1], 10)));
        s = s.replace(dayMatch[0], ' ');
      }

      const amtMatch = s.match(/(?:₱|\$|php|usd)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i);
      if (amtMatch) {
        const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
        const namePart = s
          .replace(amtMatch[0], ' ')
          .replace(/\b(for|at|with|amount|budget|pesos|dollars|monthly|every\s+month|per\s+month)\b/gi, ' ')
          .replace(/\b(bill|subscription)\b/gi, ' ')
          .replace(/^[:\-\s]+|[:\-\s]+$/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (namePart && amount > 0) {
          const res = executeAiCreateRecurringBill({ name: namePart, amount, dueDay });
          if (res && res.ok) successResults.push(res);
        }
      }
    });

    if (successResults.length === 1) {
      return {
        answerText: successResults[0].markdownMsg,
        executedCardHtml: renderAiExecutedActionCardHtml(successResults[0]),
        actionIds: ['goto_bills']
      };
    } else if (successResults.length > 1) {
      const cur = appState.currency || '₱';
      const batchUndoKey = 'undo_batch_rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      aiCreatedItemsUndoRegistry[batchUndoKey] = () => {
        successResults.slice().reverse().forEach(res => {
          if (res.undoKey && typeof aiCreatedItemsUndoRegistry[res.undoKey] === 'function') {
            aiCreatedItemsUndoRegistry[res.undoKey]();
            delete aiCreatedItemsUndoRegistry[res.undoKey];
          }
        });
        if (typeof showToast === 'function') {
          showToast(`↩️ Undid batch of ${successResults.length} recurring bills.`, 'info');
        }
      };

      const lines = successResults.map(r => `- ${r.summaryTitle} (${r.summaryDetail})`).join('\n');
      const answerText = `✅ **AI Successfully Scheduled ${successResults.length} Recurring Bills** to your active workspace:\n${lines}\n- All bills have **Auto-Post** enabled and are synced in real time. Click **↩️ Undo All** or undo individual bills below anytime!`;

      return {
        answerText,
        executedCardHtml: renderAiBatchExecutedActionCardHtml({
          itemType: `${successResults.length} Recurring Bills Added`,
          summaryTitle: `${successResults.length} Bills Scheduled in Real Time`,
          batchUndoKey,
          items: successResults
        }),
        actionIds: ['goto_bills']
      };
    }
  }

  // 2. Categories Command (Single or Multi-Item)
  if (/\b(categories|category|envelopes|envelope)\b/i.test(cleanCmd)) {
    const rawPrefix = cleanCmd.replace(/(categories|category|envelopes|envelope)[\s\S]*$/i, '$1');
    const isWantsHeader = /\bwants?\b/i.test(rawPrefix);
    const isNeedsHeader = /\bneeds?\b/i.test(rawPrefix);
    const defaultBudgetType = isWantsHeader ? 'wants' : (isNeedsHeader ? 'needs' : '');

    const body = cleanAiCommandLeadingColonOrPreposition(
      cleanCmd.replace(/^(add|create|new|set\s+up)\s+(a\s+)?(new\s+)?(multiple\s+|\d+\s+)?(wants?\s+|needs?\s+)?(budget\s+)?(categories|category|envelopes|envelope)\b/i, '')
    );
    const segments = splitAiCreationMultiSegments(body);
    const successResults = [];

    segments.forEach(seg => {
      let s = seg.trim();
      const isWants = /\b(wants?)\b/i.test(s);
      const isNeeds = /\b(needs?)\b/i.test(s);
      const budgetType = isWants ? 'wants' : (isNeeds ? 'needs' : defaultBudgetType);
      s = s.replace(/\((?:needs?|wants?)\)/gi, ' ');

      const amtMatch = s.match(/(?:₱|\$|php|usd)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i);
      const budgetAmount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : 0;

      let namePart = (amtMatch ? s.replace(amtMatch[0], ' ') : s)
        .replace(/\b(with\s+budget|budget|cap|of|for|pesos|dollars|wants?|needs?|monthly|envelope)\b/gi, ' ')
        .replace(/[()[\]{}]/g, ' ')
        .replace(/^[:\-\s]+|[:\-\s]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (namePart) {
        const res = executeAiCreateCategory({
          name: namePart,
          budgetAmount,
          budgetType
        });
        if (res && res.ok) successResults.push(res);
      }
    });

    if (successResults.length === 1) {
      return {
        answerText: successResults[0].markdownMsg,
        executedCardHtml: renderAiExecutedActionCardHtml(successResults[0]),
        actionIds: ['goto_budget', 'add_category']
      };
    } else if (successResults.length > 1) {
      const cur = appState.currency || '₱';
      const batchUndoKey = 'undo_batch_cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      aiCreatedItemsUndoRegistry[batchUndoKey] = () => {
        successResults.slice().reverse().forEach(res => {
          if (res.undoKey && typeof aiCreatedItemsUndoRegistry[res.undoKey] === 'function') {
            aiCreatedItemsUndoRegistry[res.undoKey]();
            delete aiCreatedItemsUndoRegistry[res.undoKey];
          }
        });
        if (typeof showToast === 'function') {
          showToast(`↩️ Undid batch of ${successResults.length} categories.`, 'info');
        }
      };

      const lines = successResults.map(r => `- ${r.summaryTitle}: ${r.summaryDetail}`).join('\n');
      const answerText = `✅ **AI Successfully Added ${successResults.length} Categories** to your active workspace:\n${lines}\n- Synced instantly to your budget grid! Click **↩️ Undo All** or undo individual categories below anytime.`;

      return {
        answerText,
        executedCardHtml: renderAiBatchExecutedActionCardHtml({
          itemType: `${successResults.length} Categories Added`,
          summaryTitle: `${successResults.length} Categories Created in Real Time`,
          batchUndoKey,
          items: successResults
        }),
        actionIds: ['goto_budget', 'add_category']
      };
    }
  }

  // 3. One-Time Expenses Command (Single or Multi-Item)
  if (/\b(expenses|expense|transactions|transaction|spent)\b/i.test(cleanCmd)) {
    const body = cleanAiCommandLeadingColonOrPreposition(
      cleanCmd.replace(/^(add|create|log|record|new)\s+(a\s+)?(new\s+)?(multiple\s+|\d+\s+)?(one-time\s+)?(expenses|expense|transactions|transaction)\b/i, '')
    );
    const segments = splitAiCreationMultiSegments(body);
    const successResults = [];

    segments.forEach(seg => {
      let s = seg.trim();
      let explicitCategory = '__auto__';
      const catMatch = s.match(/\b(?:under|in\s+category|category|in)\s+([a-z0-9 &/-]+)$/i);
      if (catMatch && catMatch[1]) {
        explicitCategory = catMatch[1].trim();
        s = s.replace(catMatch[0], ' ').trim();
      }

      const amtMatch = s.match(/(?:₱|\$|php|usd)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i);
      if (amtMatch) {
        const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
        const descPart = s
          .replace(amtMatch[0], ' ')
          .replace(/^\b(for|at|on|of)\b/i, ' ')
          .replace(/\b(for|at|on|pesos|dollars)\b$/i, ' ')
          .replace(/^[:\-\s]+|[:\-\s]+$/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (descPart && amount > 0) {
          const res = executeAiCreateExpense({
            description: descPart,
            amount,
            categoryIdOrName: explicitCategory
          });
          if (res && res.ok) successResults.push(res);
        }
      }
    });

    if (successResults.length === 1) {
      return {
        answerText: successResults[0].markdownMsg,
        executedCardHtml: renderAiExecutedActionCardHtml(successResults[0]),
        actionIds: ['goto_expenses', 'goto_analytics']
      };
    } else if (successResults.length > 1) {
      const cur = appState.currency || '₱';
      const totalAmount = successResults.reduce((sum, r) => sum + (parseFloat(r.createdAmount) || 0), 0);
      const batchUndoKey = 'undo_batch_tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      aiCreatedItemsUndoRegistry[batchUndoKey] = () => {
        successResults.slice().reverse().forEach(res => {
          if (res.undoKey && typeof aiCreatedItemsUndoRegistry[res.undoKey] === 'function') {
            aiCreatedItemsUndoRegistry[res.undoKey]();
            delete aiCreatedItemsUndoRegistry[res.undoKey];
          }
        });
        if (typeof showToast === 'function') {
          showToast(`↩️ Undid batch of ${successResults.length} expenses.`, 'info');
        }
      };

      const lines = successResults.map(r => `- ${r.summaryTitle} (${r.summaryDetail})`).join('\n');
      const answerText = `✅ **AI Successfully Logged ${successResults.length} Expenses** (Total: **${fmtAiMoney(totalAmount, cur)}**) to your active workspace:\n${lines}\n- Synced in real time with your expense ledger and category budgets! Click **↩️ Undo All** or undo individual expenses below anytime.`;

      return {
        answerText,
        executedCardHtml: renderAiBatchExecutedActionCardHtml({
          itemType: `${successResults.length} Expenses Logged`,
          summaryTitle: `Total Logged: ${fmtAiMoney(totalAmount, cur)} (${successResults.length} items)`,
          batchUndoKey,
          items: successResults
        }),
        actionIds: ['goto_expenses', 'goto_analytics']
      };
    }
  }

  return null;
}

/**
 * [NIRVAI-FEAT-PATCHNOTES] Checks if the user is asking about the app version, patch notes, or what's new.
 */
function tryExecutePatchNotesInquiry(questionText) {
  if (!questionText) return null;
  const q = String(questionText).toLowerCase().trim();
  const isVersionInquiry = /(what('?s| is) (the )?(current )?version|app version|current version|version number|v1\.|build version|patch note|patch notes|release note|release notes|changelog|what('?s| is) new in (the )?(latest )?update|latest update|what was added|what are the new features)/i.test(q);
  if (!isVersionInquiry) return null;

  const ver = getAppVersion();
  const verDate = getAppVersionDate();
  const latest = getLatestPatchNote();

  let featsText = '';
  if (latest && Array.isArray(latest.features)) {
    featsText = latest.features.map(f => `- **${f.title}**: ${f.desc}`).join('\n');
  }

  const answerText = `### 🚀 NirvTrack Version **${ver}**\n**Implemented on ${verDate}**\n\n#### Latest Milestone: ${latest ? latest.title : 'System Update'}\n${latest ? latest.summary : ''}\n\n**New Features & Enhancements in this Build**:\n${featsText}\n\nYou can inspect the entire release timeline, past milestones, and filter updates by category in the **Release Notes & Patch Hub**.`;

  return {
    answerText,
    actionIds: ['view_patch_notes']
  };
}

/**
 * Handles asking a question in the FAQ AI Copilot.
 * Step 0: Refreshes all community recommendations & user chat memory BEFORE answering so the AI learns from them!
 */
async function askFaqAiQuestion(questionText, imageBase64 = null) {
  const chatStream = document.getElementById('faqAiChatStream');
  if (!chatStream) return;

  // Clear chat input entry field immediately so user has a fresh empty box ready for next typing
  const qInput = document.getElementById('faqAiQuestionInput');
  if (qInput) {
    qInput.value = '';
  }

  // Clear previous "newly-arrived" highlight from earlier messages so the user knows which message is the latest response
  chatStream.querySelectorAll('.faq-ai-msg.newly-arrived').forEach(el => {
    el.classList.remove('newly-arrived');
    const oldTag = el.querySelector('.faq-ai-new-response-tag');
    if (oldTag) oldTag.remove();
  });

  // 1. Append User Message Bubble (with optional image preview)
  const imagePreviewHtml = imageBase64 
    ? `<div style="margin-bottom:8px;"><img src="${imageBase64}" style="max-width:180px; max-height:140px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); object-fit:cover;" alt="Receipt"></div>`
    : '';

  const userMsgEl = document.createElement('div');
  userMsgEl.className = 'faq-ai-msg user';
  userMsgEl.innerHTML = `
    <div class="faq-ai-avatar">👤</div>
    <div class="faq-ai-bubble">
      ${imagePreviewHtml}
      <p>${escapeFaqHtml(questionText)}</p>
    </div>
  `;
  chatStream.appendChild(userMsgEl);

  // 2. Append Loading Assistant Bubble with animated thinking pulse
  const loadingMsgEl = document.createElement('div');
  loadingMsgEl.className = 'faq-ai-msg assistant newly-arrived';
  loadingMsgEl.innerHTML = `
    <div class="faq-ai-avatar">🤖</div>
    <div class="faq-ai-bubble">
      <div class="faq-ai-thinking-wrap">
        <div class="faq-ai-thinking-dots"><span></span><span></span><span></span></div>
        <em>Checking learned wishlist &amp; generating your answer...</em>
      </div>
    </div>
  `;
  chatStream.appendChild(loadingMsgEl);
  chatStream.scrollTop = chatStream.scrollHeight;

  // 2b. Check if the user asked the AI to directly create a Category, Expense, or Recurring Bill!
  const directCreation = tryExecuteNaturalLanguageAiCreation(questionText);
  if (directCreation) {
    const nowIso = new Date().toISOString();
    faqAiConversationHistory.push({ role: 'user', text: questionText, timestamp: nowIso });
    faqAiConversationHistory.push({
      role: 'assistant',
      text: directCreation.answerText,
      actionIds: directCreation.actionIds || [],
      wishId: null,
      modelLabel: 'AI Smart Ledger Executor (Real-Time Sync + Undo)',
      timestamp: nowIso
    });
    saveFaqChatHistory(true);
    populateAiQuickAddCategorySelects();

    const formattedHtml = formatAiMarkdown(directCreation.answerText);
    const postStreamHtml = `
      ${directCreation.executedCardHtml || ''}
      ${renderFaqAiActionButtonsHtml(directCreation.actionIds || [])}
    `;
    const bubbleEl = loadingMsgEl.querySelector('.faq-ai-bubble');
    if (bubbleEl) {
      streamAnimateAiResponse(bubbleEl, formattedHtml, postStreamHtml, chatStream);
    }
    return;
  }

  // 2c. [NIRVAI-FEAT-AFFORD] "Before You Buy" Affordability Advisor Check
  const affordAssessment = tryExecuteAffordabilityAdvisor(questionText);
  if (affordAssessment) {
    const nowIso = new Date().toISOString();
    faqAiConversationHistory.push({ role: 'user', text: questionText, timestamp: nowIso });
    faqAiConversationHistory.push({
      role: 'assistant',
      text: affordAssessment.answerText,
      actionIds: affordAssessment.actionIds || [],
      wishId: null,
      modelLabel: 'NirvAI Affordability Engine (Live Safe-to-Spend & Bills Math)',
      timestamp: nowIso
    });
    saveFaqChatHistory(true);

    const formattedHtml = formatAiMarkdown(affordAssessment.answerText);
    const postStreamHtml = `
      ${affordAssessment.cardHtml || ''}
      ${renderFaqAiActionButtonsHtml(affordAssessment.actionIds || [])}
    `;
    const bubbleEl = loadingMsgEl.querySelector('.faq-ai-bubble');
    if (bubbleEl) {
      streamAnimateAiResponse(bubbleEl, formattedHtml, postStreamHtml, chatStream);
    }
    return;
  }

  // 2d. [NIRVAI-FEAT-REBALANCE] Smart Envelope Rebalance Check
  const rebalanceAssessment = tryExecuteSmartRebalancerQuery(questionText);
  if (rebalanceAssessment) {
    const nowIso = new Date().toISOString();
    faqAiConversationHistory.push({ role: 'user', text: questionText, timestamp: nowIso });
    faqAiConversationHistory.push({
      role: 'assistant',
      text: rebalanceAssessment.answerText,
      actionIds: rebalanceAssessment.actionIds || [],
      wishId: null,
      modelLabel: 'NirvAI Smart Envelope Rebalancer (Deficit Protection & Surplus Transfer)',
      timestamp: nowIso
    });
    saveFaqChatHistory(true);

    const formattedHtml = formatAiMarkdown(rebalanceAssessment.answerText);
    const postStreamHtml = `
      ${rebalanceAssessment.cardHtml || ''}
      ${renderFaqAiActionButtonsHtml(rebalanceAssessment.actionIds || [])}
    `;
    const bubbleEl = loadingMsgEl.querySelector('.faq-ai-bubble');
    if (bubbleEl) {
      streamAnimateAiResponse(bubbleEl, formattedHtml, postStreamHtml, chatStream);
    }
    return;
  }

  // 2e. [NIRVAI-FEAT-SUBS] Subscription Bleed Auditor Check
  const subAssessment = tryExecuteSubscriptionBleedAudit(questionText);
  if (subAssessment) {
    const nowIso = new Date().toISOString();
    faqAiConversationHistory.push({ role: 'user', text: questionText, timestamp: nowIso });
    faqAiConversationHistory.push({
      role: 'assistant',
      text: subAssessment.answerText,
      actionIds: subAssessment.actionIds || [],
      wishId: null,
      modelLabel: 'NirvAI Subscription Bleed & Commitments Auditor',
      timestamp: nowIso
    });
    saveFaqChatHistory(true);

    const formattedHtml = formatAiMarkdown(subAssessment.answerText);
    const postStreamHtml = `
      ${subAssessment.cardHtml || ''}
      ${renderFaqAiActionButtonsHtml(subAssessment.actionIds || [])}
    `;
    const bubbleEl = loadingMsgEl.querySelector('.faq-ai-bubble');
    if (bubbleEl) {
      streamAnimateAiResponse(bubbleEl, formattedHtml, postStreamHtml, chatStream);
    }
    return;
  }

  // 2f. [NIRVAI-FEAT-BRIEF] Proactive Weekly Financial Briefing Check
  const briefAssessment = tryExecuteWeeklyFinancialBriefing(questionText);
  if (briefAssessment) {
    const nowIso = new Date().toISOString();
    faqAiConversationHistory.push({ role: 'user', text: questionText, timestamp: nowIso });
    faqAiConversationHistory.push({
      role: 'assistant',
      text: briefAssessment.answerText,
      actionIds: briefAssessment.actionIds || [],
      wishId: null,
      modelLabel: 'NirvAI Sunday Executive Financial Briefing Engine',
      timestamp: nowIso
    });
    saveFaqChatHistory(true);

    const formattedHtml = formatAiMarkdown(briefAssessment.answerText);
    const postStreamHtml = `
      ${briefAssessment.cardHtml || ''}
      ${renderFaqAiActionButtonsHtml(briefAssessment.actionIds || [])}
    `;
    const bubbleEl = loadingMsgEl.querySelector('.faq-ai-bubble');
    if (bubbleEl) {
      streamAnimateAiResponse(bubbleEl, formattedHtml, postStreamHtml, chatStream);
    }
    return;
  }

  // 2g. [NIRVAI-FEAT-PATCHNOTES] App Version & Release Patch Notes Inquiry
  const patchAssessment = tryExecutePatchNotesInquiry(questionText);
  if (patchAssessment) {
    const nowIso = new Date().toISOString();
    faqAiConversationHistory.push({ role: 'user', text: questionText, timestamp: nowIso });
    faqAiConversationHistory.push({
      role: 'assistant',
      text: patchAssessment.answerText,
      actionIds: patchAssessment.actionIds || [],
      wishId: null,
      modelLabel: 'NirvTrack Version & Release Intelligence',
      timestamp: nowIso
    });
    saveFaqChatHistory(true);

    const formattedHtml = formatAiMarkdown(patchAssessment.answerText);
    const postStreamHtml = `
      ${renderFaqAiActionButtonsHtml(patchAssessment.actionIds || [])}
    `;
    const bubbleEl = loadingMsgEl.querySelector('.faq-ai-bubble');
    if (bubbleEl) {
      streamAnimateAiResponse(bubbleEl, formattedHtml, postStreamHtml, chatStream);
    }
    return;
  }

  // 3. Pre-Answer Self-Learning: Refresh Community Feature Wishlist & User Chat Memory
  await loadFeatureWishlist();
  if (!Array.isArray(faqAiConversationHistory) || faqAiConversationHistory.length === 0) {
    loadFaqChatHistory();
  }

  // Check if this question matches an already-learned recommendation in cachedFeatureWishlist
  let matchedWishItem = findMatchingLearnedRecommendation(questionText);

  const apiKey = ensureAutoProvisionedAiKey();
  let answerText = '';
  let recommendation = null;
  let actionIds = [];
  let usedModelLabel = 'NirvTrack AI (Google Gemini • Self-Learning)';

  if (apiKey) {
    try {
      const geminiResult = await callGoogleGeminiCopilot(questionText, apiKey, imageBase64);
      answerText = geminiResult.answerText;
      recommendation = geminiResult.recommendation;
      actionIds = Array.isArray(geminiResult.actionIds) ? geminiResult.actionIds : [];
      usedModelLabel = `Google ${geminiResult.modelUsed} • Self-Learning + Multimodal Vision`;
    } catch (err) {
      console.warn('Google Gemini API call failed, falling back to Smart Local FAQ Engine:', err);
      const localResult = await generateSmartLocalFaqResponse(questionText, matchedWishItem);
      answerText = localResult.answerText;
      recommendation = localResult.recommendation;
      actionIds = Array.isArray(localResult.actionIds) ? localResult.actionIds : [];
      usedModelLabel = 'NirvTrack Smart Assistant (Local Knowledge Engine)';
    }
  } else {
    const localResult = await generateSmartLocalFaqResponse(questionText, matchedWishItem);
    answerText = localResult.answerText;
    recommendation = localResult.recommendation;
    actionIds = Array.isArray(localResult.actionIds) ? localResult.actionIds : [];
    usedModelLabel = 'NirvTrack Smart Assistant (Local Knowledge Engine)';
  }

  // Ensure relevant clickable action buttons are always attached even if Gemini didn't emit the action tag
  if (!actionIds || actionIds.length === 0) {
    actionIds = resolveAiActionIdsForQuery(questionText, answerText);
  }

  // Secondary missing-feature detector if neither Gemini nor initial check flagged a recommendation
  if (!recommendation && !matchedWishItem) {
    recommendation = detectMissingFeatureFromQuery(questionText, answerText);
  }

  // 4. Self-Learning Storage: Record new missing-feature recommendations OR append this user's query to the existing wishlist item
  let learnedCardHtml = '';
  let linkedWishId = null;

  if (matchedWishItem) {
    linkedWishId = matchedWishItem.id;
    await recordLearnedQueryOnWishlistItem(matchedWishItem, questionText);
    learnedCardHtml = renderLearnedWishlistCardHtml(matchedWishItem, false);
  } else if (recommendation && recommendation.title) {
    // Check if recommendation.title matches an existing wishlist item
    const existingByTitle = findMatchingLearnedRecommendation(recommendation.title);
    if (existingByTitle) {
      matchedWishItem = existingByTitle;
      linkedWishId = existingByTitle.id;
      await recordLearnedQueryOnWishlistItem(existingByTitle, questionText);
      learnedCardHtml = renderLearnedWishlistCardHtml(existingByTitle, false);
    } else {
      // Automatically learn & save this new recommendation to the Wishlist so future chats immediately know about it!
      const autoSavedWish = await submitFeatureRecommendation({
        title: recommendation.title,
        category: recommendation.category || 'Automation & AI',
        description: recommendation.description || `User asked: "${questionText}"`,
        source: 'NirvTrack AI (Auto-Learned)',
        userQuery: questionText
      }, { silent: true });
      if (autoSavedWish && autoSavedWish.id) {
        linkedWishId = autoSavedWish.id;
        learnedCardHtml = renderLearnedWishlistCardHtml(autoSavedWish, true);
      }
    }
  }

  // 5. Persist this conversation turn (user question + AI response) to per-user chat memory & Cloud Firestore immediately
  const nowIso = new Date().toISOString();
  faqAiConversationHistory.push({
    role: 'user',
    text: questionText,
    timestamp: nowIso
  });
  faqAiConversationHistory.push({
    role: 'assistant',
    text: answerText,
    actionIds: actionIds || [],
    wishId: linkedWishId || null,
    modelLabel: usedModelLabel,
    timestamp: nowIso
  });
  saveFaqChatHistory(true);

  const actionButtonsHtml = renderFaqAiActionButtonsHtml(actionIds);
  const formattedHtml = formatAiMarkdown(answerText);
  const postStreamHtml = `
    ${actionButtonsHtml}
    ${learnedCardHtml}
    <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 0.69rem; color: var(--text-muted); display: flex; justify-content: space-between;">
      <span>⚡ ${escapeFaqHtml(usedModelLabel)}</span>
      <span>🧠 Learned (${cachedFeatureWishlist.length} wishlist items)</span>
    </div>
  `;

  const bubbleEl = loadingMsgEl.querySelector('.faq-ai-bubble');
  if (bubbleEl) {
    streamAnimateAiResponse(bubbleEl, formattedHtml, postStreamHtml, chatStream);
  }
}

/**
 * Interactive 1-Click Action Buttons Registry inside AI Chat Bubbles.
 * Allows users to click a feature or button directly inside the chat conversation.
 */
const FAQ_AI_ACTION_CATALOG = {
  add_expense: {
    label: '➕ Add Expense Now (Shortcut: N)',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof openExpenseModal === 'function') openExpenseModal();
    }
  },
  goto_expenses: {
    label: '🧾 Go to Expense Tracker',
    primary: false,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof switchTab === 'function') switchTab('expenses');
    }
  },
  upload_expense_csv: {
    label: '📂 Upload Expense CSV',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof switchTab === 'function') switchTab('expenses');
      setTimeout(() => {
        const btn = document.getElementById('btnUploadExpenseCSV');
        if (btn) btn.click();
      }, 120);
    }
  },
  add_category: {
    label: '🏷️ + Add New Category',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof switchTab === 'function') switchTab('budget');
      if (typeof openCategoryModal === 'function') openCategoryModal();
    }
  },
  upload_category_csv: {
    label: '📂 Bulk Upload Categories CSV',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof switchTab === 'function') switchTab('budget');
      setTimeout(() => {
        const btn = document.getElementById('btnUploadCategoryCSV');
        if (btn) btn.click();
      }, 120);
    }
  },
  download_category_csv_template: {
    label: '📥 Download Category CSV Template',
    primary: false,
    run: () => {
      if (typeof downloadCategoryCSVTemplate === 'function') downloadCategoryCSVTemplate();
    }
  },
  goto_budget: {
    label: '💵 Go to Budget & 15th/30th Income',
    primary: false,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof switchTab === 'function') switchTab('budget');
    }
  },
  auto_budget_503020: {
    label: '⚡ Open 50/30/20 Auto-Budget Optimizer',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof switchTab === 'function') switchTab('budget');
      if (typeof openAutoBudgetModal === 'function') openAutoBudgetModal();
    }
  },
  goto_bills: {
    label: '📅 Go to Recurring Bills',
    primary: false,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof switchTab === 'function') switchTab('bills');
    }
  },
  add_bill: {
    label: '➕ Add Recurring Bill',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof switchTab === 'function') switchTab('bills');
      if (typeof openBillModal === 'function') openBillModal();
    }
  },
  goto_analytics: {
    label: '📈 Go to Budget vs. Actual Analytics',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof switchTab === 'function') switchTab('analytics');
    }
  },
  goto_savings: {
    label: '💎 Open Savings Analyst & Wealth Hub',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof switchTab === 'function') switchTab('savings');
    }
  },
  add_savings_goal: {
    label: '🎯 + Create Sinking Fund Goal',
    primary: false,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof switchTab === 'function') switchTab('savings');
      if (typeof openSavingsGoalModal === 'function') openSavingsGoalModal();
    }
  },
  open_workspaces: {
    label: '📁 Open Workspaces Drawer (Shortcut: W)',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof openWorkspaceDrawer === 'function') openWorkspaceDrawer();
    }
  },
  open_multi_month: {
    label: '🗓️ Open Multi-Month Period Selector',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof openMultiMonthModal === 'function') openMultiMonthModal();
    }
  },
  view_patch_notes: {
    label: '📜 View Release Notes & Patch History',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof openPatchNotesModal === 'function') openPatchNotesModal();
    }
  },
  scan_gmail: {
    label: '📬 Scan Gmail Transactions (Staging Inbox)',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof openGmailTransactionInboxModal === 'function') openGmailTransactionInboxModal();
    }
  },
  open_command_palette: {
    label: '🔎 Launch Command Palette (Ctrl+K)',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof openCommandPalette === 'function') openCommandPalette();
    }
  },
  toggle_privacy: {
    label: '🕶️ Toggle Privacy Stealth Blur (Shortcut: H)',
    primary: true,
    run: () => {
      if (typeof togglePrivacyMode === 'function') togglePrivacyMode();
    }
  },
  open_layout_studio: {
    label: '📐 Open Custom UI Widget Studio',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof openWidgetManagerModal === 'function') openWidgetManagerModal();
    }
  },
  switch_ui_minimal: {
    label: '✨ Switch to Minimalist Zen Mode',
    primary: false,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof applyUIMode === 'function') applyUIMode('minimal');
    }
  },
  switch_ui_default: {
    label: '🖥️ Switch to Default Executive Mode',
    primary: false,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof applyUIMode === 'function') applyUIMode('default');
    }
  },
  open_system_tools: {
    label: '🛠️ Open System & Data Tools Drawer',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof openSystemToolsDrawer === 'function') openSystemToolsDrawer();
    }
  },
  export_csv: {
    label: '📥 Export CSV Report',
    primary: false,
    run: () => {
      if (typeof exportCSVReport === 'function') exportCSVReport();
    }
  },
  export_json: {
    label: '💾 Export Full JSON Backup',
    primary: false,
    run: () => {
      if (typeof exportJSONBackup === 'function') exportJSONBackup();
    }
  },
  load_sample_data: {
    label: '🧪 Load Demo Sample Dataset',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof loadSampleInitialData === 'function') loadSampleInitialData();
    }
  },
  reset_zero: {
    label: '🧹 Reset All Amounts to Zero',
    primary: false,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof resetAllToZero === 'function') resetAllToZero();
    }
  },
  goto_dashboard: {
    label: '🏠 Go to Executive Dashboard',
    primary: false,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof switchTab === 'function') switchTab('dashboard');
    }
  },
  open_admin_hub: {
    label: '🛡️ Open Admin Command Center',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof openAdminHubModal === 'function') openAdminHubModal();
    }
  },
  upgrade_pro: {
    label: '⚡ Upgrade to Pro (₱199/mo)',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof openPaymentPlaceholderModal === 'function') openPaymentPlaceholderModal('pro');
    }
  },
  upgrade_executive: {
    label: '👑 Upgrade to Executive (₱599/mo)',
    primary: true,
    run: () => {
      if (typeof closeFAQModal === 'function') closeFAQModal();
      if (typeof openPaymentPlaceholderModal === 'function') openPaymentPlaceholderModal('executive');
    }
  },
  open_wishlist: {
    label: '💡 Submit to Feature Wishlist',
    primary: false,
    run: () => {
      if (typeof switchFaqMode === 'function') switchFaqMode('request');
    }
  },
  open_admin_wishlist: {
    label: '👑 Open Admin Wishlist Hub',
    primary: false,
    run: () => {
      if (typeof openAdminWishlistModal === 'function') openAdminWishlistModal();
    }
  }
};

function executeFaqAiChatAction(actionId) {
  const item = FAQ_AI_ACTION_CATALOG[actionId];
  if (item && typeof item.run === 'function') {
    item.run();
  }
}
window.executeFaqAiChatAction = executeFaqAiChatAction;

function renderFaqAiActionButtonsHtml(actionIds) {
  if (!Array.isArray(actionIds) || actionIds.length === 0) return '';
  const validActions = actionIds.filter(id => Boolean(FAQ_AI_ACTION_CATALOG[id]));
  if (validActions.length === 0) return '';

  const buttonsHtml = validActions.map(id => {
    const cfg = FAQ_AI_ACTION_CATALOG[id];
    return `<button type="button" class="faq-ai-action-chip" onclick="executeFaqAiChatAction('${id}')">${escapeFaqHtml(cfg.label)}</button>`;
  }).join('');

  return `
    <div class="faq-ai-action-bar">
      <span class="faq-ai-action-bar-label">💡 Suggested:</span>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        ${buttonsHtml}
      </div>
    </div>
  `;
}

/**
 * Automatically maps any user question or AI response to the most relevant clickable in-chat buttons.
 */
function resolveAiActionIdsForQuery(userQuestion, answerText = '') {
  const q = `${userQuestion || ''} ${answerText || ''}`.toLowerCase();
  const actions = [];
  if (q.includes('multiple') || q.includes('multi-entry') || q.includes('multi entry') || q.includes('batch entry') || q.includes('batch add')) {
    actions.push('add_category', 'add_expense', 'goto_bills');
  }
  if (q.includes('add expense') || q.includes('new expense') || q.includes('log expense') || (q.includes('expense') && (q.includes('button') || q.includes('find') || q.includes('where') || q.includes('how')))) {
    actions.push('add_expense', 'goto_expenses');
  }
  if ((q.includes('csv') || q.includes('bulk') || q.includes('upload') || q.includes('import')) && q.includes('categor')) {
    actions.push('upload_category_csv', 'download_category_csv_template', 'add_category');
  } else if (q.includes('csv') || q.includes('bulk') || q.includes('upload') || q.includes('import')) {
    actions.push('upload_category_csv', 'upload_expense_csv');
  }
  if (q.includes('add categor') || q.includes('new categor') || q.includes('create categor') || (q.includes('categor') && (q.includes('button') || q.includes('where') || q.includes('edit')))) {
    if (!actions.includes('add_category')) actions.push('add_category');
    if (!actions.includes('goto_budget')) actions.push('goto_budget');
  }
  if (q.includes('15th') || q.includes('30th') || q.includes('paycheck') || q.includes('income') || q.includes('50/30/20') || q.includes('auto-balance') || q.includes('auto budget')) {
    if (!actions.includes('goto_budget')) actions.push('goto_budget');
    if (!actions.includes('auto_budget_503020')) actions.push('auto_budget_503020');
  }
  if (q.includes('sweep') || q.includes('surplus') || q.includes('unspent')) {
    actions.push('surplus_sweeper', 'goto_savings');
  }
  if (q.includes('bill') || q.includes('subscription') || q.includes('recurring')) {
    actions.push('add_bill', 'goto_bills');
  }
  if (q.includes('saving') || q.includes('sinking') || q.includes('goal') || q.includes('runway') || q.includes('waterfall')) {
    if (!actions.includes('goto_savings')) actions.push('goto_savings');
    if (!actions.includes('add_savings_goal')) actions.push('add_savings_goal');
  }
  if (q.includes('analytic') || q.includes('variance') || q.includes('scorecard') || q.includes('actual') || q.includes('chart')) {
    actions.push('goto_analytics');
  }
  if (q.includes('workspace') || q.includes('business') || q.includes('personal book')) {
    actions.push('open_workspaces');
  }
  if (q.includes('multi-month') || q.includes('ytd') || q.includes('quarter')) {
    actions.push('open_multi_month');
  }
  if (q.includes('gmail') || q.includes('scan email') || q.includes('bank email') || q.includes('receipt') || q.includes('staging') || q.includes('inbox')) {
    actions.push('scan_gmail');
  }
  if (q.includes('privacy') || q.includes('blur') || q.includes('stealth') || q.includes('hide amount')) {
    actions.push('toggle_privacy');
  }
  if (q.includes('layout') || q.includes('minimal') || q.includes('zen') || q.includes('widget')) {
    actions.push('open_layout_studio', 'switch_ui_minimal', 'switch_ui_default');
  }
  if (q.includes('backup') || q.includes('export') || q.includes('json') || q.includes('system tool')) {
    actions.push('open_system_tools', 'export_csv', 'export_json');
  }
  if (q.includes('sample') || q.includes('demo')) {
    actions.push('load_sample_data');
  }
  if (q.includes('reset') || q.includes('zero')) {
    actions.push('reset_zero', 'open_system_tools');
  }
  if (q.includes('shortcut') || q.includes('command palette') || q.includes('ctrl+k')) {
    actions.push('open_command_palette');
  }
  if (q.includes('admin') && (typeof isCurrentUserAdmin === 'function' && isCurrentUserAdmin())) {
    actions.push('open_admin_hub');
  }
  if (q.includes('upgrade') || q.includes('pro') || q.includes('executive') || q.includes('subscribe') || q.includes('subscription') || q.includes('pricing') || q.includes('paymongo') || q.includes('plan')) {
    actions.push('upgrade_pro', 'upgrade_executive');
  }
  if (q.includes('train') || q.includes('teach') || q.includes('wishlist') || q.includes('recommend') || q.includes('idea') || q.includes('request')) {
    actions.push('open_wishlist');
    if (typeof isCurrentUserAdmin === 'function' && isCurrentUserAdmin()) {
      actions.push('open_admin_wishlist');
    }
  }

  return actions.slice(0, 3);
}

/**
 * Builds a compact digest of all learned Community Wishlist & Admin Roadmap items
 * so the AI Copilot learns from all user recommendations and Admin rankings before answering.
 */
function buildLearnedWishlistPromptDigest() {
  if (!Array.isArray(cachedFeatureWishlist) || cachedFeatureWishlist.length === 0) {
    return 'No community wishlist items recorded yet.';
  }
  const statusMap = {
    review: 'Under Review',
    planned: 'Planned on Roadmap',
    progress: 'In Progress',
    shipped: 'Shipped',
    declined: 'Declined'
  };
  return cachedFeatureWishlist.slice(0, 25).map(item => {
    const rankNum = Number(item.rank) || 99;
    const rankStr = rankNum <= 5 ? `Rank #${rankNum}` : 'Unranked (Under Review)';
    const statusStr = statusMap[item.status] || 'Under Review';
    const votes = Number(item.votes) || 1;
    const notes = item.adminNotes ? ` | Admin Note: "${item.adminNotes}"` : '';
    const pastQueries = Array.isArray(item.tags) && item.tags.length > 0
      ? ` | Past user questions: ${item.tags.slice(0, 3).join('; ')}`
      : (item.userQuery ? ` | Asked: "${item.userQuery}"` : '');
    return `• "${item.title}" [${item.category || 'General'}] — ${rankStr}, Status: ${statusStr}, Votes: ${votes}${notes}${pastQueries}`;
  }).join('\n');
}

/**
 * Checks if the user's question (or follow-up context from faqAiConversationHistory)
 * matches any recommendation already learned in cachedFeatureWishlist.
 */
function findMatchingLearnedRecommendation(userQuestion) {
  if (!Array.isArray(cachedFeatureWishlist) || cachedFeatureWishlist.length === 0) return null;
  const qRaw = String(userQuestion || '').toLowerCase().trim();
  if (!qRaw) return null;

  // 1. If the user is asking a short follow-up question about rank/status/votes ("what is its rank?", "is that planned?", "how many votes?"),
  // check if the previous assistant turn in faqAiConversationHistory had a linked wishId!
  const isFollowUpAboutWish = (
    qRaw.length < 75 &&
    (qRaw.includes('rank') || qRaw.includes('status') || qRaw.includes('plan') || qRaw.includes('vote') || qRaw.includes('when') || qRaw.includes('roadmap') || qRaw.includes('that feature') || qRaw.includes('this feature') || qRaw.includes('it '))
  );
  if (isFollowUpAboutWish && Array.isArray(faqAiConversationHistory) && faqAiConversationHistory.length > 0) {
    for (let i = faqAiConversationHistory.length - 1; i >= 0; i--) {
      const turn = faqAiConversationHistory[i];
      if (turn && turn.wishId) {
        const prevWish = cachedFeatureWishlist.find(w => w.id === turn.wishId);
        if (prevWish) return prevWish;
      }
    }
  }

  // 2. Stopwords to ignore when matching keywords
  const stopWords = new Set([
    'can', 'you', 'how', 'do', 'does', 'the', 'budget', 'master', 'app', 'have', 'has', 'is', 'there',
    'a', 'an', 'to', 'in', 'for', 'of', 'with', 'on', 'my', 'i', 'want', 'need', 'feature', 'button',
    'where', 'what', 'when', 'will', 'be', 'able', 'support', 'supported', 'please', 'add', 'create',
    'make', 'use', 'find', 'get', 'show', 'me', 'about', 'it', 'this', 'that', 'from', 'or', 'and'
  ]);

  const extractTokens = (str) => String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));

  const qTokens = extractTokens(qRaw);
  if (qTokens.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const item of cachedFeatureWishlist) {
    if (!item || !item.title) continue;
    const titleLower = String(item.title).toLowerCase();
    if (titleLower === qRaw || (qRaw.length >= 8 && titleLower.includes(qRaw))) {
      return item;
    }

    const hayText = [
      item.title || '',
      item.description || '',
      item.userQuery || '',
      ...(Array.isArray(item.tags) ? item.tags : [])
    ].join(' ');
    const itemTokens = new Set(extractTokens(hayText));
    const titleTokens = new Set(extractTokens(item.title));

    let score = 0;
    qTokens.forEach(tok => {
      if (titleTokens.has(tok)) {
        score += 3;
      } else if (itemTokens.has(tok)) {
        score += 1.5;
      }
    });

    // High-signal domain keyword boosts for common missing-feature concepts
    if ((qRaw.includes('receipt') || qRaw.includes('ocr') || qRaw.includes('camera')) && titleLower.includes('receipt')) score += 6;
    if ((qRaw.includes('plaid') || qRaw.includes('bank sync') || qRaw.includes('link bank') || qRaw.includes('connect bank')) && (titleLower.includes('plaid') || titleLower.includes('bank'))) score += 6;
    if ((qRaw.includes('spouse') || qRaw.includes('wife') || qRaw.includes('husband') || qRaw.includes('partner') || qRaw.includes('family') || qRaw.includes('collaborat')) && (titleLower.includes('shared') || titleLower.includes('family') || titleLower.includes('partner'))) score += 6;
    if ((qRaw.includes('crypto') || qRaw.includes('stock') || qRaw.includes('ticker') || qRaw.includes('bitcoin')) && (titleLower.includes('crypto') || titleLower.includes('stock') || titleLower.includes('portfolio'))) score += 6;
    if (qRaw.includes('pdf') && titleLower.includes('pdf')) score += 6;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestScore >= 4.5 ? bestMatch : null;
}

/**
 * Appends a user's natural-language question to a wishlist item's learned `tags` array
 * (up to 35 items, compliant with firestore.rules `tags` list validation) and persists it.
 */
async function recordLearnedQueryOnWishlistItem(wishItem, questionText) {
  if (!wishItem || !questionText) return;
  const cleanQ = String(questionText).trim().slice(0, 140);
  if (!cleanQ) return;

  if (!Array.isArray(wishItem.tags)) {
    wishItem.tags = wishItem.userQuery ? [String(wishItem.userQuery).slice(0, 140)] : [];
  }
  const alreadyHas = wishItem.tags.some(t => String(t).toLowerCase() === cleanQ.toLowerCase());
  if (!alreadyHas) {
    wishItem.tags.unshift(cleanQ);
    wishItem.tags = wishItem.tags.slice(0, 35);
    wishItem.updatedAt = new Date().toISOString();
    saveFeatureWishlistLocally();

    const activeDb = (typeof window !== 'undefined' && window.fbDb) ? window.fbDb : (typeof fbDb !== 'undefined' && fbDb ? fbDb : null);
    const currentUser = (typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser)
      ? fbAuth.currentUser
      : (typeof currentAuthenticatedUser !== 'undefined' ? currentAuthenticatedUser : null);
    if (activeDb && currentUser) {
      try {
        await activeDb.collection('feature_wishlist').doc(wishItem.id).set({
          tags: wishItem.tags,
          updatedAt: wishItem.updatedAt
        }, { merge: true });
      } catch (e) {}
    }
  }
}

/**
 * Allows upvoting an existing or auto-learned wishlist recommendation directly from inside an AI chat bubble.
 */
async function upvoteWishlistItemFromChat(wishId, btnId) {
  await upvoteWishlistItem(wishId);
  const item = cachedFeatureWishlist.find(w => w.id === wishId);
  const btn = document.getElementById(btnId);
  const countEl = document.getElementById('count_' + btnId);
  if (item && countEl) {
    const v = Number(item.votes) || 1;
    countEl.textContent = `${v} vote${v === 1 ? '' : 's'}`;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = '✅ Upvoted!';
  }
  if (typeof showToast === 'function' && item) {
    showToast(`👍 Upvoted "${item.title}" (${item.votes} total votes)!`);
  }
}
window.upvoteWishlistItemFromChat = upvoteWishlistItemFromChat;

/**
 * 100% Read-Only Real-Time Workspace Financial Report Calculator.
 * Reads any workspace container (either the live active `appState` or a saved workspace snapshot from `localStorage`)
 * without mutating any state or database records.
 */
function computeSingleWorkspaceRealtimeReport(wsMeta, snapshot, isActiveWorkspace = false) {
  const src = snapshot || {};
  const currency = (typeof appState !== 'undefined' && appState.currency) ? appState.currency : '₱';
  const months = (typeof getSortedActiveMonths === 'function' && getSortedActiveMonths().length > 0)
    ? getSortedActiveMonths()
    : [(typeof appState !== 'undefined' && appState.activeMonth) ? appState.activeMonth : '2026-10'];

  const categories = Array.isArray(src.categories) ? src.categories : [];
  const incomes = (src.incomes && typeof src.incomes === 'object') ? src.incomes : {};
  const budgets = (src.budgets && typeof src.budgets === 'object') ? src.budgets : {};
  const expenses = Array.isArray(src.expenses) ? src.expenses : [];
  const excludedByMonth = (src.excludedCategoriesByMonth && typeof src.excludedCategoriesByMonth === 'object') ? src.excludedCategoriesByMonth : {};
  const recurringBills = Array.isArray(src.recurringBills) ? src.recurringBills : [];
  const savingsGoals = Array.isArray(src.savingsGoals) ? src.savingsGoals : [];

  // 1. Income across active period
  let totalIncome = 0;
  let paycheck15 = 0;
  let paycheck30 = 0;
  let additionalIncome = 0;
  let carryoverSurplus = 0;

  months.forEach(m => {
    const inc = incomes[m] || {};
    const p15 = Number(inc.paycheck15) || 0;
    const p30 = Number(inc.paycheck30) || 0;
    const add = Number(inc.additional) || 0;
    const carry = Number(inc.carryoverSurplus) || 0;
    paycheck15 += p15;
    paycheck30 += p30;
    additionalIncome += add;
    carryoverSurplus += carry;
    totalIncome += (p15 + p30 + add + carry);
  });

  // 2. Category Budgets across active period
  let totalBudget = 0;
  const catBudgetMap = {};
  const catSpentMap = {};
  categories.forEach(c => {
    catBudgetMap[c.id] = 0;
    catSpentMap[c.id] = 0;
  });

  months.forEach(m => {
    const bMap = budgets[m] || {};
    const excl = Array.isArray(excludedByMonth[m]) ? excludedByMonth[m] : [];
    categories.forEach(cat => {
      if (excl.includes(cat.id)) return;
      const isMonthScoped = cat.scope === 'month' || (Array.isArray(cat.createdInMonths) && cat.createdInMonths.length > 0) || (cat.createdInMonth && cat.createdInMonth !== m);
      if (isMonthScoped) {
        const allowed = cat.createdInMonths || (cat.createdInMonth ? [cat.createdInMonth] : []);
        if (allowed.length > 0 && !allowed.includes(m)) return;
      }
      const amt = bMap[cat.id] !== undefined ? (Number(bMap[cat.id]) || 0) : (Number(cat.defaultBudget) || 0);
      catBudgetMap[cat.id] = (catBudgetMap[cat.id] || 0) + amt;
      totalBudget += amt;
    });
  });

  // 3. Expenses in active period vs all-time
  const activeMonthSet = new Set(months);
  const periodExpenses = expenses.filter(tx => {
    if (!tx || !tx.date) return false;
    const mKey = String(tx.date).slice(0, 7);
    if (!activeMonthSet.has(mKey)) return false;
    const excl = Array.isArray(excludedByMonth[mKey]) ? excludedByMonth[mKey] : [];
    if (excl.includes(tx.categoryId)) return false;
    return true;
  });

  let totalSpent = 0;
  const paymentMethods = {};
  periodExpenses.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    totalSpent += amt;
    if (catSpentMap[tx.categoryId] !== undefined) {
      catSpentMap[tx.categoryId] += amt;
    } else {
      catSpentMap[tx.categoryId] = (catSpentMap[tx.categoryId] || 0) + amt;
    }
    const pm = tx.paymentMethod || 'Unspecified';
    paymentMethods[pm] = (paymentMethods[pm] || 0) + amt;
  });

  const allTimeSpent = expenses.reduce((sum, tx) => sum + (Number(tx && tx.amount) || 0), 0);

  const remainingBudget = totalBudget - totalSpent;
  const netSavings = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100) : 0;
  const budgetUtilization = totalBudget > 0 ? ((totalSpent / totalBudget) * 100) : 0;

  // 4. Category Variance Rows
  const categoryRows = categories.map(cat => {
    const budget = catBudgetMap[cat.id] || 0;
    const spent = catSpentMap[cat.id] || 0;
    const remaining = budget - spent;
    const pctUsed = budget > 0 ? ((spent / budget) * 100) : (spent > 0 ? 100 : 0);
    return {
      id: cat.id,
      name: cat.name || 'Category',
      icon: cat.icon || '🏷️',
      budgetType: cat.budgetType || 'needs',
      budget,
      spent,
      remaining,
      pctUsed,
      isOverBudget: spent > budget && budget >= 0 && (spent - budget) > 0.005
    };
  }).filter(r => r.budget > 0 || r.spent > 0);

  const overBudgetCats = categoryRows
    .filter(r => r.isOverBudget)
    .sort((a, b) => (b.spent - b.budget) - (a.spent - a.budget));

  const surplusCats = categoryRows
    .filter(r => r.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  const totalSweepableSurplus = surplusCats.reduce((s, r) => s + r.remaining, 0);

  const topSpentCats = [...categoryRows]
    .filter(r => r.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 6);

  // 5. Top Transactions (from active period, or fallback to all-time if active period is empty)
  const sourceTxList = periodExpenses.length > 0 ? periodExpenses : expenses;
  const catNameById = {};
  categories.forEach(c => { catNameById[c.id] = c.name; });

  const topTransactions = [...sourceTxList]
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, 5)
    .map(tx => ({
      date: tx.date || '',
      description: tx.description || tx.notes || 'Expense',
      categoryName: catNameById[tx.categoryId] || 'Category',
      amount: Number(tx.amount) || 0,
      paymentMethod: tx.paymentMethod || 'Cash'
    }));

  // 6. Recurring Bills & Sinking Funds
  const activeBills = recurringBills.filter(b => b && b.active !== false);
  const activeBillsTotal = activeBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const sinkingSavedTotal = savingsGoals.reduce((s, g) => s + (Number(g && g.savedAmount) || 0), 0);
  const sinkingTargetTotal = savingsGoals.reduce((s, g) => s + (Number(g && g.targetAmount) || 0), 0);

  return {
    id: (wsMeta && wsMeta.id) || 'ws_default',
    name: (wsMeta && wsMeta.name) || 'Personal Finances',
    tag: (wsMeta && wsMeta.tag) || 'Personal',
    isActiveWorkspace,
    currency,
    months,
    totalIncome,
    paycheck15,
    paycheck30,
    additionalIncome,
    carryoverSurplus,
    totalBudget,
    totalSpent,
    remainingBudget,
    netSavings,
    savingsRate,
    budgetUtilization,
    totalSweepableSurplus,
    periodTxCount: periodExpenses.length,
    allTimeTxCount: expenses.length,
    allTimeSpent,
    categoriesCount: categories.length,
    categoryRows,
    overBudgetCats,
    surplusCats,
    topSpentCats,
    topTransactions,
    paymentMethods,
    activeBillsCount: activeBills.length,
    activeBillsTotal,
    sinkingFundsCount: savingsGoals.length,
    sinkingSavedTotal,
    sinkingTargetTotal
  };
}

/**
 * Returns an array of real-time reports for ALL isolated workspaces in `workspaceRegistry.workspaces`.
 */
function fmtAiMoney(amount, currencySymbol) {
  const cur = currencySymbol || ((typeof appState !== 'undefined' && appState.currency) ? appState.currency : '₱');
  const num = Number(amount) || 0;
  return `${cur}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * FUTURE-PROOF DYNAMIC SCHEMA & LIVE DOM REPORT AUTO-DISCOVERY ENGINE (100% READ-ONLY)
 * 1) Automatically discovers any NEW data arrays/objects added to `appState`, workspace containers,
 *    or user-scoped localStorage in the future (e.g. investments, debts, assets, customReports, loans, etc.)
 *    without requiring hardcoded schema updates.
 * 2) Automatically scrapes any live rendered KPI cards, report panels, and analytics tables from the DOM
 *    so any new report widget added to the UI in the future is immediately known to the AI in real time.
 */
const BASELINE_KNOWN_STATE_KEYS = new Set([
  'selectedMonths', 'activeMonth', 'activeMonths', 'currency', 'theme',
  'activeTab', 'executiveTheme', 'uiMode', 'excludedCategoriesByMonth',
  'userTier', 'userRole', 'isAdmin', 'privacyStealth', 'dashboardLayout',
  'widgetLayout', 'customLayout', 'categories', 'incomes', 'budgets',
  'expenses', 'recurringBills', 'savingsGoals', 'surplusSweeps',
  'updatedAt', 'version'
]);

function humanizeFutureKeyName(rawKey) {
  return String(rawKey || '')
    .replace(/^budget_app_/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function summarizeArbitraryDataStructure(keyName, val, currencySymbol) {
  if (val === null || val === undefined) return null;
  const label = humanizeFutureKeyName(keyName);
  if (Array.isArray(val)) {
    if (val.length === 0) return `${label}: 0 records`;
    let numericSum = 0;
    let hasNumericAmount = false;
    const sampleNames = [];
    val.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const numField = item.amount ?? item.value ?? item.total ?? item.balance ?? item.target ?? item.cost ?? item.price ?? item.netWorth;
        if (numField !== undefined && !isNaN(Number(numField))) {
          numericSum += Number(numField);
          hasNumericAmount = true;
        }
        if (idx < 4) {
          const itemLabel = item.name || item.title || item.description || item.label || item.category || item.type || item.id;
          if (itemLabel) {
            sampleNames.push(numField !== undefined && !isNaN(Number(numField))
              ? `${String(itemLabel).slice(0, 32)} (${fmtAiMoney(numField, currencySymbol)})`
              : String(itemLabel).slice(0, 32));
          }
        }
      }
    });
    const sumPart = hasNumericAmount ? ` • Total Value: ${fmtAiMoney(numericSum, currencySymbol)}` : '';
    const samplePart = sampleNames.length > 0 ? ` [Samples: ${sampleNames.join(', ')}]` : '';
    return `${label} (${val.length} records${sumPart})${samplePart}`;
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val);
    if (entries.length === 0) return null;
    const preview = entries.slice(0, 6).map(([k, v]) => {
      if (typeof v === 'number') return `${humanizeFutureKeyName(k)}: ${v}`;
      if (typeof v === 'string' || typeof v === 'boolean') return `${humanizeFutureKeyName(k)}: ${String(v).slice(0, 30)}`;
      if (Array.isArray(v)) return `${humanizeFutureKeyName(k)}: ${v.length} items`;
      return `${humanizeFutureKeyName(k)}: [Object]`;
    }).join(', ');
    return `${label}: { ${preview} }`;
  }
  if (typeof val === 'number' || typeof val === 'string') {
    return `${label}: ${String(val).slice(0, 60)}`;
  }
  return null;
}

function discoverDynamicFutureDataAndReports(currencySymbol) {
  const cur = currencySymbol || ((typeof appState !== 'undefined' && appState.currency) ? appState.currency : '₱');
  const dynamicStateSummaries = [];
  const liveDomReportSummaries = [];

  try {
    // 1. Inspect live `appState` for any newly added future keys/modules
    if (typeof appState !== 'undefined' && appState && typeof appState === 'object') {
      Object.keys(appState).forEach(key => {
        if (!BASELINE_KNOWN_STATE_KEYS.has(key)) {
          const summary = summarizeArbitraryDataStructure(key, appState[key], cur);
          if (summary) dynamicStateSummaries.push(`Active State -> ${summary}`);
        }
      });
    }

    // 2. Inspect all workspace containers for any future custom fields/reports
    const wsList = (typeof workspaceRegistry !== 'undefined' && workspaceRegistry && Array.isArray(workspaceRegistry.workspaces))
      ? workspaceRegistry.workspaces
      : [];
    wsList.forEach(wsMeta => {
      const container = (typeof loadWorkspaceContainer === 'function') ? loadWorkspaceContainer(wsMeta.id) : null;
      if (container && typeof container === 'object') {
        Object.keys(container).forEach(key => {
          if (!BASELINE_KNOWN_STATE_KEYS.has(key)) {
            const summary = summarizeArbitraryDataStructure(key, container[key], cur);
            if (summary) dynamicStateSummaries.push(`Workspace "${wsMeta.name}" -> ${summary}`);
          }
        });
      }
    });

    // 3. Scrape live rendered KPI cards, custom widgets, and report panels directly from the DOM
    //    so any new report or analytics card added to the UI in the future is automatically read!
    if (typeof document !== 'undefined') {
      // 3a. All KPI & Metric Cards (.kpi-card, .sa-metric-card, [data-report-metric])
      const kpiCards = document.querySelectorAll('.kpi-card, .sa-metric-card, [data-report-metric]');
      const kpiPairs = [];
      kpiCards.forEach(card => {
        const labelEl = card.querySelector('.kpi-label, .sa-metric-title, h4, .label');
        const valEl = card.querySelector('.kpi-value, .sa-metric-value, .value, strong');
        const subEl = card.querySelector('.kpi-sub, .sa-metric-sub, small');
        const labelText = labelEl ? labelEl.textContent.replace(/\s+/g, ' ').trim() : '';
        const valText = valEl ? valEl.textContent.replace(/\s+/g, ' ').trim() : '';
        const subText = subEl ? subEl.textContent.replace(/\s+/g, ' ').trim() : '';
        if (labelText && valText) {
          kpiPairs.push(`${labelText}: ${valText}${subText ? ` (${subText})` : ''}`);
        }
      });
      if (kpiPairs.length > 0) {
        liveDomReportSummaries.push(`Live Rendered KPI & Analytics Cards: ${kpiPairs.slice(0, 16).join(' | ')}`);
      }

      // 3b. All Dashboard & Analytics Widget Panels (.panel, [data-widget-id], [data-report-section])
      const reportPanels = document.querySelectorAll('[data-widget-id], [data-report-section], #tab-analytics .panel, #tab-savings .panel');
      reportPanels.forEach(panel => {
        const headingEl = panel.querySelector('h2, h3, .panel-header h2, .panel-header h3');
        if (!headingEl) return;
        const title = headingEl.textContent.replace(/\s+/g, ' ').trim();
        if (!title) return;

        // Check if panel has a table with summary rows or badges
        const tableRows = panel.querySelectorAll('tbody tr');
        const badges = panel.querySelectorAll('.badge, .pill-badge, .sa-badge, strong');
        const badgeSnippets = [];
        badges.forEach((b, idx) => {
          if (idx < 5) {
            const txt = b.textContent.replace(/\s+/g, ' ').trim();
            if (txt && txt.length > 1 && txt.length < 55 && !title.includes(txt)) {
              badgeSnippets.push(txt);
            }
          }
        });

        if (tableRows.length > 0 || badgeSnippets.length > 0) {
          const rowInfo = tableRows.length > 0 ? `${tableRows.length} report rows` : '';
          const snippetInfo = badgeSnippets.length > 0 ? `Highlights: ${[...new Set(badgeSnippets)].slice(0, 4).join(', ')}` : '';
          liveDomReportSummaries.push(`Report Panel "${title}": ${[rowInfo, snippetInfo].filter(Boolean).join(' • ')}`);
        }
      });
    }
  } catch (e) {
    // Keep 100% safe & non-breaking
  }

  return {
    dynamicStateSummaries,
    liveDomReportSummaries,
    lastSyncedTimestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };
}

/**
 * Returns an array of real-time reports for ALL isolated workspaces in `workspaceRegistry.workspaces`.
 */
function getAllWorkspacesRealtimeReports() {
  const reports = [];
  const wsList = (typeof workspaceRegistry !== 'undefined' && workspaceRegistry && Array.isArray(workspaceRegistry.workspaces) && workspaceRegistry.workspaces.length > 0)
    ? workspaceRegistry.workspaces
    : [{ id: 'ws_default', name: 'Personal Finances', tag: 'Personal' }];
  const activeId = (typeof workspaceRegistry !== 'undefined' && workspaceRegistry && workspaceRegistry.activeWorkspaceId)
    ? workspaceRegistry.activeWorkspaceId
    : 'ws_default';

  wsList.forEach(wsMeta => {
    const isActive = wsMeta.id === activeId;
    let snapshot = null;
    if (isActive && typeof appState !== 'undefined') {
      snapshot = appState;
    } else if (typeof loadWorkspaceContainer === 'function') {
      snapshot = loadWorkspaceContainer(wsMeta.id);
    }
    if (snapshot) {
      reports.push(computeSingleWorkspaceRealtimeReport(wsMeta, snapshot, isActive));
    }
  });

  if (reports.length === 0 && typeof appState !== 'undefined') {
    reports.push(computeSingleWorkspaceRealtimeReport({ id: 'ws_default', name: 'Personal Finances', tag: 'Personal' }, appState, true));
  }
  return reports;
}

/**
 * Builds a comprehensive, real-time Multi-Workspace Financial Digest to inject into the AI Copilot's system prompt
 * so the AI understands all imported data, categories, expenses, variances, and any future reports across every workspace.
 */
function buildLiveAllWorkspacesPromptDigest() {
  try {
    const reports = getAllWorkspacesRealtimeReports();
    if (!reports || reports.length === 0) return 'No workspace data loaded yet.';

    const activeRep = reports.find(r => r.isActiveWorkspace) || reports[0];
    const cur = activeRep.currency;
    const periodStr = activeRep.months.join(', ');

    const topCatLines = activeRep.topSpentCats.length > 0
      ? activeRep.topSpentCats.map(c =>
          `  • ${c.icon} ${c.name}: Spent ${fmtAiMoney(c.spent, cur)} / Budget ${fmtAiMoney(c.budget, cur)} (${c.pctUsed.toFixed(1)}% used, Remaining: ${fmtAiMoney(c.remaining, cur)}${c.isOverBudget ? ' [OVER BUDGET!]' : ''})`
        ).join('\n')
      : '  • No category spending recorded in the active period yet.';

    const allCatsSummary = activeRep.categoryRows.slice(0, 18).map(c =>
      `${c.name}: Budget ${fmtAiMoney(c.budget, cur)}, Spent ${fmtAiMoney(c.spent, cur)}`
    ).join(' | ');

    const overBudgetLine = activeRep.overBudgetCats.length > 0
      ? activeRep.overBudgetCats.map(c => `${c.name} (Over by ${fmtAiMoney(c.spent - c.budget, cur)})`).join(', ')
      : 'None (All categories within budget caps!)';

    const topTxLines = activeRep.topTransactions.length > 0
      ? activeRep.topTransactions.map(t =>
          `  • ${t.date}: "${t.description}" — ${fmtAiMoney(t.amount, cur)} (${t.categoryName}, via ${t.paymentMethod})`
        ).join('\n')
      : '  • No transactions logged yet.';

    const pmSummary = Object.keys(activeRep.paymentMethods).length > 0
      ? Object.entries(activeRep.paymentMethods).map(([k, v]) => `${k}: ${fmtAiMoney(v, cur)}`).join(', ')
      : 'None';

    // Cross-workspace summary across all workspaces
    const allWorkspacesLines = reports.map(r =>
      `  • Workspace "${r.name}" [${r.tag}]${r.isActiveWorkspace ? ' [ACTIVE]' : ''}: Income ${fmtAiMoney(r.totalIncome, cur)}, Budget ${fmtAiMoney(r.totalBudget, cur)}, Spent ${fmtAiMoney(r.totalSpent, cur)}, Net Savings ${fmtAiMoney(r.netSavings, cur)} (${r.savingsRate.toFixed(1)}%), Categories: ${r.categoriesCount}, Active Period Tx: ${r.periodTxCount} (All-Time Tx: ${r.allTimeTxCount}, All-Time Spent: ${fmtAiMoney(r.allTimeSpent, cur)})`
    ).join('\n');

    // Auto-discover any newly added future data modules or live DOM reports
    const futureDiscovery = discoverDynamicFutureDataAndReports(cur);
    const dynamicModulesSection = futureDiscovery.dynamicStateSummaries.length > 0
      ? `\nAUTO-DISCOVERED NEW USER DATA MODULES:\n  • ${futureDiscovery.dynamicStateSummaries.join('\n  • ')}`
      : '';
    const liveDomReportsSection = futureDiscovery.liveDomReportSummaries.length > 0
      ? `\nLIVE RENDERED UI REPORTS & ANALYTICS WIDGETS (Real-Time DOM Snapshot @ ${futureDiscovery.lastSyncedTimestamp}):\n  • ${futureDiscovery.liveDomReportSummaries.join('\n  • ')}`
      : '';

    return `ACTIVE WORKSPACE REAL-TIME FINANCIAL REPORT ("${activeRep.name}" [${activeRep.tag}] • Period: ${periodStr} • Live Sync @ ${futureDiscovery.lastSyncedTimestamp}):
- Total Income: ${fmtAiMoney(activeRep.totalIncome, cur)} (15th Paycheck: ${fmtAiMoney(activeRep.paycheck15, cur)}, 30th Paycheck: ${fmtAiMoney(activeRep.paycheck30, cur)}, Additional: ${fmtAiMoney(activeRep.additionalIncome, cur)}, Carryover: ${fmtAiMoney(activeRep.carryoverSurplus, cur)})
- Total Allocated Budget: ${fmtAiMoney(activeRep.totalBudget, cur)} across ${activeRep.categoriesCount} categories
- Total Actual Spent (Active Period): ${fmtAiMoney(activeRep.totalSpent, cur)} across ${activeRep.periodTxCount} transactions (${activeRep.budgetUtilization.toFixed(1)}% of budget used)
- Remaining Budget Balance: ${fmtAiMoney(activeRep.remainingBudget, cur)} | Sweepable Unspent Category Surplus: ${fmtAiMoney(activeRep.totalSweepableSurplus, cur)}
- Net Retained Savings (Income - Spent): ${fmtAiMoney(activeRep.netSavings, cur)} (Savings Rate: ${activeRep.savingsRate.toFixed(1)}%)
- Over-Budget Categories Alert: ${overBudgetLine}
- Active Category Allocations (${activeRep.categoryRows.length} active): ${allCatsSummary || 'None'}
- Top Spending Categories in Active Period:
${topCatLines}
- Top / Largest Transactions:
${topTxLines}
- Spending by Payment Method: ${pmSummary}
- Recurring Bills: ${activeRep.activeBillsCount} active bills totaling ${fmtAiMoney(activeRep.activeBillsTotal, cur)}/mo
- Sinking Fund Goals: ${activeRep.sinkingFundsCount} goals (Saved: ${fmtAiMoney(activeRep.sinkingSavedTotal, cur)} / Target: ${fmtAiMoney(activeRep.sinkingTargetTotal, cur)})

ALL ISOLATED WORKSPACES COMPARISON (${reports.length} Total Workspaces):
${allWorkspacesLines}${dynamicModulesSection}${liveDomReportsSection}`;
  } catch (err) {
    return 'Live workspace metrics currently unavailable.';
  }
}

/**
 * Generates an instant, accurate Real-Time Financial Data & Multi-Workspace Report Analysis
 * whenever the user asks about their numbers, imported CSV data, spending, over-budget categories, workspaces, or newly added reports.
 */
function generateLiveDataAnalystResponse(userQuestion) {
  const q = String(userQuestion || '').toLowerCase().trim();
  const reports = getAllWorkspacesRealtimeReports();
  if (!reports || reports.length === 0) return null;

  // Check if user is asking about their live data, numbers, workspaces, spending, variances, or reports
  const matchedSpecificWs = reports.find(r =>
    q.includes(r.name.toLowerCase()) ||
    (r.tag && q.includes(r.tag.toLowerCase() + ' workspace')) ||
    (r.tag && q.includes(r.tag.toLowerCase() + ' book'))
  );

  const isDataAnalysisQuery =
    Boolean(matchedSpecificWs) ||
    q.includes('analyze') ||
    q.includes('interpret') ||
    q.includes('my data') ||
    q.includes('new data') ||
    q.includes('latest data') ||
    q.includes('my budget') ||
    q.includes('my spend') ||
    q.includes('my expense') ||
    q.includes('my income') ||
    q.includes('my report') ||
    q.includes('added report') ||
    q.includes('live report') ||
    q.includes('my workspace') ||
    q.includes('all workspace') ||
    q.includes('compare workspace') ||
    q.includes('imported') ||
    q.includes('over budget') ||
    q.includes('over-budget') ||
    q.includes('overspent') ||
    q.includes('overspending') ||
    q.includes('how much did i spend') ||
    q.includes('how much have i spent') ||
    q.includes('how much is left') ||
    q.includes('remaining budget') ||
    q.includes('biggest expense') ||
    q.includes('top expense') ||
    q.includes('highest spend') ||
    q.includes('where did my money') ||
    q.includes('financial summary') ||
    q.includes('executive summary') ||
    (q.includes('which categor') && (q.includes('over') || q.includes('surplus') || q.includes('most') || q.includes('top') || q.includes('left')));

  if (!isDataAnalysisQuery) return null;

  const targetRep = matchedSpecificWs || reports.find(r => r.isActiveWorkspace) || reports[0];
  const cur = targetRep.currency;
  const periodLabel = targetRep.months.join(', ');
  const futureDiscovery = discoverDynamicFutureDataAndReports(cur);

  // Sub-intent 1: Specifically asking about Over-Budget or Surplus categories
  if (q.includes('over budget') || q.includes('over-budget') || q.includes('overspent') || q.includes('overspending') || (q.includes('which categor') && (q.includes('surplus') || q.includes('over')))) {
    const hasOver = targetRep.overBudgetCats.length > 0;
    const hasSurplus = targetRep.surplusCats.length > 0;

    let intro = '';
    if (hasOver) {
      intro = `Heads up! You have **${targetRep.overBudgetCats.length} categor${targetRep.overBudgetCats.length === 1 ? 'y' : 'ies'} exceeding budget** in **${targetRep.name}** for **${periodLabel}**:`;
    } else {
      intro = `Great news! You currently have **zero over-budget categories** in **${targetRep.name}** for **${periodLabel}**.`;
    }

    let overBullets = '';
    if (hasOver) {
      overBullets = targetRep.overBudgetCats.slice(0, 5).map(c =>
        `• 🔴 **${c.icon} ${c.name}**: Spent ${fmtAiMoney(c.spent, cur)} of ${fmtAiMoney(c.budget, cur)} (${fmtAiMoney(c.spent - c.budget, cur)} over cap • ${c.pctUsed.toFixed(0)}% used)`
      ).join('\n');
    } else {
      overBullets = `• 🟢 **Category Health**: All ${targetRep.categoryRows.length} active categories are within their budget caps.`;
    }

    let surplusBullet = '';
    if (hasSurplus) {
      const topSurplus = targetRep.surplusCats.slice(0, 3).map(c => `**${c.icon} ${c.name}** (${fmtAiMoney(c.remaining, cur)} left)`).join(', ');
      surplusBullet = `• 💰 **Unspent Surplus**: ${fmtAiMoney(targetRep.totalSweepableSurplus, cur)} available across ${targetRep.surplusCats.length} categories (Top: ${topSurplus})`;
    } else {
      surplusBullet = `• 💰 **Unspent Surplus**: ${fmtAiMoney(0, cur)} remaining in unspent allocations`;
    }

    const utilBullet = `• 📊 **Budget Utilization**: ${fmtAiMoney(targetRep.totalSpent, cur)} spent of ${fmtAiMoney(targetRep.totalBudget, cur)} allocated (${targetRep.budgetUtilization.toFixed(1)}% utilized)`;

    const closing = hasOver
      ? `💡 *Tip: Consider reallocating funds from your surplus categories or adjusting caps in Budget Analytics.*`
      : (targetRep.totalSweepableSurplus > 0
          ? `💡 *Tip: You can use the 1-Click Surplus Sweeper to move your unspent ${fmtAiMoney(targetRep.totalSweepableSurplus, cur)} into your savings vault!*`
          : `💡 *Tip: Everything looks healthy and balanced for this period.*`);

    return {
      answerText: `${intro}\n\n${overBullets}\n${surplusBullet}\n${utilBullet}\n\n${closing}`,
      actionIds: ['goto_analytics', 'surplus_sweeper', 'goto_budget'],
      recommendation: null
    };
  }

  // Sub-intent 2: Full Live Data, Imported Transactions, Multi-Workspace & Dynamic Future Report Briefing
  const topCatsText = targetRep.topSpentCats.length > 0
    ? targetRep.topSpentCats.slice(0, 3).map(c => `**${c.icon} ${c.name}** (${fmtAiMoney(c.spent, cur)} / ${fmtAiMoney(c.budget, cur)})`).join(', ')
    : `No expenses logged in ${periodLabel} yet (${targetRep.categoriesCount} categories ready)`;

  const overAlertText = targetRep.overBudgetCats.length > 0
    ? `⚠️ **${targetRep.overBudgetCats.length} over budget**: ${targetRep.overBudgetCats.slice(0, 3).map(c => `${c.name} (-${fmtAiMoney(c.spent - c.budget, cur)})`).join(', ')}`
    : `✅ All categories on track (+${fmtAiMoney(targetRep.totalSweepableSurplus, cur)} surplus)`;

  const topTxText = targetRep.topTransactions.length > 0
    ? `\n• 🧾 **Top Transactions**: ${targetRep.topTransactions.slice(0, 3).map(t => `**${t.description}** (${fmtAiMoney(t.amount, cur)} on ${t.date})`).join(', ')}`
    : '';

  const multiWsText = reports.length > 1
    ? `\n• 📁 **All Workspaces**: ${reports.map(r => `**${r.name}** (${fmtAiMoney(r.totalSpent, cur)} spent of ${fmtAiMoney(r.totalBudget, cur)})`).join(' • ')}`
    : '';

  return {
    answerText: `Here is your real-time financial briefing for **${targetRep.name}** (${periodLabel}):\n\n• 💵 **Cashflow & Savings**: ${fmtAiMoney(targetRep.totalIncome, cur)} income, ${fmtAiMoney(targetRep.totalSpent, cur)} spent (${targetRep.budgetUtilization.toFixed(1)}% utilized) • Net savings: +${fmtAiMoney(targetRep.netSavings, cur)} (${targetRep.savingsRate.toFixed(1)}% rate)\n• 🎯 **Spending Health**: ${topCatsText} • ${overAlertText}${topTxText}${multiWsText}\n\n💡 *Tip: Let me know if you would like to drill down into a specific category or log a new transaction!*`,
    actionIds: ['goto_analytics', 'goto_savings', 'surplus_sweeper', 'open_workspaces'],
    recommendation: null
  };
}
// ============================================================================
// [FEAT-68] NIRVTRACK AI DYNAMIC KNOWLEDGE INTROSPECTION ENGINE
// Automatically discovers all features, DOM FAQ guides, action buttons, and tiers
// in real time so NirvTrack AI never misses new capabilities or docs!
// ============================================================================

function getAppFeaturesCatalog() {
  const featMap = (typeof FEATURE_TIERS !== 'undefined') ? FEATURE_TIERS : {};
  const tierGroups = { free: [], pro: [], executive: [] };

  const featureNames = {
    '[FEAT-01]': 'Monthly Budget Cycle Navigation',
    '[FEAT-02]': 'Bi-Monthly 15th & 30th Paycheck Income Planning',
    '[FEAT-03]': 'Custom Category Creation',
    '[FEAT-04]': 'Category Editing & Deletion',
    '[FEAT-05]': 'Daily Expense Entry (Shortcut: N)',
    '[FEAT-06]': 'Budget vs Actual Variance Engine',
    '[FEAT-07]': 'Financial Health Dashboard & Visual Charts',
    '[FEAT-08]': 'Multi-Currency Selector (₱, $, €, ¥, £)',
    '[FEAT-09]': 'Sample Demo Dataset Loader',
    '[FEAT-10]': 'Full CSV & JSON Data Export',
    '[FEAT-11]': 'Dark & Light Adaptive Themes',
    '[FEAT-12]': 'Multi-Month & YTD Trend Analytics',
    '[FEAT-13]': 'LocalStorage Offline-First Persistence',
    '[FEAT-14]': 'Clear Month Expenses with Confirmation',
    '[FEAT-15]': 'Inline Category Card Quick-Editing',
    '[FEAT-16]': 'Reset All Amounts to Zero',
    '[FEAT-17]': 'Responsive Adaptive Layout (Mobile, Tablet, Desktop)',
    '[FEAT-18]': 'Firebase Cloud Authentication (Free Prerequisite)',
    '[FEAT-19]': 'Built-in App Guide & Visual FAQ Knowledge Base',
    '[FEAT-20]': 'Cloud Firestore Real-Time Database Sync',
    '[FEAT-21]': 'Category Multi-Select & Bulk Month Copy',
    '[FEAT-22]': 'Standard Payment Method Tags',
    '[FEAT-23]': 'Click-to-Edit Budget Target Pills',
    '[FEAT-24]': 'Digital E-Wallets (GCash, Maya, GrabPay)',
    '[FEAT-25]': 'Detailed Variance Scorecard Table',
    '[FEAT-26]': 'Top Spending Drains Widget',
    '[FEAT-27 v2]': 'Isolated Multi-Workspaces (Personal, Business, Freelance)',
    '[FEAT-28]': 'Month-Scoped Category Exclusion',
    '[FEAT-29]': 'Category Drilldown Accordions',
    '[FEAT-30]': 'Safe-to-Spend Daily Allowance',
    '[FEAT-31]': 'Single-Key Fast Keyboard Navigation (D, B, E, R, A, S, W, H, N, Esc)',
    '[FEAT-32]': 'Recurring Bills & Subscriptions Calendar',
    '[FEAT-33]': 'Proactive Bill Due & Overspend Alerts',
    '[FEAT-34]': 'Auto-Post Bills to Expense Ledger',
    '[FEAT-35]': 'Collapsible Keyboard Shortcuts HUD',
    '[FEAT-36]': 'Multi-Layout UI Selector',
    '[FEAT-37]': 'Bills Interactive Column Sorting',
    '[FEAT-38]': 'Savings Analyst 7-Metric Cashflow Waterfall',
    '[FEAT-39]': '50/30/20 Wealth Diagnostic Benchmark',
    '[FEAT-40]': 'Smart Unified Filter Popover',
    '[FEAT-41]': 'CSV Bank Statement Importer',
    '[FEAT-42]': 'Needs vs. Wants Budget Filter Tabs',
    '[FEAT-43]': 'Emergency Runway & FIRE Wealth Simulator',
    '[FEAT-44]': 'Executive Privacy Stealth Mode (Quick Blur H)',
    '[FEAT-45]': 'Zero-Based Budget Auto-Optimizer',
    '[FEAT-46]': 'Expense Multi-Select & Bulk Actions',
    '[FEAT-47]': 'Merchant Memory & Quick-Fill Autocomplete',
    '[FEAT-48]': 'Universal Command Palette (Ctrl+K)',
    '[FEAT-49]': '1-Click Month-End Surplus Sweeper',
    '[FEAT-50]': 'Category Pacing & Burn-Rate Badges',
    '[FEAT-51]': 'Sinking Funds & Savings Goals Hub',
    '[FEAT-52]': 'Workspace Custom UI Layout Studio',
    '[FEAT-53]': 'Slide-Over System & Data Tools Drawer',
    '[FEAT-54]': 'Admin Command Center & Customer Directory',
    '[FEAT-55]': 'Administrative User Removal & Directory CSV Export',
    '[FEAT-56]': 'Tri-Tier Ambient Aura & Dynamic Modal Accents',
    '[FEAT-57]': 'Layering & High-Z Modal Stacking Architecture',
    '[FEAT-58]': 'Zen Minimalist Sidebar Floating Filter Popover',
    '[FEAT-59]': 'Bulk Category CSV Importer & Template Engine',
    '[FEAT-60]': 'Category CSV Target Scope Engine (Current Month vs. Global)',
    '[FEAT-61]': 'NirvTrack AI Assistant (BYOK Google Gemini)',
    '[FEAT-62]': 'AI Feature Recommendation Collector & Admin Wishlist Hub',
    '[FEAT-63]': 'NirvTrack AI Multi-Entry Natural Language Ledger Commands',
    '[FEAT-64]': 'Gmail Transaction Scanner & Staging Vetting Inbox',
    '[FEAT-65]': 'Automated PayMongo Webhooks & Instant Tier Upgrades (QR Ph, GCash, Maya)',
    '[FEAT-66]': 'Dynamic Tier-Matched Celebration Modal (Confetti + Synthesized Chime)',
    '[FEAT-67]': 'Exact Centavo Price Capture & Firestore Sync',
    '[FEAT-68]': 'NirvTrack AI Dynamic Knowledge Introspection Engine'
  };

  Object.keys(featMap).forEach(tag => {
    const tier = featMap[tag] || 'free';
    const name = featureNames[tag] || tag.replace(/[\[\]]/g, '');
    if (tierGroups[tier]) {
      tierGroups[tier].push(`${tag} ${name}`);
    }
  });

  return {
    total: Object.keys(featMap).length,
    tierGroups,
    featureNames
  };
}

function getAppFaqGuidesDigest() {
  if (typeof document === 'undefined') return 'No DOM FAQ guides available.';
  const faqItems = document.querySelectorAll('.faq-item');
  if (!faqItems || faqItems.length === 0) return 'No DOM FAQ guides found.';

  const lines = [];
  faqItems.forEach((item, idx) => {
    const qBtn = item.querySelector('.faq-question-btn');
    const qText = qBtn ? qBtn.innerText.replace(/\s+/g, ' ').trim() : `Guide #${idx + 1}`;
    const answerEl = item.querySelector('.faq-answer');
    const answerSummary = answerEl
      ? answerEl.innerText.replace(/\s+/g, ' ').slice(0, 160).trim() + '...'
      : '';
    const keywords = item.getAttribute('data-keywords') || '';
    lines.push(`• **${qText}**: ${answerSummary} (Keywords: ${keywords})`);
  });
  return lines.join('\n');
}

function getAppActionsDigest() {
  if (typeof FAQ_AI_ACTION_CATALOG === 'undefined') return '';
  return Object.keys(FAQ_AI_ACTION_CATALOG).map(id => {
    const cfg = FAQ_AI_ACTION_CATALOG[id];
    return `"${id}" (${cfg.label || id})`;
  }).join(', ');
}

function buildDynamicAppKnowledgeDigest() {
  const featInfo = getAppFeaturesCatalog();
  const faqDigest = getAppFaqGuidesDigest();
  const actionsDigest = getAppActionsDigest();

  return `DYNAMIC AUTO-INTROSPECTED NIRVTRACK KNOWLEDGE BASE (${featInfo.total} Total Registered Features):
- Free Core Features (${featInfo.tierGroups.free.length}):
  ${featInfo.tierGroups.free.join(', ')}
- Budget Pro Features (${featInfo.tierGroups.pro.length}):
  ${featInfo.tierGroups.pro.join(', ')}
- Executive Wealth Features (${featInfo.tierGroups.executive.length}):
  ${featInfo.tierGroups.executive.join(', ')}

OFFICIAL VISUAL GUIDES AUTO-HARVESTED FROM APP (${typeof document !== 'undefined' ? document.querySelectorAll('.faq-item').length : 29} Live Guides):
${faqDigest}

KEY WORKFLOW SYNTAX:
- Multi-Item AI Commands [FEAT-63]: "Add categories: Gym 2000, Internet 1500" or "Log expenses: Starbucks 190, Shell 1500" or "Add recurring bills: Netflix 549 on 15th". All include unique IDs & "↩️ Undo All".
- Gmail & Bank Scanner [FEAT-64]: Extracts merchant, date, amount from forwarded GCash, Maya, BDO, BPI alerts into staging vetting inbox.
- Subscriptions [FEAT-65, FEAT-66, FEAT-67]: Automated PayMongo webhooks (GCash, Maya, QR Ph, cards), exact centavo capture, and instant celebration modal.

AVAILABLE 1-CLICK ACTION BUTTONS:
${actionsDigest}`;
}

function searchDynamicFaqGuides(userQuestion) {
  if (typeof document === 'undefined') return null;
  const q = String(userQuestion || '').toLowerCase().trim();
  if (!q) return null;

  const faqItems = document.querySelectorAll('.faq-item');
  if (!faqItems || faqItems.length === 0) return null;

  const stopWords = new Set(['what', 'is', 'the', 'how', 'do', 'i', 'can', 'you', 'to', 'in', 'on', 'a', 'an', 'and', 'or', 'for', 'of', 'my', 'me', 'where', 'button']);
  const terms = q.split(/[\s,?.!]+/).filter(w => w.length > 2 && !stopWords.has(w));
  if (terms.length === 0) return null;

  let bestItem = null;
  let bestScore = 0;

  faqItems.forEach(item => {
    const qBtn = item.querySelector('.faq-question-btn');
    const title = qBtn ? qBtn.innerText.toLowerCase() : '';
    const keywords = (item.getAttribute('data-keywords') || '').toLowerCase();
    const answer = item.querySelector('.faq-answer') ? item.querySelector('.faq-answer').innerText.toLowerCase() : '';

    let score = 0;
    terms.forEach(term => {
      if (title.includes(term)) score += 5;
      if (keywords.includes(term)) score += 3;
      if (answer.includes(term)) score += 1;
    });

    if (score > bestScore && score >= 4) {
      bestScore = score;
      bestItem = item;
    }
  });

  if (bestItem) {
    const qBtn = bestItem.querySelector('.faq-question-btn');
    const title = qBtn ? qBtn.innerText.replace(/\s+/g, ' ').trim() : 'App Guide';
    const answerEl = bestItem.querySelector('.faq-answer');
    const rawAnswer = answerEl ? answerEl.innerText.replace(/\s+/g, ' ').slice(0, 340).trim() + '...' : '';
    const actionIds = resolveAiActionIdsForQuery(userQuestion, rawAnswer);

    return {
      answerText: `Here is the official guide for **${title}**:\n\n${rawAnswer}\n\n💡 *Tip: Click below to launch this feature directly or search the Command Palette!*`,
      actionIds: actionIds.length > 0 ? actionIds : ['open_command_palette', 'goto_dashboard'],
      recommendation: null
    };
  }

  return null;
}

/**
 * Calls the user's Google Gemini account directly from the browser using their API key or OAuth token.
 * Injects:
 * 1) Real-Time Multi-Workspace Financial Data Digest (all workspaces, imported CSVs, categories, variances, transactions)
 * 2) Learned Community Wishlist digest & recent conversation history
 * 3) Dynamic Auto-Introspected App Knowledge Digest (features, DOM guides, actions, tiers)
 * 4) Outside financial/world knowledge instructions + automatic feature recommendation logging
 */
async function callGoogleGeminiCopilot(userQuestion, apiKey, imageBase64 = null) {
  const preferredModel = localStorage.getItem(STORAGE_GEMINI_MODEL) || 'auto';
  const candidateModels = preferredModel === 'auto'
    ? ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
    : [preferredModel, 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];

  const activeCurrency = (typeof appState !== 'undefined' && appState.currency) ? appState.currency : '₱';
  const activeMonth = (typeof appState !== 'undefined' && appState.activeMonth) ? appState.activeMonth : 'Current Month';
  const wishlistDigest = buildLearnedWishlistPromptDigest();
  const liveWorkspacesDigest = buildLiveAllWorkspacesPromptDigest();
  const appKnowledgeDigest = buildDynamicAppKnowledgeDigest();

  const systemInstruction = `You are NirvTrack AI, the official real-time financial analyst and smart assistant inside the NirvTrack app.
Current User Context: Currency=${activeCurrency}, Active Month=${activeMonth}.

STYLE & FORMATTING RULES:
- Never copy-paste raw documentation blocks. Always answer in a clean, conversational, easy-to-scan format (1 short opening sentence + 2 to 4 crisp bullet points).
- Use the multi-turn conversation history to understand follow-up questions naturally.
- When the user asks about their own budget, imported CSV data, expenses, categories, variances, reports, or workspaces, analyze the LIVE MULTI-WORKSPACE FINANCIAL DATA below and cite their exact real-time numbers, percentages, and category names!
- When the user asks how to do something or where a button/report is, append relevant action IDs at the end using:
  <<<ACTION_BUTTONS:["action_id"]>>>
  Available action_ids: "add_expense", "goto_expenses", "upload_expense_csv", "add_category", "upload_category_csv", "download_category_csv_template", "goto_budget", "auto_budget_503020", "surplus_sweeper", "goto_bills", "add_bill", "goto_analytics", "goto_savings", "add_savings_goal", "open_workspaces", "open_multi_month", "open_command_palette", "toggle_privacy", "open_layout_studio", "switch_ui_minimal", "switch_ui_default", "open_system_tools", "export_csv", "export_json", "load_sample_data", "reset_zero", "goto_dashboard", "upgrade_pro", "upgrade_executive", "open_wishlist", "open_admin_wishlist", "open_admin_hub".

NIRVTRACK AI TRAINING & ARCHITECTURE (If user asks how you are trained or how to train you):
- Explain your 3-Layer Hybrid Architecture clearly:
  1. Real-Time Workspace Context (RAG): You dynamically inspect their live envelopes, balances, and multi-workspace ledgers without needing training runs.
  2. Autonomous Self-Learning Wishlist Loop: When users request workflows not in docs, you automatically synthesize and store feature requests into Cloud Firestore (/featureWishlist), increment community vote counts, and re-ingest Admin roadmap rankings into your pre-prompt memory before every chat.
  3. Developer & Codebase Training: Developers can expand your knowledge in app.js (systemInstruction, FEAT-01 to FEAT-67 catalog, FAQ_AI_ACTION_CATALOG) or connect custom tuned models from Google AI Studio via the Model Selector.
- Always append <<<ACTION_BUTTONS:["open_wishlist"]>>> (or "open_admin_wishlist" for admins) so users can immediately teach you new workflows.

UPGRADES & SUBSCRIPTIONS (If user asks about pricing, upgrading, or plans):
- Official Tiers: Free Core (₱0 / $0 Free Forever), Budget Pro (₱199/mo • $3.99/mo), Executive Wealth (₱599/mo • $9.99/mo).
- Payment Methods: Instant National QR Ph (GCash, Maya, BDO, BPI, UnionBank, Metrobank) powered by PayMongo with zero-wait automated webhooks (upgrades within 2s), plus Credit/Debit Cards and PayPal.
- Always append <<<ACTION_BUTTONS:["upgrade_pro", "upgrade_executive"]>>> to give users 1-click checkout buttons!

DOMAIN FINANCIAL COACHING MASTERY (Philippine & Global Personal Finance):
- You possess deep expertise in personal finance, accounting, and budgeting principles:
  • Philippine Vehicles: Pag-IBIG MP2 (tax-free, ~6.5-7% p.a. dividends, 5-yr lock-in, government-guaranteed), SSS contributions, BIR income tax brackets (TRAIN Law: 0% tax below ₱250k/year), 13th month pay tax-exemption threshold (up to ₱90k).
  • High-Yield Digital Banks: SeaBank (4.5% p.a.), Maya Savings (up to 10-14% p.a. promo / 4-6% base), GoTyme (4% p.a.), Tonik Stashes (4-4.5% p.a.).
  • Debt Payoff: Debt Snowball (smallest balance first for quick psychological momentum) vs. Debt Avalanche (highest interest rate first to minimize interest cost).
  • Emergency Reserve: 3 to 6 months of baseline essential needs (rent, utilities, food).
  • Multi-Workspace Partitioning: Strictly separating personal living costs from business, freelance, and side hustle cashflows.

LIVE MULTI-WORKSPACE FINANCIAL DATA & IMPORTED LEDGER REPORT (Real-Time User Data Across All Workspaces):
${liveWorkspacesDigest}

${appKnowledgeDigest}

LEARNED COMMUNITY FEATURE WISHLIST & ADMIN ROADMAP (Self-Learned from Past User Chats & Requests):
${wishlistDigest}

CRITICAL INSTRUCTION FOR UNDOCUMENTED QUESTIONS & EXTERNAL KNOWLEDGE:
When a user asks a question that goes BEYOND NirvTrack's documentation AND is not a question about their own financial data above (such as general personal finance, accounting, tax rules, investing, debt payoff strategies, currency exchange, or a feature not built in yet):
1. USE YOUR OUTSIDE KNOWLEDGE FIRST: Answer their question intelligently and accurately using real-world financial/domain knowledge (explain the concept, formula, or strategy in 1-2 crisp bullets).
2. CONNECT TO NIRVTRACK: Explain the closest way to apply or track it in NirvTrack today.
3. CHECK WISHLIST OR LOG AS A NEW RECOMMENDATION:
   - If it matches an item in the LEARNED COMMUNITY FEATURE WISHLIST above, mention its current Admin Priority Rank, Roadmap Status, and Vote Count.
   - Otherwise, synthesize the underlying feature idea + WHY the user needs it and append at the very end:
<<<FEATURE_RECOMMENDATION:{"title":"Clear Feature Idea Name","category":"Automation & AI","description":"Why user asked + 1-2 sentence summary of the recommended feature"}>>>`;

  // Build multi-turn contents array from recent faqAiConversationHistory (last 8 messages)
  const recentTurns = Array.isArray(faqAiConversationHistory)
    ? faqAiConversationHistory.slice(-8)
    : [];
  const multiTurnContents = [];
  recentTurns.forEach(turn => {
    if (!turn || !turn.text) return;
    const role = turn.role === 'assistant' ? 'model' : 'user';
    // Ensure alternating roles or valid sequence for Gemini API
    if (multiTurnContents.length === 0 && role === 'model') return;
    if (multiTurnContents.length > 0 && multiTurnContents[multiTurnContents.length - 1].role === role) {
      multiTurnContents[multiTurnContents.length - 1].parts[0].text += '\n' + String(turn.text);
    } else {
      multiTurnContents.push({
        role,
        parts: [{ text: String(turn.text) }]
      });
    }
  });
  const userParts = [{ text: String(userQuestion) }];
  if (imageBase64) {
    let mimeType = 'image/jpeg';
    let cleanB64 = imageBase64;
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      cleanB64 = match[2];
    }
    userParts.unshift({
      inlineData: {
        mimeType,
        data: cleanB64
      }
    });
  }

  if (multiTurnContents.length > 0 && multiTurnContents[multiTurnContents.length - 1].role === 'user' && !imageBase64) {
    multiTurnContents[multiTurnContents.length - 1].parts[0].text += '\n' + String(userQuestion);
  } else {
    multiTurnContents.push({
      role: 'user',
      parts: userParts
    });
  }

  // 1. [SEC-AI-PROXY] Prioritize Cloudflare edge serverless proxy (/api/ai-chat) so the dedicated key is never exposed
  if (typeof window !== 'undefined' && window.location && window.location.protocol !== 'file:') {
    try {
      const proxyRes = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateModels,
          systemInstruction,
          contents: multiTurnContents,
          customKey: (apiKey && apiKey.length >= 15 && apiKey !== 'server-proxy') ? apiKey : undefined,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 650
          }
        })
      });

      if (proxyRes.ok) {
        const data = await proxyRes.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
        if (rawText) {
          const parsed = extractRecommendationTag(rawText);
          return {
            answerText: parsed.cleanText,
            recommendation: parsed.recommendation,
            actionIds: parsed.actionIds,
            modelUsed: data.modelUsed || candidateModels[0] || 'Gemini 2.5'
          };
        }
      }
    } catch (proxyErr) {
      console.warn('Proxy /api/ai-chat fallback to direct client call:', proxyErr);
    }
  }

  // 2. Direct client fallback (when custom client key is provided or running offline/locally)
  const isBearerToken = apiKey && apiKey.startsWith('ya29.');
  let lastError = null;
  for (const model of candidateModels) {
    if (!apiKey || apiKey === 'server-proxy') break;
    try {
      const endpoint = isBearerToken
        ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
        : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const headers = { 'Content-Type': 'application/json' };
      if (isBearerToken) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        headers['x-goog-api-key'] = apiKey;
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          contents: multiTurnContents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 650
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const msg = (errJson && errJson.error && errJson.error.message) ? errJson.error.message : `HTTP ${response.status}`;
        lastError = new Error(msg);
        if (response.status === 404 || response.status === 400) continue;
        throw lastError;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
      if (!rawText) {
        lastError = new Error('Empty response from Gemini model');
        continue;
      }

      const parsed = extractRecommendationTag(rawText);
      return {
        answerText: parsed.cleanText,
        recommendation: parsed.recommendation,
        actionIds: parsed.actionIds,
        modelUsed: model
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Could not reach Google Gemini API');
}

function extractRecommendationTag(rawText) {
  let cleanText = String(rawText || '');
  let recommendation = null;
  let actionIds = [];

  const recMatch = cleanText.match(/<<<FEATURE_RECOMMENDATION:(\{[\s\S]*?\})>>>/);
  if (recMatch && recMatch[1]) {
    try {
      recommendation = JSON.parse(recMatch[1]);
    } catch (e) {}
    cleanText = cleanText.replace(recMatch[0], '').trim();
  }

  const actMatch = cleanText.match(/<<<ACTION_BUTTONS:(\[[\s\S]*?\])>>>/);
  if (actMatch && actMatch[1]) {
    try {
      actionIds = JSON.parse(actMatch[1]);
    } catch (e) {}
    cleanText = cleanText.replace(actMatch[0], '').trim();
  }

  return { cleanText, recommendation, actionIds };
}

/**
 * Fetches real-world external knowledge from public CORS-enabled APIs (Wikipedia REST Summary API
 * & DuckDuckGo Instant Answer API) when a user asks about a financial, technical, or general concept
 * that is outside NirvTrack's internal documentation.
 */
async function fetchExternalKnowledgeResource(userQuestion, fallbackTopic = '') {
  const rawSearch = String(fallbackTopic || userQuestion || '')
    .replace(/^(what\s+is\s+a?\s*|what\s+are\s+|how\s+does\s+|how\s+do\s+i\s+|how\s+to\s+|can\s+i\s+|can\s+you\s+|explain\s+|tell\s+me\s+about\s+)/i, '')
    .replace(/\?+$/, '')
    .trim();
  if (!rawSearch || rawSearch.length < 3) return '';

  const withTimeout = (promise, ms = 2500) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('External lookup timeout')), ms))
  ]);

  // 1. Try Wikipedia OpenSearch + Summary REST API (CORS-enabled with origin=*)
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(rawSearch)}&limit=1&namespace=0&format=json&origin=*`;
    const searchRes = await withTimeout(fetch(searchUrl), 2200);
    if (searchRes && searchRes.ok) {
      const searchJson = await searchRes.json();
      const topTitle = Array.isArray(searchJson?.[1]) && searchJson[1][0] ? searchJson[1][0] : '';
      if (topTitle) {
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`;
        const sumRes = await withTimeout(fetch(summaryUrl), 2200);
        if (sumRes && sumRes.ok) {
          const sumData = await sumRes.json();
          if (sumData && sumData.extract && sumData.extract.length > 30) {
            // Take first 2 concise sentences
            const sentences = String(sumData.extract).split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
            return `🌐 **External Knowledge (${sumData.title || topTitle})**: ${sentences}`;
          }
        }
      }
    }
  } catch (e) {}

  // 2. Fallback: Try DuckDuckGo Instant Answer JSON API
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(rawSearch)}&format=json&no_html=1&skip_disambig=1`;
    const ddgRes = await withTimeout(fetch(ddgUrl), 2000);
    if (ddgRes && ddgRes.ok) {
      const ddgData = await ddgRes.json();
      const abstractText = ddgData?.AbstractText || ddgData?.Answer || '';
      if (abstractText && abstractText.length > 25) {
        const sentences = String(abstractText).split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
        return `🌐 **External Knowledge Insight**: ${sentences}`;
      }
    }
  } catch (e) {}

  return '';
}

/**
 * Analyzes any user question to determine if they are asking for a capability or concept that is NOT part of
 * the official 67-feature documentation ([FEAT-01] to [FEAT-67])—even if their sentence mentions
 * generic words like "expense", "bill", "category", "month", or "export"—and extracts:
 *   1) Clean Feature Title
 *   2) Category
 *   3) External Domain Knowledge Answer (so the AI smartly answers the question first!)
 *   4) WHY the user asked (their underlying financial goal / pain point)
 *   5) Closest existing documented workaround + Action Buttons
 */
function synthesizeUndocumentedFeatureSpec(userQuestion) {
  const raw = String(userQuestion || '').trim();
  const q = raw.toLowerCase();
  if (!q) return null;

  // 1. Rich catalog of undocumented capabilities + External Financial Knowledge + WHY users ask + closest documented workaround
  const undocumentedCatalog = [
    {
      keywords: ['receipt', 'camera', 'ocr', 'scan', 'photo', 'picture'],
      title: 'Camera Receipt OCR Scanner & Auto-Itemizer',
      category: 'Automation & AI',
      externalInsight: '🌐 **How Receipt OCR Works**: Optical Character Recognition (OCR) uses computer vision to detect merchant headers, transaction dates, line items, and totals from receipt photos.',
      whyGoal: 'User wants to eliminate manual typing by snapping a photo of paper receipts to auto-extract merchant, date, and amount.',
      actionIds: ['add_expense', 'upload_expense_csv'],
      workaround: '- **How to Do This in NirvTrack Today**: Click **➕ Add Expense** below (or press **N**)—as soon as you type a merchant name, **Merchant Memory [FEAT-47]** auto-fills the category and payment method for you.'
    },
    {
      keywords: ['plaid', 'auto sync bank', 'auto-sync', 'connect bank', 'link bank', 'bank api', 'automatic bank', 'open banking', 'bank feed'],
      title: 'Direct Open-Banking / Plaid Live Transaction Sync',
      category: 'Cloud & Integrations',
      externalInsight: '🌐 **How Open Banking / Plaid Works**: Services like Plaid and Yodlee use OAuth bank tokens to poll checking and credit card ledgers for settled transactions automatically.',
      whyGoal: 'User wants hands-free background bank and credit card transaction syncing without downloading CSV statements.',
      actionIds: ['upload_expense_csv', 'goto_expenses'],
      workaround: '- **How to Do This in NirvTrack Today**: To keep your banking credentials 100% private and zero-cost, use our **1-Click Bank Statement CSV Importer [FEAT-41]** below to batch-upload hundreds of bank or card transactions in seconds.'
    },
    {
      keywords: ['crypto', 'stock', 'ticker', 'portfolio', 'bitcoin', 'dividend', 'brokerage', 'etf', 'mutual fund'],
      title: 'Live Investment, Stock & Crypto Portfolio Tracker',
      category: 'Wealth & Investing',
      externalInsight: '🌐 **Portfolio & Net Worth Tracking**: Financial advisors recommend tracking liquid cash reserves (Emergency Runway) separately from volatile market assets (Equities, ETFs, Crypto) while targeting at least 20% of monthly income toward long-term investments.',
      whyGoal: 'User wants to track live market values of stocks, ETFs, and crypto holdings alongside their cash Sinking Funds.',
      actionIds: ['goto_savings', 'add_savings_goal'],
      workaround: '- **How to Do This in NirvTrack Today**: Log your monthly brokerage/crypto contributions under the **Investments** category and project 3–5 year compound growth in **Savings Analyst [FEAT-38]**.'
    },
    {
      keywords: ['share workspace', 'family', 'spouse', 'partner', 'collaborat', 'invite user', 'multi-user workspace', 'wife', 'husband', 'household member'],
      title: 'Shared Partner / Family Multi-User Collaborative Workspace',
      category: 'Cloud & Integrations',
      externalInsight: '🌐 **Joint vs. Hybrid Household Budgeting**: Couples and partners typically use either a "Yours, Mine & Ours" 3-book structure or a unified household ledger with shared spending caps.',
      whyGoal: 'User wants two or more people (e.g., spouse, partner, or team) to collaborate on a shared budget from separate logins.',
      actionIds: ['open_workspaces'],
      workaround: '- **How to Do This in NirvTrack Today**: You can create separate **Isolated Workspaces [FEAT-27 v2]** (e.g., *Household*, *Personal*, *Business*) that sync in real time across any devices signed into the same account.'
    },
    {
      keywords: ['pdf', 'print report', 'pdf statement'],
      title: 'Executive Monthly PDF Financial Statement Generator',
      category: 'Analytics & Reports',
      externalInsight: '🌐 **Monthly Financial Statements**: A complete personal financial statement combines an Income & Cashflow Summary, Category Variance Scorecard, and Net Savings Rate.',
      whyGoal: 'User wants a formatted, print-ready monthly PDF financial statement with visual charts and variance summaries.',
      actionIds: ['export_csv', 'goto_analytics'],
      workaround: '- **How to Do This in NirvTrack Today**: Export a full **Excel CSV Variance Report [FEAT-10]** with 1 click below, or press **Ctrl+P** on the **Analytics** tab.'
    },
    {
      keywords: ['split bill', 'split expense', 'split with friend', 'roommate', 'venmo', 'splitwise', 'iou', 'shared tab', 'pay me back'],
      title: 'Split Bills & Group Expense IOU Tracker',
      category: 'Core Budgeting',
      externalInsight: '🌐 **Group Expense Splitting Best Practice**: In personal accounting, you should either record only your net personal share of a split bill so your category budget isn\'t artificially inflated, or tag the reimbursement portion as an IOU receivable.',
      whyGoal: 'User wants to split shared group expenses (dining, rent, trips) with friends or roommates and track who owes what.',
      actionIds: ['add_expense', 'goto_expenses'],
      workaround: '- **How to Do This in NirvTrack Today**: Log your personal share in **➕ Add Expense [FEAT-05]** or add a `#reimbursable` hashtag in the description to filter shared expenses.'
    },
    {
      keywords: ['whatsapp', 'sms', 'text alert', 'email alert', 'telegram', 'push notification', 'notify me when', 'alert when'],
      title: 'Automated WhatsApp, SMS & Email Budget Overspend Alerts',
      category: 'Automation & AI',
      externalInsight: '🌐 **Proactive Pacing Thresholds**: Behavioral finance research shows that receiving an alert at **85% category utilization** (before hitting 100%) reduces monthly overspending by over 25%.',
      whyGoal: 'User wants proactive external notifications (WhatsApp, SMS, or Email) when a category approaches or exceeds its budget cap.',
      actionIds: ['goto_budget', 'goto_bills'],
      workaround: '- **How to Do This in NirvTrack Today**: NirvTrack displays real-time **85% Amber & 100% Red Pacing Alerts [FEAT-08]** on your Dashboard and **Upcoming Bill Due Badges [FEAT-33]**.'
    },
    {
      keywords: ['debt snowball', 'debt avalanche', 'loan payoff', 'amortization', 'credit card payoff', 'interest calculator', 'mortgage calculator'],
      title: 'Debt Snowball / Avalanche & Loan Payoff Planner',
      category: 'Wealth & Investing',
      externalInsight: '🌐 **Debt Snowball vs. Debt Avalanche**: **Debt Snowball** pays off your *smallest balance first* for quick psychological wins, while **Debt Avalanche** pays off the *highest interest rate (APR) first* to save the most money mathematically (while paying minimums on all other debts).',
      whyGoal: 'User wants to model credit card or loan interest rates and generate an optimal debt payoff schedule (Snowball vs. Avalanche).',
      actionIds: ['goto_savings', 'goto_budget'],
      workaround: '- **How to Do This in NirvTrack Today**: Allocate your monthly payoff target in the **Debt / Loans** budget category and track each card/loan payoff milestone in **Sinking Funds [FEAT-51]**.'
    },
    {
      keywords: ['exchange rate', 'forex', 'convert currency', 'multi-currency', 'multiple currencies', 'auto convert', 'travel currency'],
      title: 'Live Multi-Currency Exchange Rate Converter (FX)',
      category: 'Cloud & Integrations',
      externalInsight: '🌐 **Multi-Currency Accounting**: When spending abroad or billing international clients, expenses are converted using the spot mid-market FX rate on the transaction date into your base reporting currency.',
      whyGoal: 'User wants transactions in foreign currencies to automatically convert into their home workspace currency using live FX rates.',
      actionIds: ['open_workspaces', 'add_expense'],
      workaround: '- **How to Do This in NirvTrack Today**: Each **Isolated Workspace [FEAT-27 v2]** can have its own dedicated currency symbol (`₱`, `$`, `€`, `£`, `¥`, `₹`, `₩`, `A$`, `C$`, `S$`).'
    },
    {
      keywords: ['quickbooks', 'xero', 'turbotax', 'tax report', 'tax deduction', 'accountant export', 'irs', 'bir', 'vat', 'withholding tax'],
      title: 'Tax Deduction Tagging & QuickBooks / Xero Accounting Export',
      category: 'Analytics & Reports',
      externalInsight: '🌐 **Tax Deduction Tracking**: Self-employed professionals and business owners can deduct ordinary and necessary business expenses (software, home office, travel, equipment) by keeping separated books and date-stamped transaction ledgers.',
      whyGoal: 'User wants to flag tax-deductible expenses and export accountant-ready tax schedules for tax filing.',
      actionIds: ['export_csv', 'open_workspaces'],
      workaround: '- **How to Do This in NirvTrack Today**: Keep a dedicated **Business / Freelance Workspace [FEAT-27 v2]** and use **Export CSV [FEAT-10]** for your accountant.'
    },
    {
      keywords: ['voice', 'siri', 'alexa', 'google assistant', 'microphone', 'speak', 'dictate'],
      title: 'Voice-Activated Expense Logging',
      category: 'Mobile & UX',
      externalInsight: '🌐 **Voice-to-Ledger Capture**: Natural language voice capture parses spoken phrases like *"Spent 450 pesos at Starbucks on Food"* into structured amount, merchant, and category fields.',
      whyGoal: 'User wants to log expenses hands-free using voice commands or mobile voice assistants.',
      actionIds: ['add_expense'],
      workaround: '- **How to Do This in NirvTrack Today**: Press **N** (or tap **+** on mobile) for 2-second entry with **Merchant Memory [FEAT-47]**.'
    },
    {
      keywords: ['google calendar', 'apple calendar', 'ical', 'ics', 'sync calendar'],
      title: 'Two-Way Google / Apple Calendar Bill Due-Date Sync',
      category: 'Cloud & Integrations',
      externalInsight: '🌐 **Calendar Cashflow Reminders**: Syncing recurring bill due dates with iCal / Google Calendar helps align due dates with 15th and 30th paycheck deposits to prevent late fees.',
      whyGoal: 'User wants recurring bill due dates and payday reminders to appear automatically on their phone or desktop calendar.',
      actionIds: ['goto_bills', 'add_bill'],
      workaround: '- **How to Do This in NirvTrack Today**: Track all due dates and automatic monthly ledger posting in the **Recurring Bills Hub [FEAT-32 & FEAT-34]**.'
    },
    {
      keywords: ['biometric', 'faceid', 'face id', 'fingerprint', 'touchid', 'pin lock', 'passcode', 'app lock'],
      title: 'Biometric FaceID / Fingerprint & PIN App Lock',
      category: 'Mobile & UX',
      externalInsight: '🌐 **Biometric WebAuthn & App Locks**: Modern web apps use WebAuthn passkeys and local screen locks to protect sensitive financial dashboards on shared devices.',
      whyGoal: 'User wants an extra local PIN or biometric lock screen before anyone holding their device can view financial data.',
      actionIds: ['toggle_privacy'],
      workaround: '- **How to Do This in NirvTrack Today**: Press **H** anytime to activate **Privacy Stealth Mode [FEAT-44]**, which blurs all monetary figures on screen.'
    }
  ];

  for (const item of undocumentedCatalog) {
    if (item.keywords.some(kw => q.includes(kw))) {
      return {
        title: item.title,
        category: item.category,
        externalInsight: item.externalInsight,
        whyGoal: item.whyGoal,
        description: `${item.whyGoal} (Asked: "${raw}")`,
        actionIds: item.actionIds,
        workaround: item.workaround
      };
    }
  }

  // 2. Dynamic Undocumented Concept Detector:
  // What if the user asks for something completely novel that is NOT in undocumentedCatalog AND NOT in our 67 documented features?
  const documentedCoreKeywords = [
    'add expense', 'new expense', 'log expense', 'record expense', 'delete expense', 'edit expense',
    'csv', 'bulk upload', 'import', 'template',
    'category', 'categories', 'envelope', 'allocation',
    '15th', '30th', 'paycheck', 'salary', 'income', '50/30/20', 'auto-balance', 'zero-based',
    'sweep', 'surplus', 'unspent', 'leftover',
    'recurring bill', 'subscription', 'due date', 'auto-post',
    'saving', 'sinking fund', 'runway', 'waterfall',
    'analytic', 'variance', 'scorecard', 'drilldown', 'chart',
    'workspace', 'personal book', 'business book',
    'multi-month', 'ytd', 'quarter',
    'layout', 'minimalist', 'zen mode', 'dark mode', 'light mode', 'theme', 'widget',
    'privacy', 'stealth', 'blur', 'shortcut', 'hotkey', 'command palette', 'ctrl+k',
    'backup', 'export json', 'sample data', 'demo data', 'reset to zero',
    'analyze', 'interpret', 'my data', 'my budget', 'my spend', 'my expense', 'my report', 'over budget', 'over-budget', 'overspent', 'how much'
  ];

  // Dynamic Check: Does this query match any registered feature tag, title, or DOM FAQ guide?
  const featInfo = (typeof getAppFeaturesCatalog === 'function') ? getAppFeaturesCatalog() : null;
  if (featInfo) {
    const allFeatureTags = Object.keys(featInfo.featureNames).map(k => k.toLowerCase().replace(/[\[\]]/g, ''));
    const allFeatureTitles = Object.values(featInfo.featureNames).map(t => t.toLowerCase());
    const matchesRegisteredFeature = allFeatureTags.some(tag => q.includes(tag)) ||
      allFeatureTitles.some(title => q.includes(title));
    if (matchesRegisteredFeature) {
      return null;
    }
  }

  if (typeof searchDynamicFaqGuides === 'function' && searchDynamicFaqGuides(userQuestion)) {
    return null;
  }

  const matchesDocumentedCore = documentedCoreKeywords.some(kw => q.includes(kw));
  if (!matchesDocumentedCore) {
    let extractedTopic = raw
      .replace(/^(can\s+i|can\s+you|can\s+budget\s+master|does\s+budget\s+master|does\s+this\s+app|does\s+it|is\s+there\s+a\s+way\s+to|is\s+there\s+an?\s+|how\s+do\s+i|how\s+can\s+i|how\s+to|do\s+you\s+have|do\s+you\s+support|what\s+is\s+a?\s*|what\s+are\s+|explain\s+|i\s+want\s+to|i\s+need\s+to|please\s+add)\s+/i, '')
      .replace(/\?+$/, '')
      .trim();

    if (extractedTopic.length > 4) {
      extractedTopic = extractedTopic.charAt(0).toUpperCase() + extractedTopic.slice(1);
    } else {
      extractedTopic = raw;
    }
    const cleanTitle = extractedTopic.length > 62 ? extractedTopic.slice(0, 59) + '...' : extractedTopic;

    let inferredCategory = 'Automation & AI';
    if (q.includes('sync') || q.includes('connect') || q.includes('link') || q.includes('api') || q.includes('bank') || q.includes('cloud')) {
      inferredCategory = 'Cloud & Integrations';
    } else if (q.includes('chart') || q.includes('report') || q.includes('graph') || q.includes('forecast') || q.includes('tax') || q.includes('export')) {
      inferredCategory = 'Analytics & Reports';
    } else if (q.includes('invest') || q.includes('loan') || q.includes('debt') || q.includes('net worth') || q.includes('interest') || q.includes('retire') || q.includes('inflation')) {
      inferredCategory = 'Wealth & Investing';
    } else if (q.includes('mobile') || q.includes('phone') || q.includes('button') || q.includes('screen') || q.includes('color') || q.includes('font')) {
      inferredCategory = 'Mobile & UX';
    } else if (q.includes('budget') || q.includes('spend') || q.includes('split') || q.includes('limit') || q.includes('rule')) {
      inferredCategory = 'Core Budgeting';
    }

    const whyGoal = `User asked about "${cleanTitle}"—an external concept/capability outside the current [FEAT-01]–[FEAT-67] documentation.`;

    return {
      title: cleanTitle,
      searchTopic: extractedTopic,
      category: inferredCategory,
      externalInsight: '',
      whyGoal,
      description: `${whyGoal} Original question: "${raw}"`,
      actionIds: ['open_command_palette', 'add_expense', 'goto_budget'],
      workaround: `- **How to Apply This in NirvTrack Today**: While dedicated **"${cleanTitle}"** automation isn't in our \`[FEAT-01]\`–\`[FEAT-67]\` docs yet, you can use the quick-action buttons below to open the **Command Palette (Ctrl+K)**, **Add an Expense**, or **Manage Budget Categories**.`
    };
  }

  return null;
}

/**
 * Clean, Conversational Intent, Real-Time Workspace Data Analyst, External Resource Lookup & Self-Learning Action Engine!
 * 1) Analyzes live user data & imported CSV ledgers across ALL Workspaces in real time.
 * 2) Checks learned Community Wishlist items & conversation history BEFORE answering.
 * 3) Uses outside resources (curated Financial Encyclopedia + live Wikipedia/DuckDuckGo APIs) to smartly answer questions outside the docs.
 * 4) Automatically logs the underlying idea as a Feature Recommendation on the Admin Wishlist.
 */
async function generateSmartLocalFaqResponse(userQuestion, prematchedWish = null) {
  const q = String(userQuestion || '').toLowerCase().trim();

  // 0a. Real-Time Live Data & Multi-Workspace Report Interpreter
  const liveDataAnalysis = generateLiveDataAnalystResponse(userQuestion);
  if (liveDataAnalysis) {
    return liveDataAnalysis;
  }

  // 0a-2. Direct Registered Feature Tag or Name Lookup (e.g. "What is FEAT-68?", "Explain FEAT-41")
  const featTagMatch = q.match(/feat-?(\d+)/i);
  if (featTagMatch) {
    const num = featTagMatch[1].padStart(2, '0');
    const fullTag = `[FEAT-${num}]`;
    const featCatalog = (typeof getAppFeaturesCatalog === 'function') ? getAppFeaturesCatalog() : null;
    if (featCatalog && featCatalog.featureNames[fullTag]) {
      const title = featCatalog.featureNames[fullTag];
      const tier = (typeof FEATURE_TIERS !== 'undefined' && FEATURE_TIERS[fullTag]) || 'free';
      const tierLabel = tier === 'executive' ? '👑 Executive Wealth' : (tier === 'pro' ? '⚡ Budget Pro' : '🟢 Free Core');
      const actionIds = resolveAiActionIdsForQuery(title, '');
      return {
        answerText: `**${fullTag} ${title}** is an official feature in NirvTrack (${tierLabel}):\n\n` +
          `• 🎯 **Capability**: ${title}\n` +
          `• 🏷️ **Tier Access**: ${tierLabel}\n` +
          `• ⚡ **Availability**: Built directly into your workspace.\n\n` +
          `💡 *Click below to access this feature directly or search the Command Palette!*`,
        actionIds: actionIds.length > 0 ? actionIds : ['open_command_palette', 'goto_dashboard'],
        recommendation: null
      };
    }
  }

  // 0b. If user asks "what recommendations have you learned?" or "show wishlist / roadmap"
  if (
    q.includes('wishlist') ||
    q.includes('roadmap') ||
    (q.includes('what') && (q.includes('recommend') || q.includes('learned') || q.includes('feature request')))
  ) {
    const topItems = [...(cachedFeatureWishlist || [])]
      .sort((a, b) => ((Number(a.rank) || 99) - (Number(b.rank) || 99)) || ((Number(b.votes) || 1) - (Number(a.votes) || 1)))
      .slice(0, 4);
    const bulletLines = topItems.map(item => {
      const r = Number(item.rank) <= 5 ? `Rank #${item.rank}` : 'Under Review';
      return `- **${item.title}** — **${r}** (${item.status || 'review'}, **${Number(item.votes) || 1} votes**)`;
    }).join('\n');
    return {
      answerText: `I have learned **${cachedFeatureWishlist.length} feature recommendations** from user chats and the Community Wishlist:\n${bulletLines || '- No items yet.'}\n\nWhenever you ask about a topic that is not in our documentation, I use **outside knowledge resources** to answer your question AND automatically log the idea to our **Admin Feature Wishlist**!`,
      actionIds: (typeof isCurrentUserAdmin === 'function' && isCurrentUserAdmin()) ? ['open_admin_hub', 'open_command_palette'] : ['open_command_palette'],
      recommendation: null
    };
  }

  const statusLabels = {
    review: '📋 Under Review',
    planned: '🛠️ Planned on Roadmap',
    progress: '🚀 In Progress',
    shipped: '✅ Shipped',
    declined: '❌ Declined'
  };

  // 1. Check if the question asks for ANY concept/capability outside the official documentation (via synthesizeUndocumentedFeatureSpec)
  const undocSpec = synthesizeUndocumentedFeatureSpec(userQuestion);
  if (undocSpec) {
    // Fetch live outside knowledge if not already provided in undocSpec.externalInsight
    let outsideKnowledgeBlock = undocSpec.externalInsight || '';
    if (!outsideKnowledgeBlock) {
      outsideKnowledgeBlock = await fetchExternalKnowledgeResource(userQuestion, undocSpec.searchTopic || undocSpec.title);
    }
    if (!outsideKnowledgeBlock) {
      outsideKnowledgeBlock = `🌐 **External Financial & Product Insight**: **${undocSpec.title}** is a valuable workflow enhancement that helps automate and streamline personal or business finance management.`;
    }

    const learned = prematchedWish || findMatchingLearnedRecommendation(undocSpec.title) || findMatchingLearnedRecommendation(userQuestion);
    if (learned) {
      const rankStr = Number(learned.rank) <= 5 ? `Admin Priority Rank #${learned.rank}` : 'Pending Admin Priority Rank';
      const statusStr = statusLabels[learned.status] || '📋 Under Review';
      const noteLine = learned.adminNotes ? `\n- **Admin Roadmap Note**: *"${learned.adminNotes}"*` : '';
      return {
        answerText: `${outsideKnowledgeBlock}\n${undocSpec.workaround}\n- **🧠 Learned Roadmap Status**: I already learned this feature idea from previous chats! It is on our Community Wishlist (**${rankStr}** • **${statusStr}** • **${Number(learned.votes) || 1} community votes**).${noteLine}\n- Click **👍 Upvote (+1)** on the card below to boost its priority!`,
        actionIds: undocSpec.actionIds || [],
        recommendation: {
          title: learned.title,
          category: learned.category || undocSpec.category,
          description: learned.description || undocSpec.description
        }
      };
    }
    return {
      answerText: `${outsideKnowledgeBlock}\n${undocSpec.workaround}\n- **💡 Idea Logged as Feature Recommendation**: I also analyzed **why** you asked (*${undocSpec.whyGoal}*) and automatically logged **${undocSpec.title}** to our **Admin Feature Wishlist** below so future chats remember it!`,
      actionIds: undocSpec.actionIds || [],
      recommendation: {
        title: undocSpec.title,
        category: undocSpec.category,
        description: undocSpec.description
      }
    };
  }

  // 1b. If the user's question matched a previously learned custom recommendation in cachedFeatureWishlist!
  const matchedCustomWish = prematchedWish || findMatchingLearnedRecommendation(userQuestion);
  if (matchedCustomWish) {
    const rankStr = Number(matchedCustomWish.rank) <= 5 ? `Admin Priority Rank #${matchedCustomWish.rank}` : 'Under Admin Review';
    const statusStr = statusLabels[matchedCustomWish.status] || '📋 Under Review';
    const noteLine = matchedCustomWish.adminNotes ? `\n- **Admin Note**: *"${matchedCustomWish.adminNotes}"*` : '';
    return {
      answerText: `I remember **"${matchedCustomWish.title}"** from our learned Community Wishlist!\n- **Current Roadmap Status**: **${rankStr}** • **${statusStr}** (**${Number(matchedCustomWish.votes) || 1} vote${Number(matchedCustomWish.votes) === 1 ? '' : 's'}**).${noteLine}\n- **Why Requested & Summary**: ${matchedCustomWish.description}\n- You can click **👍 Upvote (+1)** below to increase its demand score, or use the quick actions below:`,
      actionIds: resolveAiActionIdsForQuery(userQuestion, matchedCustomWish.description),
      recommendation: {
        title: matchedCustomWish.title,
        category: matchedCustomWish.category || 'Automation & AI',
        description: matchedCustomWish.description
      }
    };
  }

  // 2. Clean, Intent-Driven Conversational Answers + Direct In-Chat Action Buttons

  // Intent 0: Multi-Entry AI Commands & Batch Ledger Formats [FEAT-63]
  if (
    q.includes('multiple entries') ||
    q.includes('multiple entry') ||
    q.includes('multi-entry') ||
    q.includes('multi entry') ||
    q.includes('batch entry') ||
    q.includes('batch entries') ||
    (q.includes('multiple') && (q.includes('categor') || q.includes('expense') || q.includes('bill') || q.includes('format') || q.includes('how') || q.includes('chat') || q.includes('prompt') || q.includes('add') || q.includes('syntax'))) ||
    (q.includes('format') && (q.includes('multiple') || q.includes('batch') || q.includes('several') || q.includes('list') || q.includes('ai') || q.includes('copilot')))
  ) {
    return {
      answerText: 'You can add **multiple items in 1 chat** prompt using either a comma-separated line or a multi-line list. Here are the exact formats:\n\n' +
        '🏷️ **1. Multiple Categories**:\n' +
        '- **Single-Line**: `Add categories: Gym 2000, Internet 1500, Pet Care 800`\n' +
        '- **Multi-Line**:\n' +
        '  ```text\n' +
        '  Add categories:\n' +
        '  - Groceries 15000 (needs)\n' +
        '  - Dining Out 5000 (wants)\n' +
        '  - Gym 2000\n' +
        '  ```\n\n' +
        '💸 **2. Multiple Expenses**:\n' +
        '- **Single-Line**: `Log expenses: Starbucks 190, Shell Gas 1500, Groceries 3400`\n' +
        '- **With Categories**:\n' +
        '  ```text\n' +
        '  Log expenses:\n' +
        '  - Lunch 250 under Food\n' +
        '  - Taxi 180 under Transportation\n' +
        '  - Movie 350 under Entertainment\n' +
        '  ```\n\n' +
        '🔁 **3. Multiple Recurring Bills**:\n' +
        '- **Single-Line**: `Add recurring bills: Netflix 549 on 15th, Spotify 149 on 20th, Gym 1500 on 1st`\n' +
        '- **Multi-Line**:\n' +
        '  ```text\n' +
        '  Add recurring bills:\n' +
        '  - Fiber Internet 1699 on 5th\n' +
        '  - Electricity 2500 on 25th\n' +
        '  - Mobile Plan 999 on 20th\n' +
        '  ```\n\n' +
        '⚡ **100% Safe & Instant Undo**: Every item receives a unique ID, syncs across your workspace and Cloud Firestore automatically, and includes a **↩️ Undo All** button to revert the whole batch anytime!',
      actionIds: ['add_category', 'add_expense', 'goto_bills'],
      recommendation: null
    };
  }

  // Intent 0b: Gmail & Bank Transaction Alert Scanner [FEAT-64]
  if (
    q.includes('gmail') ||
    q.includes('email alert') ||
    q.includes('bank alert') ||
    q.includes('transaction scanner') ||
    q.includes('email scanner') ||
    q.includes('vetting') ||
    q.includes('staging') ||
    q.includes('feat-64')
  ) {
    return {
      answerText: 'The **Gmail & Bank Transaction Alert Scanner [FEAT-64]** eliminates manual receipt entry by transforming e-wallet & bank alert emails into verified ledger expenses:\n\n' +
        '• 📬 **Smart Parsing Engine**: Automatically parses transaction amount, merchant, date, and payment method from forwarded bank alerts (GCash, Maya, BDO, BPI, UnionBank, Grab).\n' +
        '• 🛡️ **Interactive Staging Inbox**: Candidate transactions appear in a vetting table first so you can inspect, edit, check/uncheck, or categorize them before committing.\n' +
        '• 🔒 **100% Client-Side Privacy**: All parsing runs strictly inside your web browser. No sensitive emails or credentials are ever transmitted to or stored on our servers.\n' +
        '• ⚡ **1-Click Ledger Post**: Click **✅ Approve & Post Selected** to write vetted transactions directly to your active month\'s expense ledger and Cloud Firestore.',
      actionIds: ['upload_expense_csv', 'goto_expenses', 'add_expense'],
      recommendation: null
    };
  }

  // Intent 0c: Automated PayMongo Subscriptions, Dynamic QR Ph & Confetti Celebration [FEAT-65, FEAT-66, FEAT-67]
  if (
    q.includes('paymongo') ||
    q.includes('qr ph') ||
    q.includes('celebration') ||
    q.includes('confetti') ||
    q.includes('chime') ||
    q.includes('feat-65') ||
    q.includes('feat-66') ||
    q.includes('feat-67')
  ) {
    return {
      answerText: 'NirvTrack features an **Automated Real-Time Subscription & Dynamic QR Ph Engine [FEAT-65, FEAT-66 & FEAT-67]**:\n\n' +
        '• ⚡ **National QR Ph Standard**: PayMongo generates an interoperable QR Ph code. Scan with **GCash, Maya, BDO, BPI, or UnionBank** and authenticate securely with FaceID, Fingerprint, or MPIN.\n' +
        '• 🔄 **Zero-Wait Webhook Pipeline [FEAT-65]**: PayMongo sends a real-time `payment.paid` event to our Pipedream webhook, automatically updating your Cloud Firestore document in under 2 seconds.\n' +
        '• 💰 **Dynamic Centavo Price Recording [FEAT-67]**: Pipedream reads exact centavos paid from PayMongo storefronts and records the actual transaction price in Firestore (`amountPaid`), ensuring real-time accuracy for any price or promo.\n' +
        '• 🎉 **Dynamic Tier Celebration Modal [FEAT-66]**: Upon upgrade, a theme-matched celebration modal appears with 60fps micro-confetti, a synthesized Web Audio major chord chime, and an itemized receipt strip showing your exact amount paid.',
      actionIds: ['upgrade_pro', 'upgrade_executive', 'open_command_palette'],
      recommendation: null
    };
  }

  // Intent 0d: Pricing, Plans & Competitive Market Comparison Guide
  if (
    q.includes('pricing') ||
    q.includes('price') ||
    q.includes('cost') ||
    q.includes('how much') ||
    q.includes('compare plans') ||
    q.includes('plan comparison') ||
    q.includes('subscription cost') ||
    q.includes('free vs pro') ||
    q.includes('pro vs executive') ||
    (q.includes('tier') && (q.includes('difference') || q.includes('compare') || q.includes('feature') || q.includes('cost')))
  ) {
    return {
      answerText: 'NirvTrack follows a **Value-First, Non-Predatory Tier Architecture** designed to be highly competitive in the personal finance market:\n\n' +
        '• 🟢 **Free Core (₱0 / $0 Forever)**:\n' +
        '  - 100% offline-first personal budgeting with 1 active workspace.\n' +
        '  - Bi-monthly 15th & 30th paycheck planning, unlimited custom envelopes, expense ledger, CSV category importer, and BYOK Google Gemini AI.\n' +
        '  - **Cloud Auth & Sync Included**: Prerequisite cloud login and single-workspace cloud sync are free so you never lose your data.\n\n' +
        '• ⚡ **Budget Pro (₱199 / mo • $3.99/mo)**:\n' +
        '  - Up to 5 isolated workspaces, Automated Recurring Bills Calendar & Auto-Posting, Gmail Transaction Scanner [FEAT-64], and CSV Bank Statement Importer [FEAT-41].\n' +
        '  - Safe Daily Spend Allowance, Variance Scorecard with Accordion Drilldowns, Merchant Memory Quick-Fill, Universal Spotlight Command Palette (Ctrl+K), and Category Pacing Badges.\n\n' +
        '• 👑 **Executive Wealth (₱599 / mo • $9.99/mo)**:\n' +
        '  - Unlimited Isolated Workspaces (99,999) for Personal, Business, LLC, Freelance, or Rental Books.\n' +
        '  - 50/30/20 Wealth Diagnostic Benchmark, 7-Metric Savings Analyst Waterfall, Sinking Funds & Multi-Goal Projections, Zero-Based Auto-Optimizer, 1-Click Surplus Sweeper, Privacy Stealth Mode (H), and Custom UI Studio.\n\n' +
        '💡 **Market Comparison**: While YNAB ($14.99/mo ~ ₱850) and Monarch ($14.99/mo) offer zero free tiers and lack multi-workspace isolation, NirvTrack delivers unmatched flexibility at 30% to 70% lower cost.',
      actionIds: ['upgrade_pro', 'upgrade_executive', 'open_workspaces'],
      recommendation: null
    };
  }

  // Intent 0e: How to Train NirvTrack AI & Architecture Guide
  if (
    q.includes('train') ||
    q.includes('teach') ||
    q.includes('how to train') ||
    q.includes('training') ||
    q.includes('fine-tune') ||
    q.includes('fine tune') ||
    q.includes('model learning') ||
    q.includes('developer training') ||
    q.includes('codebase training')
  ) {
    const isAdmin = (typeof isCurrentUserAdmin === 'function') ? isCurrentUserAdmin() : false;
    return {
      answerText: 'NirvTrack AI is built on a **3-Layer Hybrid Training & Knowledge Architecture**:\n\n' +
        '• 📊 **1. Real-Time Workspace Context (RAG)**: I am grounded on your active live numbers—analyzing envelopes, balances, cashflow, and multi-workspace ledgers dynamically before answering every prompt.\n' +
        '• 🧠 **2. Autonomous Self-Learning Wishlist Loop**: When users ask for features or workflows outside our documentation, I automatically synthesize the request and save it to Cloud Firestore (`/featureWishlist`). Community votes and Admin rankings are re-injected into my pre-prompt memory before every chat!\n' +
        '• 💻 **3. Developer / Codebase Training**: You can expand my core behavior in `app.js` by editing `systemInstruction` under `callGoogleGeminiCopilot()`, registering interactive buttons in `FAQ_AI_ACTION_CATALOG`, or connecting custom tuned models from Google AI Studio via the Model Selector.\n\n' +
        '💡 *Click below to recommend a new feature or inspect the roadmap!*',
      actionIds: isAdmin ? ['open_wishlist', 'open_admin_wishlist', 'open_command_palette'] : ['open_wishlist', 'open_command_palette'],
      recommendation: null
    };
  }

  // Intent A: Adding or finding the Add Expense button / logging transactions
  if (
    q.includes('add expense') ||
    q.includes('new expense') ||
    q.includes('log expense') ||
    q.includes('record expense') ||
    (q.includes('expense') && (q.includes('button') || q.includes('find') || q.includes('where') || q.includes('how') || q.includes('add')))
  ) {
    return {
      answerText: 'You can log a new expense from **anywhere in the app** in 3 easy ways:\n- **Click the button right below** in this chat (**➕ Add Expense Now**) to open the Expense form immediately.\n- **Top-Right Header**: Click the glowing **+ Add Expense** button at the top-right of your screen.\n- **Keyboard Shortcut**: Press **N** on your keyboard anytime (or **+** at the bottom on mobile).',
      actionIds: ['add_expense', 'goto_expenses', 'upload_expense_csv'],
      recommendation: null
    };
  }

  // Intent B: Bulk CSV Upload (Categories or Expenses)
  if (q.includes('csv') || q.includes('bulk') || q.includes('upload') || q.includes('import') || q.includes('template')) {
    if (q.includes('categor')) {
      return {
        answerText: 'You can **bulk upload Budget Categories via CSV [FEAT-59 & FEAT-60]** in seconds:\n- **Required Columns**: Just **Category** and **Amount** (icons and colors are assigned automatically).\n- **Target Scope**: A preview window lets you choose **Current Month Only (Default)** or **Global (All Months)**.\n- Click **📂 Bulk Upload Categories CSV** below to start right now!',
        actionIds: ['upload_category_csv', 'download_category_csv_template', 'add_category'],
        recommendation: null
      };
    }
    return {
      answerText: 'NirvTrack includes **two 1-Click CSV Importers**—click either button below to launch the one you need:\n- **📂 Bulk Upload Categories CSV [FEAT-59 & FEAT-60]**: Upload a spreadsheet with **Category** and **Amount** columns into the **Current Month (Default)** or **Global (All Months)**.\n- **📂 Upload Expense CSV [FEAT-41]**: Batch-import bank or card transactions (**Date**, **Description**, **Amount**) directly into your Expense Tracker.',
      actionIds: ['upload_category_csv', 'upload_expense_csv', 'download_category_csv_template'],
      recommendation: null
    };
  }

  // Intent C: Adding, Editing, or Deleting Budget Categories
  if (q.includes('categor') || q.includes('envelope') || q.includes('allocation')) {
    return {
      answerText: 'Here is how to manage your **Budget Categories [FEAT-03, FEAT-23, FEAT-28]**:\n- **Create a Category**: Click **🏷️ + Add New Category** below (or on the **Budget & Income** tab) to add a custom category with auto-detected emoji and color.\n- **Quick Edit Amount**: Click directly on any dollar/peso amount on a category card to type a new monthly budget inline.\n- **Delete or Bulk Copy**: Select checkboxes on category cards to copy them to future months or remove them from the current month only.',
      actionIds: ['add_category', 'upload_category_csv', 'goto_budget'],
      recommendation: null
    };
  }

  // Intent D: 15th & 30th Paychecks, Income, or 50/30/20 Rule
  if (q.includes('15th') || q.includes('30th') || q.includes('paycheck') || q.includes('income') || q.includes('salary') || q.includes('50/30/20') || q.includes('auto-balance') || q.includes('zero-based')) {
    return {
      answerText: 'You can set your **15th & 30th Paychecks [FEAT-02]** and auto-balance your budget using the **50/30/20 Optimizer [FEAT-45]**:\n- Open the **Budget & Income** tab and enter your **15th Paycheck**, **30th Paycheck**, and any **Side Income** at the top.\n- Click **⚡ Open 50/30/20 Auto-Budget Optimizer** below to automatically distribute your income across **Needs (50%)**, **Wants (30%)**, and **Savings (20%)**.',
      actionIds: ['goto_budget', 'auto_budget_503020'],
      recommendation: null
    };
  }

  // Intent E: Surplus Sweeper
  if (q.includes('sweep') || q.includes('surplus') || q.includes('unspent') || q.includes('leftover')) {
    return {
      answerText: 'The **1-Click Month-End Surplus Sweeper [FEAT-49]** helps you save all unspent money at the end of the month:\n- It calculates **Budget Cap − Actual Spent** across every category.\n- With 1 click, it sweeps your unspent surplus into your **Emergency Fund / Savings** while keeping your monthly category caps strict.',
      actionIds: ['surplus_sweeper', 'goto_savings'],
      recommendation: null
    };
  }

  // Intent F: Recurring Bills & Subscriptions
  if (q.includes('bill') || q.includes('subscription') || q.includes('recurring') || q.includes('due date') || q.includes('auto-post')) {
    return {
      answerText: 'Track all your monthly bills and subscriptions in the **Recurring Bills Hub [FEAT-32 & FEAT-34]**:\n- Add fixed bills (rent, utilities, Netflix, insurance) with their due day and frequency.\n- **Auto-Post to Ledger**: Enabled by default so due bills are automatically logged into your Expense Tracker each month without duplicate entries.',
      actionIds: ['add_bill', 'goto_bills'],
      recommendation: null
    };
  }

  // Intent G: Savings Analyst, Sinking Funds, Emergency Runway
  if (q.includes('saving') || q.includes('sinking') || q.includes('goal') || q.includes('runway') || q.includes('waterfall') || q.includes('wealth')) {
    return {
      answerText: 'The **Savings Analyst & Sinking Funds Hub [FEAT-38 & FEAT-51]** gives you a complete view of your wealth:\n- **7-Metric Cashflow Waterfall**: Tracks Gross Income down to True Retained Savings.\n- **Sinking Funds**: Create dedicated milestone savings pots (e.g., *Emergency Fund*, *Travel*, *New Car*) and log deposits or withdrawals.',
      actionIds: ['goto_savings', 'add_savings_goal', 'surplus_sweeper'],
      recommendation: null
    };
  }

  // Intent H: Analytics, Charts, Variance Scorecard
  if (q.includes('analytic') || q.includes('variance') || q.includes('scorecard') || q.includes('chart') || q.includes('drilldown') || q.includes('report')) {
    return {
      answerText: 'You can audit your spending vs. targets in **Budget vs. Actual Analytics [FEAT-07, FEAT-25, FEAT-29]**:\n- Click any column header in the **Variance Scorecard** to sort by Budget, Actual Spent, or Remaining.\n- Click any category row (▾) to expand an inline **Transaction Drilldown** showing every expense in that category.',
      actionIds: ['goto_analytics', 'export_csv'],
      recommendation: null
    };
  }

  // Intent I: Workspaces (Personal vs Business books)
  if (q.includes('workspace') || q.includes('business') || q.includes('separate') || q.includes('book')) {
    return {
      answerText: '**Isolated Financial Workspaces [FEAT-27 v2]** let you keep completely separate books (e.g., *Personal Finances*, *Business / Freelance*, *Family*) with zero data bleed:\n- Press **W** on your keyboard or click **📁 Open Workspaces Drawer** below to switch, create, rename, or clone a workspace.',
      actionIds: ['open_workspaces'],
      recommendation: null
    };
  }

  // Intent J: Multi-Month / YTD / Date Period
  if (q.includes('month') || q.includes('ytd') || q.includes('quarter') || q.includes('year') || q.includes('period') || q.includes('date')) {
    return {
      answerText: 'You can switch months or aggregate multiple months using **Multi-Month Range Analysis [FEAT-12 & FEAT-40]**:\n- Use the sidebar filter pill (**📁 Workspace • Month ▾**) to switch months or select **1 Mo**, **3 Mo**, **YTD**, or **Year**.\n- Click **🗓️ Open Multi-Month Period Selector** below to pick custom months.',
      actionIds: ['open_multi_month', 'goto_dashboard'],
      recommendation: null
    };
  }

  // Intent K: Layout Mode (Minimalist Zen, Executive, Custom Widgets, Theme)
  if (q.includes('layout') || q.includes('minimal') || q.includes('zen') || q.includes('theme') || q.includes('dark') || q.includes('light') || q.includes('widget')) {
    return {
      answerText: 'Customize your workspace look and layout anytime:\n- **Layout Modes [FEAT-36]**: Switch between **Default Executive** (full Power BI dashboard) and **Minimalist Zen** (sleek 76px icon rail).\n- **Custom UI Widget Studio [FEAT-52]**: Reorder or hide individual dashboard and page widgets.',
      actionIds: ['open_layout_studio', 'switch_ui_minimal', 'switch_ui_default'],
      recommendation: null
    };
  }

  // Intent L: Privacy Blur / Shortcuts / Command Palette
  if (q.includes('privacy') || q.includes('blur') || q.includes('stealth') || q.includes('hide') || q.includes('shortcut') || q.includes('hotkey') || q.includes('command') || q.includes('find') || q.includes('button')) {
    return {
      answerText: 'Here are the fastest ways to find any button or control in NirvTrack:\n- **Spotlight Command Palette (Ctrl+K) [FEAT-48]**: Search and trigger any action, tab, or modal in 1 click.\n- **Quick Add Expense (N)**: Opens the New Expense modal immediately.\n- **Privacy Stealth Mode (H) [FEAT-44]**: Blurs all dollar/peso balances when working in public.\n\nClick any quick-launch button below to jump straight there:',
      actionIds: ['open_command_palette', 'add_expense', 'toggle_privacy'],
      recommendation: null
    };
  }

  // Intent M: Backup, Export, Sample Data, Reset to Zero
  if (q.includes('backup') || q.includes('export') || q.includes('json') || q.includes('sample') || q.includes('demo') || q.includes('reset') || q.includes('zero') || q.includes('clear')) {
    return {
      answerText: 'Manage your data backups, demo data, and resets in the **System & Data Tools Drawer [FEAT-53]**:\n- **Export CSV / JSON [FEAT-10]**: Download spreadsheet reports or a complete JSON backup.\n- **Sample Data [FEAT-09] & Reset to Zero [FEAT-16]**: Load realistic sample data or reset all amounts to **0** while keeping your categories.',
      actionIds: ['open_system_tools', 'export_csv', 'reset_zero'],
      recommendation: null
    };
  }

  // 2b. Dynamic FAQ Guide Search: Check all DOM .faq-item visual guides auto-discovered from index.html
  const dynamicFaqMatch = searchDynamicFaqGuides(userQuestion);
  if (dynamicFaqMatch) {
    return dynamicFaqMatch;
  }

  // 3. Fallback for any other undocumented question: synthesize title & why-goal
  const fallbackSpec = synthesizeUndocumentedFeatureSpec(userQuestion) || {
    title: userQuestion.length > 60 ? userQuestion.slice(0, 57) + '...' : userQuestion,
    category: 'Automation & AI',
    description: `User asked for an undocumented capability in NirvTrack AI: "${userQuestion}"`
  };
  const featStats = (typeof getFaqFeatureStats === 'function') ? getFaqFeatureStats() : { total: 68, maxTag: 68 };
  return {
    answerText: `**"${fallbackSpec.title}"** is not part of NirvTrack's current documentation (\`[FEAT-01]\` to \`[FEAT-${featStats.maxTag}]\`) yet!\n\n- **🧠 Auto-Learned**: I extracted your goal and saved it to our **Community & Admin Feature Wishlist** below so I will remember it in future chats and our Admin team can rank it.\n- You can also use the quick-launch buttons below to open the **Command Palette (Ctrl+K)**, **Add an Expense**, or **Manage Categories**.`,
    actionIds: ['open_command_palette', 'add_expense', 'goto_budget'],
    recommendation: {
      title: fallbackSpec.title,
      category: fallbackSpec.category,
      description: fallbackSpec.description
    }
  };
}

/**
 * Secondary heuristic detector if Gemini answered that a feature is not supported without emitting the tag.
 */
function detectMissingFeatureFromQuery(userQuestion, answerText) {
  const ans = String(answerText || '').toLowerCase();
  const notSupportedPhrases = [
    'does not currently support',
    'doesn\'t currently support',
    'not currently available',
    'not yet supported',
    'isn\'t a built-in feature',
    'is not a built-in feature',
    'isn\'t built into nirvtrack',
    'isn\'t built into budget master',
    'does not have a built-in',
    'currently no built-in',
    'not part of nirvtrack',
    'not part of budget master'
  ];
  if (notSupportedPhrases.some(p => ans.includes(p))) {
    const spec = synthesizeUndocumentedFeatureSpec(userQuestion);
    if (spec) {
      return {
        title: spec.title,
        category: spec.category,
        description: spec.description
      };
    }
    const cleanTitle = userQuestion.length > 58 ? userQuestion.slice(0, 55) + '...' : userQuestion;
    return {
      title: cleanTitle,
      category: 'Automation & AI',
      description: `AI detected an undocumented capability from user query: "${userQuestion}"`
    };
  }
  return null;
}

/**
 * Triggered when user clicks "🚀 Send to Admin Wishlist" on an AI-detected recommendation card.
 */
async function submitAiDetectedRecommendation(recId) {
  const recData = pendingRecommendationsMap[recId];
  if (!recData) return;

  const btn = document.getElementById(`btnSubmitRec_${recId}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Sending...';
  }

  await submitFeatureRecommendation(recData);

  if (btn) {
    btn.textContent = '✅ Sent to Admin Wishlist';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
  }
}
window.submitAiDetectedRecommendation = submitAiDetectedRecommendation;

/**
 * Saves a feature recommendation to the Wishlist (LocalStorage + Cloud Firestore /feature_wishlist).
 * Also records the user's natural-language chat query in `tags` so the AI learns from every conversation.
 */
async function submitFeatureRecommendation(recInput, options = {}) {
  const silent = Boolean(options && options.silent);
  await loadFeatureWishlist();

  const currentUser = (typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser)
    ? fbAuth.currentUser
    : (typeof currentAuthenticatedUser !== 'undefined' ? currentAuthenticatedUser : null);

  const userEmail = (currentUser && currentUser.email) ? currentUser.email : 'guest@local.session';
  const userName = (currentUser && (currentUser.displayName || currentUser.email))
    ? (currentUser.displayName || currentUser.email.split('@')[0])
    : 'Local Budgeter';
  const userUid = (currentUser && currentUser.uid) ? currentUser.uid : 'local_user';
  const userTier = (typeof appState !== 'undefined' && appState.userTier) ? appState.userTier : 'free';

  const normalizedTitle = String(recInput.title || '').trim();
  const cleanUserQuery = String(recInput.userQuery || normalizedTitle).trim().slice(0, 140);
  const existing = cachedFeatureWishlist.find(
    w => String(w.title || '').toLowerCase() === normalizedTitle.toLowerCase()
  );

  const nowIso = new Date().toISOString();
  let targetItem = null;

  if (existing) {
    existing.votes = (Number(existing.votes) || 1) + 1;
    existing.updatedAt = nowIso;
    if (!Array.isArray(existing.tags)) {
      existing.tags = existing.userQuery ? [String(existing.userQuery).slice(0, 140)] : [];
    }
    if (cleanUserQuery && !existing.tags.some(t => String(t).toLowerCase() === cleanUserQuery.toLowerCase())) {
      existing.tags.unshift(cleanUserQuery);
      existing.tags = existing.tags.slice(0, 35);
    }
    targetItem = existing;
  } else {
    targetItem = {
      id: 'wish_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: normalizedTitle,
      description: String(recInput.description || '').trim(),
      category: recInput.category || 'Automation & AI',
      source: recInput.source || 'NirvTrack AI',
      userQuery: cleanUserQuery,
      tags: cleanUserQuery ? [cleanUserQuery] : [],
      requestedByEmail: userEmail,
      requestedByName: userName,
      requestedByUid: userUid,
      userTier: userTier,
      createdAt: nowIso,
      updatedAt: nowIso,
      votes: 1,
      rank: 99, // Unranked initially so Admin can assign rank 1-5
      status: 'review',
      adminNotes: ''
    };
    cachedFeatureWishlist.unshift(targetItem);
  }

  saveFeatureWishlistLocally();

  // Sync to Cloud Firestore /feature_wishlist/{id} if connected
  const activeDb = (typeof window !== 'undefined' && window.fbDb) ? window.fbDb : (typeof fbDb !== 'undefined' && fbDb ? fbDb : null);
  if (activeDb && currentUser) {
    try {
      await activeDb.collection('feature_wishlist').doc(targetItem.id).set(targetItem, { merge: true });
    } catch (err) {
      console.warn('Cloud Firestore wishlist sync note (saved locally):', err);
    }
  }

  if (!silent && typeof showToast === 'function') {
    showToast(`💡 Feature "${targetItem.title}" saved to Admin Wishlist!`);
  }
  return targetItem;
}

/**
 * Renders the Community & User Wishlist preview inside the FAQ "Recommend a Feature" tab.
 */
async function renderUserWishlistPreview() {
  const container = document.getElementById('faqUserWishlistPreview');
  const countLabel = document.getElementById('faqWishlistCountLabel');
  if (!container) return;

  await loadFeatureWishlist();

  const sorted = [...cachedFeatureWishlist].sort((a, b) => {
    const rankA = Number(a.rank) || 99;
    const rankB = Number(b.rank) || 99;
    if (rankA !== rankB) return rankA - rankB;
    return (Number(b.votes) || 1) - (Number(a.votes) || 1);
  });

  if (countLabel) countLabel.textContent = `${sorted.length} recommendation${sorted.length === 1 ? '' : 's'}`;

  const statusLabels = {
    review: '📋 Under Review',
    planned: '🛠️ Planned',
    progress: '🚀 In Progress',
    shipped: '✅ Shipped',
    declined: '❌ Declined'
  };

  const rankBadges = {
    1: '🔥 Rank #1',
    2: '⚡ Rank #2',
    3: '📌 Rank #3',
    4: '🧊 Rank #4',
    5: '💤 Rank #5'
  };

  container.innerHTML = sorted.slice(0, 12).map(item => {
    const rBadge = rankBadges[item.rank] ? `<span class="faq-badge-tag" style="background:rgba(251,191,36,0.18); color:#fbbf24;">${rankBadges[item.rank]}</span>` : '';
    const sLabel = statusLabels[item.status] || '📋 Under Review';
    return `
      <div class="faq-wish-row">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px;">
            ${rBadge}
            <strong style="font-size: 0.84rem; color: var(--text-primary);">${escapeFaqHtml(item.title)}</strong>
            <span style="font-size: 0.7rem; color: var(--text-muted);">• ${escapeFaqHtml(item.category || 'General')}</span>
          </div>
          <p style="margin: 0; font-size: 0.76rem; color: var(--text-secondary);">${escapeFaqHtml(item.description)}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <span style="font-size: 0.72rem; color: var(--text-secondary);">${sLabel}</span>
          <button type="button" class="btn btn-secondary btn-sm" onclick="upvoteWishlistItem('${item.id}')" title="Upvote this feature request" style="padding: 3px 8px; font-size: 0.74rem;">
            👍 ${Number(item.votes) || 1}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renders the Admin Feature Wishlist & Priority Ranking table inside Tab 4 of Admin Command Center.
 */
async function renderAdminWishlist(reloadFromCloud = true) {
  const tbody = document.getElementById('adminWishlistTableBody');
  if (!tbody) return;

  if (reloadFromCloud || !cachedFeatureWishlist || cachedFeatureWishlist.length === 0) {
    await loadFeatureWishlist();
  }

  // Update KPI strip
  const totalEl = document.getElementById('adminWishlistTotalCount');
  const aiEl = document.getElementById('adminWishlistAiCount');
  const prioEl = document.getElementById('adminWishlistPriorityCount');
  const plannedEl = document.getElementById('adminWishlistPlannedCount');

  const totalCount = cachedFeatureWishlist.length;
  const aiCount = cachedFeatureWishlist.filter(w => String(w.source || '').toLowerCase().includes('ai')).length;
  const prioCount = cachedFeatureWishlist.filter(w => Number(w.rank) === 1 || Number(w.rank) === 2).length;
  const plannedCount = cachedFeatureWishlist.filter(w => w.status === 'planned' || w.status === 'progress' || w.status === 'shipped').length;

  if (totalEl) totalEl.textContent = String(totalCount);
  if (aiEl) aiEl.textContent = String(aiCount);
  if (prioEl) prioEl.textContent = String(prioCount);
  if (plannedEl) plannedEl.textContent = String(plannedCount);

  // Filter & Sort
  const searchVal = (document.getElementById('adminWishlistSearchInput')?.value || '').toLowerCase().trim();
  const rankFilter = document.getElementById('adminWishlistRankFilter')?.value || 'all';
  const statusFilter = document.getElementById('adminWishlistStatusFilter')?.value || 'all';
  const sortMode = document.getElementById('adminWishlistSortSelect')?.value || 'rank';

  let filtered = cachedFeatureWishlist.filter(item => {
    if (rankFilter !== 'all' && String(item.rank || 99) !== rankFilter) return false;
    if (statusFilter !== 'all' && (item.status || 'review') !== statusFilter) return false;
    if (searchVal) {
      const hay = `${item.title} ${item.description} ${item.userQuery} ${item.requestedByEmail} ${item.requestedByName} ${item.category}`.toLowerCase();
      if (!hay.includes(searchVal)) return false;
    }
    return true;
  });

  const tierWeight = { executive: 3, pro: 2, free: 1 };

  filtered.sort((a, b) => {
    if (sortMode === 'votes') {
      return (Number(b.votes) || 1) - (Number(a.votes) || 1);
    }
    if (sortMode === 'newest') {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }
    if (sortMode === 'tier') {
      const twDiff = (tierWeight[b.userTier] || 1) - (tierWeight[a.userTier] || 1);
      if (twDiff !== 0) return twDiff;
    }
    // Default: Sort by Priority Rank (1 -> 5 -> 99), then Votes desc
    const rA = Number(a.rank) || 99;
    const rB = Number(b.rank) || 99;
    if (rA !== rB) return rA - rB;
    return (Number(b.votes) || 1) - (Number(a.votes) || 1);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 28px; color: var(--text-muted);">
          No feature wishlist recommendations match your current filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const rankNum = Number(item.rank) || 99;
    const rankClass = rankNum <= 3 ? `rank-${rankNum}` : '';
    const statusVal = item.status || 'review';
    const isAi = String(item.source || '').toLowerCase().includes('ai');
    const tierStr = String(item.userTier || 'free').toLowerCase();
    const tierBadge = tierStr === 'executive'
      ? '<span style="color:#fbbf24; font-weight:700; font-size:0.7rem;">👑 EXEC</span>'
      : (tierStr === 'pro' ? '<span style="color:#38bdf8; font-weight:700; font-size:0.7rem;">⚡ PRO</span>' : '<span style="color:#34d399; font-weight:700; font-size:0.7rem;">🌱 FREE</span>');

    const dateFormatted = typeof formatAdminDate === 'function' ? formatAdminDate(item.createdAt) : String(item.createdAt || '').slice(0, 10);

    return `
      <tr>
        <td>
          <select class="admin-rank-select ${rankClass}" onchange="updateWishlistItemRank('${item.id}', this.value)" title="Assign Admin Priority Ranking">
            <option value="1" ${rankNum === 1 ? 'selected' : ''}>🔥 #1 Critical</option>
            <option value="2" ${rankNum === 2 ? 'selected' : ''}>⚡ #2 High</option>
            <option value="3" ${rankNum === 3 ? 'selected' : ''}>📌 #3 Medium</option>
            <option value="4" ${rankNum === 4 ? 'selected' : ''}>🧊 #4 Low</option>
            <option value="5" ${rankNum === 5 ? 'selected' : ''}>💤 #5 Backlog</option>
            <option value="99" ${rankNum === 99 ? 'selected' : ''}>⚪ Unranked</option>
          </select>
        </td>
        <td>
          <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); margin-bottom: 3px;">
            ${escapeFaqHtml(item.title)}
          </div>
          <div style="font-size: 0.77rem; color: var(--text-secondary); line-height: 1.4; margin-bottom: 4px;">
            ${escapeFaqHtml(item.description)}
          </div>
          ${item.userQuery ? `<div style="font-size: 0.71rem; color: var(--text-muted); font-style: italic;">💬 User asked: "${escapeFaqHtml(item.userQuery)}"</div>` : ''}
        </td>
        <td>
          <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
            ${escapeFaqHtml(item.category || 'General')}
          </div>
          <span style="display: inline-block; font-size: 0.68rem; padding: 2px 6px; border-radius: 999px; background: ${isAi ? 'rgba(56, 189, 248, 0.14)' : 'rgba(16, 185, 129, 0.14)'}; color: ${isAi ? '#38bdf8' : '#34d399'}; border: 1px solid ${isAi ? 'rgba(56, 189, 248, 0.35)' : 'rgba(16, 185, 129, 0.35)'};">
            ${isAi ? '🤖 AI Gathered' : '✍️ User Form'}
          </span>
        </td>
        <td>
          <div style="font-weight: 600; font-size: 0.79rem; color: var(--text-primary);">
            ${escapeFaqHtml(item.requestedByName || 'Member')} ${tierBadge}
          </div>
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${escapeFaqHtml(item.requestedByEmail || '')}</div>
          <div style="font-size: 0.69rem; color: var(--text-muted); margin-top: 2px;">📅 ${escapeFaqHtml(dateFormatted)}</div>
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="upvoteWishlistItem('${item.id}')" title="Increment demand count" style="padding: 4px 8px; font-size: 0.76rem; font-weight: 700;">
            👍 ${Number(item.votes) || 1}
          </button>
        </td>
        <td>
          <select class="admin-status-select" onchange="updateWishlistItemStatus('${item.id}', this.value)" title="Update Roadmap Status">
            <option value="review" ${statusVal === 'review' ? 'selected' : ''}>📋 Under Review</option>
            <option value="planned" ${statusVal === 'planned' ? 'selected' : ''}>🛠️ Planned</option>
            <option value="progress" ${statusVal === 'progress' ? 'selected' : ''}>🚀 In Progress</option>
            <option value="shipped" ${statusVal === 'shipped' ? 'selected' : ''}>✅ Shipped</option>
            <option value="declined" ${statusVal === 'declined' ? 'selected' : ''}>❌ Declined</option>
          </select>
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-danger-soft btn-sm" onclick="deleteWishlistItem('${item.id}')" title="Remove from wishlist" style="padding: 4px 8px; font-size: 0.8rem; color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-sm); cursor: pointer;">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Updates the Admin Priority Rank (1-5 or 99) of a wishlist item and persists to Firestore + LocalStorage.
 */
async function updateWishlistItemRank(wishId, newRankVal) {
  const item = cachedFeatureWishlist.find(w => w.id === wishId);
  if (!item) return;

  item.rank = Number(newRankVal) || 99;
  item.updatedAt = new Date().toISOString();
  saveFeatureWishlistLocally();

  const activeDb = (typeof window !== 'undefined' && window.fbDb) ? window.fbDb : (typeof fbDb !== 'undefined' && fbDb ? fbDb : null);
  if (activeDb) {
    try {
      await activeDb.collection('feature_wishlist').doc(wishId).set({ rank: item.rank, updatedAt: item.updatedAt }, { merge: true });
    } catch (e) {}
  }

  renderAdminWishlist(false);
  if (typeof showToast === 'function') {
    const label = item.rank === 99 ? 'Unranked' : `Rank #${item.rank}`;
    showToast(`🏆 Updated "${item.title}" priority to ${label}`);
  }
}

/**
 * Updates the Roadmap Status of a wishlist item and persists to Firestore + LocalStorage.
 */
async function updateWishlistItemStatus(wishId, newStatus) {
  const item = cachedFeatureWishlist.find(w => w.id === wishId);
  if (!item) return;

  item.status = newStatus;
  item.updatedAt = new Date().toISOString();
  saveFeatureWishlistLocally();

  const activeDb = (typeof window !== 'undefined' && window.fbDb) ? window.fbDb : (typeof fbDb !== 'undefined' && fbDb ? fbDb : null);
  if (activeDb) {
    try {
      await activeDb.collection('feature_wishlist').doc(wishId).set({ status: item.status, updatedAt: item.updatedAt }, { merge: true });
    } catch (e) {}
  }

  renderAdminWishlist(false);
  if (typeof showToast === 'function') {
    showToast(`📌 Updated status for "${item.title}"`);
  }
}

/**
 * Increments the upvote/demand counter for a wishlist item.
 */
async function upvoteWishlistItem(wishId) {
  const item = cachedFeatureWishlist.find(w => w.id === wishId);
  if (!item) return;

  item.votes = (Number(item.votes) || 1) + 1;
  item.updatedAt = new Date().toISOString();
  saveFeatureWishlistLocally();

  const activeDb = (typeof window !== 'undefined' && window.fbDb) ? window.fbDb : (typeof fbDb !== 'undefined' && fbDb ? fbDb : null);
  if (activeDb) {
    try {
      await activeDb.collection('feature_wishlist').doc(wishId).set({ votes: item.votes, updatedAt: item.updatedAt }, { merge: true });
    } catch (e) {}
  }

  renderUserWishlistPreview();
  renderAdminWishlist(false);
}

/**
 * Deletes a wishlist item (with high-Z confirmation modal).
 */
async function deleteWishlistItem(wishId) {
  const item = cachedFeatureWishlist.find(w => w.id === wishId);
  if (!item) return;

  let confirmed = true;
  if (typeof askYesNo === 'function') {
    confirmed = await askYesNo(
      'Remove Feature Recommendation?',
      `Are you sure you want to remove "${item.title}" from the Feature Wishlist?`,
      'Yes, remove'
    );
  }
  if (!confirmed) return;

  cachedFeatureWishlist = cachedFeatureWishlist.filter(w => w.id !== wishId);
  saveFeatureWishlistLocally();

  const activeDb = (typeof window !== 'undefined' && window.fbDb) ? window.fbDb : (typeof fbDb !== 'undefined' && fbDb ? fbDb : null);
  if (activeDb) {
    try {
      await activeDb.collection('feature_wishlist').doc(wishId).delete();
    } catch (e) {}
  }

  renderAdminWishlist(false);
  renderUserWishlistPreview();
  if (typeof showToast === 'function') {
    showToast(`🗑️ Removed "${item.title}" from wishlist.`);
  }
}

/**
 * Exports the ranked Feature Wishlist to an Excel-compatible CSV file.
 */
function exportAdminWishlistToCSV() {
  if (!cachedFeatureWishlist || cachedFeatureWishlist.length === 0) {
    if (typeof showToast === 'function') showToast('⚠️ No wishlist items to export.');
    return;
  }

  const headers = ['Priority Rank', 'Feature Title', 'Category', 'Status', 'Votes', 'Source', 'Original User Query', 'Requested By', 'Email', 'User Tier', 'Created Date'];
  const sorted = [...cachedFeatureWishlist].sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));

  const rows = sorted.map(w => {
    const rankLabel = (Number(w.rank) && Number(w.rank) !== 99) ? `Rank #${w.rank}` : 'Unranked';
    return [
      `"${rankLabel}"`,
      `"${String(w.title || '').replace(/"/g, '""')}"`,
      `"${String(w.category || '').replace(/"/g, '""')}"`,
      `"${String(w.status || 'review').toUpperCase()}"`,
      `"${Number(w.votes) || 1}"`,
      `"${String(w.source || '').replace(/"/g, '""')}"`,
      `"${String(w.userQuery || '').replace(/"/g, '""')}"`,
      `"${String(w.requestedByName || '').replace(/"/g, '""')}"`,
      `"${String(w.requestedByEmail || '').replace(/"/g, '""')}"`,
      `"${String(w.userTier || 'free').toUpperCase()}"`,
      `"${String(w.createdAt || '').slice(0, 10)}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `budget_master_feature_wishlist_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  if (typeof showToast === 'function') {
    showToast(`📄 Exported ${sorted.length} ranked wishlist items to CSV!`);
  }
}

window.switchFaqMode = switchFaqMode;
window.initFaqAiCopilot = initFaqAiCopilot;
window.askFaqAiQuestion = askFaqAiQuestion;
window.renderAdminWishlist = renderAdminWishlist;
window.updateWishlistItemRank = updateWishlistItemRank;
window.updateWishlistItemStatus = updateWishlistItemStatus;
window.upvoteWishlistItem = upvoteWishlistItem;
window.deleteWishlistItem = deleteWishlistItem;
window.exportAdminWishlistToCSV = exportAdminWishlistToCSV;
window.updateAdminWishlistCountBadge = updateAdminWishlistCountBadge;
window.openPatchNotesModal = openPatchNotesModal;
window.closePatchNotesModal = closePatchNotesModal;
window.togglePatchNotesExpand = togglePatchNotesExpand;
window.toggleAllPatchDetails = toggleAllPatchDetails;
window.togglePatchCardDetails = togglePatchCardDetails;
window.checkAndShowPatchNotesOnLogin = checkAndShowPatchNotesOnLogin;
window.getAppVersion = getAppVersion;
window.getAppVersionDate = getAppVersionDate;
window.registerPatchNote = registerPatchNote;

// ============================================================================
// [FEAT-64] GMAIL TRANSACTION SCANNER & STAGING VETTING INBOX
// ============================================================================
let stagingGmailTransactions = [];
let isScanningGmail = false;

function openGmailTransactionInboxModal() {
  const modal = document.getElementById('gmailTransactionInboxModal');
  if (!modal) return;
  modal.style.display = 'flex';

  // Restore maximized modal state if previously chosen
  const wasMax = localStorage.getItem('budget_master_gmail_modal_maximized') === 'true';
  const modalDialog = modal.querySelector('.modal-card');
  const maxBtn = document.getElementById('btnToggleGmailModalMaximize');
  if (modalDialog) {
    if (wasMax) {
      modalDialog.classList.add('is-maximized');
      if (maxBtn) maxBtn.innerHTML = '🗗';
    } else {
      modalDialog.classList.remove('is-maximized');
      if (maxBtn) maxBtn.innerHTML = '⛶';
    }
  }

  // Check current auth status
  const emailLabel = document.getElementById('gmailScanAccountEmail');
  if (emailLabel) {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      emailLabel.textContent = `(${firebase.auth().currentUser.email || 'Logged In'})`;
      emailLabel.style.color = 'var(--cyan)';
    } else {
      emailLabel.textContent = '(Sign in with Google to enable 1-click scan, or use Sheets / Paste tab)';
      emailLabel.style.color = 'var(--text-muted)';
    }
  }

  // Restore saved Google Sheet URL if previously entered
  const savedSheetUrl = localStorage.getItem('budget_master_gmail_sheets_url');
  const sheetInput = document.getElementById('gmailGoogleSheetUrlInput');
  if (sheetInput && savedSheetUrl) {
    sheetInput.value = savedSheetUrl;
  }

  // If sheet URL already exists, keep the code guide details collapsed to maximize vertical space
  const details = document.getElementById('gmailAppsScriptDetails');
  if (details && savedSheetUrl) {
    details.removeAttribute('open');
  }

  // Populate code snippet textarea
  const codeArea = document.getElementById('googleAppsScriptCodeArea');
  if (codeArea && !codeArea.value) {
    codeArea.value = getGoogleAppsScriptTemplateText();
  }

  // Clear any old scan status banner
  const banner = document.getElementById('gmailScanStatusBanner');
  if (banner) banner.style.display = 'none';

  renderGmailStagingTable();
}

function toggleGmailModalMaximize() {
  const modalDialog = document.querySelector('#gmailTransactionInboxModal .modal-card');
  const btn = document.getElementById('btnToggleGmailModalMaximize');
  if (!modalDialog) return;
  modalDialog.classList.toggle('is-maximized');
  const isMax = modalDialog.classList.contains('is-maximized');
  if (btn) btn.innerHTML = isMax ? '🗗' : '⛶';
  try {
    localStorage.setItem('budget_master_gmail_modal_maximized', isMax ? 'true' : 'false');
  } catch (e) {}
}

function closeGmailTransactionInboxModal() {
  const modal = document.getElementById('gmailTransactionInboxModal');
  if (modal) modal.style.display = 'none';
}

function switchGmailInboxTab(tab) {
  const liveTabBtn = document.getElementById('tabBtnGmailLive');
  const sheetsTabBtn = document.getElementById('tabBtnGmailSheets');
  const pasteTabBtn = document.getElementById('tabBtnGmailPaste');
  const liveContent = document.getElementById('gmailTabContentLive');
  const sheetsContent = document.getElementById('gmailTabContentSheets');
  const pasteContent = document.getElementById('gmailTabContentPaste');

  [liveTabBtn, sheetsTabBtn, pasteTabBtn].forEach(b => b && b.classList.remove('active'));
  [liveContent, sheetsContent, pasteContent].forEach(c => c && (c.style.display = 'none'));

  if (tab === 'sheets') {
    if (sheetsTabBtn) sheetsTabBtn.classList.add('active');
    if (sheetsContent) sheetsContent.style.display = 'block';
  } else if (tab === 'paste') {
    if (pasteTabBtn) pasteTabBtn.classList.add('active');
    if (pasteContent) pasteContent.style.display = 'block';
  } else {
    if (liveTabBtn) liveTabBtn.classList.add('active');
    if (liveContent) liveContent.style.display = 'block';
  }
}

function escapeHtml(str) {
  if (typeof escapeHTML === 'function') return escapeHTML(str);
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

async function requestGmailOAuthAccessToken(forceConsent = false) {
  // Use a dedicated storage key specifically for Gmail read-only access (separate from basic sign-in)
  let token = !forceConsent ? localStorage.getItem('budget_master_gmail_access_token') : null;
  if (token) return token;

  if (typeof firebase === 'undefined' || !firebase.auth) {
    throw new Error('Firebase Auth is not available.');
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
  provider.setCustomParameters({ prompt: 'consent select_account' });

  let authResult;
  try {
    // signInWithPopup requests the newly added Google OAuth scopes directly from Google
    authResult = await firebase.auth().signInWithPopup(provider);
  } catch (popupErr) {
    if (popupErr.code === 'auth/popup-closed-by-user') {
      throw new Error('Google authorization popup was closed before granting Gmail permission.');
    } else if (popupErr.code === 'auth/popup-blocked') {
      throw new Error('Google popup was blocked by your browser. Please allow popups for this site and try again.');
    }
    throw popupErr;
  }

  const credential = authResult && (authResult.credential || (firebase.auth.GoogleAuthProvider && firebase.auth.GoogleAuthProvider.credentialFromResult(authResult)));
  token = credential ? credential.accessToken : (authResult && authResult.credential && authResult.credential.accessToken);

  if (token) {
    try {
      localStorage.setItem('budget_master_gmail_access_token', token);
    } catch (e) {}
    return token;
  }

  throw new Error('Could not obtain Google OAuth access token with Gmail read permissions.');
}

async function requestGmailConsentAndScan() {
  try {
    localStorage.removeItem('budget_master_gmail_access_token');
    await requestGmailOAuthAccessToken(true);
    startGmailScanProcess();
  } catch (err) {
    const statusBanner = document.getElementById('gmailScanStatusBanner');
    if (statusBanner) {
      statusBanner.style.display = 'block';
      statusBanner.innerHTML = `⚠️ ${err.message || err}`;
    }
  }
}

async function startGmailScanProcess() {
  if (isScanningGmail) return;
  const statusBanner = document.getElementById('gmailScanStatusBanner');
  const scanBtn = document.getElementById('btnStartGmailScan');

  const setStatus = (msg, type = 'info') => {
    if (!statusBanner) return;
    statusBanner.style.display = 'block';
    if (type === 'error') {
      statusBanner.style.background = 'rgba(239, 68, 68, 0.12)';
      statusBanner.style.border = '1px solid rgba(239, 68, 68, 0.35)';
      statusBanner.style.color = '#f87171';
    } else if (type === 'success') {
      statusBanner.style.background = 'rgba(16, 185, 129, 0.12)';
      statusBanner.style.border = '1px solid rgba(16, 185, 129, 0.35)';
      statusBanner.style.color = '#34d399';
    } else {
      statusBanner.style.background = 'rgba(6, 182, 212, 0.12)';
      statusBanner.style.border = '1px solid rgba(6, 182, 212, 0.35)';
      statusBanner.style.color = 'var(--cyan)';
    }
    statusBanner.innerHTML = msg;
  };

  try {
    isScanningGmail = true;
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.innerHTML = '<span>⏳ Requesting Permission...</span>';
    }
    setStatus('🔐 Requesting Gmail read-only authorization from Google...');

    let token;
    try {
      token = await requestGmailOAuthAccessToken(false);
    } catch (authErr) {
      console.warn('OAuth token acquisition notice:', authErr);
      setStatus(
        `ℹ️ <strong>Google Sign-In / OAuth Notice:</strong> ${authErr.message || 'Popup closed or unauthorized.'}<br>` +
        `• <em>Tip:</em> If running locally on <code>file:///</code> or with email/password, switch to the <strong>"📋 Paste Receipt / SMS Text"</strong> tab or click <strong>"🪄 Load Sample Receipts"</strong> above to test vetting!`,
        'info'
      );
      return;
    }

    if (!token) {
      setStatus('⚠️ No OAuth access token returned. Please try again or paste receipt text.', 'error');
      return;
    }

    if (scanBtn) scanBtn.innerHTML = '<span>🔍 Querying Recent Transactions...</span>';
    setStatus('🔍 Querying Gmail REST API for bank debit, transfer & e-wallet alerts from the last 30 days...');

    // Gmail search query
    const qParam = encodeURIComponent('newer_than:30d (receipt OR transaction OR payment OR debit OR "bank transfer" OR "express send" OR gcash OR maya OR grab OR shopee OR bpi OR bdo OR unionbank)');
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${qParam}&maxResults=15`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!listRes.ok) {
      const errJson = await listRes.json().catch(() => ({}));
      const rawErrMsg = (errJson && errJson.error && errJson.error.message) || `Gmail API responded with status ${listRes.status}`;

      if (listRes.status === 401 || listRes.status === 403 || rawErrMsg.toLowerCase().includes('insufficient authentication scopes')) {
        localStorage.removeItem('budget_master_gmail_access_token');
        setStatus(
          `🔐 <strong>Gmail Read Permission Needed:</strong> Your current Google sign-in does not have read-only permissions to scan messages.<br>` +
          `<div style="margin-top: 10px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">` +
          `  <button type="button" class="btn btn-primary btn-sm" onclick="requestGmailConsentAndScan()">🔑 Grant Gmail Permission &amp; Retry</button>` +
          `  <button type="button" class="btn btn-secondary btn-sm" onclick="switchGmailInboxTab('paste')">📋 Or Paste Receipt Text</button>` +
          `</div>`,
          'info'
        );
        return;
      }

      if (rawErrMsg.toLowerCase().includes('has not been used in project') || rawErrMsg.toLowerCase().includes('is not enabled')) {
        setStatus(
          `⚠️ <strong>Gmail API Disabled in Google Cloud Console:</strong><br>` +
          `The Gmail API must be enabled for this Firebase project (<code>budget-master-app-cc2ff</code>) in Google Cloud Console.<br>` +
          `<div style="margin-top: 8px;">` +
          `  <button type="button" class="btn btn-primary btn-sm" onclick="loadSampleGmailReceipts()">🪄 Load Sample Receipts to Test</button>` +
          `  <button type="button" class="btn btn-secondary btn-sm" onclick="switchGmailInboxTab('paste')">📋 Paste Receipt Text</button>` +
          `</div>`,
          'error'
        );
        return;
      }

      throw new Error(rawErrMsg);
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];

    if (messages.length === 0) {
      setStatus('✨ Scan complete! No transaction receipts found in your Gmail inbox in the last 30 days. You can test the staging table using <strong>"🪄 Load Sample Receipts"</strong>.', 'success');
      return;
    }

    setStatus(`📥 Found ${messages.length} receipt emails. Parsing transaction details...`);

    let extractedCount = 0;
    for (const m of messages) {
      try {
        const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (detailRes.ok) {
          const detail = await detailRes.json();
          const candidate = parseGmailMessageToCandidate(detail);
          if (candidate && candidate.amount > 0) {
            // Check for duplicates
            const exists = stagingGmailTransactions.some(c => c.rawId === m.id || (c.date === candidate.date && Math.abs(c.amount - candidate.amount) < 0.01 && c.description === candidate.description));
            if (!exists) {
              candidate.rawId = m.id;
              stagingGmailTransactions.push(candidate);
              extractedCount++;
            }
          }
        }
      } catch (itemErr) {
        console.warn('Error fetching message details:', itemErr);
      }
    }

    renderGmailStagingTable();
    setStatus(`✅ Scan complete! Extracted <strong>${extractedCount}</strong> transaction candidates into the staging inbox below. Please review and vet them before approving.`, 'success');
    if (typeof showToast === 'function') {
      showToast(`📬 Extracted ${extractedCount} transaction candidates into Staging Inbox!`);
    }
  } catch (err) {
    console.error('Gmail scan error:', err);
    setStatus(`❌ Failed to scan Gmail: ${err.message || err}. You can also use the <strong>"📋 Paste Receipt / SMS Text"</strong> tab.`, 'error');
  } finally {
    isScanningGmail = false;
    if (scanBtn) {
      scanBtn.disabled = false;
      scanBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><span>🔍 Scan My Gmail</span>';
    }
  }
}

function parseGmailMessageToCandidate(detail) {
  if (!detail || !detail.payload) return null;

  const headers = detail.payload.headers || [];
  const getHeader = name => {
    const h = headers.find(item => item.name && item.name.toLowerCase() === name.toLowerCase());
    return h ? h.value : '';
  };

  const subject = getHeader('Subject');
  const from = getHeader('From');
  const dateHeader = getHeader('Date');
  const snippet = detail.snippet || '';
  const fullText = `${subject} ${from} ${snippet}`;

  // Extract amount
  const amtMatch = fullText.match(/(?:PHP|Php|₱|\$)\s*([0-9,]+(?:\.[0-9]{2})?)/i) ||
                   fullText.match(/([0-9,]+(?:\.[0-9]{2})?)\s*(?:PHP|pesos?|PHP)/i) ||
                   fullText.match(/amount(?:\s+of)?\s*:?\s*(?:PHP|Php|₱|\$)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
  let amount = 0;
  if (amtMatch) {
    amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  }

  // Extract date
  let txDate = new Date().toISOString().split('T')[0];
  if (dateHeader) {
    try {
      const d = new Date(dateHeader);
      if (!isNaN(d.getTime())) {
        txDate = d.toISOString().split('T')[0];
      }
    } catch (e) {}
  }

  // Extract payment method and source
  let paymentMethod = 'Credit Card';
  let source = 'Gmail';
  const low = fullText.toLowerCase();

  if (low.includes('gcash')) {
    paymentMethod = 'GCash';
    source = 'GCash';
  } else if (low.includes('maya')) {
    paymentMethod = 'Maya';
    source = 'Maya';
  } else if (low.includes('bpi')) {
    paymentMethod = 'BPI';
    source = 'BPI';
  } else if (low.includes('bdo')) {
    paymentMethod = 'BDO';
    source = 'BDO';
  } else if (low.includes('unionbank') || low.includes('ubp')) {
    paymentMethod = 'UnionBank';
    source = 'UnionBank';
  } else if (low.includes('grab')) {
    paymentMethod = 'GrabPay';
    source = 'Grab';
  } else if (low.includes('shopee')) {
    paymentMethod = 'ShopeePay';
    source = 'Shopee';
  } else if (low.includes('paypal')) {
    paymentMethod = 'PayPal';
    source = 'PayPal';
  } else if (low.includes('debit')) {
    paymentMethod = 'Debit Card';
    source = 'Bank Debit';
  }

  // Extract clean merchant / description
  let description = subject.replace(/^(Fwd:|Re:|Receipt for|Payment confirmation for|Your receipt from)\s*/i, '').trim();
  if (!description || description.length < 3) {
    description = snippet.slice(0, 50).trim() || 'Gmail Bank Transaction';
  }

  // Smart match category
  let categoryId = '';
  if (typeof smartResolveOrAutoCreateCategory === 'function') {
    const matched = smartResolveOrAutoCreateCategory(null, `${description} ${source}`);
    if (matched) categoryId = matched.id;
  }
  if (!categoryId && Array.isArray(appState.categories) && appState.categories.length > 0) {
    categoryId = appState.categories[0].id;
  }

  return {
    id: 'g_cand_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    selected: true,
    date: txDate,
    description: description.slice(0, 60),
    categoryId,
    paymentMethod,
    amount,
    source,
    rawSubject: subject
  };
}

function extractTransactionsFromRawText(rawText, sourceLabel = 'Pasted Text') {
  if (!rawText) return [];
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const candidates = [];

  for (const line of lines) {
    // Check if line contains an amount
    const amtMatch = line.match(/(?:PHP|Php|₱|\$)\s*([0-9,]+(?:\.[0-9]{2})?)/i) ||
                     line.match(/([0-9,]+(?:\.[0-9]{2})?)\s*(?:PHP|pesos?)/i);
    if (!amtMatch) continue;

    const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) continue;

    // Detect date
    let txDate = new Date().toISOString().split('T')[0];
    const dateMatch = line.match(/\b(202[4-9]-[0-1][0-9]-[0-3][0-9])\b/) ||
                      line.match(/\b([0-3]?[0-9][\/\-][0-1]?[0-9][\/\-]202[4-9])\b/);
    if (dateMatch) {
      try {
        const parsed = new Date(dateMatch[1]);
        if (!isNaN(parsed.getTime())) {
          txDate = parsed.toISOString().split('T')[0];
        }
      } catch (e) {}
    }

    // Detect payment method & source
    let paymentMethod = 'Credit Card';
    let source = sourceLabel;
    const low = line.toLowerCase();
    if (low.includes('gcash')) { paymentMethod = 'GCash'; source = 'GCash'; }
    else if (low.includes('maya')) { paymentMethod = 'Maya'; source = 'Maya'; }
    else if (low.includes('bpi')) { paymentMethod = 'BPI'; source = 'BPI'; }
    else if (low.includes('bdo')) { paymentMethod = 'BDO'; source = 'BDO'; }
    else if (low.includes('unionbank') || low.includes('ubp')) { paymentMethod = 'UnionBank'; source = 'UnionBank'; }
    else if (low.includes('grab')) { paymentMethod = 'GrabPay'; source = 'Grab'; }
    else if (low.includes('shopee')) { paymentMethod = 'ShopeePay'; source = 'Shopee'; }
    else if (low.includes('paypal')) { paymentMethod = 'PayPal'; source = 'PayPal'; }
    else if (low.includes('debit')) { paymentMethod = 'Debit Card'; source = 'Debit'; }

    // Clean description
    let desc = line
      .replace(/(?:PHP|Php|₱|\$)\s*([0-9,]+(?:\.[0-9]{2})?)/gi, '')
      .replace(/\b(202[4-9]-[0-1][0-9]-[0-3][0-9])\b/g, '')
      .replace(/\b([0-3]?[0-9][\/\-][0-1]?[0-9][\/\-]202[4-9])\b/g, '')
      .replace(/Ref(?:erence)?\s*(?:No|#)?\s*:?\s*[0-9a-zA-Z]+/gi, '')
      .replace(/^(You sent|Payment of|Sent|Transfer to|Purchase at|Order for|Received)\s*/i, '')
      .trim();

    if (!desc || desc.length < 3) desc = line.slice(0, 45);

    // Smart match category
    let categoryId = '';
    if (typeof smartResolveOrAutoCreateCategory === 'function') {
      const matched = smartResolveOrAutoCreateCategory(null, `${desc} ${source}`);
      if (matched) categoryId = matched.id;
    }
    if (!categoryId && Array.isArray(appState.categories) && appState.categories.length > 0) {
      categoryId = appState.categories[0].id;
    }

    candidates.push({
      id: 'g_cand_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      selected: true,
      date: txDate,
      description: desc.slice(0, 60),
      categoryId,
      paymentMethod,
      amount,
      source,
      rawSubject: line
    });
  }

  return candidates;
}

function parsePastedReceiptText() {
  const input = document.getElementById('gmailPasteRawInput');
  const text = (input ? input.value : '').trim();
  if (!text) {
    if (typeof showToast === 'function') showToast('⚠️ Please paste email or SMS receipt text first.', 'warning');
    return;
  }

  const extracted = extractTransactionsFromRawText(text, 'Pasted SMS/Email');
  if (extracted.length === 0) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Could not find amounts or dates in the pasted text. Please check format.', 'warning');
    }
    return;
  }

  stagingGmailTransactions.push(...extracted);
  renderGmailStagingTable();
  if (input) input.value = '';
  if (typeof showToast === 'function') {
    showToast(`⚡ Extracted ${extracted.length} transaction candidate(s) into staging inbox!`, 'success');
  }
}

function loadSampleGmailReceipts() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  const samples = [
    {
      id: 'g_cand_sample_1',
      selected: true,
      date: `${year}-${month}-15`,
      description: 'GCash Express Send to Juan Dela Cruz',
      categoryId: '',
      paymentMethod: 'GCash',
      amount: 500.00,
      source: 'GCash',
      rawSubject: 'You sent PHP 500.00 to Juan Dela Cruz'
    },
    {
      id: 'g_cand_sample_2',
      selected: true,
      date: `${year}-${month}-14`,
      description: 'Meralco Electric Utility Bill Payment',
      categoryId: '',
      paymentMethod: 'BPI',
      amount: 2850.00,
      source: 'BPI',
      rawSubject: 'Your BPI account was debited for PHP 2,850.00 for payment to Meralco'
    },
    {
      id: 'g_cand_sample_3',
      selected: true,
      date: `${year}-${month}-12`,
      description: 'GrabFood Lunch Delivery',
      categoryId: '',
      paymentMethod: 'GrabPay',
      amount: 385.00,
      source: 'Grab',
      rawSubject: 'Your Grab receipt for order #GRB-8921: PHP 385.00'
    },
    {
      id: 'g_cand_sample_4',
      selected: true,
      date: `${year}-${month}-10`,
      description: 'Shopee Online Marketplace Order',
      categoryId: '',
      paymentMethod: 'ShopeePay',
      amount: 620.00,
      source: 'Shopee',
      rawSubject: 'ShopeePay payment confirmation for PHP 620.00'
    },
    {
      id: 'g_cand_sample_5',
      selected: true,
      date: `${year}-${month}-08`,
      description: 'SM Supermarket Grocery Shopping',
      categoryId: '',
      paymentMethod: 'Maya',
      amount: 1450.00,
      source: 'Maya',
      rawSubject: 'You paid PHP 1,450.00 to SM Supermarket via Maya'
    }
  ];

  // Auto-resolve categories
  samples.forEach(s => {
    if (typeof smartResolveOrAutoCreateCategory === 'function') {
      const matched = smartResolveOrAutoCreateCategory(null, `${s.description} ${s.source}`);
      if (matched) s.categoryId = matched.id;
    }
    if (!s.categoryId && Array.isArray(appState.categories) && appState.categories.length > 0) {
      s.categoryId = appState.categories[0].id;
    }
  });

  // Prepend to staging list
  stagingGmailTransactions.unshift(...samples);
  renderGmailStagingTable();

  if (typeof showToast === 'function') {
    showToast('🪄 Loaded 5 sample bank & e-wallet receipts into Staging Inbox! Review, uncheck or edit them before approving.', 'info');
  }
}

function renderGmailStagingTable() {
  const tbody = document.getElementById('gmailStagingTableBody');
  const tableWrap = document.getElementById('gmailStagingTableWrap');
  const emptyState = document.getElementById('gmailStagingEmptyState');
  const countBadge = document.getElementById('gmailStagingCountBadge');
  const footerSummary = document.getElementById('gmailFooterSummary');
  const approveBtn = document.getElementById('btnApproveGmailTransactions');
  const masterCheckbox = document.getElementById('gmailMasterCheckbox');

  if (!tbody) return;

  const totalCount = stagingGmailTransactions.length;
  if (countBadge) countBadge.textContent = `${totalCount} Candidate${totalCount === 1 ? '' : 's'}`;

  if (totalCount === 0) {
    if (tableWrap) tableWrap.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    if (footerSummary) footerSummary.innerHTML = '<span>0 items selected</span>';
    if (approveBtn) {
      approveBtn.disabled = true;
      approveBtn.textContent = '✅ Approve Selected (0)';
    }
    return;
  }

  if (tableWrap) tableWrap.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';

  // Category options HTML
  const catOptionsHtml = (Array.isArray(appState.categories) ? appState.categories : []).map(cat => {
    return `<option value="${cat.id}">${cat.icon || '🏷️'} ${escapeHtml(cat.name || 'Category')}</option>`;
  }).join('');

  const paymentOptions = ['GCash', 'Maya', 'BPI', 'BDO', 'UnionBank', 'Debit Card', 'Credit Card', 'GrabPay', 'ShopeePay', 'PayPal', 'Cash', 'Bank Transfer'];

  let selectedCount = 0;
  let selectedSum = 0;

  const rowsHtml = stagingGmailTransactions.map((item, idx) => {
    if (item.selected) {
      selectedCount++;
      selectedSum += Number(item.amount) || 0;
    }

    const cur = appState.currency || '₱';
    const sourceClass = (item.source || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    return `
      <tr class="gmail-staging-row ${item.selected ? 'is-selected' : ''}" data-idx="${idx}">
        <td style="text-align: center;">
          <input type="checkbox" ${item.selected ? 'checked' : ''} onchange="toggleGmailStagingItem(${idx}, this.checked)">
        </td>
        <td>
          <input type="date" class="gmail-staging-input" value="${item.date || ''}" onchange="updateGmailStagingField(${idx}, 'date', this.value)">
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <input type="text" class="gmail-staging-input" style="font-weight: 550;" value="${escapeHtml(item.description || '')}" placeholder="Merchant / Description" onchange="updateGmailStagingField(${idx}, 'description', this.value)">
            <span class="gmail-source-pill ${sourceClass}" title="${escapeHtml(item.rawSubject || item.source || '')}">
              ${escapeHtml(item.source || 'Email')}
            </span>
          </div>
        </td>
        <td>
          <select class="gmail-staging-input" onchange="updateGmailStagingField(${idx}, 'categoryId', this.value)">
            <option value="">(Uncategorized)</option>
            ${catOptionsHtml}
          </select>
        </td>
        <td>
          <select class="gmail-staging-input" onchange="updateGmailStagingField(${idx}, 'paymentMethod', this.value)">
            ${paymentOptions.map(p => `<option value="${p}" ${item.paymentMethod === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </td>
        <td>
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 5px;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--cyan);">${cur}</span>
            <input type="number" class="gmail-staging-input" style="text-align: right; max-width: 120px; font-weight: 700; font-size: 0.92rem;" step="any" min="0" value="${item.amount || 0}" onchange="updateGmailStagingField(${idx}, 'amount', this.value)">
          </div>
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn-text-action" onclick="removeGmailStagingItem(${idx})" title="Discard row" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 1.15rem; padding: 2px 6px;">&times;</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;

  // Set selected categories dynamically
  stagingGmailTransactions.forEach((item, idx) => {
    const row = tbody.querySelector(`tr[data-idx="${idx}"]`);
    if (row) {
      const select = row.querySelector('select');
      if (select && item.categoryId) select.value = item.categoryId;
    }
  });

  // Update footer summary
  const cur = appState.currency || '₱';
  if (footerSummary) {
    footerSummary.innerHTML = `<span><strong>${selectedCount}</strong> of ${totalCount} selected · Total: <strong style="color: var(--cyan); font-size: 1.05rem;">${cur}${selectedSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>`;
  }

  if (approveBtn) {
    approveBtn.disabled = selectedCount === 0;
    approveBtn.textContent = `✅ Approve Selected (${selectedCount})`;
  }

  if (masterCheckbox) {
    masterCheckbox.checked = selectedCount > 0 && selectedCount === totalCount;
    masterCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalCount;
  }
}

function toggleSelectAllGmailStaging(val) {
  stagingGmailTransactions.forEach(item => item.selected = Boolean(val));
  renderGmailStagingTable();
}

function toggleGmailStagingItem(idx, checked) {
  if (stagingGmailTransactions[idx]) {
    stagingGmailTransactions[idx].selected = Boolean(checked);
    renderGmailStagingTable();
  }
}

function updateGmailStagingField(idx, field, val) {
  if (!stagingGmailTransactions[idx]) return;
  if (field === 'amount') {
    stagingGmailTransactions[idx].amount = parseFloat(val) || 0;
  } else {
    stagingGmailTransactions[idx][field] = val;
  }
  renderGmailStagingTable();
}

function removeGmailStagingItem(idx) {
  if (stagingGmailTransactions[idx]) {
    stagingGmailTransactions.splice(idx, 1);
    renderGmailStagingTable();
  }
}

function clearGmailStagingBuffer() {
  stagingGmailTransactions = [];
  renderGmailStagingTable();
  if (typeof showToast === 'function') {
    showToast('Cleared Gmail staging vetting buffer.');
  }
}

function approveSelectedGmailTransactions() {
  const selectedItems = stagingGmailTransactions.filter(item => item.selected && Number(item.amount) > 0);
  if (selectedItems.length === 0) {
    if (typeof showToast === 'function') showToast('⚠️ No items selected for approval.', 'warning');
    return;
  }

  let approvedCount = 0;
  let approvedSum = 0;

  for (const item of selectedItems) {
    try {
      const res = executeAiCreateExpense({
        description: item.description || 'Gmail Transaction',
        amount: item.amount,
        categoryIdOrName: item.categoryId || '__auto__',
        paymentMethod: item.paymentMethod || 'Credit Card',
        date: item.date || ''
      });
      if (res && res.ok) {
        approvedCount++;
        approvedSum += Number(item.amount) || 0;
      }
    } catch (createErr) {
      console.warn('Error creating vetted expense:', createErr);
    }
  }

  // Remove vetted items from staging
  stagingGmailTransactions = stagingGmailTransactions.filter(item => !item.selected);
  renderGmailStagingTable();
  closeGmailTransactionInboxModal();

  const cur = appState.currency || '₱';
  if (typeof showToast === 'function') {
    showToast(`✅ Vetted & approved ${approvedCount} transaction(s) (${cur}${approvedSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) into your Expense Tracker!`, 'success');
  }

  // Switch to Expense Tracker tab so user immediately sees their approved entries!
  if (typeof switchTab === 'function') {
    switchTab('expenses');
  }
}

function getGoogleAppsScriptTemplateText() {
  return `/**
 * NirvTrack — Automated Gmail Transaction Scanner for Google Sheets
 * 
 * Scans your Gmail for bank debits, transfers & e-wallet receipts (GCash, Maya, BPI, BDO, UnionBank, Grab, Shopee)
 * and logs clean transaction rows directly to this Google Sheet with zero third-party OAuth roadblocks.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('NirvTrack')
    .addItem('📬 Scan Gmail Now', 'scanGmailForTransactions')
    .addItem('⏰ Enable Hourly Auto-Scan', 'setupHourlyTrigger')
    .addItem('🛑 Remove Auto-Scan Trigger', 'removeTriggers')
    .addToUi();
}

function scanGmailForTransactions() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Date", "Merchant / Description", "Category", "Payment Method", "Amount", "Email Subject"]);
    sheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#0f172a").setFontColor("#38bdf8");
  }

  // Scan emails from the last 14 days
  const query = 'newer_than:14d (subject:receipt OR subject:transaction OR subject:debit OR subject:GCash OR subject:Maya OR subject:BPI OR subject:BDO OR subject:Shopee OR subject:Grab OR subject:payment)';
  const threads = GmailApp.search(query, 0, 25);
  
  // Track existing email subjects to prevent duplicate rows
  const existingData = sheet.getLastRow() > 1 ? sheet.getRange(2, 6, sheet.getLastRow() - 1, 1).getValues().flat() : [];
  const existingSet = new Set(existingData);

  let newRowsCount = 0;

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    for (let j = 0; j < messages.length; j++) {
      const msg = messages[j];
      const subject = msg.getSubject() || '';
      const body = msg.getPlainBody() || '';
      const date = Utilities.formatDate(msg.getDate(), Session.getScriptTimeZone(), "yyyy-MM-dd");

      if (existingSet.has(subject)) continue;

      // Extract Amount (e.g. PHP 500.00, ₱1,250.00, $14.99)
      const amtMatch = (subject + " " + body).match(/(?:PHP|Php|₱|\$)\\s*([0-9,]+(?:\\.[0-9]{2})?)/i) ||
                       (subject + " " + body).match(/([0-9,]+(?:\\.[0-9]{2})?)\\s*(?:PHP|pesos?)/i);
      if (!amtMatch) continue;
      const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
      if (isNaN(amount) || amount <= 0) continue;

      // Detect Payment Method & Category
      let method = "Credit Card";
      let category = "General";
      const fullText = (subject + " " + body).toLowerCase();

      if (fullText.includes("gcash")) { method = "GCash"; category = "Transfers"; }
      else if (fullText.includes("maya")) { method = "Maya"; category = "Transfers"; }
      else if (fullText.includes("bpi")) { method = "BPI"; category = "Banking"; }
      else if (fullText.includes("bdo")) { method = "BDO"; category = "Banking"; }
      else if (fullText.includes("unionbank") || fullText.includes("ubp")) { method = "UnionBank"; category = "Banking"; }
      else if (fullText.includes("grab")) { method = "GrabPay"; category = "Food & Dining"; }
      else if (fullText.includes("shopee")) { method = "ShopeePay"; category = "Shopping"; }
      else if (fullText.includes("debit")) { method = "Debit Card"; category = "Banking"; }

      let merchant = subject.replace(/^(Fwd:|Re:|Receipt for|Payment to|You sent|Payment of)\\s*/i, "").slice(0, 50).trim();
      if (!merchant) merchant = "Bank Alert Receipt";

      sheet.appendRow([date, merchant, category, method, amount, subject]);
      existingSet.add(subject);
      newRowsCount++;
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast('Found ' + newRowsCount + ' new transaction(s)!', 'NirvTrack Scanner', 5);
}

function setupHourlyTrigger() {
  removeTriggers();
  ScriptApp.newTrigger('scanGmailForTransactions')
    .timeBased()
    .everyHours(1)
    .create();
  SpreadsheetApp.getActiveSpreadsheet().toast('Hourly automatic scan enabled! It will check Gmail every hour.', 'Success', 6);
}

function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
}`;
}

function copyGoogleAppsScriptCode() {
  const code = getGoogleAppsScriptTemplateText();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      if (typeof showToast === 'function') {
        showToast('📋 Copied Apps Script code to clipboard! Paste it into Extensions > Apps Script in Google Sheets.', 'success');
      }
    }).catch(() => {
      fallbackCopyText(code);
    });
  } else {
    fallbackCopyText(code);
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    if (typeof showToast === 'function') showToast('📋 Copied Apps Script code to clipboard!', 'success');
  } catch (err) {
    if (typeof showToast === 'function') showToast('Please select and copy the code manually.', 'info');
  }
  document.body.removeChild(textArea);
}

async function syncGoogleSheetTransactions() {
  const input = document.getElementById('gmailGoogleSheetUrlInput');
  const rawUrl = (input ? input.value : '').trim();
  if (!rawUrl) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Please paste your Google Sheet link first.', 'warning');
    }
    return;
  }

  // Extract Spreadsheet ID
  const idMatch = rawUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const sheetId = idMatch ? idMatch[1] : rawUrl.trim();
  if (!sheetId || sheetId.length < 15) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Invalid Google Sheet link format. Please paste the full URL from your browser.', 'error');
    }
    return;
  }

  // Save for future 1-click syncs
  try {
    localStorage.setItem('budget_master_gmail_sheets_url', rawUrl);
  } catch (e) {}

  const syncBtn = document.getElementById('btnSyncGoogleSheet');
  const originalText = syncBtn ? syncBtn.innerHTML : '';
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<span>⏳ Fetching Rows...</span>';
  }

  try {
    // Google Visualization API CSV export endpoint
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    const res = await fetch(exportUrl);
    if (!res.ok) {
      throw new Error(`Google Sheets responded with status ${res.status}. Make sure your sheet sharing is set to "Anyone with the link can view".`);
    }

    const csvText = await res.text();
    if (!csvText || csvText.trim().length === 0) {
      throw new Error('Google Sheet returned an empty document.');
    }

    // Parse CSV rows using our native parser
    const rows = typeof parseCSV === 'function' ? parseCSV(csvText) : [];
    if (rows.length <= 1) {
      if (typeof showToast === 'function') {
        showToast('ℹ️ Sheet has no transaction rows yet. Run "Scan Gmail Now" in your Google Sheet first.', 'info');
      }
      return;
    }

    // Header row mapping
    const headerRow = rows[0].map(h => String(h || '').trim().toLowerCase());
    let dateIdx = headerRow.findIndex(h => h.includes('date'));
    let descIdx = headerRow.findIndex(h => h.includes('merchant') || h.includes('desc') || h.includes('description') || h.includes('item'));
    let catIdx = headerRow.findIndex(h => h.includes('cat') || h.includes('category'));
    let methodIdx = headerRow.findIndex(h => h.includes('pay') || h.includes('method') || h.includes('channel'));
    let amtIdx = headerRow.findIndex(h => h.includes('amount') || h.includes('amt') || h.includes('price') || h.includes('cost'));

    // Fallbacks if headers didn't match standard names
    if (dateIdx === -1) dateIdx = 0;
    if (descIdx === -1) descIdx = 1;
    if (catIdx === -1) catIdx = 2;
    if (methodIdx === -1) methodIdx = 3;
    if (amtIdx === -1) amtIdx = 4;

    const dataRows = rows.slice(1);
    let extractedCount = 0;

    for (const r of dataRows) {
      if (!r || r.length === 0) continue;
      const rawAmt = r[amtIdx];
      const parsedAmt = typeof parseCSVAmount === 'function' ? parseCSVAmount(rawAmt) : parseFloat(String(rawAmt || '').replace(/[^0-9.-]/g, ''));
      if (isNaN(parsedAmt) || parsedAmt <= 0) continue;

      const rawDate = r[dateIdx];
      let txDate = typeof parseCSVDate === 'function' ? parseCSVDate(rawDate) : (rawDate || new Date().toISOString().split('T')[0]);
      if (!txDate) txDate = new Date().toISOString().split('T')[0];

      let desc = String(r[descIdx] || 'Google Sheet Transaction').trim();
      let method = String(r[methodIdx] || 'Credit Card').trim();
      let catHint = String(r[catIdx] || '').trim();

      // Resolve category
      let categoryId = '';
      if (typeof smartResolveOrAutoCreateCategory === 'function') {
        const matched = smartResolveOrAutoCreateCategory(catHint, `${desc} ${method}`);
        if (matched) categoryId = matched.id;
      }
      if (!categoryId && Array.isArray(appState.categories) && appState.categories.length > 0) {
        categoryId = appState.categories[0].id;
      }

      // Check duplicates
      const exists = stagingGmailTransactions.some(c =>
        c.date === txDate &&
        Math.abs(c.amount - parsedAmt) < 0.01 &&
        c.description === desc
      );

      if (!exists) {
        stagingGmailTransactions.push({
          id: 'g_cand_sheet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          selected: true,
          date: txDate,
          description: desc.slice(0, 60),
          categoryId,
          paymentMethod: method,
          amount: parsedAmt,
          source: 'Google Sheet',
          rawSubject: desc
        });
        extractedCount++;
      }
    }

    renderGmailStagingTable();

    if (typeof showToast === 'function') {
      showToast(`📊 Synced ${extractedCount} transaction(s) from your Google Sheet into Staging Inbox!`, 'success');
    }
  } catch (err) {
    console.error('Google Sheet Sync Error:', err);
    if (typeof showToast === 'function') {
      showToast(`❌ Could not sync Sheet: ${err.message || err}`, 'error', 6000);
    }
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = originalText || '⚡ Sync from Sheet';
    }
  }
}

// Window bindings
window.openGmailTransactionInboxModal = openGmailTransactionInboxModal;
window.closeGmailTransactionInboxModal = closeGmailTransactionInboxModal;
window.switchGmailInboxTab = switchGmailInboxTab;
window.startGmailScanProcess = startGmailScanProcess;
window.parsePastedReceiptText = parsePastedReceiptText;
window.loadSampleGmailReceipts = loadSampleGmailReceipts;
window.renderGmailStagingTable = renderGmailStagingTable;
window.toggleSelectAllGmailStaging = toggleSelectAllGmailStaging;
window.toggleGmailStagingItem = toggleGmailStagingItem;
window.updateGmailStagingField = updateGmailStagingField;
window.removeGmailStagingItem = removeGmailStagingItem;
window.clearGmailStagingBuffer = clearGmailStagingBuffer;
window.approveSelectedGmailTransactions = approveSelectedGmailTransactions;
window.requestGmailConsentAndScan = requestGmailConsentAndScan;
window.syncGoogleSheetTransactions = syncGoogleSheetTransactions;
window.copyGoogleAppsScriptCode = copyGoogleAppsScriptCode;
window.getGoogleAppsScriptTemplateText = getGoogleAppsScriptTemplateText;
window.toggleGmailModalMaximize = toggleGmailModalMaximize;


