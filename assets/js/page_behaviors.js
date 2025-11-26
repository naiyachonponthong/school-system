/**
 * ===================================
 * PAGE: BEHAVIORS (บันทึกพฤติกรรม)
 * ===================================
 */

// --- ค่าคงที่สำหรับคุณลักษณะอันพึงประสงค์ ---
const BEHAVIOR_TRAITS = [
  { id: 'trait_1', label: '1. รักชาติ ศาสน์ กษัตริย์' },
  { id: 'trait_2', label: '2. ซื่อสัตย์สุจริต' },
  { id: 'trait_3', label: '3. มีวินัย' },
  { id: 'trait_4', label: '4. ใฝ่เรียนรู้' },
  { id: 'trait_5', label: '5. อยู่อย่างพอเพียง' },
  { id: 'trait_6', label: '6. มุ่งมั่นในการทำงาน' },
  { id: 'trait_7', label: '7. รักความเป็นไทย' },
  { id: 'trait_8', label: '8. มีจิตสาธารณะ' }
];

const BEHAVIOR_EVALUATION_OPTIONS = [
  { label: 'ดีเยี่ยม (3)', value: '3' },
  { label: 'ดี (2)', value: '2' },
  { label: 'ผ่าน (1)', value: '1' },
  { label: 'ไม่ผ่าน (0)', value: '0' }
];

const BEHAVIOR_OVERALL_OPTIONS = [
  { label: 'ดีเยี่ยม', value: 'ดีเยี่ยม' },
  { label: 'ดี', value: 'ดี' },
  { label: 'ผ่าน', value: 'ผ่าน' },
  { label: 'ไม่ผ่าน', value: 'ไม่ผ่าน' }
];

// --- เกณฑ์การคำนวณผลสรุป ---
function getOverallBehaviorFromScore(score) {
  if (score >= 80) return 'ดีเยี่ยม';
  if (score >= 70) return 'ดี';
  if (score >= 50) return 'ผ่าน';
  return 'ไม่ผ่าน';
}

/** 
 * Helper: คำนวณคะแนนพฤติกรรมอัตโนมัติ
 * @param {string} modalId - ID ของ Modal
 */
function calculateBehaviorScore(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  const form = modal.querySelector('form');
  if (!form) return;

  let totalPoints = 0;
  const maxPoints = BEHAVIOR_TRAITS.length * 3; // 8 ข้อ * 3 คะแนน = 24

  BEHAVIOR_TRAITS.forEach(trait => {
    const select = form.querySelector(`[name="${trait.id}"]`);
    if (select) {
      totalPoints += parseInt(select.value) || 0;
    }
  });

  // แปลงเป็นคะแนนเต็ม 100
  const conductScore = Math.round((totalPoints / maxPoints) * 100);
  const overallBehavior = getOverallBehaviorFromScore(conductScore);

  const scoreInput = document.getElementById('conduct_score');
  const overallSelect = document.getElementById('overall_behavior');

  if (scoreInput) scoreInput.value = conductScore;
  if (overallSelect) overallSelect.value = overallBehavior;
}

// Global state
window.behaviorData = {
  students: [],
  classId: null,
  semester: null,
  year: null
};

/**
 * 1. Render หน้าหลัก (ตัวเลือก)
 */
async function renderBehaviorSelectionPage() {
  renderBreadcrumb(['หน้าแรก', 'บันทึกพฤติกรรม']);
  
  const role = window.currentUser.role;
  if (role !== 'homeroom' && role !== 'admin' && role !== 'registrar' && role !== 'principal') {
    showNoPermission();
    return;
  }
  
  const html = `
    <div class="card p-6 mb-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">เลือกข้อมูลเพื่อบันทึกพฤติกรรม</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="behaviorYearSelect" class="form-select">
            <option value="">-- กำลังโหลดปี --</option>
          </select>
        </div>
        <div>
          <label class="form-label">ภาคเรียน</label>
          <select class="form-select" id="behaviorSemesterSelect">
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2">ภาคเรียนที่ 2</option>
          </select>
        </div>
        <div>
          <label class="form-label">ห้องเรียน</label>
          <select class="form-select" id="behaviorClassSelect">
            <option value="">-- กรุณาเลือกห้องเรียน --</option>
          </select>
        </div>
        <div class="md:mt-[28px]">
          <button onclick="loadBehaviorData()" class="btn btn-primary w-full">
            <i class="fas fa-search mr-2"></i>โหลดข้อมูลนักเรียน
          </button>
        </div>
      </div>
    </div>
    
    <div id="behaviorEntryContainer" class="mt-6"></div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
  
  showLoading('กำลังโหลดข้อมูล...');
  try {
    const [classesResult, configResult] = await Promise.all([
      callServerFunction('getClasses'),
      callServerFunction('getConfig')
    ]);

    const classSelect = document.getElementById('behaviorClassSelect');
    const yearSelect = document.getElementById('behaviorYearSelect');
    const semesterSelect = document.getElementById('behaviorSemesterSelect');
    
    let allClasses = classesResult.success ? classesResult.data : [];
    let classesToShow = [];

    if (role === 'admin' || role === 'registrar' || role === 'principal') {
      classesToShow = allClasses;
    } else {
      classesToShow = allClasses.filter(c => c.homeroom_teacher_id === window.currentUser.id);
    }
    
    let currentYear = new Date().getFullYear() + 543;
    if (configResult.success) {
      currentYear = configResult.data.current_year || currentYear.toString();
      semesterSelect.value = configResult.data.current_semester || '1';
    }
    
    const availableYears = [...new Set(allClasses.map(c => c.year))];
    if (availableYears.length === 0 || !availableYears.includes(currentYear.toString())) {
      availableYears.unshift(currentYear.toString());
    }
    availableYears.sort((a, b) => b.localeCompare(a, 'th'));
    
    yearSelect.innerHTML = '';
    availableYears.forEach(year => {
      yearSelect.innerHTML += `<option value="${year}" ${year === currentYear.toString() ? 'selected' : ''}>${year}</option>`;
    });

    classSelect.innerHTML = '<option value="">-- เลือกห้องเรียน --</option>';
    if (classesToShow.length === 0) {
      classSelect.innerHTML = `<option value="" disabled>${role === 'homeroom' ? 'ไม่พบห้องเรียนที่คุณเป็นครูประจำชั้น' : 'ไม่พบห้องเรียนในระบบ'}</option>`;
    } else {
      classesToShow
        .filter(c => c.status === 'active')
        .sort((a, b) => a.level.localeCompare(b.level, 'th') || a.room.localeCompare(b.room, 'th'))
        .forEach(cls => {
          classSelect.innerHTML += `<option value="${cls.id}">${cls.level}/${cls.room} (ปี ${cls.year})</option>`;
        });
    }

  } catch (error) {
    console.error('Error loading behavior page:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * 2. โหลดข้อมูล
 */
async function loadBehaviorData() {
  const classId = document.getElementById('behaviorClassSelect').value;
  const semester = document.getElementById('behaviorSemesterSelect').value;
  const year = document.getElementById('behaviorYearSelect').value;
  
  if (!classId || !semester || !year) {
    showToast('กรุณาเลือกปี, ภาคเรียน และห้องเรียน', 'warning');
    return;
  }

  window.behaviorData = { classId, semester, year, students: [] };

  await waitForResponse(
    () => callServerFunction('getBehaviorData', classId, semester, year),
    'กำลังโหลดข้อมูลพฤติกรรม...',
    (result) => {
      if (result.success) {
        window.behaviorData.students = (result.data || []).sort((a, b) => (a.student_number || 99) - (b.student_number || 99));
        renderBehaviorList();
      } else {
        document.getElementById('behaviorEntryContainer').innerHTML = 
          renderEmptyState('ไม่สามารถโหลดข้อมูลได้', 'fas fa-exclamation-triangle');
      }
    }
  );
}

/**
 * 3. Render List
 */
function renderBehaviorList() {
  const { students, classId, semester, year } = window.behaviorData;
  const classData = document.getElementById('behaviorClassSelect').selectedOptions[0].text;

  const summary = { 'recorded': 0, 'not_recorded': 0 };
  students.forEach(s => {
    if (s.behavior_id) {
      summary.recorded++;
    } else {
      summary.not_recorded++;
    }
  });

  const html = `
    <div class="card p-4 md:p-6">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4 pb-4 border-b">
        <div>
          <h3 class="text-xl font-bold text-gray-800">บันทึกพฤติกรรม: ${classData}</h3>
          <p class="text-sm text-gray-600">ภาคเรียนที่ ${semester} ปีการศึกษา ${year}</p>
        </div>
        <div class="text-lg font-semibold text-gray-700 mt-2 md:mt-0">
          บันทึกแล้ว: <span class="text-green-600">${summary.recorded}</span> / ${students.length} คน
        </div>
      </div>
      
      <div class="hidden md:block overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th class="w-12 text-center">เลขที่</th>
              <th class="w-24">รหัส</th>
              <th>ชื่อ-สกุล</th>
              <th class="w-24 text-center">คะแนน (100)</th>
              <th class="w-24 text-center">ผลสรุป</th>
              <th class="w-32 text-center">สถานะ</th>
              <th class="w-24 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody id="behavior-table-body">
            ${students.length > 0 ? students.map(s => renderBehaviorRow(s)).join('') : 
              '<tr><td colspan="7">' + renderEmptyState('ไม่พบข้อมูลนักเรียน', 'fas fa-users') + '</td></tr>'
            }
          </tbody>
        </table>
      </div>
      
      <div class="block md:hidden space-y-3" id="behavior-card-list">
        ${students.length > 0 ? students.map(s => renderBehaviorCard(s)).join('') : 
          renderEmptyState('ไม่พบข้อมูลนักเรียน', 'fas fa-users')
        }
      </div>
    </div>
  `;
  
  document.getElementById('behaviorEntryContainer').innerHTML = html;
}

function renderBehaviorRow(student) {
  const isRecorded = !!student.behavior_id;
  const statusBadge = isRecorded
    ? `<span class="badge badge-success">บันทึกแล้ว</span>`
    : `<span class="badge badge-secondary">ยังไม่บันทึก</span>`;
    
  return `
    <tr id="row-${student.student_id}" data-student-id="${student.student_id}">
      <td class="text-center">${student.student_number || '-'}</td>
      <td class="font-mono">${student.student_code}</td>
      <td class="font-semibold">${student.student_name}</td>
      <td class="text-center">${isRecorded ? student.conduct_score : '-'}</td>
      <td class="text-center">${isRecorded ? student.overall_behavior : '-'}</td>
      <td class="text-center">${statusBadge}</td>
      <td class="text-center">
        <button onclick="showBehaviorEditModal('${student.student_id}')" class="btn btn-primary btn-sm">
          <i class="fas fa-edit mr-1"></i>${isRecorded ? 'แก้ไข' : 'บันทึก'}
        </button>
      </td>
    </tr>
  `;
}

function renderBehaviorCard(student) {
  const isRecorded = !!student.behavior_id;
  const statusBadge = isRecorded
    ? `<span class="badge badge-success">บันทึกแล้ว</span>`
    : `<span class="badge badge-secondary">ยังไม่บันทึก</span>`;

  return `
    <div id="card-${student.student_id}" class="card p-4 shadow-md" data-student-id="${student.student_id}">
      <div class="flex items-center justify-between mb-2">
        <span class="font-mono font-semibold text-blue-600">เลขที่ ${student.student_number || '-'}</span>
        ${statusBadge}
      </div>
      <p class="font-semibold text-gray-800 text-lg mb-2">${student.student_name}</p>
      
      <div class="grid grid-cols-2 gap-2 mb-3 text-center">
        <div>
          <p class="text-xs text-gray-500">คะแนน</p>
          <p class="text-lg font-bold">${isRecorded ? student.conduct_score : '-'}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500">ผลสรุป</p>
          <p class="text-lg font-bold">${isRecorded ? student.overall_behavior : '-'}</p>
        </div>
      </div>
      
      <button onclick="showBehaviorEditModal('${student.student_id}')" class="btn btn-primary w-full">
        <i class="fas fa-edit mr-2"></i>${isRecorded ? 'แก้ไขข้อมูล' : 'บันทึกข้อมูล'}
      </button>
    </div>
  `;
}

/**
 * 6. Action: แสดง Modal แก้ไข/บันทึก
 */
function showBehaviorEditModal(studentId) {
  const studentData = window.behaviorData.students.find(s => s.student_id === studentId);
  if (!studentData) {
    showToast('ไม่พบข้อมูลนักเรียน', 'error');
    return;
  }

  const fields = [
    { type: 'section', label: 'สรุปผล' },
    { 
      name: 'conduct_score', 
      label: 'คะแนนความประพฤติ (เต็ม 100)', 
      type: 'number', 
      required: true, 
      colSpan: 1, 
      disabled: true,
      id: 'conduct_score' // Add ID
    },
    { 
      name: 'overall_behavior', 
      label: 'ผลการประเมินสรุป', 
      type: 'select', 
      options: BEHAVIOR_OVERALL_OPTIONS, 
      required: true, 
      colSpan: 2, 
      disabled: true,
      id: 'overall_behavior' // Add ID
    },
    
    { type: 'section', label: 'คุณลักษณะอันพึงประสงค์' },
    ...BEHAVIOR_TRAITS.map(trait => ({
      name: trait.id,
      label: trait.label,
      type: 'select',
      options: BEHAVIOR_EVALUATION_OPTIONS,
      required: true,
      colSpan: 1,
      id: trait.id // Add ID for event listener
    })),
    
    { type: 'section', label: 'ข้อเสนอแนะ' },
    { name: 'positive_note', label: 'พฤติกรรมดีเด่น/จุดแข็ง', type: 'textarea', colSpan: 3 },
    { name: 'improvement_note', label: 'พฤติกรรมที่ควรปรับปรุง', type: 'textarea', colSpan: 3 }
  ];

  const initialData = {
    conduct_score: studentData.conduct_score || '100',
    overall_behavior: studentData.overall_behavior || 'ดีเยี่ยม',
    positive_note: studentData.positive_note || '',
    improvement_note: studentData.improvement_note || '',
    ...studentData.traits
  };
  
  BEHAVIOR_TRAITS.forEach(trait => {
    if (!initialData[trait.id]) {
      initialData[trait.id] = '3';
    }
  });

  // Modal ID
  const modalId = 'behaviorFormModal';

  showFormModal(
    `บันทึกพฤติกรรม: ${studentData.student_name}`,
    fields,
    async (formData) => {
      const traits = {};
      BEHAVIOR_TRAITS.forEach(trait => {
        traits[trait.id] = formData[trait.id];
        delete formData[trait.id];
      });

      const behaviorRecord = {
        ...formData,
        id: studentData.behavior_id || null, // ส่ง ID เดิมถ้ามี
        student_id: studentData.student_id,
        class_id: window.behaviorData.classId,
        semester: window.behaviorData.semester,
        year: window.behaviorData.year,
        traits: traits,
        conduct_score: document.getElementById('conduct_score').value,
        overall_behavior: document.getElementById('overall_behavior').value
      };

      await waitForResponse(
        () => callServerFunction('saveOrUpdateBehavior', behaviorRecord),
        'กำลังบันทึกข้อมูล...',
        (result) => {
          if (result.success) {
            showToast('บันทึกข้อมูลสำเร็จ', 'success');
            
            // [⭐️ แก้ไข UPDATE UI ⭐️]
            const index = window.behaviorData.students.findIndex(s => s.student_id === studentId);
            if (index !== -1) {
              window.behaviorData.students[index] = {
                ...window.behaviorData.students[index],
                ...result.data, // ข้อมูลจาก Server
                behavior_id: result.data.id // ⭐️ สำคัญ: อัปเดต behavior_id
              };
            }
            // Re-render
            renderBehaviorList();
          }
        }
      );
    },
    initialData,
    modalId // ส่ง ID ไปให้ showFormModal
  );

  // Attach event listeners
  setTimeout(() => {
    BEHAVIOR_TRAITS.forEach(trait => {
      const traitSelect = document.getElementById(trait.id); 
      if (traitSelect) {
        traitSelect.addEventListener('change', () => calculateBehaviorScore(modalId));
      }
    });
    calculateBehaviorScore(modalId);
  }, 200);
}