
/**
 * ===================================
 * PAGE: ATTENDANCE (บันทึกการเข้าเรียน)
 * ===================================
 */

// Global state for this page
window.attendanceData = {
  students: [],
  classId: null,
  date: null
};

/**
 * 1. Render หน้าหลัก (ตัวเลือก)
 * (แก้ไข: กรองห้องเรียนตามสิทธิ์ของครู)
 */
async function renderAttendancePage() {
  renderBreadcrumb(['หน้าแรก', 'บันทึกการเข้าเรียน']);
  
  const html = `
    <div class="card p-6 mb-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">เลือกข้อมูลเพื่อบันทึกการเข้าเรียน</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="form-label">ห้องเรียน</label>
          <select class="form-select" id="attendanceClassSelect">
            <option value="">-- กรุณาเลือกห้องเรียน --</option>
          </select>
        </div>
        <div>
          <label class="form-label">วันที่</label>
          <input type="date" id="attendanceDateSelect" class="form-input">
        </div>
        <div class="md:mt-[28px]">
          <button onclick="loadAttendanceData()" class="btn btn-primary w-full md:w-auto">
            <i class="fas fa-search mr-2"></i>โหลดข้อมูล
          </button>
        </div>
      </div>
    </div>
    
    <div id="attendanceEntryContainer" class="mt-6">
      </div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
  
  // Set default date to today
  document.getElementById('attendanceDateSelect').value = formatDateISO(new Date());
  
  // [ ⭐️⭐️⭐️ นี่คือส่วนที่แก้ไข ⭐️⭐️⭐️ ]
  
  showLoading('กำลังโหลดข้อมูลห้องเรียน...');
  try {
    // 1. ดึงข้อมูลผู้ใช้ปัจจุบัน
    const currentUserId = window.currentUser.id;
    const currentUserRole = window.currentUser.role;
    const adminRoles = ['admin', 'principal', 'registrar']; // Role ที่เห็นทุกห้อง

    // 2. โหลดข้อมูลห้องเรียนและวิชา
    const [classesResult, subjectsResult] = await Promise.all([
      callServerFunction('getClasses'),
      callServerFunction('getSubjects')
    ]);

    const classSelect = document.getElementById('attendanceClassSelect');
    const allClasses = classesResult.success ? classesResult.data : [];
    const allSubjects = subjectsResult.success ? subjectsResult.data : [];
    
    let classesToShow = [];

// 3. กรองห้องเรียนตามสิทธิ์
    if (adminRoles.includes(currentUserRole)) {
      // ⭐️ 1. Admin/ทะเบียน/ผอ. -> เห็นทุกห้อง
      classesToShow = allClasses;
    } else {
      // ⭐️ 2. (ตรรกะใหม่) สำหรับครู/ครูประจำชั้น -> ให้รวบรวมห้องทั้งหมดที่เกี่ยวข้อง
      
      const combinedClassIds = new Set();

      // a. ถ้าเป็นครูประจำชั้น (homeroom) -> เพิ่มห้องประจำชั้น
      if (currentUserRole === 'homeroom') {
        allClasses
          .filter(c => c.homeroom_teacher_id === currentUserId)
          .forEach(c => combinedClassIds.add(c.id));
      }

      // b. (ทุกคนที่เป็นครู) หาระดับชั้น (Level) ที่ครูคนนี้สอน
      const teacherLevels = new Set(
        allSubjects
          .filter(s => s.teacher_id === currentUserId) // กรองวิชาที่ครูสอน
          .map(s => s.level) // เอาระดับชั้นของวิชานั้นๆ
      );
      
      // c. เพิ่มห้องเรียนตามระดับชั้นที่ครูสอน
      allClasses
        .filter(c => teacherLevels.has(c.level))
        .forEach(c => combinedClassIds.add(c.id));
      
      // 4. รวมผลลัพธ์จาก Set (Set จะช่วยกรองห้องที่ซ้ำกันออกอัตโนมัติ)
      classesToShow = allClasses.filter(c => combinedClassIds.has(c.id));
    }
    
    // 4. สร้าง Dropdown
    if (classesToShow.length === 0) {
       const option = document.createElement('option');
       option.value = "";
       option.textContent = (adminRoles.includes(currentUserRole))
         ? "ไม่พบห้องเรียนในระบบ"
         : "ไม่พบห้องเรียนที่ท่านรับผิดชอบ";
       option.disabled = true;
       classSelect.appendChild(option);
    } else {
      classesToShow
        .filter(c => c.status === 'active')
        .sort((a, b) => {
          if (a.level !== b.level) return a.level.localeCompare(b.level, 'th');
          return a.room.localeCompare(b.room, 'th');
        })
        .forEach(cls => {
          const option = document.createElement('option');
          option.value = cls.id;
          option.textContent = `${cls.level}/${cls.room} (ปี ${cls.year})`;
          classSelect.appendChild(option);
        });
    }

  } catch (error) {
    console.error('Error loading classes/subjects for attendance:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดห้องเรียน', 'error');
  } finally {
    hideLoading();
  }
  // [ ⭐️⭐️⭐️ สิ้นสุดส่วนที่แก้ไข ⭐️⭐️⭐️ ]
}

/**
 * 2. โหลดข้อมูลนักเรียนและสถานะการเข้าเรียน
 */
async function loadAttendanceData() {
  const classId = document.getElementById('attendanceClassSelect').value;
  const date = document.getElementById('attendanceDateSelect').value;
  
  if (!classId || !date) {
    showToast('กรุณาเลือกห้องเรียนและวันที่', 'warning');
    return;
  }

  // เก็บค่าไว้ใน global state
  window.attendanceData.classId = classId;
  window.attendanceData.date = date;

  await waitForResponse(
    () => callServerFunction('getAttendanceData', classId, date),
    'กำลังโหลดข้อมูลนักเรียน...',
    (result) => {
      if (result.success) {
        // [⭐️] เรียงตามเลขที่ก่อนเก็บ
        const sortedStudents = (result.data || []).sort((a, b) => (a.student_number || 99) - (b.student_number || 99));
        window.attendanceData.students = sortedStudents;
        
        renderAttendanceList();
      } else {
        document.getElementById('attendanceEntryContainer').innerHTML = 
          renderEmptyState('ไม่สามารถโหลดข้อมูลได้', 'fas fa-exclamation-triangle');
      }
    }
  );
}

/**
 * 3. วาดรายการนักเรียน (Desktop + Mobile)
 */
function renderAttendanceList() {
  const students = window.attendanceData.students;
  const { classId, date } = window.attendanceData;
  const classData = document.getElementById('attendanceClassSelect').selectedOptions[0].text;
  
  // 3.1 สร้าง Summary
  const summary = students.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, { present: 0, late: 0, absent: 0, leave: 0, not_recorded: 0 });
  
  const total = students.length;
  summary.not_recorded = students.filter(s => s.status === 'not_recorded' || !s.status).length;
  summary.present = students.filter(s => s.status === 'present').length;
  summary.late = students.filter(s => s.status === 'late').length;
  summary.absent = students.filter(s => s.status === 'absent').length;
  summary.leave = students.filter(s => s.status === 'leave').length;
  
  // 3.2 HTML
  const html = `
    <div class="card p-4 md:p-6">
      
      <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4 pb-4 border-b">
        <div>
          <h3 class="text-xl font-bold text-gray-800">บันทึกการเข้าเรียน: ${classData}</h3>
          <p class="text-sm text-gray-600">วันที่: ${formatThaiDate(date)}</p>
        </div>
        <div class="text-lg font-semibold text-gray-700 mt-2 md:mt-0">
          นักเรียนทั้งหมด: <span class="text-blue-600">${total}</span> คน
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        <div class="bg-gray-50 p-4 rounded-lg border">
          <h4 class="text-md font-semibold text-gray-700 mb-3">จัดการทั้งหมด</h4>
          
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button onclick="handleBatchUpdateStatus('present')" 
                    class="btn btn-success text-sm"> <i class="fas fa-check mr-1"></i>มาทั้งหมด
            </button>
            <button onclick="handleBatchUpdateStatus('late')" 
                    class="btn btn-outline-warning text-sm"> <i class="fas fa-clock mr-1"></i>สายทั้งหมด
            </button>
            <button onclick="handleBatchUpdateStatus('absent')" 
                    class="btn btn-outline-danger text-sm"> <i class="fas fa-times mr-1"></i>ขาดทั้งหมด
            </button>
            <button onclick="handleBatchUpdateStatus('not_recorded')" 
                    class="btn btn-outline-secondary text-sm"> <i class="fas fa-undo mr-1"></i>รีเซ็ต
            </button>
          </div>
          </div>
        
        <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 class="text-md font-semibold text-gray-700 mb-3">สรุปการเข้าเรียน</h4>
          <div class="flex flex-wrap justify-between gap-2">
            <div class="text-center">
              <p class="text-2xl font-bold text-green-600" id="summary-present">${summary.present}</p>
              <p class="text-xs text-green-700">มาเรียน</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-yellow-600" id="summary-late">${summary.late}</p>
              <p class="text-xs text-yellow-700">มาสาย</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-red-600" id="summary-absent">${summary.absent}</p>
              <p class="text-xs text-red-700">ขาด</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-blue-600" id="summary-leave">${summary.leave}</p>
              <p class="text-xs text-blue-700">ลา</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-gray-500" id="summary-not_recorded">${summary.not_recorded}</p>
              <p class="text-xs text-gray-600">ยังไม่บันทึก</p>
            </div>
          </div>
        </div>
      </div>
      
<div class="hidden md:block overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th class="w-12 text-center">เลขที่</th>
              <th class="w-24">รหัส</th>
              <th>ชื่อ-สกุล</th>
              <th class="w-64 text-center">สถานะ</th>
              <th class="w-48">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody id="attendance-table-body">
            ${students.length > 0 ? students.map(s => renderAttendanceRow(s)).join('') : 
              '<tr><td colspan="5">' + renderEmptyState('ไม่พบข้อมูลนักเรียน', 'fas fa-users') + '</td></tr>'
            }
          </tbody>
        </table>
      </div>
      
      <div class="block md:hidden space-y-3" id="attendance-card-list">
        ${students.length > 0 ? students.map(s => renderAttendanceCard(s)).join('') : 
          renderEmptyState('ไม่พบข้อมูลนักเรียน', 'fas fa-users')
        }
      </div>
      
      <div class="mt-6 pt-6 border-t text-right">
        <button onclick="handleSaveAllAttendance()" class="btn btn-primary btn-lg px-8">
          <i class="fas fa-save mr-2"></i>บันทึกการเปลี่ยนแปลง
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('attendanceEntryContainer').innerHTML = html;
}

/**
 * 4. Helper: วาดแถว (Desktop)
 */
function renderAttendanceRow(student) {
  const status = student.status || 'not_recorded';
  const colors = {
    present: { btn: 'btn-success', text: 'มาเรียน' },
    late: { btn: 'btn-warning', text: 'มาสาย' },
    absent: { btn: 'btn-danger', text: 'ขาด' },
    leave: { btn: 'btn-info', text: 'ลา' },
    not_recorded: { btn: 'btn-secondary', text: 'ยังไม่บันทึก' }
  };

  return `
    <tr id="row-${student.student_id}" data-student-id="${student.student_id}" data-status="${status}">
      
      <td class="text-center">${student.student_number ? student.student_number : '-'}</td>
      
      <td class="font-mono">${student.student_code}</td>
      <td class="font-semibold">${student.student_name}</td>
      <td class="text-center">
        <div class="btn-group w-full">
          <button onclick="updateStudentStatus('${student.student_id}', 'present')" 
                  class="btn btn-sm ${status === 'present' ? 'btn-success' : 'btn-outline-success'}">มา</button>
          <button onclick="updateStudentStatus('${student.student_id}', 'late')" 
                  class="btn btn-sm ${status === 'late' ? 'btn-warning' : 'btn-outline-warning'}">สาย</button>
          <button onclick="updateStudentStatus('${student.student_id}', 'absent')" 
                  class="btn btn-sm ${status === 'absent' ? 'btn-danger' : 'btn-outline-danger'}">ขาด</button>
          <button onclick="updateStudentStatus('${student.student_id}', 'leave')" 
                  class="btn btn-sm ${status === 'leave' ? 'btn-info' : 'btn-outline-info'}">ลา</button>
        </div>
      </td>
      <td>
        <input type="text" 
               class="form-input text-sm" 
               placeholder="หมายเหตุ (ถ้ามี)" 
               value="${student.note || ''}"
               onchange="updateStudentNote('${student.student_id}', this.value)">
      </td>
    </tr>
  `;
}

/**
 * 5. Helper: วาดการ์ด (Mobile)
 */
function renderAttendanceCard(student) {
  const status = student.status || 'not_recorded';
  const fullName = student.student_name;
  const initial = getInitials(fullName);
  
  const statusInfo = {
    present: { text: 'มาเรียน', color: 'text-green-600', bg: 'bg-green-100' },
    late: { text: 'มาสาย', color: 'text-yellow-600', bg: 'bg-yellow-100' },
    absent: { text: 'ขาด', color: 'text-red-600', bg: 'bg-red-100' },
    leave: { text: 'ลา', color: 'text-blue-600', bg: 'bg-blue-100' },
    not_recorded: { text: 'ยังไม่บันทึก', color: 'text-gray-600', bg: 'bg-gray-100' }
  };
  const currentStatus = statusInfo[status];

  return `
    <div id="card-${student.student_id}" class="card p-4 shadow-md" data-student-id="${student.student_id}" data-status="${status}">
      <div class="flex items-center space-x-3 mb-3">
        ${student.photo_url ? `
          <img src="${student.photo_url}" alt="${fullName}" class="w-12 h-12 rounded-full object-cover">
        ` : `
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
            ${initial}
          </div>
        `}
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-gray-800 truncate">${fullName}</p>
          
          <p class="text-sm text-gray-500">เลขที่ ${student.student_number ? student.student_number : '-'} (${student.student_code})</p>

        </div>
        <div id="card-status-badge-${student.student_id}" class="flex-shrink-0">
          <span class="badge ${currentStatus.bg} ${currentStatus.color} text-sm">${currentStatus.text}</span>
        </div>
      </div>
      
      <div class="grid grid-cols-4 gap-2 mb-2">
        <button onclick="updateStudentStatus('${student.student_id}', 'present')" 
                class="btn btn-sm ${status === 'present' ? 'btn-success' : 'btn-outline-success'}">มา</button>
        <button onclick="updateStudentStatus('${student.student_id}', 'late')" 
                class="btn btn-sm ${status === 'late' ? 'btn-warning' : 'btn-outline-warning'}">สาย</button>
        <button onclick="updateStudentStatus('${student.student_id}', 'absent')" 
                class="btn btn-sm ${status === 'absent' ? 'btn-danger' : 'btn-outline-danger'}">ขาด</button>
        <button onclick="updateStudentStatus('${student.student_id}', 'leave')" 
                class="btn btn-sm ${status === 'leave' ? 'btn-info' : 'btn-outline-info'}">ลา</button>
      </div>
      
      <input type="text" 
             class="form-input text-sm" 
             placeholder="หมายเหตุ (ถ้ามี)" 
             value="${student.note || ''}"
             onchange="updateStudentNote('${student.student_id}', this.value)">
    </div>
  `;
}

/**
 * 6. Action: อัปเดตสถานะนักเรียน (ใน State และ UI)
 */
function updateStudentStatus(studentId, newStatus) {
  // 1. อัปเดต Global State
  const student = window.attendanceData.students.find(s => s.student_id === studentId);
  if (student) {
    student.status = newStatus;
  }
  
  // 2. อัปเดต UI (Desktop)
  const row = document.getElementById(`row-${studentId}`);
  if (row) {
    row.dataset.status = newStatus;
    // ลบคลาส active ทั้งหมด
    row.querySelectorAll('.btn-group button').forEach(btn => {
      btn.className = btn.className.replace(/btn-(success|warning|danger|info)/g, (match, p1) => `btn-outline-${p1}`);
    });
    // เพิ่มคลาส active ให้ปุ่มที่ถูก
    const activeBtn = row.querySelector(`button[onclick*="'${newStatus}'"]`);
    if (activeBtn) {
      activeBtn.className = activeBtn.className.replace(/btn-outline-(success|warning|danger|info)/g, (match, p1) => `btn-${p1}`);
    }
  }
  
  // 3. อัปเดต UI (Mobile)
  const card = document.getElementById(`card-${studentId}`);
  if (card) {
    card.dataset.status = newStatus;
    // ลบคลาส active ทั้งหมด
    card.querySelectorAll('.grid button').forEach(btn => {
      btn.className = btn.className.replace(/btn-(success|warning|danger|info)/g, (match, p1) => `btn-outline-${p1}`);
    });
    // เพิ่มคลาส active ให้ปุ่มที่ถูก
    const activeCardBtn = card.querySelector(`button[onclick*="'${newStatus}'"]`);
    if (activeCardBtn) {
      activeCardBtn.className = activeCardBtn.className.replace(/btn-outline-(success|warning|danger|info)/g, (match, p1) => `btn-${p1}`);
    }
    
    // อัปเดต Badge
    const statusInfo = {
      present: { text: 'มาเรียน', color: 'text-green-600', bg: 'bg-green-100' },
      late: { text: 'มาสาย', color: 'text-yellow-600', bg: 'bg-yellow-100' },
      absent: { text: 'ขาด', color: 'text-red-600', bg: 'bg-red-100' },
      leave: { text: 'ลา', color: 'text-blue-600', bg: 'bg-blue-100' },
      not_recorded: { text: 'ยังไม่บันทึก', color: 'text-gray-600', bg: 'bg-gray-100' }
    };
    const currentStatus = statusInfo[newStatus];
    document.getElementById(`card-status-badge-${studentId}`).innerHTML = 
      `<span class="badge ${currentStatus.bg} ${currentStatus.color} text-sm">${currentStatus.text}</span>`;
  }
  
  // 4. อัปเดต Summary
  updateAttendanceSummary();
}

/**
 * 7. Action: อัปเดตหมายเหตุ (ใน State)
 */
function updateStudentNote(studentId, note) {
  const student = window.attendanceData.students.find(s => s.student_id === studentId);
  if (student) {
    student.note = note;
  }
}

/**
 * 8. Action: จัดการทั้งหมด
 */
function handleBatchUpdateStatus(status) {
  window.attendanceData.students.forEach(student => {
    updateStudentStatus(student.student_id, status);
  });
}

/**
 * 9. Helper: อัปเดตตัวเลขสรุป
 */
function updateAttendanceSummary() {
  const students = window.attendanceData.students;
  const summary = { present: 0, late: 0, absent: 0, leave: 0, not_recorded: 0 };
  
  summary.not_recorded = students.filter(s => s.status === 'not_recorded' || !s.status).length;
  summary.present = students.filter(s => s.status === 'present').length;
  summary.late = students.filter(s => s.status === 'late').length;
  summary.absent = students.filter(s => s.status === 'absent').length;
  summary.leave = students.filter(s => s.status === 'leave').length;

  document.getElementById('summary-present').textContent = summary.present;
  document.getElementById('summary-late').textContent = summary.late;
  document.getElementById('summary-absent').textContent = summary.absent;
  document.getElementById('summary-leave').textContent = summary.leave;
  document.getElementById('summary-not_recorded').textContent = summary.not_recorded;
}

/**
 * 10. Action: บันทึกข้อมูลทั้งหมดลง Server
 */
async function handleSaveAllAttendance() {
  const { classId, date, students } = window.attendanceData;
  
  if (!classId || !date) {
    showToast('ข้อมูลไม่ครบถ้วน', 'error');
    return;
  }
  
  // 1. กรองข้อมูลเฉพาะที่จำเป็นต้องส่ง
  const recordsToSave = students.map(s => ({
    student_id: s.student_id,
    status: s.status,
    note: s.note || ''
  }));
  
  await waitForResponse(
    () => callServerFunction('batchSaveAttendance', classId, date, recordsToSave),
    'กำลังบันทึกข้อมูลการเข้าเรียน...',
    (result) => {
      if (result.success) {
        showToast('บันทึกข้อมูลสำเร็จ', 'success');
        // โหลดข้อมูลใหม่เพื่อให้แน่ใจว่าตรงกับ Server
        loadAttendanceData();
      }
    }
  );
}

/**
 * (Helper) เพิ่ม CSS สำหรับ btn-group (ถ้ายังไม่มี)
 */
function addAttendanceStyles() {
  const styleId = 'attendance-styles';
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.innerHTML = `
    .btn-group {
      display: inline-flex;
      border-radius: 0.375rem;
      overflow: hidden;
      border: 1px solid #d1d5db;
    }
    .btn-group .btn {
      border-radius: 0;
      border: none;
      border-right: 1px solid #d1d5db;
      padding-left: 0.75rem;
      padding-right: 0.75rem;
    }
    .btn-group .btn:last-child {
      border-right: none;
    }
    .btn-outline-success {
      color: #16a34a; background-color: white;
    }
    .btn-outline-success:hover {
      background-color: #f0fdf4;
    }
    .btn-outline-warning {
      color: #d97706; background-color: white;
    }
    .btn-outline-warning:hover {
      background-color: #fefce8;
    }
    .btn-outline-danger {
      color: #dc2626; background-color: white;
    }
    .btn-outline-danger:hover {
      background-color: #fef2f2;
    }
    .btn-outline-info {
      color: #2563eb; background-color: white;
    }
    .btn-outline-info:hover {
      background-color: #eff6ff;
    }

    /* [ ⭐️⭐️⭐️ เพิ่มส่วนนี้ ⭐️⭐️⭐️ ] */
    .btn-outline-secondary {
      color: #6b7280; /* gray-500 */
      background-color: white;
      border: 1px solid #d1d5db; /* gray-300 */
    }
    .btn-outline-secondary:hover {
      background-color: #f3f4f6; /* gray-100 */
    }
    /* [ ⭐️⭐️⭐️ สิ้นสุดส่วนที่เพิ่ม ⭐️⭐️⭐️ ] */
  `;
  document.head.appendChild(style);
}

// เรียกใช้ CSS เมื่อโหลด Script
addAttendanceStyles();

console.log('✅ JS-Pages-Attendance loaded successfully');
