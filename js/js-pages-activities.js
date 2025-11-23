
/**
 * ===================================
 * PAGE: ACTIVITIES (บันทึกกิจกรรม)
 * ===================================
 */

// --- ค่าคงที่สำหรับกิจกรรมพัฒนาผู้เรียน ---
const ACTIVITY_CATEGORIES = [
  { id: 'guidance', label: '1. กิจกรรมแนะแนว' },
  { id: 'club', label: '2. กิจกรรมนักเรียน (ชุมนุม)' },
  { id: 'social_service', label: '3. กิจกรรมเพื่อสังคมและสาธารณประโยชน์' },
  { id: 'scout', label: '4. กิจกรรมลูกเสือ/เนตรนารี' }
];

const ACTIVITY_EVAL_OPTIONS = [
  { label: 'ผ่าน (ผ)', value: 'ผ่าน' },
  { label: 'ไม่ผ่าน (มผ)', value: 'ไม่ผ่าน' }
];
// ----------------------------------------------------

// Global state for this page
window.activityData = {
  students: [],
  classId: null,
  semester: null,
  year: null
};

/**
 * 1. Render หน้าหลัก (ตัวเลือก)
 */
async function renderActivitySelectionPage() {
  renderBreadcrumb(['หน้าแรก', 'บันทึกกิจกรรม']);
  
  // ตรวจสอบสิทธิ์ (เฉพาะครูประจำชั้น หรือ Admin)
  const role = window.currentUser.role;
  if (role !== 'homeroom' && role !== 'admin' && role !== 'registrar' && role !== 'principal') {
    showNoPermission();
    return;
  }
  
  const html = `
    <div class="card p-6 mb-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">เลือกข้อมูลเพื่อบันทึกกิจกรรม</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="activityYearSelect" class="form-select">
            <option value="">-- กำลังโหลดปี --</option>
          </select>
        </div>
        <div>
          <label class="form-label">ภาคเรียน</label>
          <select class="form-select" id="activitySemesterSelect">
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2">ภาคเรียนที่ 2</option>
          </select>
        </div>
        <div>
          <label class="form-label">ห้องเรียน</label>
          <select class="form-select" id="activityClassSelect">
            <option value="">-- กรุณาเลือกห้องเรียน --</option>
          </select>
        </div>
        <div class="md:mt-[28px]">
          <button onclick="loadActivityData()" class="btn btn-primary w-full">
            <i class="fas fa-search mr-2"></i>โหลดข้อมูลนักเรียน
          </button>
        </div>
      </div>
    </div>
    
    <div id="activityEntryContainer" class="mt-6">
      </div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
  
  showLoading('กำลังโหลดข้อมูล...');
  try {
    const [classesResult, configResult] = await Promise.all([
      callServerFunction('getClasses'),
      callServerFunction('getConfig')
    ]);

    const classSelect = document.getElementById('activityClassSelect');
    const yearSelect = document.getElementById('activityYearSelect');
    const semesterSelect = document.getElementById('activitySemesterSelect');
    
    let allClasses = classesResult.success ? classesResult.data : [];
    let classesToShow = [];

    // กรองห้องเรียน
    if (role === 'admin' || role === 'registrar' || role === 'principal') {
      classesToShow = allClasses; // Admin เห็นทุกห้อง
    } else {
      // 'homeroom' เห็นเฉพาะห้องตัวเอง
      classesToShow = allClasses.filter(c => c.homeroom_teacher_id === window.currentUser.id);
    }
    
    // ตั้งค่าปีและภาคเรียน
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

    // สร้าง Dropdown ห้องเรียน
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
    console.error('Error loading activity page selections:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * 2. โหลดข้อมูลนักเรียนและข้อมูลกิจกรรม
 */
async function loadActivityData() {
  const classId = document.getElementById('activityClassSelect').value;
  const semester = document.getElementById('activitySemesterSelect').value;
  const year = document.getElementById('activityYearSelect').value;
  
  if (!classId || !semester || !year) {
    showToast('กรุณาเลือกปี, ภาคเรียน และห้องเรียน', 'warning');
    return;
  }

  window.activityData = { classId, semester, year, students: [] };

  await waitForResponse(
    () => callServerFunction('getActivityData', classId, semester, year),
    'กำลังโหลดข้อมูลกิจกรรม...',
    (result) => {
      if (result.success) {
        window.activityData.students = (result.data || []).sort((a, b) => (a.student_number || 99) - (b.student_number || 99));
        renderActivityList();
      } else {
        document.getElementById('activityEntryContainer').innerHTML = 
          renderEmptyState('ไม่สามารถโหลดข้อมูลได้', 'fas fa-exclamation-triangle');
      }
    }
  );
}

/**
 * 3. วาดรายการนักเรียน
 */
function renderActivityList() {
  const { students, classId, semester, year } = window.activityData;
  const classData = document.getElementById('activityClassSelect').selectedOptions[0].text;

  // สรุปผล
  const summary = { 'recorded': 0, 'not_recorded': 0 };
  students.forEach(s => {
    if (s.activity_id) { // activity_id คือ id ของ record
      summary.recorded++;
    } else {
      summary.not_recorded++;
    }
  });

  const html = `
    <div class="card p-4 md:p-6">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4 pb-4 border-b">
        <div>
          <h3 class="text-xl font-bold text-gray-800">บันทึกกิจกรรม: ${classData}</h3>
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
              <th class="w-24 text-center">แนะแนว</th>
              <th class="w-24 text-center">ชุมนุม</th>
              <th class="w-24 text-center">บำเพ็ญฯ</th>
              <th class="w-24 text-center">ลูกเสือ</th>
              <th class="w-32 text-center">สถานะ</th>
              <th class="w-24 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody id="activity-table-body">
            ${students.length > 0 ? students.map(s => renderActivityRow(s)).join('') : 
              '<tr><td colspan="9">' + renderEmptyState('ไม่พบข้อมูลนักเรียน', 'fas fa-users') + '</td></tr>'
            }
          </tbody>
        </table>
      </div>
      
      <div class="block md:hidden space-y-3" id="activity-card-list">
        ${students.length > 0 ? students.map(s => renderActivityCard(s)).join('') : 
          renderEmptyState('ไม่พบข้อมูลนักเรียน', 'fas fa-users')
        }
      </div>
    </div>
  `;
  
  document.getElementById('activityEntryContainer').innerHTML = html;
}

/**
 * 4. Helper: วาดแถว (Desktop)
 */
function renderActivityRow(student) {
  const isRecorded = !!student.activity_id;
  
  const getStatusBadge = (activity) => {
    if (!activity || !activity.status) return '-';
    return activity.status === 'ผ่าน' 
      ? '<span class="text-green-600">ผ่าน</span>' 
      : '<span class="text-red-600">ไม่ผ่าน</span>';
  };
  
  const statusBadge = isRecorded
    ? `<span class="badge badge-success">บันทึกแล้ว</span>`
    : `<span class="badge badge-secondary">ยังไม่บันทึก</span>`;
    
  return `
    <tr id="row-${student.student_id}" data-student-id="${student.student_id}">
      <td class="text-center">${student.student_number || '-'}</td>
      <td class="font-mono">${student.student_code}</td>
      <td class="font-semibold">${student.student_name}</td>
      <td class="text-center">${getStatusBadge(student.guidance)}</td>
      <td class="text-center">${getStatusBadge(student.club)}</td>
      <td class="text-center">${getStatusBadge(student.social_service)}</td>
      <td class="text-center">${getStatusBadge(student.scout)}</td>
      <td class="text-center">${statusBadge}</td>
      <td class="text-center">
        <button onclick="showActivityEditModal('${student.student_id}')" class="btn btn-primary btn-sm">
          <i class="fas fa-edit mr-1"></i>${isRecorded ? 'แก้ไข' : 'บันทึก'}
        </button>
      </td>
    </tr>
  `;
}

/**
 * 5. Helper: วาดการ์ด (Mobile)
 */
function renderActivityCard(student) {
  const isRecorded = !!student.activity_id;
  const statusBadge = isRecorded
    ? `<span class="badge badge-success">บันทึกแล้ว</span>`
    : `<span class="badge badge-secondary">ยังไม่บันทึก</span>`;

  return `
    <div id="card-${student.student_id}" class="card p-4 shadow-md" data-student-id="${student.student_id}">
      <div class="flex items-center justify-between mb-2">
        <span class="font-mono font-semibold text-blue-600">เลขที่ ${student.student_number || '-'}</span>
        ${statusBadge}
      </div>
      <p class="font-semibold text-gray-800 text-lg mb-3">${student.student_name}</p>
      
      <button onclick="showActivityEditModal('${student.student_id}')" class="btn btn-primary w-full">
        <i class="fas fa-edit mr-2"></i>${isRecorded ? 'แก้ไขข้อมูล' : 'บันทึกข้อมูล'}
      </button>
    </div>
  `;
}

/**
 * 6. Action: แสดง Modal แก้ไข/บันทึก
 */
function showActivityEditModal(studentId) {
  const studentData = window.activityData.students.find(s => s.student_id === studentId);
  if (!studentData) {
    showToast('ไม่พบข้อมูลนักเรียน', 'error');
    return;
  }

  // สร้าง Fields แบบไดนามิก
  const fields = [];
  ACTIVITY_CATEGORIES.forEach(category => {
    fields.push({ type: 'section', label: category.label });
    fields.push({
      name: `${category.id}_status`,
      label: 'ผลการประเมิน',
      type: 'select',
      options: ACTIVITY_EVAL_OPTIONS,
      required: true,
      colSpan: 1
    });
    fields.push({
      name: `${category.id}_note`,
      label: 'บันทึก/หมายเหตุ',
      type: 'text',
      colSpan: 2
    });
  });

  // เตรียมข้อมูลเริ่มต้น
  const initialData = {};
  ACTIVITY_CATEGORIES.forEach(category => {
    const activity = studentData[category.id] || {}; // (e.g., studentData.guidance)
    initialData[`${category.id}_status`] = activity.status || 'ผ่าน';
    initialData[`${category.id}_note`] = activity.note || '';
  });

  // แสดง Modal
  showFormModal(
    `บันทึกกิจกรรม: ${studentData.student_name}`,
    fields,
    async (formData) => {
      // 1. รวบรวมข้อมูลเมื่อ Submit (แปลงกลับเป็น Object)
      const activityRecord = {
        id: studentData.activity_id || null, // (สำคัญ) ส่ง id เดิมถ้ามี
        student_id: studentData.student_id,
        class_id: window.activityData.classId,
        semester: window.activityData.semester,
        year: window.activityData.year,
        // (สร้าง Object ย่อย)
        guidance: {
          status: formData.guidance_status,
          note: formData.guidance_note
        },
        club: {
          status: formData.club_status,
          note: formData.club_note
        },
        social_service: {
          status: formData.social_service_status,
          note: formData.social_service_note
        },
        scout: {
          status: formData.scout_status,
          note: formData.scout_note
        }
      };

      // 2. เรียก Server
      await waitForResponse(
        () => callServerFunction('saveOrUpdateActivity', activityRecord),
        'กำลังบันทึกข้อมูล...',
        (result) => {
          if (result.success) {
            showToast('บันทึกข้อมูลสำเร็จ', 'success');
            // 3. อัปเดตข้อมูลใน window.activityData
            const index = window.activityData.students.findIndex(s => s.student_id === studentId);
            if (index !== -1) {
              window.activityData.students[index] = {
                ...studentData, // ข้อมูลนักเรียน (code, name)
                ...result.data  // ข้อมูลกิจกรรมที่ Server ส่งกลับมา
              };
            }
            // 4. วาด List ใหม่
            renderActivityList();
          }
        }
      );
    },
    initialData
  );
}

console.log('✅ JS-Pages-Activities loaded successfully');
