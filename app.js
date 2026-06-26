
const GEMINI_KEY = "my gemini api key";
const ADMIN_EMAIL = "vigneshwaran9356@gmail.com";

const firebaseConfig = {
  apiKey: "AIzaSyDHmXD59FVU1SKdDDMS3T8_zv3BGHF55bE",
  authDomain: "community-hero-web.firebaseapp.com",
  projectId: "community-hero-web",
  storageBucket: "community-hero-web.firebasestorage.app",
  messagingSenderId: "318488212451",
  appId: "1:318488212451:web:20be005fc7d4e05efca6d6"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
console.log("🔥 Firebase Ready!");

let issues = [];
let map = null;
let userLat = 11.3410;
let userLng = 77.7172;
let mediaBase64 = null;
let currentFilter = 'all';
let cameraStream = null;
let currentUser = null;

window.addEventListener('load', () => {
  initMap();
  detectLocation();
  startLiveTracking();
  loadReports();
  setupAuth();
});

function setupAuth() {
  auth.onAuthStateChanged(user => {
    currentUser = user;
    const loginBtn = document.getElementById('loginBtn');
    const userProfile = document.getElementById('userProfile');

    if (user) {
      loginBtn.style.display = 'none';
      userProfile.style.display = 'flex';
      document.getElementById('userPhoto').src = user.photoURL || '';
      document.getElementById('userName').textContent =
        user.displayName?.split(' ')[0] || 'Hero';
      showToast(`Welcome ${user.displayName}! 🎉`);
      if (user.email === ADMIN_EMAIL) {
        document.getElementById('admin-panel').style.display = 'block';
        renderAdminFeed();
      }
    } else {
      loginBtn.style.display = 'flex';
      userProfile.style.display = 'none';
      document.getElementById('admin-panel').style.display = 'none';
    }
  });
}

async function googleLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch(e) {
    console.error('Login error:', e);
    showToast('Login failed: ' + e.message);
  }
}

function logout() {
  auth.signOut();
  showToast('Logged out!');
}

function initMap() {
  map = L.map('map').setView([userLat, userLng], 13);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OSM contributors',
    maxZoom: 19
  }).addTo(map);
}

function addMapMarker(issue) {
  if (!map || !issue.lat || !issue.lng) return;
  const colors = {
    critical: '#ff4757', high: '#ff8c42',
    medium: '#ffd166', low: '#06d6a0'
  };
  const color = colors[issue.severity] || '#00e5a0';
  const icon = L.divIcon({
    html: `<div style="width:28px;height:28px;background:${color};
      border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.4)">
    </div>`,
    iconSize: [28, 28],
    className: ''
  });
  const marker = L.marker([issue.lat, issue.lng], { icon }).addTo(map);
  marker.bindPopup(`
    <div style="font-family:Inter,sans-serif;padding:8px;min-width:180px;
      background:#111c2d;color:#e8edf5;border-radius:8px">
      <b style="color:#00e5a0">${getEmoji(issue.category)} ${issue.category}</b><br>
      <small style="color:#7a8aa0">${(issue.description||'').substring(0,80)}...</small><br><br>
      <span style="background:${color}22;color:${color};padding:2px 10px;
        border-radius:20px;font-size:11px;font-weight:700">${issue.severity}</span>
    </div>`);
}

function detectLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
    const text = `${userLat.toFixed(3)}, ${userLng.toFixed(3)}`;
    document.getElementById('nav-location-text').textContent = text;
    document.getElementById('loc-text').textContent = `📍 ${text}`;
    if (map) map.setView([userLat, userLng], 14);
  }, () => {
    document.getElementById('nav-location-text').textContent = 'Salem, TN';
  });
}

function startLiveTracking() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(pos => {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
    const text = `${userLat.toFixed(4)}, ${userLng.toFixed(4)}`;
    document.getElementById('nav-location-text').textContent = text;
    document.getElementById('loc-text').textContent = `📍 Live: ${text}`;
    if (map) map.setView([userLat, userLng], 14);
  }, null, { enableHighAccuracy: true, maximumAge: 5000 });
}

function switchTab(tab, btn) {
  ['upload','video','live'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = 'none';
  });
  document.getElementById(`tab-${tab}`).style.display = 'block';
  document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'live') startCamera();
  else if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    document.getElementById('cameraFeed').srcObject = cameraStream;
  } catch(e) {
    showToast('Camera not available');
  }
}

function captureFromCamera() {
  const video = document.getElementById('cameraFeed');
  const canvas = document.getElementById('captureCanvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  mediaBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
  const preview = document.getElementById('photoPreview');
  preview.src = canvas.toDataURL('image/jpeg');
  preview.style.display = 'block';
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  showToast('📸 Photo captured!');
}

function handlePhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('photoPreview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  toBase64(file).then(b64 => mediaBase64 = b64);
}

function handleVideo(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('videoPreview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  extractFrame(file).then(b64 => mediaBase64 = b64);
}

function handleDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (file.type.startsWith('image/')) {
    const preview = document.getElementById('photoPreview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    toBase64(file).then(b64 => mediaBase64 = b64);
  }
}

function toBase64(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.readAsDataURL(file);
  });
}

function extractFrame(file) {
  return new Promise(res => {
    const v = document.createElement('video');
    const c = document.createElement('canvas');
    v.src = URL.createObjectURL(file);
    v.addEventListener('seeked', () => {
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      res(c.toDataURL('image/jpeg').split(',')[1]);
    });
    v.addEventListener('loadeddata', () => v.currentTime = 1);
  });
}

async function analyzeIssue() {
  if (!mediaBase64) {
    showToast('⚠️ Please upload a photo first!');
    return;
  }
  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing with Gemini AI...';
  try {
    const result = await callGemini(mediaBase64);
    showAIResult(result);
    await saveIssue(result);
    generateComplaintLetter(result);
    updateAllStats();
  } catch(e) {
    showToast('❌ Analysis failed: ' + e.message);
    console.error(e);
  }
  btn.disabled = false;
  btn.innerHTML = '✨ Analyze &amp; Report';
}

// ===== GEMINI API =====
async function callGemini(base64) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_KEY
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            { text: `You are an expert urban infrastructure AI analyst.
Study this image and identify the community issue.

LOOK FOR:
- Road cracks/holes = "Road Damage" or "Pothole"
- Water leaking/puddles = "Water Leakage"
- Broken street lights = "Street Lights"
- Garbage/waste = "Garbage"
- Flooding = "Flooding"
- Broken structures = "Infrastructure"

Return ONLY valid JSON, no markdown:
{
  "category": "Road Damage",
  "severity": "high",
  "description": "2 sentence description",
  "department": "Public Works Department",
  "priority": 8,
  "fix_time": "3-5 days",
  "risk": "high",
  "steps": "Step 1, Step 2, Step 3"
}` }
          ]
        }]
      })
    }
  );
  const data = await res.json();
  if (!data.candidates?.[0]) throw new Error(data.error?.message || 'No AI response');
  const text = data.candidates[0].content.parts[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Invalid format');
  const result = JSON.parse(match[0]);
  result.severity = result.severity?.toLowerCase() || 'medium';
  result.risk = result.risk?.toLowerCase() || 'medium';
  return result;
}

// ===== SHOW AI RESULT =====
function showAIResult(r) {
  const panel = document.getElementById('ai-result-panel');
  panel.style.display = 'block';
  document.getElementById('ai-result-content').innerHTML = `
    <div class="result-grid">
      <div class="result-row">
        <span class="result-key">Category</span>
        <span class="result-val">${getEmoji(r.category)} ${r.category}</span>
      </div>
      <div class="result-row">
        <span class="result-key">Severity</span>
        <span class="severity-pill sev-${r.severity}">${r.severity}</span>
      </div>
      <div class="result-row">
        <span class="result-key">Risk to Public</span>
        <span class="severity-pill sev-${r.risk}">${r.risk}</span>
      </div>
      <div class="result-row">
        <span class="result-key">Est. Fix Time</span>
        <span class="result-val">${r.fix_time}</span>
      </div>
      <div class="result-row">
        <span class="result-key">Department</span>
        <span class="result-val">${r.department}</span>
      </div>
      <div class="result-row">
        <span class="result-key">Description</span>
        <span class="result-val">${r.description}</span>
      </div>
      <div class="result-row">
        <span class="result-key">Steps</span>
        <span class="result-val">${r.steps}</span>
      </div>
      <div class="priority-row">
        <div class="priority-label">Priority Score</div>
        <div class="priority-track">
          <div class="priority-fill" style="width:${r.priority*10}%">
            ${r.priority}/10
          </div>
        </div>
      </div>
    </div>`;
  panel.scrollIntoView({ behavior: 'smooth' });
}

async function generateComplaintLetter(r) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Write a formal complaint letter to ${r.department}.
Issue: ${r.category}
Location: ${userLat.toFixed(4)}, ${userLng.toFixed(4)}
Description: ${r.description}
Severity: ${r.severity}
Priority: ${r.priority}/10
Reporter: ${currentUser?.displayName || 'Community Member'}
Date: ${new Date().toLocaleDateString()}

Write 3 paragraphs. Start: "To The Officer In Charge,"
End: "Yours faithfully,\nCommunity Hero Platform"`
            }]
          }]
        })
      }
    );
    const data = await res.json();
    const letter = data.candidates[0].content.parts[0].text;
    document.getElementById('complaint-letter').textContent = letter;
    document.getElementById('complaint-section').style.display = 'block';
  } catch(e) {
    console.log('Letter error:', e);
  }
}

function copyLetter() {
  const letter = document.getElementById('complaint-letter').textContent;
  navigator.clipboard.writeText(letter);
  showToast('📋 Complaint letter copied!');
}

// ===== SAVE ISSUE =====
async function saveIssue(r) {
  const preview = document.getElementById('photoPreview');
  const imgSrc = preview.style.display !== 'none' ? preview.src : null;

  const newIssue = {
    id: Date.now().toString(),
    category: r.category,
    severity: r.severity,
    description: r.description,
    department: r.department,
    priority: r.priority,
    fixTime: r.fix_time,
    risk: r.risk,
    steps: r.steps,
    lat: userLat,
    lng: userLng,
    status: 'reported',
    upvotes: 0,
    downvotes: 0,
    verifications: 0,
    verifiedBy: [],
    imgSrc: mediaBase64
  ? `data:image/jpeg;base64,${mediaBase64}`
  : null,
    date: new Date().toLocaleDateString('en-GB'),
    userId: currentUser?.uid || 'anonymous',
    userName: currentUser?.displayName || 'Anonymous Hero',
    userEmail: currentUser?.email || ''
  };

  try {
    await db.collection('reports').doc(newIssue.id).set(newIssue);
    showToast('✅ Report saved to community!');
  } catch(e) {
    console.error('Save error:', e);
    showToast('⚠️ Saved locally only');
  }

  issues.unshift(newIssue);
  addMapMarker(newIssue);
  renderFeed();
  updateCategoryBreakdown();
}

// ===== LOAD REPORTS REAL-TIME =====
function loadReports() {
  // Real-time listener - updates instantly!
  db.collection('reports')
    .onSnapshot(snapshot => {
      issues = [];
      // Clear map markers
      if (map) {
        map.eachLayer(layer => {
          if (layer instanceof L.Marker) map.removeLayer(layer);
        });
      }
      snapshot.forEach(doc => {
        const issue = doc.data();
        issues.push(issue);
        addMapMarker(issue);
      });
      // Sort by date newest first
      issues.sort((a, b) => new Date(b.date) - new Date(a.date));
      renderFeed();
      updateAllStats();
      updateCategoryBreakdown();
      updateHealthScore();
      console.log('✅ Real-time update:', issues.length, 'reports');
      generatePredictions();
    }, err => {
      console.error('Load error:', err);
      showToast('⚠️ Could not load reports');
    });
}

// ===== RENDER FEED =====
function renderFeed() {
  const grid = document.getElementById('feed-grid');
  let filtered = issues;
  if (currentFilter !== 'all') {
    filtered = issues.filter(i =>
      i.severity === currentFilter ||
      i.status === currentFilter ||
      (currentFilter === 'new' && i.status === 'reported')
    );
  }
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-feed">
      <div class="empty-icon">🌟</div>
      <p>No reports yet. Be the first Community Hero!</p>
    </div>`;
    return;
  }
  grid.innerHTML = filtered.map(issue => `
    <div class="report-card" id="card-${issue.id}">
      ${issue.imgSrc
        ? `<img class="report-img" src="${issue.imgSrc}" alt="issue"
            onerror="this.parentElement.innerHTML='<div class=report-img-placeholder>${getEmoji(issue.category)}</div>'">`
        : `<div class="report-img-placeholder">${getEmoji(issue.category)}</div>`}
      <div class="report-body">
        <div class="report-tags">
          <span class="tag tag-${issue.severity}">${issue.severity}</span>
          <span class="tag tag-category">${issue.category}</span>
          ${(issue.verifications||0) >= 3
            ? '<span class="tag" style="background:rgba(0,229,160,0.2);color:#00e5a0;border:1px solid rgba(0,229,160,0.3)">✅ Verified</span>'
            : ''}
        </div>
        <p class="report-desc">${issue.description || ''}</p>
        <div class="report-meta">
          <span>📍 ${issue.lat?.toFixed(3)}, ${issue.lng?.toFixed(3)}</span>
          <span>${issue.date || ''}</span>
        </div>
        <div class="report-meta" style="margin-top:4px">
          <span>👤 ${issue.userName || 'Anonymous'}</span>
          <span>🏢 ${issue.department || ''}</span>
        </div>
        <div class="report-actions">
          <button class="vote-btn" onclick="vote('${issue.id}','up')">
            👍 ${issue.upvotes || 0}
          </button>
          <button class="vote-btn" onclick="vote('${issue.id}','down')">
            👎 ${issue.downvotes || 0}
          </button>
          <button class="vote-btn" onclick="verifyIssue('${issue.id}')"
            style="border-color:rgba(255,140,66,0.3);color:#ff8c42">
            🔥 Verify (${issue.verifications || 0}/3)
          </button>
          <span class="status-pill status-${issue.status}">${issue.status}</span>
        </div>
        ${issue.status !== 'resolved'
          ? `<button class="move-btn" onclick="moveStatus('${issue.id}')">
               → ${getNextStatus(issue.status)}
             </button>` : ''}
      </div>
    </div>`).join('');
}

// ===== ADMIN FEED =====
function renderAdminFeed() {
  const feed = document.getElementById('admin-feed');
  if (!feed) return;
  if (issues.length === 0) {
    feed.innerHTML = '<p style="color:var(--text2);padding:20px">No reports yet.</p>';
    return;
  }
  feed.innerHTML = issues.map(issue => `
    <div style="background:var(--panel);border:1px solid var(--border);
      border-radius:14px;padding:16px;margin-bottom:12px;
      display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <strong style="color:var(--text)">${getEmoji(issue.category)} ${issue.category}</strong>
        <span class="severity-pill sev-${issue.severity}" style="margin-left:8px">
          ${issue.severity}
        </span>
        <p style="color:var(--text2);font-size:0.82rem;margin-top:4px">
          👤 ${issue.userName || 'Anonymous'} · 
          📍 ${issue.lat?.toFixed(3)}, ${issue.lng?.toFixed(3)} · 
          📊 ${issue.status}
        </p>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="adminResolve('${issue.id}')"
          style="background:rgba(0,229,160,0.15);border:1px solid rgba(0,229,160,0.3);
          color:#00e5a0;padding:7px 14px;border-radius:8px;cursor:pointer;
          font-size:0.8rem;font-weight:600;font-family:Inter,sans-serif;width:auto">
          ✅ Resolve
        </button>
        <button onclick="adminDelete('${issue.id}')"
          style="background:rgba(255,71,87,0.15);border:1px solid rgba(255,71,87,0.3);
          color:#ff4757;padding:7px 14px;border-radius:8px;cursor:pointer;
          font-size:0.8rem;font-weight:600;font-family:Inter,sans-serif;width:auto">
          🗑️ Delete
        </button>
      </div>
    </div>`).join('');

  const el = id => document.getElementById(id);
  if (el('a-total')) el('a-total').textContent = issues.length;
  if (el('a-pending')) el('a-pending').textContent =
    issues.filter(i => i.status !== 'resolved').length;
  if (el('a-resolved')) el('a-resolved').textContent =
    issues.filter(i => i.status === 'resolved').length;
}

async function adminResolve(id) {
  try {
    await db.collection('reports').doc(id).update({ status: 'resolved' });
    showToast('✅ Issue resolved by admin!');
  } catch(e) {
    const issue = issues.find(i => i.id === id);
    if (issue) { issue.status = 'resolved'; renderFeed(); }
  }
}

async function adminDelete(id) {
  if (!confirm('Delete this report?')) return;
  try {
    await db.collection('reports').doc(id).delete();
    showToast('🗑️ Report deleted!');
  } catch(e) {
    issues = issues.filter(i => i.id !== id);
    renderFeed();
  }
}

// ===== VERIFY =====
async function verifyIssue(id) {
  if (!currentUser) {
    showToast('⚠️ Please login to verify!');
    return;
  }
  const issue = issues.find(i => i.id === id);
  if (!issue) return;
  const verifiedBy = issue.verifiedBy || [];
  if (verifiedBy.includes(currentUser.uid)) {
    showToast('⚠️ Already verified by you!');
    return;
  }
  const newCount = (issue.verifications || 0) + 1;
  const update = {
    verifications: newCount,
    verifiedBy: [...verifiedBy, currentUser.uid]
  };
  if (newCount >= 3) {
    update.status = 'verified';
    showToast('✅ Issue VERIFIED by community!');
  } else {
    showToast(`🔥 Verification ${newCount}/3 recorded!`);
  }
  try {
    await db.collection('reports').doc(id).update(update);
  } catch(e) {
    Object.assign(issue, update);
    renderFeed();
  }
}

// ===== VOTING =====
async function vote(id, type) {
  const issue = issues.find(i => i.id === id);
  if (!issue) return;
  if (type === 'up') {
    issue.upvotes = (issue.upvotes || 0) + 1;
    if (issue.upvotes >= 5 && issue.status === 'reported') {
      issue.status = 'under_review';
      showToast('🚨 Issue escalated!');
    }
  } else {
    issue.downvotes = (issue.downvotes || 0) + 1;
  }
  try {
    await db.collection('reports').doc(id).update({
      upvotes: issue.upvotes,
      downvotes: issue.downvotes,
      status: issue.status
    });
  } catch(e) { console.log(e); }
  updateAllStats();
  renderFeed();
}

// ===== STATUS =====
async function moveStatus(id) {
  const issue = issues.find(i => i.id === id);
  if (!issue) return;
  const flow = {
    'reported': 'under_review',
    'under_review': 'in_progress',
    'in_progress': 'resolved',
    'resolved': 'resolved'
  };
  issue.status = flow[issue.status] || 'reported';
  try {
    await db.collection('reports').doc(id).update({ status: issue.status });
    if (issue.status === 'resolved') showToast('✅ Issue resolved!');
  } catch(e) { renderFeed(); }
  updateAllStats();
  renderFeed();
}

function getNextStatus(status) {
  const labels = {
    'reported': 'Move to Under Review',
    'under_review': 'Move to In Progress',
    'in_progress': 'Mark as Resolved',
    'resolved': '✅ Resolved'
  };
  return labels[status] || 'Update';
}

// ===== FILTER =====
function filterFeed(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.feed-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFeed();
}

// ===== STATS =====
function updateAllStats() {
  const total    = issues.length;
  const critical = issues.filter(i => i.severity === 'critical').length;
  const high     = issues.filter(i => i.severity === 'high').length;
  const resolved = issues.filter(i => i.status === 'resolved').length;
  const votes    = issues.reduce((s,i) => s + (i.upvotes||0), 0);
  const verified = issues.filter(i => (i.verifications||0) >= 3).length;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('hero-total', total);
  set('hero-critical', critical);
  set('hero-resolved', resolved);
  set('d-total', total);
  set('d-critical', critical);
  set('d-high', high);
  set('d-resolved', resolved);
  set('d-votes', votes);
  set('d-verified', verified);

  updateRank(total);
  updateHealthScore();
  if (currentUser?.email === ADMIN_EMAIL) renderAdminFeed();
}

function updateRank(total) {
  const ranks = [
    { min: 0,  title: 'Rookie Citizen',  next: 5  },
    { min: 5,  title: 'Active Reporter', next: 10 },
    { min: 10, title: 'Community Guard', next: 20 },
    { min: 20, title: 'Civic Champion',  next: 50 },
    { min: 50, title: '🌟 City Hero',    next: 0  }
  ];
  const rank = [...ranks].reverse().find(r => total >= r.min) || ranks[0];
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('rank-title', rank.title);
  set('rank-count', total);
  set('rank-next', rank.next ? `reports · ${rank.next - total} to next` : 'Max rank! 🌟');
}

function updateHealthScore() {
  const total    = issues.length;
  const critical = issues.filter(i => i.severity === 'critical').length;
  const high     = issues.filter(i => i.severity === 'high').length;
  const resolved = issues.filter(i => i.status === 'resolved').length;

  let score = 100;
  score -= critical * 15;
  score -= high * 8;
  score -= (total - resolved) * 2;
  score += resolved * 5;
  score = Math.max(0, Math.min(100, score));

  const scoreEl = document.getElementById('health-score');
  const barEl   = document.getElementById('health-bar');
  const labelEl = document.getElementById('health-label');

  if (scoreEl) scoreEl.textContent = score;
  if (barEl)   barEl.style.width = score + '%';

  const label = score >= 80 ? '🟢 Excellent'
    : score >= 60 ? '🟡 Good'
    : score >= 40 ? '🟠 Needs Attention'
    : '🔴 Critical - Immediate Action!';
  if (labelEl) labelEl.textContent = label;

  const color = score >= 80 ? '#00e5a0'
    : score >= 60 ? '#ffd166'
    : score >= 40 ? '#ff8c42'
    : '#ff4757';
  if (scoreEl) scoreEl.style.color = color;
}

function updateCategoryBreakdown() {
  if (issues.length === 0) return;
  const counts = {};
  issues.forEach(i => {
    if (i.category) counts[i.category] = (counts[i.category]||0) + 1;
  });
  const el = document.getElementById('cat-breakdown');
  if (!el) return;
  el.innerHTML = Object.entries(counts).map(([cat, n]) => {
    const pct = Math.round((n/issues.length)*100);
    return `<div class="cat-item">
      <span class="cat-name">${getEmoji(cat)} ${cat}</span>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="cat-pct">${n} · ${pct}%</span>
    </div>`;
  }).join('');
}

// ===== HELPERS =====
function getEmoji(cat) {
  const e = {
    'Pothole':'🕳️','Road Damage':'🛣️',
    'Water Leakage':'💧','Street Lights':'💡',
    'Garbage':'🗑️','Flooding':'🌊',
    'Infrastructure':'🏗️','other':'⚠️'
  };
  return e[cat] || '⚠️';
}

function scrollToReport() {
  document.getElementById('report-section')?.scrollIntoView({behavior:'smooth'});
}

function scrollToFeed() {
  document.getElementById('feed-section')?.scrollIntoView({behavior:'smooth'});
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}
// ===== PREDICTIVE INSIGHTS =====
async function generatePredictions() {
  if (issues.length < 2) return;

  const summary = {};
  issues.forEach(i => {
    if (i.category) summary[i.category] = (summary[i.category] || 0) + 1;
  });

  const severityCounts = {
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a smart city AI analyst for Tamil Nadu, India.

Community issue report data:
Categories: ${JSON.stringify(summary)}
Severity: ${JSON.stringify(severityCounts)}
Total reports: ${issues.length}
Area: Salem/Chennai, Tamil Nadu

Analyze this data and give predictions.
Return ONLY valid JSON no markdown:
{
  "prediction": "one sentence about what will happen next",
  "hotspot": "most at risk area or road type",
  "urgent": "most urgent category needing attention",
  "recommendation": "one specific action for authorities",
  "trend": "increasing",
  "risk_level": "high"
}`
            }]
          }]
        })
      }
    );
    const data = await res.json();
    if (!data.candidates?.[0]) return;
    const text = data.candidates[0].content.parts[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const pred = JSON.parse(match[0]);
      showPredictions(pred);
    }
  } catch(e) {
    console.log('Prediction error:', e);
  }
}

function showPredictions(pred) {
  const panel = document.getElementById('predictions-panel');
  const box = document.getElementById('predictions-box');
  if (!panel || !box) return;

  const trendIcon = pred.trend === 'increasing' ? '📈'
    : pred.trend === 'decreasing' ? '📉' : '➡️';

  const riskColor = pred.risk_level === 'high' ? '#ff4757'
    : pred.risk_level === 'medium' ? '#ffd166' : '#00e5a0';

  box.innerHTML = `
    <div class="pred-item">
      <span class="pred-icon">🔮</span>
      <div>
        <div class="pred-label">AI PREDICTION</div>
        <div class="pred-value">${pred.prediction}</div>
      </div>
    </div>
    <div class="pred-item">
      <span class="pred-icon">📍</span>
      <div>
        <div class="pred-label">HOTSPOT AREA</div>
        <div class="pred-value">${pred.hotspot}</div>
      </div>
    </div>
    <div class="pred-item">
      <span class="pred-icon">⚡</span>
      <div>
        <div class="pred-label">MOST URGENT</div>
        <div class="pred-value">${pred.urgent}</div>
      </div>
    </div>
    <div class="pred-item">
      <span class="pred-icon">💡</span>
      <div>
        <div class="pred-label">RECOMMENDATION</div>
        <div class="pred-value">${pred.recommendation}</div>
      </div>
    </div>
    <div class="pred-item">
      <span class="pred-icon">${trendIcon}</span>
      <div>
        <div class="pred-label">ISSUE TREND</div>
        <div class="pred-value" style="color:${riskColor}">
          ${pred.trend?.toUpperCase()} · Risk: ${pred.risk_level?.toUpperCase()}
        </div>
      </div>
    </div>
  `;
  panel.style.display = 'block';
}