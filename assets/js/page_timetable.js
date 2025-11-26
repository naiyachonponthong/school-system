
/**
 * ===================================
 * PAGE: TIMETABLE (ตารางสอน)
 * (เวอร์ชันแก้ไข: ⭐️ แก้ไข Layout ลายเซ็น ⭐️, Responsive, Combobox, ปุ่ม + แสดงตลอด)
 * ===================================
 */

// Global state for this page
window.timetableState = {
  allSlots: [],    // ตารางสอนทั้งหมด (สำหรับ Admin check)
  allTeachers: [], // รายชื่อครู (สำหรับ Admin dropdown)
  allSubjects: [], // รายวิชา (สำหรับ Modal)
  allClasses: [],  // ห้องเรียน (สำหรับ Modal)
  config: null,    // Config (คาบเวลา)
  currentTeacherSlots: [], // ตารางสอนของครูที่เลือก
  teacherData: null // ⭐️ เก็บข้อมูลของครูไว้สำหรับพิมพ์
};

/**
 * 1. Main Entry Function
 * (ตรวจสอบสิทธิ์ก่อน)
 */
async function renderTimetablePage() {
  const role = window.currentUser.role;
  
  // โหลดข้อมูลพื้นฐาน
  showLoading('กำลังโหลดข้อมูลตารางสอน...');
  try {
    const [teachersResult, subjectsResult, classesResult] = await Promise.all([
      callServerFunction('getTeachers'),
      callServerFunction('getSubjects'),
      callServerFunction('getClasses')
    ]);
    
    window.timetableState.allTeachers = teachersResult.success ? teachersResult.data : [];
    window.timetableState.allSubjects = subjectsResult.success ? subjectsResult.data : [];
    window.timetableState.allClasses = classesResult.success ? classesResult.data : [];

    // แยกการแสดงผลตาม Role
    if (role === 'admin' || role === 'registrar' || role === 'principal') {
      renderAdminTimetable_Entry();
    } else if (role === 'teacher' || role === 'homeroom') {
      renderTeacherTimetable_Entry();
    } else {
      showNoPermission();
    }
  } catch (error) {
    console.error('Error loading timetable data:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลพื้นฐาน', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * 2. [Admin] Render หน้าสำหรับเลือก (Filters)
 * (⭐️ แก้ไข: เปลี่ยนเป็น Combobox ⭐️)
 */
function renderAdminTimetable_Entry() {
  renderBreadcrumb(['หน้าแรก', 'จัดการระบบ', 'ตารางสอน']);
  
  // 1. สร้าง 'options' array สำหรับ Combobox
  const teacherOptions = window.timetableState.allTeachers
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
    .map(t => ({
      value: t.id,
      label: `${t.name} (${getRoleLabel(t.role)})` // เพิ่ม Role ให้ชัดเจนขึ้น
    }));

  const html = `
    <div class="card p-6 mb-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">จัดการตารางสอน</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div>
          ${renderFormField({ 
            name: 'teacher_id', 
            label: 'ครูผู้สอน (ค้นหาได้)',
            type: 'combobox', 
            required: true, 
            options: teacherOptions, 
            id: 'timetableTeacherSelect' // ⭐️ ใช้ ID เดิม
          })}
        </div>

        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="timetableYearSelect" class="form-select"></select>
        </div>
        <div>
          <label class="form-label">ภาคเรียน</label>
          <select class="form-select" id="timetableSemesterSelect">
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2">ภาคเรียนที่ 2</option>
          </select>
        </div>
      </div>
      <div class="mt-6 text-right">
        <button onclick="loadAdminTimetable()" class="btn btn-primary px-8">
          <i class="fas fa-search mr-2"></i>แสดงตารางสอน
        </button>
      </div>
    </div>
    <div id="timetableContainer" class="mt-6"></div>
  `;
  document.getElementById('pageContent').innerHTML = html;

  // ตั้งค่าปี/เทอม ปัจจุบัน
  setupDefaultYearSemester('timetableYearSelect', 'timetableSemesterSelect');
}

/**
 * 3. [Teacher] Render ตารางสอนของตัวเอง
 * (⭐️ แก้ไข: เรียกฟังก์ชัน _Web ⭐️)
 */
async function renderTeacherTimetable_Entry() {
  renderBreadcrumb(['หน้าแรก', 'ตารางสอน']);
  
  await waitForResponse(
    () => callServerFunction('getTeacherTimetable'),
    'กำลังโหลดตารางสอนของคุณ...',
    (result) => {
      if (result.success) {
        // ⭐️ 1. เก็บข้อมูลทั้งหมดไว้สำหรับพิมพ์
        window.timetableState.teacherData = result.data; 
        
        // ⭐️ 2. เรียกใช้ฟังก์ชัน _Web (ที่ไม่มีโลโก้)
        document.getElementById('pageContent').innerHTML = renderTeacherTimetableGrid_Web(result.data);
      } else {
        document.getElementById('pageContent').innerHTML = renderEmptyState(result.message);
      }
    }
  );
}

/**
 * 4. [Admin] โหลดข้อมูลตารางสอน (หลังจากกดปุ่ม)
 * (⭐️ แก้ไข: เพิ่ม Loading และ Combobox ID ⭐️)
 */
async function loadAdminTimetable() {
  // ⭐️ 1. เปลี่ยน cách ดึง ID จาก combobox ที่ซ่อนอยู่
  const teacherId = document.getElementById('combo_hidden_timetableTeacherSelect').value; 
  const year = document.getElementById('timetableYearSelect').value;
  const semester = document.getElementById('timetableSemesterSelect').value;

  if (!teacherId || !year || !semester) {
    showToast('กรุณาเลือก ครู, ปีการศึกษา และภาคเรียน', 'warning');
    return;
  }
  
  const container = document.getElementById('timetableContainer');
  
  // ⭐️ 2. (เพิ่ม) แสดง Loading spinner
  container.innerHTML = '<div class="text-center py-12"><i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i><p class="mt-2 text-gray-500">กำลังโหลดข้อมูล...</p></div>';
  
  await waitForResponse(
    () => Promise.all([
      callServerFunction('getTimetable', teacherId, year, semester),
      callServerFunction('getAllTimetableSlots', year, semester),
      callServerFunction('getConfig')
    ]),
    'กำลังโหลดข้อมูลตารางสอน...', // (Global Loading)
    (results) => {
      const [timetableResult, allSlotsResult, configResult] = results;
      
      if (!timetableResult.success || !configResult.success || !allSlotsResult.success) {
        container.innerHTML = renderEmptyState('ไม่สามารถโหลดข้อมูลได้');
        return;
      }
      
      window.timetableState.currentTeacherSlots = timetableResult.data;
      window.timetableState.allSlots = allSlotsResult.data;
      window.timetableState.config = configResult.data;
      
      const teacherName = window.timetableState.allTeachers.find(t => t.id === teacherId)?.name || '';
      
      container.innerHTML = renderAdminTimetableGrid(
        window.timetableState.currentTeacherSlots,
        window.timetableState.config,
        teacherName, year, semester
      );
    }
  );
}

/**
 * 5. [Admin] วาดตารางสอน (แบบแก้ไขได้)
 * (⭐️⭐️⭐️ แก้ไข: เพิ่มเช็คคาบชน + UI มือถือ + ปุ่ม + แสดงตลอด ⭐️⭐️⭐️)
 */
function renderAdminTimetableGrid(slots, config, teacherName, year, semester) {
  const periods = config.timetable_periods || [];
  const days = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

  let html = `
    <div class="card p-4 md:p-6">
      <div class="mb-4">
        <h3 class="text-xl font-bold text-gray-800">ตารางสอน: ${teacherName}</h3>
        <p class="text-sm text-gray-600">ภาคเรียนที่ ${semester} ปีการศึกษา ${year}</p>
      </div>

      <div class="overflow-x-auto border rounded-lg hidden md:block">
        <table class="data-table min-w-[800px]">
          <thead>
            <tr>
              <th class="w-1/6">คาบ/เวลา</th>
              ${days.map(day => `<th class="w-1/6 text-center">${day}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
  `;

  // ดึง ID ครูที่กำลังดูอยู่
  const teacherId = document.getElementById('combo_hidden_timetableTeacherSelect').value;

  if (periods.length === 0) {
    html += `
      <tr>
        <td colspan="${days.length + 1}" class="text-center py-8 text-gray-500">
          กรุณาไปที่ "ตั้งค่าระบบ" -> "ตั้งค่าคาบเวลา" เพื่อกำหนดคาบเรียนก่อน
        </td>
      </tr>
    `;
  }

  periods.forEach(period => {
    html += `<tr class="h-24">`;
    // คาบเวลา
    html += `
      <td class="p-2 align-top text-center border-r bg-gray-50">
        <div class="font-semibold text-sm">${period.label}</div>
        <div class="text-xs text-gray-500">${period.time || ''}</div>
      </td>
    `;
    
    // 5 วัน
    days.forEach((day, dayIndex) => {
      const dayNum = dayIndex + 1;
      const periodId = period.id;

      // Check 1: คาบนี้ ครูที่เลือก (teacherId) จองไว้หรือไม่?
      const slot = slots.find(s => s.day === dayNum && s.period === periodId);
      
      // Check 2: คาบนี้ ครูคนอื่น (ที่ไม่ใช่ teacherId) จองไว้หรือไม่?
      const conflictSlot = window.timetableState.allSlots.find(
          s => s.day === dayNum && s.period === periodId && s.teacher_id !== teacherId
      );
      
      html += `<td class="p-1 align-top border-r" data-day="${dayNum}" data-period="${periodId}">`;
      
      if (slot) {
        // Case 1: คาบของครูคนนี้ (สีฟ้า)
        html += `
          <div class="p-2 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 h-full relative group">
            <div class="font-semibold text-sm">${slot.subject_name}</div>
            <div class="text-xs font-mono">(${slot.subject_code || 'N/A'})</div>
            <div class="text-xs">${slot.class_name}</div>
            
            <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick="showAddTimetableSlotModal(${dayNum}, ${periodId}, '${slot.id}')" class="p-1 text-blue-600 hover:bg-blue-100 rounded" title="แก้ไข">
                <i class="fas fa-edit text-xs"></i>
              </button>
              <button onclick="handleDeleteTimetableSlot('${slot.id}')" class="p-1 text-red-600 hover:bg-red-100 rounded" title="ลบ">
                <i class="fas fa-trash text-xs"></i>
              </button>
            </div>
          </div>
        `;
      } else if (conflictSlot) {
        // Case 2: คาบชน! (สีเทา)
        html += `
          <div class="p-2 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 h-full relative group opacity-70" title="คาบเรียนนี้ถูกใช้แล้ว">
            <div class="font-semibold text-sm">(คาบชน)</div>
            <div class="text-xs">${conflictSlot.subject_name}</div>
            <div class="text-xs">${conflictSlot.class_name}</div>
            <div class="text-xs text-red-500 font-medium">ครู: ${conflictSlot.teacher_name}</div>
          </div>
        `;
      } else {
        // Case 3: คาบว่าง (แสดงปุ่ม + เพิ่ม)
        html += `
          <div class="h-full flex items-center justify-center">
            <button onclick="showAddTimetableSlotModal(${dayNum}, ${periodId})" class="btn btn-secondary btn-sm transition-opacity">
              <i class="fas fa-plus"></i> เพิ่ม
            </button>
          </div>
        `;
      }
      html += `</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`; // End of Desktop table

  // --- ⭐️⭐️⭐️ 2. MOBILE VIEW (List) ⭐️⭐️⭐️ ---
  html += `<div class="block md:hidden space-y-4">`;
  
  if (periods.length === 0) {
    html += `<p class="text-center py-8 text-gray-500">กรุณาไปที่ "ตั้งค่าระบบ" -> "ตั้งค่าคาบเวลา" เพื่อกำหนดคาบเรียนก่อน</p>`;
  }

  days.forEach((day, dayIndex) => {
    const dayNum = dayIndex + 1;
    html += `
      <div class="card p-0 overflow-hidden border">
          <div class="p-3 bg-gray-50 border-b">
              <h4 class="text-lg font-semibold text-gray-700">${day}</h4>
          </div>
          <div class="divide-y divide-gray-100">
    `;

    periods.forEach(period => {
      const periodId = period.id;
      const slot = slots.find(s => s.day === dayNum && s.period === periodId);
      const conflictSlot = window.timetableState.allSlots.find(
          s => s.day === dayNum && s.period === periodId && s.teacher_id !== teacherId
      );

      html += `<div class="p-3 flex items-center space-x-3">`;
      html += `
          <div class="w-16 text-center flex-shrink-0">
              <div class="font-semibold text-sm">${period.label}</div>
              <div class="text-xs text-gray-500">${period.time || ''}</div>
          </div>
          <div class="flex-1 min-w-0">
      `;

      if (slot) {
        // Case 1: Booked by current teacher
        html += `
          <div class="p-2 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
              <div class="font-semibold text-sm">${slot.subject_name}</div>
              <div class="text-xs font-mono">(${slot.subject_code || 'N/A'})</div>
              <div class="text-xs">${slot.class_name}</div>
          </div>
        `;
      } else if (conflictSlot) {
        // Case 2: Booked by someone else
        html += `
          <div class="p-2 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 opacity-70">
              <div class="font-semibold text-sm">(คาบชน) ${conflictSlot.subject_name}</div>
              <div class="text-xs text-red-500">ครู: ${conflictSlot.teacher_name}</div>
          </div>
        `;
      } else {
        // Case 3: Empty (Show nothing, just the add button)
        html += `
          <div class="text-gray-400 text-sm italic">-- ว่าง --</div>
        `;
      }
      
      html += `</div>`; // End flex-1

      // Action buttons for mobile
      html += `<div class="flex-shrink-0">`;
      if (slot) {
          html += `
              <button onclick="showAddTimetableSlotModal(${dayNum}, ${periodId}, '${slot.id}')" class="p-2 text-blue-600 hover:bg-blue-100 rounded" title="แก้ไข">
                  <i class="fas fa-edit"></i>
              </button>
              <button onclick="handleDeleteTimetableSlot('${slot.id}')" class="p-2 text-red-600 hover:bg-red-100 rounded" title="ลบ">
                  <i class="fas fa-trash"></i>
              </button>
          `;
      } else if (!conflictSlot) {
          // Only show Add if NO conflict
          html += `
              <button onclick="showAddTimetableSlotModal(${dayNum}, ${periodId})" class="btn btn-secondary btn-sm" title="เพิ่ม">
                  <i class="fas fa-plus"></i>
              </button>
          `;
      } else {
          // Show disabled icon if conflict
           html += `
              <button class="p-2 text-gray-400 cursor-not-allowed" title="คาบชน" disabled>
                  <i class="fas fa-ban"></i>
              </button>
          `;
      }
      html += `</div>`; // End actions

      html += `</div>`; // End item row
    });

    html += `</div></div>`; // End card
  });

  html += `</div>`; // End mobile view
  html += `</div>`; // End card wrapper
  return html;
}

/**
 * ⭐️⭐️⭐️ 6.1 [Teacher] วาดตารางสอน (หน้าเว็บ - ไม่มีโลโก้ - รองรับมือถือ) ⭐️⭐️⭐️
 * (⭐️⭐️⭐️ นี่คือฟังก์ชันที่แก้ไข Bug ครับ ⭐️⭐️⭐️)
 */
function renderTeacherTimetableGrid_Web(data) {
  const { timetable, teacherName, year, semester, periods, config } = data;
  const days = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

  // ⭐️⭐️⭐️ START: แก้ไข Bug - เพิ่มการประกาศตัวแปร ⭐️⭐️⭐️
  let html = `
    <div class="card p-4 md:p-6">
      
      <div class="no-print flex justify-between items-center mb-4">
        <div>
          <h3 class="text-xl font-bold text-gray-800">ตารางสอนของคุณ: ${teacherName}</h3>
          <p class="text-sm text-gray-600">ภาคเรียนที่ ${semester} ปีการศึกษา ${year}</p>
        </div>
        <button onclick="handlePrintTimetable()" class="btn btn-primary">
          <i class="fas fa-print mr-2"></i>พิมพ์ตารางสอน
        </button>
      </div>
      
      <div id="timetable-web-area">
        
        <div class="overflow-x-auto border rounded-lg hidden md:block">
          <table class="data-table min-w-[800px]">
            <thead>
              <tr>
                <th class="w-1/6">คาบ/เวลา</th>
                ${days.map(day => `<th class="w-1/6 text-center">${day}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
  `;
  // ⭐️⭐️⭐️ END: แก้ไข Bug ⭐️⭐️⭐️

  // 3. สร้างแถวคาบเวลา (Desktop)
  if (!periods || periods.length === 0) {
    html += `
      <tr>
        <td colspan="${days.length + 1}" class="text-center py-8 text-gray-500">
          ไม่พบข้อมูลคาบเวลา (กรุณาติดต่อผู้ดูแลระบบเพื่อตั้งค่า)
        </td>
      </tr>
    `;
  } else {
    // สร้างตารางตามปกติ
    (periods || []).forEach(period => {
      html += `<tr class="h-20">`;
      html += `
        <td class="p-2 align-top text-center border-r bg-gray-50">
          <div class="font-semibold text-sm">${period.label}</div>
          <div class="text-xs text-gray-500">${period.time || ''}</div>
        </td>
      `;
      
      days.forEach((day, dayIndex) => {
        const slot = (timetable || []).find(s => s.day === (dayIndex + 1) && s.period === period.id);
        
        html += `<td class="p-1 align-top border-r">`;
        if (slot) {
          // ถ้ามีคาบสอน
          html += `
            <div class="p-2 rounded-lg bg-blue-50 text-blue-800 h-full">
              <div class="font-semibold text-sm">${slot.subject_name}</div>
              <div class="text-xs font-mono">(${slot.subject_code || 'N/A'})</div>
              <div class="text-xs">${slot.class_name}</div>
            </div>
          `;
        } else {
          // คาบว่าง
          html += `<div></div>`;
        }
        html += `</td>`;
      });
      html += `</tr>`;
    });
  }

  html += `</tbody></table></div>`; // ปิด table-responsive

  // --- ⭐️⭐️⭐️ 2.2 MOBILE VIEW (List) ⭐️⭐️⭐️ ---
  html += `<div class="block md:hidden space-y-4">`;
  
  if (!periods || periods.length === 0) {
    html += `<p class="text-center py-8 text-gray-500">ไม่พบข้อมูลคาบเวลา (กรุณาติดต่อผู้ดูแลระบบเพื่อตั้งค่า)</p>`;
  }

  days.forEach((day, dayIndex) => {
    const dayNum = dayIndex + 1;
    html += `
      <div class="card p-0 overflow-hidden border">
          <div class="p-3 bg-gray-50 border-b">
              <h4 class="text-lg font-semibold text-gray-700">${day}</h4>
          </div>
          <div class="divide-y divide-gray-100">
    `;

    (periods || []).forEach(period => {
      const periodId = period.id;
      const slot = (timetable || []).find(s => s.day === dayNum && s.period === periodId);

      html += `<div class="p-3 flex items-center space-x-3">`;
      html += `
          <div class="w-16 text-center flex-shrink-0">
              <div class="font-semibold text-sm">${period.label}</div>
              <div class="text-xs text-gray-500">${period.time || ''}</div>
          </div>
          <div class="flex-1 min-w-0">
      `;

      if (slot) {
        // Case 1: Booked by current teacher
        html += `
          <div class="p-2 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
              <div class="font-semibold text-sm">${slot.subject_name}</div>
              <div class="text-xs font-mono">(${slot.subject_code || 'N/A'})</div>
              <div class="text-xs">${slot.class_name}</div>
          </div>
        `;
      } else {
        // Case 2: Empty
        html += `
          <div class="text-gray-400 text-sm italic">-- ว่าง --</div>
        `;
      }
      
      html += `</div>`; // End flex-1
      html += `</div>`; // End item row
    });

    html += `</div></div>`; // End card
  });

  html += `</div>`; // End mobile view
  
  html += `</div></div>`; // ปิด web-area และ card
  
  return html;
}
// ⭐️⭐️⭐️ END: ฟังก์ชัน 6.1 ⭐️⭐️⭐️

/**
 * ⭐️⭐️⭐️ 6.2 [Teacher] - สำหรับหน้าพิมพ์ (มีโลโก้) ⭐️⭐️⭐️
 * (⭐️⭐️⭐️ แก้ไข: จัด Layout ลายเซ็น ซ้าย/ขวา ⭐️⭐️⭐️)
 */
function renderTeacherTimetableGrid_Print(data) {
  const { timetable, teacherName, year, semester, periods, config } = data;
  const days = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
  
  // --- ส่วนหัวกระดาษ (สำหรับพิมพ์เท่านั้น) ---
  const printHeader = `
    <div id="print-header-timetable" class="text-center mb-4">
      <img src="${config.school_logo_url || ''}" alt="Logo" 
           class="h-20 w-20 object-contain inline-block mb-2">
      <h2 class="text-lg font-bold">${config.school_name || 'โรงเรียน'}</h2>
      <p class="text-md">ตารางสอน ${teacherName}</p>
      <p class="text-md">ภาคเรียนที่ ${semester} ปีการศึกษา ${year}</p>
    </div>
  `;

  // --- ส่วนท้ายกระดาษ (สำหรับพิมพ์เท่านั้น) ---
  // ⭐️ 1. แก้ไข Layout Footer เป็น Flexbox (Inline Style)
  const printFooter = `
    <div id="print-footer-timetable" style="font-size: 11px; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #ccc;">
      <div style="display: flex; justify-content: space-between; text-align: center; width: 100%;">
        <div style="width: 45%;">
          <p style="margin-bottom: 2rem;">........................................................</p>
          <p>( ${teacherName || '...........................................'} )</p>
          <p>ครูผู้สอน</p>
        </div>
        <div style="width: 45%;">
          <p style="margin-bottom: 2rem;">........................................................</p>
          <p>( ${config.principal_name || '...........................................'} )</p>
          <p>ผู้อำนวยการ ${config.school_name || ''}</p>
        </div>
      </div>
    </div>
  `;
  
  // --- โครงสร้าง HTML หลัก ---
  let tableHtml = `<div id="timetable-print-area">`;
  
  tableHtml += printHeader; // ⭐️ แสดงโลโก้
  
  tableHtml += `
    <div class="overflow-x-auto border rounded-lg">
      <table class="data-table min-w-[800px]">
        <thead>
          <tr>
            <th class="w-1/6">คาบ/เวลา</th>
            ${days.map(day => `<th class="w-1/6 text-center">${day}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  // สร้างแถวคาบเวลา
  if (!periods || periods.length === 0) {
    tableHtml += `<tr><td colspan="${days.length + 1}" class="text-center py-8">ไม่พบข้อมูลคาบเวลา</td></tr>`;
  } else {
    (periods || []).forEach(period => {
      tableHtml += `<tr class="h-20">`;
      tableHtml += `
        <td class="p-2 align-top text-center border-r bg-gray-50">
          <div class="font-semibold text-sm">${period.label}</div>
          <div class="text-xs text-gray-500">${period.time || ''}</div>
        </td>
      `;
      
      days.forEach((day, dayIndex) => {
        const slot = (timetable || []).find(s => s.day === (dayIndex + 1) && s.period === period.id);
        
        tableHtml += `<td class="p-1 align-top border-r">`;
        if (slot) {
          tableHtml += `
            <div class="p-2 rounded-lg bg-blue-50 text-blue-800 h-full">
              <div class="font-semibold text-sm">${slot.subject_name}</div>
              <div class="text-xs font-mono">(${slot.subject_code || 'N/A'})</div>
              <div class="text-xs">${slot.class_name}</div>
            </div>
          `;
        } else {
          tableHtml += `<div></div>`;
        }
        tableHtml += `</td>`;
      });
      tableHtml += `</tr>`;
    });
  }

  tableHtml += `</tbody></table></div>`; // ปิด table-responsive
  tableHtml += printFooter; // ปิด footer
  tableHtml += `</div>`; // ปิด print-area
  
  return tableHtml;
}
// ⭐️⭐️⭐️ END: ฟังก์ชัน 6.2 ⭐️⭐️⭐️


/**
 * 7. [Admin] แสดง Modal เพิ่ม/แก้ไข คาบสอน
 * (⭐️⭐️⭐️ แก้ไข: เปลี่ยน type เป็น combobox ⭐️⭐️⭐️)
 */
function showAddTimetableSlotModal(day, period, slotId = null) {
  const { allSubjects, allClasses, currentTeacherSlots, config } = window.timetableState;
  const teacherId = document.getElementById('combo_hidden_timetableTeacherSelect').value;
  
  const slot = slotId ? currentTeacherSlots.find(s => s.id === slotId) : null;
  const title = slot ? 'แก้ไขคาบสอน' : 'เพิ่มคาบสอน';

  // สร้าง Options
  const subjectOptions = allSubjects
    .filter(s => s.teacher_id === teacherId && s.status === 'active')
    .map(s => ({ value: s.id, label: `(${s.subject_code}) ${s.subject_name} [${s.level}]` }));
    
  const classOptions = allClasses
    .filter(c => c.status === 'active')
    .sort((a, b) => a.level.localeCompare(b.level, 'th') || a.room.localeCompare(b.room, 'th'))
    .map(c => ({ value: c.id, label: `${c.level}/${c.room} (ปี ${c.year})` }));

  const fields = [
    // ⭐️ 1. เปลี่ยนจาก searchable-select เป็น combobox
    { name: 'subject_id', label: 'วิชา (ที่ครูคนนี้สอน)', type: 'combobox', required: true, options: subjectOptions, colSpan: 3, id: 'modal_subject_select' },
    // ⭐️ 2. เปลี่ยนจาก searchable-select เป็น combobox
    { name: 'class_id', label: 'ห้องเรียน', type: 'combobox', required: true, options: classOptions, colSpan: 3, id: 'modal_class_select' }
  ];
  
  const initialData = slot ? {
    subject_id: slot.subject_id,
    class_id: slot.class_id
  } : {};

  showFormModal(title, fields, async (data) => {
    const year = document.getElementById('timetableYearSelect').value;
    const semester = document.getElementById('timetableSemesterSelect').value;
    
    const slotData = {
      ...data,
      id: slotId,
      teacher_id: teacherId,
      day: day,
      period: period,
      year: year,
      semester: semester
    };
    
    // (ฟังก์ชันใน JS-Main.js จะจัดการเรื่อง Loading/Toast)
    await waitForResponse(
      () => callServerFunction('saveTimetableSlot', slotData),
      'กำลังบันทึกข้อมูล...',
      (result) => {
        if (result.success) {
          showToast('บันทึกสำเร็จ', 'success');
          loadAdminTimetable(); // โหลดตารางใหม่
        }
        // (หาก result.success == false, waitForResponse จะแสดง Toast แจ้ง error ให้อัตโนมัติ)
      }
    );
  }, initialData);
}

/**
 * 8. [Admin] ลบคาบสอน
 */
function handleDeleteTimetableSlot(slotId) {
  showConfirmModal(
    'ยืนยันการลบ',
    'คุณต้องการลบคาบสอนนี้ใช่หรือไม่?',
    async () => {
      await waitForResponse(
        () => callServerFunction('deleteTimetableSlot', slotId),
        'กำลังลบ...',
        (result) => {
          if (result.success) {
            showToast('ลบสำเร็จ', 'success');
            loadAdminTimetable(); // โหลดตารางใหม่
          }
        }
      );
    },
    { confirmText: 'ลบ', confirmColor: 'red' }
  );
}

/**
 * 9. [Teacher] สั่งพิมพ์
 * (⭐️⭐️⭐️ แก้ไข: เรียกใช้ฟังก์ชัน _Print ⭐️⭐️⭐️)
 */
function handlePrintTimetable() {
  // 1. ดึงข้อมูลที่เก็บไว้
  const data = window.timetableState.teacherData;
  if (!data) {
    showToast('ไม่พบข้อมูลตารางสอนสำหรับพิมพ์', 'error');
    return;
  }
  
  // 2. สร้าง HTML สำหรับพิมพ์ (ที่มีโลโก้)
  const printHtml = renderTeacherTimetableGrid_Print(data);
  
  // 3. เปิดหน้าต่างใหม่
  const printWindow = window.open('', '_blank');
  
  // 4. เขียนเนื้อหาลงในหน้าต่างใหม่
  printWindow.document.write('<html><head><title>พิมพ์ตารางสอน</title>');
  
  // 5. ⭐️ คัดลอก CSS ทั้งหมดจากหน้าหลักไปใส่ในหน้าพิมพ์ ⭐️
  const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
  styles.forEach(style => {
    printWindow.document.write(style.outerHTML);
  });
  
  // 6. เพิ่มคลาส .timetable-print-page เพื่อบังคับใช้ @page landscape
  printWindow.document.write('</head><body class="timetable-print-page">'); 
  printWindow.document.write(printHtml);
  printWindow.document.write('</body></html>');
  
  // 7. สั่งพิมพ์
  printWindow.document.close(); // ⭐️ ปิด document ก่อนพิมพ์
  
  // ⭐️⭐️⭐️ START: แก้ไข ⭐️⭐️⭐️
  // ใช้ requestAnimationFrame เพื่อให้แน่ใจว่า CSS ถูก render ก่อนพิมพ์
  printWindow.onload = function() {
    printWindow.requestAnimationFrame(() => {
      printWindow.focus(); // Focus ที่หน้าต่างใหม่
      printWindow.print(); // สั่งพิมพ์
      printWindow.close(); // ปิดอัตโนมัติ
    });
  };
  // ⭐️⭐️⭐️ END: แก้ไข ⭐️⭐️⭐️
}

/**
 * 10. Helper: ตั้งค่าปี/เทอม เริ่มต้น
 */
async function setupDefaultYearSemester(yearSelectId, semesterSelectId) {
  try {
    const configResult = await callServerFunction('getConfig');
    if (!configResult.success) return;

    const config = configResult.data;
    const yearSelect = document.getElementById(yearSelectId);
    const semesterSelect = document.getElementById(semesterSelectId);

    const currentYear = config.current_year || (new Date().getFullYear() + 543).toString();
    const currentSemester = config.current_semester || '1';

    // สร้าง Options ปี (ถ้ายังไม่มี)
    if (yearSelect.options.length <= 1) {
      const classesResult = await callServerFunction('getClasses');
      let availableYears = [];
      if (classesResult.success && classesResult.data.length > 0) {
        availableYears = [...new Set(classesResult.data.map(c => c.year))];
        availableYears.sort((a, b) => b.localeCompare(a, 'th'));
      }
      if (!availableYears.includes(currentYear)) {
        availableYears.unshift(currentYear);
      }
      yearSelect.innerHTML = availableYears.map(y => `<option value="${y}">${y}</option>`).join('');
    }
    
    yearSelect.value = currentYear;
    semesterSelect.value = currentSemester;

  } catch (error) {
    console.warn("Could not set default year/semester:", error);
  }
}

/**
 * ===================================
 * ⭐️⭐️⭐️ START: 11. [Student] Entry Point ⭐️⭐️⭐️
 * ===================================
 */
async function renderStudentTimetablePage() {
  renderBreadcrumb(['หน้าแรก', 'ตารางเรียน']);
  
  await waitForResponse(
    () => callServerFunction('getStudentTimetable'),
    'กำลังโหลดตารางเรียนของคุณ...',
    (result) => {
      if (result.success) {
        document.getElementById('pageContent').innerHTML = renderStudentTimetableGrid(result.data);
      } else {
        document.getElementById('pageContent').innerHTML = renderEmptyState(result.message);
      }
    }
  );
}

/**
 * ===================================
 * ⭐️⭐️⭐️ START: 12. [Student] วาดตารางเรียน (Read-only) ⭐️⭐️⭐️
 * ===================================
 */
function renderStudentTimetableGrid(data) {
  const { timetable, student, classInfo, config } = data;
  const periods = config.timetable_periods || [];
  const days = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

  const className = classInfo ? `${classInfo.level}/${classInfo.room}` : 'N/A';
  
  let html = `
    <div class="card p-4 md:p-6">
      
      <div class="flex justify-between items-center mb-4">
        <div>
          <h3 class="text-xl font-bold text-gray-800">ตารางเรียน: ${className}</h3>
          <p class="text-sm text-gray-600">ภาคเรียนที่ ${config.current_semester} ปีการศึกษา ${config.current_year}</p>
        </div>
      </div>
      
      <div id="timetable-web-area">
        
        <div class="overflow-x-auto border rounded-lg hidden md:block">
          <table class="data-table min-w-[800px]">
            <thead>
              <tr>
                <th class="w-1/6">คาบ/เวลา</th>
                ${days.map(day => `<th class="w-1/6 text-center">${day}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
  `;

  // 3. สร้างแถวคาบเวลา (Desktop)
  if (!periods || periods.length === 0) {
    html += `
      <tr>
        <td colspan="${days.length + 1}" class="text-center py-8 text-gray-500">
          ไม่พบข้อมูลคาบเวลา
        </td>
      </tr>
    `;
  } else {
    // สร้างตารางตามปกติ
    (periods || []).forEach(period => {
      html += `<tr class="h-20">`;
      html += `
        <td class="p-2 align-top text-center border-r bg-gray-50">
          <div class="font-semibold text-sm">${period.label}</div>
          <div class="text-xs text-gray-500">${period.time || ''}</div>
        </td>
      `;
      
      days.forEach((day, dayIndex) => {
        const slot = (timetable || []).find(s => s.day === (dayIndex + 1) && s.period === period.id);
        
        html += `<td class="p-1 align-top border-r">`;
        if (slot) {
          // ถ้ามีคาบสอน
          html += `
            <div class="p-2 rounded-lg bg-green-50 text-green-800 h-full">
              <div class="font-semibold text-sm">${slot.subject_name}</div>
              <div class="text-xs font-mono">(${slot.subject_code || 'N/A'})</div>
              <div class="text-xs text-gray-600">ครู: ${slot.teacher_name}</div>
            </div>
          `;
        } else {
          // คาบว่าง
          html += `<div></div>`;
        }
        html += `</td>`;
      });
      html += `</tr>`;
    });
  }

  html += `</tbody></table></div>`; // ปิด table-responsive

  // --- ⭐️ 2.2 MOBILE VIEW (List) ⭐️ ---
  html += `<div class="block md:hidden space-y-4">`;
  
  if (!periods || periods.length === 0) {
    html += `<p class="text-center py-8 text-gray-500">ไม่พบข้อมูลคาบเวลา</p>`;
  }

  days.forEach((day, dayIndex) => {
    const dayNum = dayIndex + 1;
    html += `
      <div class="card p-0 overflow-hidden border">
          <div class="p-3 bg-gray-50 border-b">
              <h4 class="text-lg font-semibold text-gray-700">${day}</h4>
          </div>
          <div class="divide-y divide-gray-100">
    `;

    (periods || []).forEach(period => {
      const periodId = period.id;
      const slot = (timetable || []).find(s => s.day === dayNum && s.period === periodId);

      html += `<div class="p-3 flex items-center space-x-3">`;
      html += `
          <div class="w-16 text-center flex-shrink-0">
              <div class="font-semibold text-sm">${period.label}</div>
              <div class="text-xs text-gray-500">${period.time || ''}</div>
          </div>
          <div class="flex-1 min-w-0">
      `;

      if (slot) {
        // Case 1: มีวิชาเรียน
        html += `
          <div class="p-2 rounded-lg bg-green-50 text-green-800 border border-green-200">
              <div class="font-semibold text-sm">${slot.subject_name}</div>
              <div class="text-xs font-mono">(${slot.subject_code || 'N/A'})</div>
              <div class="text-xs text-gray-600">ครู: ${slot.teacher_name}</div>
          </div>
        `;
      } else {
        // Case 2: ว่าง
        html += `
          <div class="text-gray-400 text-sm italic">-- ว่าง --</div>
        `;
      }
      
      html += `</div>`; // End flex-1
      html += `</div>`; // End item row
    });

    html += `</div></div>`; // End card
  });

  html += `</div>`; // End mobile view
  
  html += `</div></div>`; // ปิด web-area และ card
  
  return html;
}

console.log('✅ JS-Pages-Timetable loaded successfully');
