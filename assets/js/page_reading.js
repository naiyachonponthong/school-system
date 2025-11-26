/**
 * ===================================
 * PAGE: READING (บันทึกการอ่าน คิดวิเคราะห์ และเขียน)
 * ===================================
 */

// --- ค่าคงที่ ---
const READING_EVAL_OPTIONS = [
  { label: 'ดีเยี่ยม', value: 'ดีเยี่ยม' },
  { label: 'ดี', value: 'ดี' },
  { label: 'ผ่าน', value: 'ผ่าน' },
  { label: 'ไม่ผ่าน', value: 'ไม่ผ่าน' }
];

// Global state
window.readingData = {
  students: [],
  classId: null,
  semester: null,
  year: null
};

/**
 * 1. Render หน้าหลัก (ตัวเลือก)
 */
async function renderReadingSelectionPage() {
  renderBreadcrumb(['หน้าแรก', 'บันทึกข้อมูล', 'บันทึกการอ่านฯ']);
  
  const role = window.currentUser.role;
  if (role !== 'homeroom' && role !== 'admin' && role !== 'registrar' && role !== 'principal') {
    showNoPermission();
    return;
  }
  
  const html = `
    <div class="card p-6 mb-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">เลือกข้อมูลเพื่อบันทึกผลการอ่าน คิดวิเคราะห์ และเขียน</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="readingYearSelect" class="form-select">
            <option value="">-- กำลังโหลดปี --</option>
          </select>
        </div>
        <div>
          <label class="form-label">ภาคเรียน</label>
          <select class="form-select" id="readingSemesterSelect">
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2">ภาคเรียนที่ 2</option>
          </select>
        </div>
        <div>
          <label class="form-label">ห้องเรียน</label>
          <select class="form-select" id="readingClassSelect">
            <option value="">-- กรุณาเลือกห้องเรียน --</option>
          </select>
        </div>
        <div class="md:mt-[28px]">
          <button onclick="loadReadingData()" class="btn btn-primary w-full">
            <i class="fas fa-search mr-2"></i>โหลดข้อมูลนักเรียน
          </button>
        </div>
      </div>
    </div>
    
    <div id="readingEntryContainer" class="mt-6"></div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
  
  showLoading('กำลังโหลดข้อมูล...');
  try {
    const [classesResult, configResult] = await Promise.all([
      callServerFunction('getClasses'),
      callServerFunction('getConfig')
    ]);

    const classSelect = document.getElementById('readingClassSelect');
    const yearSelect = document.getElementById('readingYearSelect');
    const semesterSelect = document.getElementById('readingSemesterSelect');
    
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
    
    const availableYears = [...new Set(allClasses.map(c => c.year))].sort((a, b) => b.localeCompare(a, 'th'));
    if (availableYears.length === 0 || !availableYears.includes(currentYear.toString())) {
      availableYears.unshift(currentYear.toString());
    }
    
    yearSelect.innerHTML = availableYears.map(year => `<option value="${year}" ${year === currentYear.toString() ? 'selected' : ''}>${year}</option>`).join('');

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
    console.error('Error loading reading page:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * 2. โหลดข้อมูล
 */
async function loadReadingData() {
  const classId = document.getElementById('readingClassSelect').value;
  const semester = document.getElementById('readingSemesterSelect').value;
  const year = document.getElementById('readingYearSelect').value;
  
  if (!classId || !semester || !year) {
    showToast('กรุณาเลือกปี, ภาคเรียน และห้องเรียน', 'warning');
    return;
  }

  window.readingData = { classId, semester, year, students: [] };

  await waitForResponse(
    () => callServerFunction('getReadingData', classId, semester, year),
    'กำลังโหลดข้อมูลการอ่าน...',
    (result) => {
      if (result.success) {
        window.readingData.students = (result.data || []).sort((a, b) => (a.student_number || 99) - (b.student_number || 99));
        renderReadingList();
      } else {
        document.getElementById('readingEntryContainer').innerHTML = 
          renderEmptyState('ไม่สามารถโหลดข้อมูลได้', 'fas fa-exclamation-triangle');
      }
    }
  );
}

/**
 * 3. Render List
 */
function renderReadingList() {
  const { students } = window.readingData;
  const classData = document.getElementById('readingClassSelect').selectedOptions[0].text;

  const summary = { 'recorded': 0, 'not_recorded': 0 };
  students.forEach(s => { s.reading_id ? summary.recorded++ : summary.not_recorded++; });

  const html = `
    <div class="card p-4 md:p-6">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4 pb-4 border-b">
        <div>
          <h3 class="text-xl font-bold text-gray-800">บันทึกการอ่านฯ: ${classData}</h3>
          <p class="text-sm text-gray-600">ภาคเรียนที่ ${window.readingData.semester} ปีการศึกษา ${window.readingData.year}</p>
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
              <th class="w-32 text-center">ผลการประเมิน</th>
              <th class="w-32 text-center">สถานะ</th>
              <th class="w-24 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${students.length > 0 ? students.map(s => renderReadingRow(s)).join('') : 
              '<tr><td colspan="6">' + renderEmptyState('ไม่พบข้อมูลนักเรียน', 'fas fa-users') + '</td></tr>'
            }
          </tbody>
        </table>
      </div>
      
      <div class="block md:hidden space-y-3">
        ${students.length > 0 ? students.map(s => renderReadingCard(s)).join('') : 
          renderEmptyState('ไม่พบข้อมูลนักเรียน', 'fas fa-users')
        }
      </div>
    </div>
  `;
  document.getElementById('readingEntryContainer').innerHTML = html;
}

function renderReadingRow(student) {
  const isRecorded = !!student.reading_id;
  const statusBadge = isRecorded
    ? `<span class="badge badge-success">บันทึกแล้ว</span>`
    : `<span class="badge badge-secondary">ยังไม่บันทึก</span>`;
  
  const getStatusColor = (val) => {
      if(val === 'ดีเยี่ยม') return 'text-green-600';
      if(val === 'ดี') return 'text-blue-600';
      if(val === 'ผ่าน') return 'text-yellow-600';
      return 'text-red-600';
  }

  return `
    <tr id="row-${student.student_id}" data-student-id="${student.student_id}">
      <td class="text-center">${student.student_number || '-'}</td>
      <td class="font-mono">${student.student_code}</td>
      <td class="font-semibold">${student.student_name}</td>
      <td class="text-center font-bold ${getStatusColor(student.status)}">${student.status || '-'}</td>
      <td class="text-center">${statusBadge}</td>
      <td class="text-center">
        <button onclick="showReadingEditModal('${student.student_id}')" class="btn btn-primary btn-sm">
          <i class="fas fa-edit mr-1"></i>${isRecorded ? 'แก้ไข' : 'บันทึก'}
        </button>
      </td>
    </tr>
  `;
}

function renderReadingCard(student) {
  const isRecorded = !!student.reading_id;
  const statusBadge = isRecorded
    ? `<span class="badge badge-success">บันทึกแล้ว</span>`
    : `<span class="badge badge-secondary">ยังไม่บันทึก</span>`;

  const getStatusColor = (val) => {
      if(val === 'ดีเยี่ยม') return 'text-green-600';
      if(val === 'ดี') return 'text-blue-600';
      if(val === 'ผ่าน') return 'text-yellow-600';
      return 'text-red-600';
  }

  return `
    <div id="card-${student.student_id}" class="card p-4 shadow-md" data-student-id="${student.student_id}">
      <div class="flex items-center justify-between mb-2">
        <span class="font-mono font-semibold text-blue-600">เลขที่ ${student.student_number || '-'}</span>
        ${statusBadge}
      </div>
      <p class="font-semibold text-gray-800 text-lg mb-3">${student.student_name}</p>
      <p class="mb-3">ผลการประเมิน: <span class="font-bold ${getStatusColor(student.status)}">${student.status || '-'}</span></p>
      
      <button onclick="showReadingEditModal('${student.student_id}')" class="btn btn-primary w-full">
        <i class="fas fa-edit mr-2"></i>${isRecorded ? 'แก้ไขข้อมูล' : 'บันทึกข้อมูล'}
      </button>
    </div>
  `;
}

/**
 * 6. Action: แสดง Modal แก้ไข/บันทึก
 */
function showReadingEditModal(studentId) {
  const studentData = window.readingData.students.find(s => s.student_id === studentId);
  if (!studentData) {
    showToast('ไม่พบข้อมูลนักเรียน', 'error');
    return;
  }

  const fields = [
    { 
      name: 'status', 
      label: 'ผลการประเมิน', 
      type: 'select', 
      options: READING_EVAL_OPTIONS, 
      required: true, 
      colSpan: 3 
    },
    { 
      name: 'note', 
      label: 'บันทึก/หมายเหตุ', 
      type: 'textarea', 
      colSpan: 3 
    }
  ];

  const initialData = {
    status: studentData.status || 'ดีเยี่ยม',
    note: studentData.note || ''
  };

  showFormModal(
    `บันทึกการอ่านฯ: ${studentData.student_name}`,
    fields,
    async (formData) => {
      const readingRecord = {
        ...formData,
        id: studentData.reading_id || null,
        student_id: studentData.student_id,
        class_id: window.readingData.classId,
        semester: window.readingData.semester,
        year: window.readingData.year,
      };

      await waitForResponse(
        () => callServerFunction('saveOrUpdateReading', readingRecord),
        'กำลังบันทึกข้อมูล...',
        (result) => {
          if (result.success) {
            showToast('บันทึกข้อมูลสำเร็จ', 'success');
            
            // [⭐️ แก้ไข UPDATE UI ⭐️]
            const index = window.readingData.students.findIndex(s => s.student_id === studentId);
            if (index !== -1) {
              window.readingData.students[index] = {
                ...window.readingData.students[index],
                ...result.data,
                reading_id: result.data.id // ⭐️ สำคัญ: อัปเดต ID
              };
            }
            // Re-render
            renderReadingList();
          }
        }
      );
    },
    initialData
  );
}