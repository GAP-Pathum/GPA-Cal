/* GPA & FGPA Calculator
   - Uses grade-to-grade-point table from uploaded doc
   - 8 semesters, modals for each semester
   - credits 1..6 per course
   - Years:
       Year1 = Sem1 + Sem2 (weight 0.2)
       Year2 = Sem3 + Sem4 (weight 0.2)
       Year3 = Sem5 + Sem6 (weight 0.3)
       Year4 = Sem7 + Sem8 (weight 0.3)
   - FGPA = sum(weight_j * YearGPA_j)
*/

/* -------------------------
   Grade mapping (from doc)
   ------------------------- */
// Note: A+ and A both map to 4.00 (per doc)
const gradePoints = {
  "A+": 4.00,
  "A": 4.00,
  "A-": 3.70,
  "B+": 3.30,
  "B": 3.00,
  "B-": 2.70,
  "C+": 2.30,
  "C": 2.00,
  "C-": 1.70,
  "D+": 1.30,
  "D": 1.00,
  "E": 0.00
};

/* Semester weights map to years:
   Sem 1-2 => Year1 weight 0.2
   Sem 3-4 => Year2 weight 0.2
   Sem 5-6 => Year3 weight 0.3
   Sem 7-8 => Year4 weight 0.3
*/
const yearWeights = {
  1: 0.2,
  2: 0.2,
  3: 0.3,
  4: 0.3
};

// Helper: semester -> year index (1..4)
function semToYear(sem) {
  return Math.floor((sem - 1) / 2) + 1;
}

/* -------------------------
   Create semester modals
   ------------------------- */
const modalsContainer = document.getElementById('modals');

for (let s = 1; s <= 8; s++) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = `modal-sem-${s}`;
  modal.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="sem${s}-title">
      <div class="modal-header">
        <h2 id="sem${s}-title">Semester ${s}</h2>
        <div>
          <button class="close-btn" onclick="closeModal(${s})" title="Close">&times;</button>
        </div>
      </div>

      <div class="table-wrap">
        <table id="table-sem-${s}">
          <thead>
            <tr>
              <th style="width:40%;">Course</th>
              <th style="width:20%;">Grade</th>
              <th style="width:20%;">Credit</th>
              <th style="width:20%;text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
            <!-- rows inserted here -->
          </tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
        <button class="add-course" onclick="addCourse(${s})">+ Add Course</button>
        <div class="sem-gpa" id="sem-gpa-${s}">Semester GPA: —</div>
      </div>

      <div style="margin-top:10px;text-align:right;">
        <button onclick="closeModal(${s})" style="padding:8px 10px;border-radius:6px;border:none;background:#6c757d;color:white;cursor:pointer;">Close</button>
      </div>
    </div>
  `;
  modalsContainer.appendChild(modal);
}

/* --------------
   Modal controls
   -------------- */
function openModal(sem) {
  document.getElementById(`modal-sem-${sem}`).classList.add('open');
  // Recompute semester GPA when opened
  computeSemesterGPA(sem);
}

function closeModal(sem) {
  document.getElementById(`modal-sem-${sem}`).classList.remove('open');
}

/* -------------------------
   Add / Remove course rows
   ------------------------- */
function addCourse(sem) {
  const tbody = document.querySelector(`#table-sem-${sem} tbody`);
  const tr = document.createElement('tr');

tr.innerHTML = `
    <td><input type="text" placeholder="Course name (optional)"></td>

    <td>
        <select class="grade-select">
            <option value="" selected>Select Grade</option>
            <option value="A+">A+</option>
            <option value="A">A</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B">B</option>
            <option value="B-">B-</option>
            <option value="C+">C+</option>
            <option value="C">C</option>
            <option value="C-">C-</option>
            <option value="D+">D+</option>
            <option value="D">D</option>
            <option value="E">E</option>
        </select>
    </td>

    <td>
        <select class="credit-select">
        <option value="" selected>Select Credit</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
            <option value=" ">None</option>
        </select>
    </td>

    <td style="text-align:center;">
        <div class="row-actions">
            <button class="remove-row" onclick="removeCourseRow(this)">Remove</button>
        </div>
    </td>
`;

  // whenever grade or credit changes recompute
  tr.querySelector('.grade-select').addEventListener('change', () => {
    const id = getSemFromTable(tbody);
    computeSemesterGPA(id);
  });
  tr.querySelector('.credit-select').addEventListener('change', () => {
    const id = getSemFromTable(tbody);
    computeSemesterGPA(id);
  });

  tbody.appendChild(tr);
}

/* Remove a row */
function removeCourseRow(btn) {
  const tr = btn.closest('tr');
  const tbody = tr.parentNode;
  tr.remove();
  const sem = getSemFromTable(tbody);
  computeSemesterGPA(sem);
}

/* helper to get sem number from a tbody element */
function getSemFromTable(tbody) {
  const tableId = tbody.closest('table').id; // e.g., table-sem-3
  const parts = tableId.split('-');
  return parseInt(parts[2], 10);
}

/* -------------------------
   Semester GPA computation
   ------------------------- */
function computeSemesterGPA(sem) {
  const rows = document.querySelectorAll(`#table-sem-${sem} tbody tr`);
  let totalPoints = 0;
  let totalCredits = 0;

  rows.forEach(row => {
    const grade = row.querySelector('.grade-select').value;
    const credit = parseFloat(row.querySelector('.credit-select').value) || 0;
    const gp = gradePoints[grade] ?? 0;
    totalPoints += gp * credit;
    totalCredits += credit;
  });

  const gpa = totalCredits > 0 ? totalPoints / totalCredits : NaN;
  const display = Number.isNaN(gpa) ? '—' : gpa.toFixed(2);
  document.getElementById(`sem-gpa-${sem}`).textContent = `Semester GPA: ${display}`;
  return { gpa: gpa, totalCredits: totalCredits };
}

/* -------------------------
   Year GPA (combine two semesters)
   ------------------------- */
function computeYearGPA(yearIndex) {
  // yearIndex 1..4 => sems: (2*yearIndex -1) and (2*yearIndex)
  const semA = 2 * yearIndex - 1;
  const semB = 2 * yearIndex;
  // accumulate across both semesters
  let totalPoints = 0;
  let totalCredits = 0;

  [semA, semB].forEach(sem => {
    const rows = document.querySelectorAll(`#table-sem-${sem} tbody tr`);
    rows.forEach(row => {
      const grade = row.querySelector('.grade-select').value;
      const credit = parseFloat(row.querySelector('.credit-select').value) || 0;
      const gp = gradePoints[grade] ?? 0;
      totalPoints += gp * credit;
      totalCredits += credit;
    });
  });

  const yearGpa = totalCredits > 0 ? totalPoints / totalCredits : NaN;
  return { yearGpa: yearGpa, totalCredits: totalCredits };
}

/* -------------------------
   FGPA (weighted) computation
   ------------------------- */
function computeFGPA() {
  const yearResDiv = document.getElementById('yearResults');
  yearResDiv.innerHTML = '';
  let weightedSum = 0;
  let usedWeightsTotal = 0;

  for (let y = 1; y <= 4; y++) {
    const { yearGpa, totalCredits } = computeYearGPA(y);
    const display = Number.isNaN(yearGpa) ? '—' : yearGpa.toFixed(2);
    const weight = yearWeights[y] || 0;

    // Only include the year's GPA in display even if there are 0 credits (show —)
    const row = document.createElement('div');
    row.style.marginBottom = '6px';
    row.textContent = `Year ${y} (weight ${weight}): Year GPA = ${display}  (total credits: ${totalCredits})`;
    yearResDiv.appendChild(row);

    if (!Number.isNaN(yearGpa)) {
      weightedSum += yearGpa * weight;
      usedWeightsTotal += weight;
    }
  }

  // According to the document FGPA = sum(a_j * P_j)
  // If some years have no courses, we still divide by sum of used weights so partial FGPA is correct
  const fgpa = usedWeightsTotal > 0 ? (weightedSum / usedWeightsTotal) : NaN;
  const overallDisplay = Number.isNaN(fgpa) ? '—' : fgpa.toFixed(2);
  document.getElementById('overallResult').textContent = `Weighted FGPA: ${overallDisplay}`;
}

/* -------------------------
   UI wiring
   ------------------------- */
document.getElementById('calcFGPA').addEventListener('click', () => {
  // recompute all semester GPAs first
  for (let s = 1; s <= 8; s++) computeSemesterGPA(s);
  computeFGPA();
});

/* Local save/load (simple) */
const STORAGE_KEY = 'gpa_project_data_v1';
document.getElementById('saveAll').addEventListener('click', () => {
  const data = {};
  for (let s = 1; s <= 8; s++) {
    data[`sem${s}`] = [];
    const rows = document.querySelectorAll(`#table-sem-${s} tbody tr`);
    rows.forEach(row => {
      data[`sem${s}`].push({
        course: row.querySelector('input').value || '',
        grade: row.querySelector('.grade-select').value,
        credit: row.querySelector('.credit-select').value
      });
    });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  alert('Saved locally.');
});
document.getElementById('loadAll').addEventListener('click', () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) { alert('No saved data found.'); return; }
  const data = JSON.parse(raw);
  for (let s = 1; s <= 8; s++) {
    const tbody = document.querySelector(`#table-sem-${s} tbody`);
    tbody.innerHTML = '';
    (data[`sem${s}`] || []).forEach(item => {
      addCourse(s);
      // last inserted row:
      const last = tbody.lastElementChild;
      last.querySelector('input').value = item.course || '';
      last.querySelector('.grade-select').value = item.grade || 'A';
      last.querySelector('.credit-select').value = item.credit || '3';
    });
    computeSemesterGPA(s);
  }
  alert('Loaded saved data.');
});
document.getElementById('clearAll').addEventListener('click', () => {
  if (!confirm('Clear all semesters? This will remove all entered course rows.')) return;
  for (let s = 1; s <= 8; s++) {
    document.querySelector(`#table-sem-${s} tbody`).innerHTML = '';
    document.getElementById(`sem-gpa-${s}`).textContent = 'Semester GPA: —';
  }
  document.getElementById('yearResults').innerHTML = '';
  document.getElementById('overallResult').textContent = 'Weighted FGPA: —';
  localStorage.removeItem(STORAGE_KEY);
});

// Print Results button logic
document.getElementById('printResults').addEventListener('click', () => {
  // Create a new window for printing
  const fgpa = document.getElementById('overallResult').outerHTML;
  const years = document.getElementById('yearResults').outerHTML;
  const win = window.open('', '', 'width=800,height=600');
  win.document.write(`
    <html>
      <head>
        <title>Print Results</title>
        <style>
          body { font-family: system-ui, Arial, sans-serif; margin: 30px; }
          h3 { margin-bottom: 12px; }
          #yearResults > div { margin-bottom: 6px; }
        </style>
      </head>
      <body>
        <h2>GPA & FGPA Results</h2>
        ${fgpa}
        ${years}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
});

/* -------------------------
   Initialize with one sample row per semester (optional)
   ------------------------- */
for (let s = 1; s <= 8; s++) {
  addCourse(s);
  // set defaults to sensible values
  const tbody = document.querySelector(`#table-sem-${s} tbody`);
  const last = tbody.lastElementChild;
  computeSemesterGPA(s);
}
