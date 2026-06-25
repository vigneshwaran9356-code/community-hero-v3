// ===== CONFIG =====
const GEMINI_KEY = "my key api";

const firebaseConfig = {
  apiKey: "AIzaSyDHmXD59FVU1SKdDDMS3T8_zv3BGHF55bE",
  authDomain: "community-hero-web.firebaseapp.com",
  projectId: "community-hero-web",
  storageBucket: "community-hero-web.firebasestorage.app",
  messagingSenderId: "318488212451",
  appId: "1:318488212451:web:20be005fc7d4e05efca6d6",
  measurementId: "G-L595KXR93S"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();

// ===== STATE =====
let issues = [];
let map = null;
let userLat = 11.3410;
let userLng = 77.7172;
let mediaBase64 = null;
let currentFilter = 'all';
let cameraStream = null;

// ===== INIT =====
window.addEventListener('load', () => {
  initMap();
  detectLocation();
});

// ===== MAP (Leaflet - FREE) =====
function initMap() {
  map = L.map('map').setView([userLat, userLng], 13);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OSM contributors',
    maxZoom: 19
  }).addTo(map);
}

function addMapMarker(issue) {
  if (!map) return;
  const colors = {
    critical: '#ff4757', high: '#ff8c42',
    medium: '#ffd166', low: '#06d6a0'
  };
  const color = colors[issue.severity] || '#00e5a0';

  const icon = L.divIcon({
    html: `<div style="
      width:28px;height:28px;
      background:${color};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:3px solid #fff;
      box-shadow:0 3px 10px rgba(0,0,0,0.4)">
    </div>`,
    iconSize: [28, 28],
    className: ''
  });

  const marker = L.marker([issue.lat, issue.lng], { icon }).addTo(map);
  marker.bindPopup(`
    <div style="font-family:Inter,sans-serif;padding:8px;min-width:180px;
                background:#111c2d;color:#e8edf5;border-radius:8px">
      <b style="color:#00e5a0">${getEmoji(issue.category)} ${issue.category.toUpperCase()}</b><br>
      <small style="color:#7a8aa0">${issue.description.substring(0, 80)}...</small><br><br>
      <span style="background:${color}22;color:${color};
                   padding:2px 10px;border-radius:20px;
                   font-size:11px;font-weight:700">
        ${issue.severity}
      </span>
    </div>
  `);
}

// ===== LOCATION =====
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
    document.getElementById('nav-location-text').textContent = 'Location unavailable';
  });
}

// ===== MEDIA TABS =====
function switchTab(tab, btn) {
  ['upload', 'video', 'live'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = 'none';
  });
  document.getElementById(`tab-${tab}`).style.display = 'block';
  document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (tab === 'live') {
    startCamera();
  } else if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

// ===== CAMERA =====
async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    document.getElementById('cameraFeed').srcObject = cameraStream;
  } catch (e) {
    showToast('Camera not available: ' + e.message);
  }
}

function captureFromCamera() {
  const video = document.getElementById('cameraFeed');
  const canvas = document.getElementById('captureCanvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  mediaBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
  }
  showToast('📸 Photo captured!');
}

// ===== FILE HANDLERS =====
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
    document.getElementById('photoInput').files = e.dataTransfer.files;
    handlePhoto(document.getElementById('photoInput'));
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
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      res(c.toDataURL('image/jpeg').split(',')[1]);
    });
    v.addEventListener('loadeddata', () => v.currentTime = 1);
  });
}

// ===== ANALYZE =====
async function analyzeIssue() {
  if (!mediaBase64) {
    showToast('⚠️ Please upload a photo or video first!');
    return;
  }

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing with Gemini AI...';

  try {
    const result = await callGemini(mediaBase64);
    showAIResult(result);
    saveIssue(result);
    updateAllStats();
  } catch (e) {
    showToast('❌ Analysis failed: ' + e.message);
    console.error(e);
  }

  btn.disabled = false;
  btn.innerHTML = '✨ Analyze &amp; Report';
}

// ===== GEMINI API =====
async function callGemini(base64) {
  const res = await fetch(
   `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            { text: `You are an expert urban infrastructure AI analyst.
Study this image carefully and identify community issues.

LOOK FOR:
- Road cracks, holes, surface damage = "Road Damage" or "Pothole"
- Water pipes leaking, puddles, wet areas = "Water Leakage"  
- Street lights broken or not working = "Street Lights"
- Garbage dumps, waste, litter = "Garbage"
- Flooding, waterlogging = "Flooding"
- Broken infrastructure = "Infrastructure"

Respond ONLY with valid JSON, no markdown:
{
  "category": "Road Damage",
  "severity": "high",
  "description": "detailed 1-2 sentence description",
  "department": "Public Works Department",
  "priority": 8,
  "fix_time": "3-5 days",
  "risk": "high",
  "steps": "Immediate barricading required, contact PWD"
}` }
          ]
        }]
      })
    }
  );

  const data = await res.json();
  console.log("FULL RESPONSE", JSON.stringify(data, null, 2));

  if (!data.candidates || data.candidates.length === 0) {
    console.log(data);
    throw new Error('No AI response');
}

 const text = data.candidates[0].content.parts[0].text;

console.log("AI TEXT:", text);

try {
    const result = JSON.parse(text);

    result.severity = result.severity?.toLowerCase() || "medium";
    result.risk = result.risk?.toLowerCase() || "medium";

    return result;

} catch (e) {
    const match = text.match(/\{[\s\S]*\}/);

    if (match) {
        const result = JSON.parse(match[0]);

        result.severity = result.severity?.toLowerCase() || "medium";
        result.risk = result.risk?.toLowerCase() || "medium";

        return result;
    }

    throw new Error("Could not parse AI response");
}
}


// ===== SHOW AI RESULT =====
function showAIResult(r) {
  const panel = document.getElementById('ai-result-panel');
  const content = document.getElementById('ai-result-content');

  panel.style.display = 'block';

  content.innerHTML = `
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
          <div class="priority-fill" style="width:${r.priority * 10}%">
            ${r.priority}/10
          </div>
        </div>
      </div>
    </div>
  `;

  panel.scrollIntoView({ behavior: 'smooth' });
  showToast('✅ AI analysis complete! Report submitted.');
}

// ===== SAVE ISSUE =====
function saveIssue(r) {
  const imgSrc = document.getElementById('photoPreview').style.display !== 'none'
    ? document.getElementById('photoPreview').src : null;

  issues.unshift({
    id: Date.now().toString(),
    category: r.category,
    severity: r.severity.toLowerCase(),
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
    imgSrc: imgSrc,
    date: new Date().toLocaleDateString('en-GB')
  });
  saveToFirebase(issues[0]);

  addMapMarker(issues[0]);
  renderFeed();
  updateCategoryBreakdown();
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
    grid.innerHTML = `
      <div class="empty-feed">
        <div class="empty-icon">🌟</div>
        <p>No reports yet. Be the first Community Hero!</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(issue => `
    <div class="report-card" id="card-${issue.id}">
      ${issue.imgSrc
        ? `<img class="report-img" src="${issue.imgSrc}" alt="issue">`
        : `<div class="report-img-placeholder">${getEmoji(issue.category)}</div>`
      }
      <div class="report-body">
        <div class="report-tags">
          <span class="tag tag-${issue.severity}">${issue.severity}</span>
          <span class="tag tag-category">${issue.category}</span>
        </div>
        <p class="report-desc">${issue.description}</p>
        <div class="report-meta">
          <span>📍 ${issue.lat.toFixed(3)}, ${issue.lng.toFixed(3)}</span>
          <span>${issue.date}</span>
        </div>
        <div class="report-actions">
          <button class="vote-btn" onclick="vote('${issue.id}', 'up')">
            👍 ${issue.upvotes}
          </button>
          <button class="vote-btn" onclick="vote('${issue.id}', 'down')">
            👎 ${issue.downvotes}
          </button>
          <span class="status-pill status-${issue.status}">${issue.status}</span>
        </div>
        <button class="move-btn" onclick="moveStatus('${issue.id}')">
          → ${getNextStatus(issue.status)}
        </button>
      </div>
    </div>
  `).join('');
}

// ===== VOTING =====
function vote(id, type) {
  const issue = issues.find(i => i.id === id);
  if (!issue) return;
  if (type === 'up') {
    issue.upvotes++;
    if (issue.upvotes >= 5 && issue.status === 'reported') {
      issue.status = 'under_review';
      showToast('🚨 Issue escalated by community!');
    }
  } else {
    issue.downvotes++;
  }
  updateAllStats();
  renderFeed();
}

// ===== STATUS =====
function moveStatus(id) {
  const issue = issues.find(i => i.id === id);
  if (!issue) return;
  const flow = {
    'reported': 'under_review',
    'under_review': 'in_progress',
    'in_progress': 'resolved',
    'resolved': 'resolved'
  };
  issue.status = flow[issue.status] || 'reported';
  if (issue.status === 'resolved') {
    showToast('✅ Issue marked as resolved! Great work!');
  }
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
  return labels[status] || 'Update Status';
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
  const votes    = issues.reduce((s, i) => s + i.upvotes, 0);
  const verified = issues.filter(i => i.upvotes >= 3).length;

  // Hero stats
  document.getElementById('hero-total').textContent    = total;
  document.getElementById('hero-critical').textContent = critical;
  document.getElementById('hero-resolved').textContent = resolved;

  // Dashboard
  document.getElementById('d-total').textContent    = total;
  document.getElementById('d-critical').textContent = critical;
  document.getElementById('d-high').textContent     = high;
  document.getElementById('d-resolved').textContent = resolved;
  document.getElementById('d-votes').textContent    = votes;
  document.getElementById('d-verified').textContent = verified;

  // Rank
  updateRank(total);
}

function updateRank(total) {
  const ranks = [
    { min: 0,  title: 'Rookie Citizen',   next: 5  },
    { min: 5,  title: 'Active Reporter',  next: 10 },
    { min: 10, title: 'Community Guard',  next: 20 },
    { min: 20, title: 'Civic Champion',   next: 50 },
    { min: 50, title: '🌟 City Hero',     next: 0  }
  ];
  const rank = [...ranks].reverse().find(r => total >= r.min) || ranks[0];
  document.getElementById('rank-title').textContent = rank.title;
  document.getElementById('rank-count').textContent = total;
  document.getElementById('rank-next').textContent  =
    rank.next ? `reports · ${rank.next - total} to next` : 'Max rank! 🌟';
}

function updateCategoryBreakdown() {
  if (issues.length === 0) return;
  const counts = {};
  issues.forEach(i => counts[i.category] = (counts[i.category] || 0) + 1);

  document.getElementById('cat-breakdown').innerHTML =
    Object.entries(counts).map(([cat, n]) => {
      const pct = Math.round((n / issues.length) * 100);
      return `
        <div class="cat-item">
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
    'Pothole': '🕳️', 'Road Damage': '🛣️',
    'Water Leakage': '💧', 'Street Lights': '💡',
    'Garbage': '🗑️', 'Flooding': '🌊',
    'Infrastructure': '🏗️', 'other': '⚠️'
  };
  return e[cat] || '⚠️';
}

function scrollToReport() {
  document.getElementById('report-section').scrollIntoView({ behavior: 'smooth' });
}

function scrollToFeed() {
  document.getElementById('feed-section').scrollIntoView({ behavior: 'smooth' });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}
async function saveToFirebase(issue) {
  try {
    await db.collection("reports").add(issue);
    console.log("Saved to Firestore");
  } catch (err) {
    console.error(err);
  }
}