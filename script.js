/* ═══════════════════════════════════════════════════════════
   GPACal — script.js  (ES Module)
   Firebase Auth + Firestore · Templates · GPA Engine · UI
   ═══════════════════════════════════════════════════════════ */

import { initializeApp }                        from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js';
import { getAnalytics, isSupported }             from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-analytics.js';
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, onAuthStateChanged
}                                                from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js';
import {
  getFirestore, collection, addDoc,
  getDocs, query, orderBy, serverTimestamp
}                                                from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js';
import { firebaseConfig }                        from './firebase-config.js';

/* ─── Firebase Init ──────────────────────────────────────── */
const app      = initializeApp(firebaseConfig);
let analytics  = null;
isSupported().then(supported => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch(err => {
  console.warn("Firebase Analytics is not supported in this environment:", err);
});
const auth     = getAuth(app);
const db       = getFirestore(app);
const gProvider = new GoogleAuthProvider();

/* ─── State ──────────────────────────────────────────────── */
let currentUser           = null;
let pendingAfterSignIn    = null;
let communityTemplates    = [];   // cache from Firestore

/* ─── Grade → GPA points ─────────────────────────────────── */
const gradePoints = {
  'A+': 4.00, 'A': 4.00, 'A-': 3.70,
  'B+': 3.30, 'B': 3.00, 'B-': 2.70,
  'C+': 2.30, 'C': 2.00, 'C-': 1.70,
  'D+': 1.30, 'D': 1.00, 'E': 0.00
};

/* Year weights:  Y1=0.2  Y2=0.2  Y3=0.3  Y4=0.3 */
const yearWeights = { 1: 0.2, 2: 0.2, 3: 0.3, 4: 0.3 };

/* ─── HTML Helpers ───────────────────────────────────────── */
const gradeOptionsHTML = `
  <option value="">— Grade —</option>
  <option value="A+">A+</option>
  <option value="A">A</option>
  <option value="A-">A−</option>
  <option value="B+">B+</option>
  <option value="B">B</option>
  <option value="B-">B−</option>
  <option value="C+">C+</option>
  <option value="C">C</option>
  <option value="C-">C−</option>
  <option value="D+">D+</option>
  <option value="D">D</option>
  <option value="E">E</option>
`;

const creditOptionsHTML = `
  <option value="">— Cr —</option>
  <option value="0">0</option>
  <option value="1">1</option>
  <option value="2">2</option>
  <option value="3">3</option>
  <option value="4">4</option>
  <option value="5">5</option>
  <option value="6">6</option>
  <option value="7">7</option>
  <option value="8">8</option>
`;

/* ─── IS Degree Template (built-in) ──────────────────────── */
const IS_TEMPLATE = {
  id: 'IS_BUILTIN',
  name: 'Information Systems (Default)',
  program: 'Information Systems',
  builtin: true,
  semesters: [
    { semester: 1, courses: [
      { code:'IS1101', name:'Fundamentals of Information Systems',           credits:2 },
      { code:'IS1102', name:'Structured Programming Techniques',             credits:2 },
      { code:'IS1103', name:'Structured Programming Practicum',              credits:1 },
      { code:'IS1104', name:'Theories of Information Systems',               credits:2 },
      { code:'IS1105', name:'Computer System Organization',                  credits:2 },
      { code:'IS1106', name:'Foundations of Web Technologies',               credits:2 },
      { code:'IS1107', name:'Personal Productivity with Information Technology', credits:1 },
      { code:'IS1108', name:'Fundamentals of Mathematics',                   credits:2 },
      { code:'IS1109', name:'Statistics & Probability Theory',               credits:2 },
      { code:'IS1110', name:'Communication Skills I',                        credits:0 },
      { code:'IS1111', name:'Academic Integrity',                            credits:0 },
      { code:'IS-EGP-1101', name:'General English I',                        credits:0 },
    ]},
    { semester: 2, courses: [
      { code:'IS2101', name:'Object Oriented Programming',                   credits:2 },
      { code:'IS2102', name:'Object Oriented Programming Practicum',         credits:1 },
      { code:'IS2103', name:'Emerging IS Technologies',                      credits:1 },
      { code:'IS2104', name:'Database Systems',                              credits:2 },
      { code:'IS2105', name:'Database Management Systems Practicum',         credits:1 },
      { code:'IS2106', name:'System Analysis & Design',                      credits:1 },
      { code:'IS2107', name:'Social & Professional Issues',                  credits:1 },
      { code:'IS2108', name:'Human Computer Interaction',                    credits:2 },
      { code:'IS2109', name:'Information Assurance & Security',              credits:2 },
      { code:'IS2110', name:'Software Project Initiation & Planning',        credits:1 },
      { code:'IS2111', name:'Advanced Mathematics',                          credits:2 },
      { code:'IS2112', name:'Communication Skills II',                       credits:0 },
      { code:'IS-EGP-1201', name:'General English II',                       credits:0 },
    ]},
    { semester: 3, courses: [
      { code:'IS3101', name:'Object Oriented Analysis & Design',             credits:2 },
      { code:'IS3102', name:'Data Structures & Algorithms',                  credits:2 },
      { code:'IS3103', name:'IT Governance',                                 credits:2 },
      { code:'IS3104', name:'Software Engineering',                          credits:2 },
      { code:'IS3105', name:'IS Risk Management',                            credits:2 },
      { code:'IS3106', name:'IS Sustainability',                             credits:1 },
      { code:'IS3107', name:'Management Information Systems',                credits:2 },
      { code:'IS3108', name:'E-Business',                                    credits:1 },
      { code:'IS3109', name:'Digital Innovation',                            credits:2 },
      { code:'IS-EAP-2101', name:'Academic English I',                       credits:0 },
    ]},
    { semester: 4, courses: [
      { code:'IS4101', name:'IT Auditing',                                   credits:2 },
      { code:'IS4102', name:'Web Application Development',                   credits:2 },
      { code:'IS4103', name:'Operating Systems',                             credits:2 },
      { code:'IS4104', name:'System Administration and Maintenance',         credits:2 },
      { code:'IS4105', name:'IT Procurement Management',                     credits:1 },
      { code:'IS4106', name:'Software Architecture',                         credits:2 },
      { code:'IS4107', name:'Professionalism & Ethics in Computing',         credits:1 },
      { code:'IS4108', name:'IS Strategies',                                 credits:1 },
      { code:'IS4109', name:'Agile Software Development',                    credits:2 },
      { code:'IS4110', name:'Capstone Project',                              credits:2 },
      { code:'IS-EAP-2201', name:'Academic English II',                      credits:0 },
    ]},
    { semester: 5, courses: [
      { code:'IS5101', name:'Entrepreneurship & Innovation',                 credits:1 },
      { code:'IS5102', name:'Enterprise Architecture',                       credits:1 },
      { code:'IS5103', name:'High Performance Computing',                    credits:2 },
      { code:'IS5104', name:'Software Process Management',                   credits:1 },
      { code:'IS5105', name:'Business Process Management',                   credits:2 },
      { code:'IS5106', name:'UI/UX Practicum',                               credits:1 },
      { code:'IS5107', name:'Project Management Practicum',                  credits:1 },
      { code:'IS5108', name:'Business Intelligence',                         credits:2 },
      { code:'IS5109', name:'IS Project for Community',                      credits:1 },
      { code:'IS5110', name:'Advanced Database Systems [Elective]',          credits:2 },
      { code:'IS5111', name:'Data Communication & Networks [Elective]',      credits:2 },
      { code:'IS5112', name:'Design Patterns & Anti-patterns [Elective]',    credits:2 },
      { code:'IS5113', name:'Software Quality Assurance [Elective]',         credits:2 },
      { code:'IS5114', name:'Data Mining & Analytics [Elective]',            credits:2 },
      { code:'IS-EBP-3101', name:'Business English',                         credits:0 },
    ]},
    { semester: 6, courses: [
      { code:'IS6101', name:'Professional Practice',                         credits:6 },
    ]},
    { semester: 7, courses: [
      { code:'IS7101', name:'Research Methodologies',                        credits:2 },
      { code:'IS7102', name:'IT Law',                                        credits:1 },
      { code:'IS7103', name:'Business Process Simulation',                   credits:2 },
      { code:'IS7104', name:'Enterprise Modelling Ontologies',               credits:2 },
      { code:'IS7105', name:'Organizational Behavior & Management',          credits:1 },
      { code:'IS7106', name:'Cloud Computing',                               credits:2 },
      { code:'IS7107', name:'Mobile Application Development [Elective]',     credits:1 },
      { code:'IS7108', name:'Web Service Technologies [Elective]',           credits:2 },
      { code:'IS7109', name:'Geographical Information Systems [Elective]',   credits:2 },
      { code:'IS7110', name:'Statistical Distribution & Inferences [Elective]', credits:1 },
      { code:'IS7111', name:'Advanced Programming Practicum [Elective]',     credits:1 },
      { code:'IS7112', name:'Machine Learning [Elective]',                   credits:2 },
    ]},
    { semester: 8, courses: [
      { code:'IS8101', name:'Research Project in IS',                        credits:8 },
      { code:'IS8102', name:'Business/IT Alignment',                         credits:2 },
      { code:'IS8103', name:'Human Resource Management',                     credits:2 },
      { code:'IS8104', name:'Scientific Communication',                      credits:1 },
      { code:'IS8105', name:'IS Economics',                                  credits:2 },
      { code:'IS8106', name:'Computer System Security',                      credits:2 },
      { code:'IS8107', name:'Supply Chain Management [Elective]',            credits:2 },
      { code:'IS8108', name:'Advanced Computer Networks [Elective]',         credits:2 },
      { code:'IS8109', name:'Process Mining [Elective]',                     credits:2 },
      { code:'IS8110', name:'Digital Business Model [Elective]',             credits:1 },
      { code:'IS8111', name:'Game Development [Elective]',                   credits:2 },
    ]},
  ]
};

/* ═══════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════ */
const THEME_KEY = 'gpa_theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeIcon').textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);
}

/* ═══════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════ */
let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
}

/* ═══════════════════════════════════════════════════════════
   OVERLAY HELPERS  (all modals share this)
   ═══════════════════════════════════════════════════════════ */
function openOverlay(id) {
  document.getElementById(id).classList.add('open');
  document.body.classList.add('no-scroll');
}

function closeOverlay(id) {
  document.getElementById(id).classList.remove('open');
  if (!document.querySelector('.modal-overlay.open')) {
    document.body.classList.remove('no-scroll');
  }
}

/* ═══════════════════════════════════════════════════════════
   GPA CLASSIFICATION
   ═══════════════════════════════════════════════════════════ */
function getGpaClass(gpa) {
  if (isNaN(gpa))  return 'gpa-muted';
  if (gpa >= 3.70) return 'gpa-excellent';
  if (gpa >= 3.00) return 'gpa-good';
  if (gpa >= 2.00) return 'gpa-fair';
  return 'gpa-poor';
}

function getClassification(fgpa) {
  if (isNaN(fgpa)) return '';
  if (fgpa >= 3.70) return '🏅 First Class Honours';
  if (fgpa >= 3.30) return '🎖 Second Class Upper Honours';
  if (fgpa >= 3.00) return '🎗 Second Class Lower Honours';
  if (fgpa >= 2.00) return '✅ Pass';
  return '⚠️ Below Pass';
}

/* ═══════════════════════════════════════════════════════════
   GPA COMPUTATION ENGINE
   ═══════════════════════════════════════════════════════════ */
function getRowData(row) {
  const gradeEl  = row.querySelector('.grade-select');
  const creditEl = row.querySelector('.credit-select');
  const grade    = gradeEl  ? gradeEl.value  : '';
  const credit   = creditEl ? parseFloat(creditEl.value) || 0 : 0;
  return { grade, credit };
}

function computeSemesterGPA(sem) {
  const rows = document.querySelectorAll(`#table-sem-${sem} tbody tr`);
  let totalPoints = 0, totalCredits = 0;

  rows.forEach(row => {
    const { grade, credit } = getRowData(row);
    if (grade && credit > 0) {
      totalPoints  += (gradePoints[grade] ?? 0) * credit;
      totalCredits += credit;
    }
  });

  const gpa     = totalCredits > 0 ? totalPoints / totalCredits : NaN;
  const display = isNaN(gpa) ? '—' : gpa.toFixed(2);
  const chip    = document.getElementById(`sem-gpa-${sem}`);
  if (chip) chip.textContent = `Semester GPA: ${display}`;
  return { gpa, totalCredits };
}

function computeYearGPA(yearIndex) {
  const semA = 2 * yearIndex - 1, semB = 2 * yearIndex;
  let totalPoints = 0, totalCredits = 0;

  [semA, semB].forEach(sem => {
    document.querySelectorAll(`#table-sem-${sem} tbody tr`).forEach(row => {
      const { grade, credit } = getRowData(row);
      if (grade && credit > 0) {
        totalPoints  += (gradePoints[grade] ?? 0) * credit;
        totalCredits += credit;
      }
    });
  });

  const yearGpa = totalCredits > 0 ? totalPoints / totalCredits : NaN;
  return { yearGpa, totalCredits };
}

function computeFGPA() {
  const yearResDiv = document.getElementById('yearResults');
  yearResDiv.innerHTML = '';

  let weightedSum = 0, usedWeights = 0;

  for (let y = 1; y <= 4; y++) {
    const { yearGpa, totalCredits } = computeYearGPA(y);
    const display = isNaN(yearGpa) ? '—' : yearGpa.toFixed(2);
    const weight  = yearWeights[y];
    const semA    = 2 * y - 1, semB = 2 * y;

    const row = document.createElement('div');
    row.className = 'year-result-row';
    row.innerHTML = `
      <div class="year-row-left">
        <div class="year-num-badge year-badge-${y}">${y}</div>
        <div>
          <div class="year-label">Year ${y} <span style="font-weight:400;font-size:0.78rem;color:var(--text-muted)">(Sem ${semA} + ${semB})</span></div>
          <div class="year-weight">weight: ${weight}</div>
        </div>
      </div>
      <div class="year-row-right">
        <span class="year-gpa-val ${getGpaClass(yearGpa)}">${display}</span>
        <span class="year-credits-val">${totalCredits} cr</span>
      </div>`;
    yearResDiv.appendChild(row);

    if (!isNaN(yearGpa)) { weightedSum += yearGpa * weight; usedWeights += weight; }
  }

  const fgpa         = usedWeights > 0 ? weightedSum / usedWeights : NaN;
  const fgpaDisplay  = isNaN(fgpa) ? '—' : fgpa.toFixed(2);
  const fgpaEl       = document.getElementById('overallResult');
  const classEl      = document.getElementById('fgpaClass');

  fgpaEl.textContent = fgpaDisplay;
  fgpaEl.className   = `fgpa-value ${getGpaClass(fgpa)}`;
  fgpaEl.classList.remove('pop');
  void fgpaEl.offsetWidth;
  fgpaEl.classList.add('pop');
  classEl.textContent = getClassification(fgpa);
}

/* ═══════════════════════════════════════════════════════════
   COURSE ROW FACTORY
   ═══════════════════════════════════════════════════════════ */
function addCourseRow(semNum, opts = {}) {
  const {
    code         = '',
    name         = '',
    credits      = null,
    grade        = '',
    fromTemplate = false
  } = opts;

  const tbody       = document.querySelector(`#table-sem-${semNum} tbody`);
  const tr          = document.createElement('tr');
  const isZero      = fromTemplate && credits === 0;
  if (fromTemplate) tr.dataset.fromTemplate = 'true';
  if (code)         tr.dataset.code         = code;
  if (isZero)       tr.classList.add('zero-credit-row');

  /* credit cell: locked badge for template rows, select for manual */
  const creditCell = fromTemplate
    ? `${isZero
        ? `<span class="credit-badge zero-credit" title="Non-credit — not included in GPA">NC</span>`
        : `<span class="credit-badge">${credits}</span>`}
       <input type="hidden" class="credit-select" value="${credits ?? 0}" />`
    : `<select class="credit-select-el credit-select" aria-label="Credits">${creditOptionsHTML}</select>`;

  tr.innerHTML = `
    <td>
      <div class="course-cell">
        ${code ? `<span class="course-code-badge" title="${code}">${code}</span>` : ''}
        <input type="text" class="course-name" value="${escHtml(name)}"
               placeholder="Course name (optional)" aria-label="Course name" />
      </div>
    </td>
    <td>
      <select class="grade-select${isZero ? ' grade-nc' : ''}" aria-label="Grade">
        ${gradeOptionsHTML}
      </select>
    </td>
    <td class="credit-cell">${creditCell}</td>
    <td>
      <button class="btn-remove-row" title="Remove course" aria-label="Remove this course">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </td>`;

  /* set initial values */
  const gradeEl  = tr.querySelector('.grade-select');
  const creditEl = tr.querySelector('.credit-select');

  if (grade)                                    gradeEl.value = grade;
  if (!fromTemplate && credits !== null && creditEl.tagName === 'SELECT') {
    creditEl.value = String(credits);
  }

  /* listeners */
  const refresh = () => { computeSemesterGPA(semNum); updateSemCard(semNum); scheduleAutoSave(); };
  gradeEl.addEventListener('change', refresh);
  if (!fromTemplate && creditEl.tagName === 'SELECT') creditEl.addEventListener('change', refresh);

  tr.querySelector('.btn-remove-row').addEventListener('click', () => {
    tr.remove();
    computeSemesterGPA(semNum);
    updateSemCard(semNum);
    scheduleAutoSave();
  });

  tbody.appendChild(tr);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ═══════════════════════════════════════════════════════════
   SEMESTER CARDS  (home page grid)
   ═══════════════════════════════════════════════════════════ */
function buildSemCards() {
  const grid = document.getElementById('semesterGrid');
  grid.innerHTML = '';
  for (let s = 1; s <= 8; s++) {
    const y   = Math.ceil(s / 2);
    const card = document.createElement('div');
    card.className   = 'semester-card';
    card.id          = `sem-card-${s}`;
    card.dataset.year = y;
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Semester ${s} — click to open`);
    card.style.animationDelay = `${(s - 1) * 55}ms`;

    card.innerHTML = `
      <div class="sem-card-header">
        <div>
          <div class="sem-card-num">Semester ${s}</div>
          <div class="year-chip">Year ${y}</div>
        </div>
        <div class="card-gpa-wrap">
          <div class="card-gpa gpa-muted" id="cgpa-${s}">—</div>
          <div class="card-gpa-label">GPA</div>
        </div>
      </div>
      <div class="sem-card-stats">
        <div class="stat-item">
          <span class="stat-value" id="cc-${s}">0</span>
          <span class="stat-label">courses</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value" id="ccr-${s}">0</span>
          <span class="stat-label">credits</span>
        </div>
      </div>
      <div class="sem-card-progress">
        <div class="progress-bar">
          <div class="progress-fill" id="cpf-${s}" style="width:0%"></div>
        </div>
        <div class="progress-text" id="cpt-${s}">0/0 graded</div>
      </div>
      <div class="sem-card-open">Open Semester
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>`;

    card.addEventListener('click', () => openSemModal(s));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openSemModal(s); });
    grid.appendChild(card);
  }
}

function updateSemCard(semNum) {
  const rows   = document.querySelectorAll(`#table-sem-${semNum} tbody tr`);
  let total = 0, credited = 0, graded = 0;

  rows.forEach(row => {
    total++;
    const { grade, credit } = getRowData(row);
    credited += credit;
    if (grade) graded++;
  });

  const { gpa } = computeSemesterGPA(semNum);
  const pct     = total > 0 ? Math.round((graded / total) * 100) : 0;

  const cgpa = document.getElementById(`cgpa-${semNum}`);
  if (cgpa) {
    cgpa.textContent = isNaN(gpa) ? '—' : gpa.toFixed(2);
    cgpa.className   = `card-gpa ${getGpaClass(gpa)}`;
  }
  const ccEl  = document.getElementById(`cc-${semNum}`);
  const ccrEl = document.getElementById(`ccr-${semNum}`);
  const cpfEl = document.getElementById(`cpf-${semNum}`);
  const cptEl = document.getElementById(`cpt-${semNum}`);
  if (ccEl)  ccEl.textContent  = total;
  if (ccrEl) ccrEl.textContent = credited;
  if (cpfEl) cpfEl.style.width = `${pct}%`;
  if (cptEl) cptEl.textContent = `${graded}/${total} graded`;
}

/* ═══════════════════════════════════════════════════════════
   SEMESTER MODALS
   ═══════════════════════════════════════════════════════════ */
function buildSemModals() {
  const container = document.getElementById('modals');
  for (let s = 1; s <= 8; s++) {
    const y = Math.ceil(s / 2);
    const div = document.createElement('div');
    div.className = 'modal-overlay';
    div.id        = `modal-sem-${s}`;
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.setAttribute('aria-labelledby', `smtitle-${s}`);

    div.innerHTML = `
      <div class="modal-box sem-modal-box">
        <button class="modal-close" id="sm-close-${s}" aria-label="Close semester ${s}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div class="sem-modal-header">
          <div>
            <h2 class="sem-modal-title" id="smtitle-${s}">Semester ${s}</h2>
            <span class="year-badge">Year ${y}</span>
          </div>
          <div class="sem-modal-header-right">
            <div class="sem-gpa-chip" id="sem-gpa-${s}">Semester GPA: —</div>
          </div>
        </div>

        <div class="table-wrap">
          <table id="table-sem-${s}">
            <thead>
              <tr>
                <th style="width:45%">Course</th>
                <th style="width:20%">Grade</th>
                <th style="width:15%">Credits</th>
                <th style="width:10%"></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <div class="sem-modal-footer">
          <button class="btn btn-ghost" id="sm-add-${s}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Course
          </button>
          <button class="btn btn-primary" id="sm-done-${s}">Done</button>
        </div>
      </div>`;

    container.appendChild(div);

    /* modal-level listeners */
    document.getElementById(`sm-close-${s}`).addEventListener('click', () => closeSemModal(s));
    document.getElementById(`sm-done-${s}`).addEventListener('click',  () => closeSemModal(s));
    document.getElementById(`sm-add-${s}`).addEventListener('click',   () => addCourseRow(s));
    div.addEventListener('click', e => { if (e.target === div) closeSemModal(s); });
  }
}

function openSemModal(sem) {
  computeSemesterGPA(sem);
  openOverlay(`modal-sem-${sem}`);
}
function closeSemModal(sem) {
  updateSemCard(sem);
  closeOverlay(`modal-sem-${sem}`);
}

/* ═══════════════════════════════════════════════════════════
   LOCAL STORAGE  (auto-save / restore)
   ═══════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'gpa_data_v2';
let saveTimer = null;

function scheduleAutoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToLocal, 900);
}

function saveToLocal() {
  const data = {};
  for (let s = 1; s <= 8; s++) {
    data[`sem${s}`] = [];
    document.querySelectorAll(`#table-sem-${s} tbody tr`).forEach(row => {
      data[`sem${s}`].push({
        code:         row.dataset.code || '',
        name:         row.querySelector('.course-name')?.value  || '',
        grade:        row.querySelector('.grade-select')?.value || '',
        credits:      row.querySelector('.credit-select')?.value ?? '',
        fromTemplate: row.dataset.fromTemplate === 'true'
      });
    });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromLocal(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { return false; }

  /* clear all */
  for (let s = 1; s <= 8; s++) {
    document.querySelector(`#table-sem-${s} tbody`).innerHTML = '';
  }

  let hasRows = false;
  for (let s = 1; s <= 8; s++) {
    (data[`sem${s}`] || []).forEach(item => {
      hasRows = true;
      const cr = item.credits !== '' ? parseFloat(item.credits) : null;
      addCourseRow(s, {
        code:         item.code  || '',
        name:         item.name  || '',
        grade:        item.grade || '',
        credits:      cr,
        fromTemplate: !!item.fromTemplate
      });
    });
    computeSemesterGPA(s);
    updateSemCard(s);
  }
  return hasRows;
}

/* ═══════════════════════════════════════════════════════════
   TEMPLATE SYSTEM
   ═══════════════════════════════════════════════════════════ */
function loadTemplateIntoCalc(templateData) {
  /* clear all semesters */
  for (let s = 1; s <= 8; s++) {
    document.querySelector(`#table-sem-${s} tbody`).innerHTML = '';
  }
  /* reset results */
  document.getElementById('yearResults').innerHTML = `
    <div class="placeholder-hint" id="resultPlaceholder">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
      <span>Enter grades then click <strong>Calculate FGPA</strong></span>
    </div>`;
  const fv = document.getElementById('overallResult');
  fv.textContent = '—'; fv.className = 'fgpa-value';
  document.getElementById('fgpaClass').textContent = '';

  /* fill courses */
  (templateData.semesters || []).forEach(semData => {
    const sn = semData.semester;
    if (sn < 1 || sn > 8) return;
    (semData.courses || []).forEach(c => {
      addCourseRow(sn, { code: c.code||'', name: c.name||'', credits: c.credits ?? 1, fromTemplate: true });
    });
  });

  for (let s = 1; s <= 8; s++) { computeSemesterGPA(s); updateSemCard(s); }
  saveToLocal();
  showToast(`✓ Loaded "${templateData.name}"`, 'success');
}

/* Load all community templates from Firestore */
async function fetchCommunityTemplates() {
  const group = document.getElementById('cloudGroup');
  group.innerHTML = '';

  try {
    const q = query(collection(db, 'templates'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    communityTemplates = [];

    snap.forEach(doc => {
      communityTemplates.push({ id: doc.id, ...doc.data() });
    });

    if (communityTemplates.length > 0) {
      group.style.display = '';
      communityTemplates.forEach(t => {
        const opt = document.createElement('option');
        opt.value       = t.id;
        opt.textContent = `${t.name} — ${t.program || 'Custom'} (by ${t.displayName || 'User'})`;
        group.appendChild(opt);
      });
    }
  } catch (err) {
    console.warn('Could not load community templates:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════ */
function openAuthModal(afterSignIn = null) {
  pendingAfterSignIn = afterSignIn;
  /* reset form */
  document.getElementById('authEmail').value    = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('authError').classList.add('hidden');
  switchAuthTab('google');
  openOverlay('authModal');
}
function closeAuthModal() { closeOverlay('authModal'); }

function openSaveModal() {
  document.getElementById('templateName').value    = '';
  document.getElementById('templateProgram').value = '';
  openOverlay('saveTemplateModal');
}
function closeSaveModal() { closeOverlay('saveTemplateModal'); }

function switchAuthTab(tab) {
  const isGoogle = tab === 'google';
  document.getElementById('tabGoogle').classList.toggle('active',  isGoogle);
  document.getElementById('tabEmail').classList.toggle('active',  !isGoogle);
  document.getElementById('panelGoogle').classList.toggle('hidden', !isGoogle);
  document.getElementById('panelEmail').classList.toggle('hidden',  isGoogle);
  document.getElementById('tabGoogle').setAttribute('aria-selected', String(isGoogle));
  document.getElementById('tabEmail').setAttribute('aria-selected',  String(!isGoogle));
}

function handleAuthStateChange(user) {
  currentUser = user;
  const chip      = document.getElementById('userChip');
  const signInBtn = document.getElementById('signInBtn');
  const avatar    = document.getElementById('userAvatar');
  const nameEl    = document.getElementById('userName');

  if (user) {
    chip.classList.remove('hidden');
    signInBtn.classList.add('hidden');
    avatar.src     = user.photoURL  || '';
    avatar.style.display = user.photoURL ? 'block' : 'none';
    nameEl.textContent   = user.displayName || user.email || 'User';
    /* load/refresh community templates on sign-in */
    fetchCommunityTemplates();
  } else {
    chip.classList.add('hidden');
    signInBtn.classList.remove('hidden');
  }
}

async function doGoogleSignIn() {
  try {
    await signInWithPopup(auth, gProvider);
    closeAuthModal();
    showToast('Signed in! 🎉', 'success');
    runPending();
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      showToast('Sign-in failed — ' + err.message, 'error');
    }
  }
}

async function doEmailSignIn() {
  const email = document.getElementById('authEmail').value.trim();
  const pwd   = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
    closeAuthModal();
    showToast('Signed in! 🎉', 'success');
    runPending();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function doEmailSignUp() {
  const email = document.getElementById('authEmail').value.trim();
  const pwd   = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  try {
    await createUserWithEmailAndPassword(auth, email, pwd);
    closeAuthModal();
    showToast('Account created! 🎉', 'success');
    runPending();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function runPending() {
  if (pendingAfterSignIn) {
    const cb = pendingAfterSignIn;
    pendingAfterSignIn = null;
    cb();
  }
}

/* ═══════════════════════════════════════════════════════════
   SAVE TEMPLATE TO FIRESTORE
   ═══════════════════════════════════════════════════════════ */
async function confirmSaveTemplate() {
  const btn     = document.getElementById('confirmSaveTemplate');
  const tName   = document.getElementById('templateName').value.trim();
  const tProg   = document.getElementById('templateProgram').value.trim();

  if (!tName) { showToast('Please enter a template name', 'warning'); return; }

  if (!confirm(`Are you sure you want to save the template "${tName}"? Once saved, it will be visible to all users and cannot be deleted.`)) {
    return;
  }

  /* collect semesters (no grades) */
  const semesters = [];
  for (let s = 1; s <= 8; s++) {
    const rows = document.querySelectorAll(`#table-sem-${s} tbody tr`);
    const courses = [];
    rows.forEach(row => {
      const cName  = row.querySelector('.course-name')?.value?.trim() || '';
      const code   = row.dataset.code || '';
      const credit = parseFloat(row.querySelector('.credit-select')?.value) || 0;
      if (cName || code) courses.push({ code, name: cName, credits: credit });
    });
    if (courses.length) semesters.push({ semester: s, courses });
  }

  if (!semesters.length) {
    showToast('No courses found. Load a template or add courses first.', 'warning');
    return;
  }

  btn.disabled     = true;
  btn.textContent  = 'Saving…';

  try {
    await addDoc(collection(db, 'templates'), {
      uid:         currentUser.uid,
      displayName: currentUser.displayName || currentUser.email || 'Anonymous',
      name:        tName,
      program:     tProg || 'Custom',
      semesters,
      createdAt:   serverTimestamp()
    });
    closeSaveModal();
    showToast(`✓ Template "${tName}" saved to cloud!`, 'success');
    await fetchCommunityTemplates();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Confirm & Save to Cloud';
  }
}

/* ═══════════════════════════════════════════════════════════
   EVENT WIRING
   ═══════════════════════════════════════════════════════════ */
function wireEvents() {
  /* theme */
  document.getElementById('themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });

  /* auth */
  document.getElementById('signInBtn').addEventListener('click', () => openAuthModal());
  document.getElementById('signOutBtn').addEventListener('click', async () => {
    await signOut(auth);
    showToast('Signed out', 'success');
  });
  document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);
  document.getElementById('authModal').addEventListener('click', e => {
    if (e.target.id === 'authModal') closeAuthModal();
  });
  document.getElementById('tabGoogle').addEventListener('click', () => switchAuthTab('google'));
  document.getElementById('tabEmail').addEventListener('click',  () => switchAuthTab('email'));
  document.getElementById('googleSignInBtn').addEventListener('click', doGoogleSignIn);
  document.getElementById('emailSignInBtn').addEventListener('click',  doEmailSignIn);
  document.getElementById('emailSignUpBtn').addEventListener('click',  doEmailSignUp);

  /* save template modal */
  document.getElementById('closeSaveTemplateModal').addEventListener('click', closeSaveModal);
  document.getElementById('saveTemplateModal').addEventListener('click', e => {
    if (e.target.id === 'saveTemplateModal') closeSaveModal();
  });
  document.getElementById('confirmSaveTemplate').addEventListener('click', confirmSaveTemplate);

  /* template bar */
  document.getElementById('loadTemplateBtn').addEventListener('click', () => {
    const sel = document.getElementById('templateSelect');
    const val = sel.value;
    if (!val) { showToast('Please select a template first', 'warning'); return; }

    /* check existing data */
    let hasCourses = false;
    for (let s = 1; s <= 8; s++) {
      if (document.querySelectorAll(`#table-sem-${s} tbody tr`).length > 0) { hasCourses = true; break; }
    }
    if (hasCourses && !confirm('Loading will replace all current data. Continue?')) return;

    if (val === 'IS_BUILTIN') {
      loadTemplateIntoCalc(IS_TEMPLATE);
    } else {
      const t = communityTemplates.find(x => x.id === val);
      if (t) loadTemplateIntoCalc(t);
      else showToast('Template not found', 'error');
    }
  });

  document.getElementById('saveTemplateBtn').addEventListener('click', () => {
    if (!currentUser) {
      openAuthModal(() => openSaveModal());
    } else {
      openSaveModal();
    }
  });

  /* FGPA calculate */
  document.getElementById('calcFGPA').addEventListener('click', () => {
    for (let s = 1; s <= 8; s++) computeSemesterGPA(s);
    computeFGPA();
    document.getElementById('resultsPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* local save */
  document.getElementById('saveAll').addEventListener('click', () => {
    saveToLocal();
    showToast('Saved to local storage ✓', 'success');
  });

  /* local load */
  document.getElementById('loadAll').addEventListener('click', () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { showToast('No local data found', 'warning'); return; }
    const ok = loadFromLocal(raw);
    if (ok) showToast('Local data restored ✓', 'success');
    else    showToast('Local data was empty', 'warning');
  });

  /* clear all */
  document.getElementById('clearAll').addEventListener('click', () => {
    if (!confirm('Clear all semesters? This cannot be undone.')) return;
    for (let s = 1; s <= 8; s++) {
      document.querySelector(`#table-sem-${s} tbody`).innerHTML = '';
      computeSemesterGPA(s);
      updateSemCard(s);
    }
    document.getElementById('yearResults').innerHTML = `
      <div class="placeholder-hint">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        <span>Enter grades then click <strong>Calculate FGPA</strong></span>
      </div>`;
    const fv = document.getElementById('overallResult');
    fv.textContent = '—'; fv.className = 'fgpa-value';
    document.getElementById('fgpaClass').textContent = '';
    localStorage.removeItem(STORAGE_KEY);
    showToast('All data cleared', 'success');
  });

  /* print */
  document.getElementById('printResults').addEventListener('click', () => window.print());
}

/* ═══════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════ */
function init() {
  /* apply saved theme */
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  /* build DOM */
  buildSemCards();
  buildSemModals();

  /* wire all events */
  wireEvents();

  /* auth state listener */
  onAuthStateChanged(auth, handleAuthStateChange);

  /* restore local data if present */
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    loadFromLocal(raw);
  }

  /* load community templates (public — no auth needed) */
  fetchCommunityTemplates();
}

init();
