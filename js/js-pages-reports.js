
/**
 * ===================================
 * PAGE: REPORTS (รายงาน)
 * (เวอร์ชันอัปเดต: เพิ่ม ปพ.6 และตั้งค่า Default ปี/เทอม ปัจจุบัน)
 * ===================================
 */

/**
 * 1. Render หน้าเมนูหลักของรายงาน
 * (แก้ไข: เพิ่มเมนู ปพ.6)
 */
function renderReportsPage() {
  renderBreadcrumb(['หน้าแรก', 'รายงาน']);
  
  const reportsMenu = [
    { title: 'รายงานสถิตินักเรียน', icon: 'fas fa-user-graduate', color: 'blue', action: 'renderReport_StudentList_Filters', desc: 'พิมพ์รายชื่อนักเรียนตามห้องเรียน' },
    { title: 'รายงานผลการเรียน', icon: 'fas fa-chart-line', color: 'green', action: 'renderReport_Grade_Filters', desc: 'สรุปเกรดเฉลี่ยของนักเรียน' },
    { title: 'รายงานการเข้าเรียน', icon: 'fas fa-calendar-check', color: 'yellow', action: 'renderReport_Attendance_Filters', desc: 'สรุปสถิติการมาเรียน' },
    { title: 'รายงานพฤติกรรม', icon: 'fas fa-heart', color: 'red', action: 'renderReport_Behavior_Filters', desc: 'สรุปคุณลักษณะอันพึงประสงค์' },
    { title: 'รายงานกิจกรรม', icon: 'fas fa-running', color: 'purple', action: 'renderReport_Activity_Filters', desc: 'สรุปกิจกรรมพัฒนาผู้เรียน' },
    // ⭐️ [แก้ไข] เปลี่ยนชื่อให้ชัดเจนขึ้น
    { title: 'พิมพ์ ปพ.5 (รายบุคคล)', icon: 'fas fa-file-alt', color: 'indigo', action: 'renderPP5SelectionPage', desc: 'แบบรายงานผลการพัฒนาคุณภาพผู้เรียน' },
    // ⭐️ [เพิ่มใหม่] รายงาน ปพ.6
    { title: 'พิมพ์ ปพ.6 (รายบุคคล)', icon: 'fas fa-file-pdf', color: 'orange', action: 'renderPP6SelectionPage', desc: 'แบบรายงานประจำตัวนักเรียน' }
  ];
  
  const html = `
    <h2 class="text-2xl font-bold text-gray-800 mb-6">รายงานต่างๆ</h2>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${reportsMenu.map(report => `
        <div class="card p-6 cursor-pointer hover:shadow-lg transition-shadow" onclick="${report.action}()">
          <div class="flex items-center space-x-4">
            <div class="bg-${report.color}-100 rounded-full p-4">
              <i class="${report.icon} text-2xl text-${report.color}-600"></i>
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-gray-800">${report.title}</h3>
              <p class="text-sm text-gray-500">${report.desc}</p>
            </div>
            <i class="fas fa-chevron-right text-gray-400"></i>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
}

// ===================================
// (HELPER) ฟังก์ชันโหลด Dropdown ห้องเรียน
// ===================================
async function _loadClassDropdown(selectId) {
  const classSelect = document.getElementById(selectId);
  if (!classSelect) return;
  
  classSelect.innerHTML = '<option value="all">-- ทุกห้องเรียน (ที่รับผิดชอบ) --</option>';

  try {
    const classesResult = await callServerFunction('getClasses');
    if (classesResult.success) {
      const role = window.currentUser.role;
      const userId = window.currentUser.id;
      let classesToShow = [];
      
      const adminRoles = ['admin', 'registrar', 'principal'];
      if (adminRoles.includes(role)) {
        classesToShow = classesResult.data;
      } else if (role === 'homeroom') {
        classesToShow = classesResult.data.filter(c => c.homeroom_teacher_id === userId);
      } else if (role === 'teacher') {
        classesToShow = classesResult.data;
      }
      
      classesToShow
        .filter(c => c.status === 'active')
        .sort((a, b) => a.level.localeCompare(b.level, 'th') || a.room.localeCompare(b.room, 'th'))
        .forEach(cls => {
          classSelect.innerHTML += `<option value="${cls.id}">${cls.level}/${cls.room} (ปี ${cls.year})</option>`;
        });
    }
  } catch (e) {
    showToast('ไม่สามารถโหลดข้อมูลห้องเรียนได้', 'error');
  }
}

// (HELPER) ฟังก์ชันวาดหัวตาราง/ปุ่มพิมพ์
function _renderReportContainer(reportTitle, filterText, tableHtml) {
  return `
    <div class="card p-4 md:p-6">
      <div class="no-print mb-6 flex justify-between items-center">
        <button onclick="renderReportsPage()" class="btn btn-secondary">
          <i class="fas fa-arrow-left mr-2"></i>กลับไปเมนูรายงาน
        </button>
        <button onclick="window.print()" class="btn btn-primary">
          <i class="fas fa-print mr-2"></i>พิมพ์รายงาน
        </button>
      </div>
      
      <div id="report-print-area">
        <div class="print-header text-center mb-4">
          <h3 class="text-xl font-bold">${reportTitle}</h3>
          <p class="text-md">${filterText}</p>
        </div>
        
        <div class="overflow-x-auto">
          ${tableHtml}
        </div>
      </div>
    </div>
  `;
}

// ===================================
// REPORT 1: รายงานสถิตินักเรียน (รายชื่อ)
// ===================================
async function renderReport_StudentList_Filters() {
  renderBreadcrumb(['หน้าแรก', 'รายงาน', 'รายงานสถิตินักเรียน']);
  
  const html = `
    <div class="card p-6 mb-6 no-print">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">รายงานสถิตินักเรียน</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="form-label">ห้องเรียน</label>
          <select id="reportClassSelect" class="form-select"></select>
        </div>
        <div>
          <label class="form-label">สถานะนักเรียน</label>
          <select class="form-select" id="reportStatusSelect">
            <option value="active">กำลังศึกษา</option>
            <option value="all">ทุกสถานะ</option>
            <option value="graduated">จบการศึกษา</option>
            <option value="transferred">ย้ายโรงเรียน</option>
            <option value="dropped">พ้นสภาพ</option>
          </select>
        </div>
        <div class="md:mt-[28px]">
          <button onclick="loadStudentListReport()" class="btn btn-primary w-full">
            <i class="fas fa-search mr-2"></i>สร้างรายงาน
          </button>
        </div>
      </div>
    </div>
    <div id="reportResultContainer" class="mt-6"></div>
  `;
  document.getElementById('pageContent').innerHTML = html;
  
  showLoading('กำลังโหลดข้อมูลนักเรียน...');
  try {
    await _loadClassDropdown('reportClassSelect');
  } catch(e) {
    console.error(e);
  } finally {
    hideLoading();
  }
}

async function loadStudentListReport() {
  const classId = document.getElementById('reportClassSelect').value;
  const status = document.getElementById('reportStatusSelect').value;
  const filters = {
    classId: classId === 'all' ? null : classId,
    status: status === 'all' ? null : status
  };
  
  const resultContainer = document.getElementById('reportResultContainer');
  resultContainer.innerHTML = ''; 

  await waitForResponse(
    () => callServerFunction('getStudentListReportData', filters),
    'กำลังสร้างรายงาน...',
    (result) => {
      if (result.success) {
        const classSelect = document.getElementById('reportClassSelect');
        const statusSelect = document.getElementById('reportStatusSelect');
        const classText = filters.classId ? classSelect.options[classSelect.selectedIndex].text : "ทุกห้องเรียน";
        const statusText = statusSelect.options[statusSelect.selectedIndex].text;
        
        const columns = [
          { label: 'ลำดับ', field: 'index', className: 'w-12 text-center' },
          { label: 'รหัสนักเรียน', field: 'student_code', className: 'w-24 font-mono' },
          { label: 'ชื่อ-นามสกุล', field: 'full_name' },
          { label: 'ชั้น/ห้อง', field: 'class_name', className: 'w-24 text-center' },
          { label: 'เลขที่', field: 'student_number', className: 'w-16 text-center' },
          { label: 'สถานะ', field: 'status', className: 'w-24 text-center' }
        ];
        
        const statusMap = {
          'active': 'กำลังศึกษา',
          'graduated': 'จบการศึกษา',
          'transferred': 'ย้ายโรงเรียน',
          'dropped': 'พ้นสภาพ',
          'inactive': 'ปิดใช้งาน'
        };

        const tableData = result.data.map((student, index) => ({
          index: index + 1,
          student_code: student.student_code,
          full_name: `${student.prefix || ''} ${student.firstname} ${student.lastname}`.trim(),
          class_name: `${student.level}/${student.room}`,
          student_number: student.student_number || '-',
          status: statusMap[student.status] || student.status
        }));

        const tableHtml = `
          <table class="print-table data-table">
            <thead> <tr> ${columns.map(col => `<th class="${col.className || ''}">${col.label}</th>`).join('')} </tr> </thead>
            <tbody>
              ${tableData.length > 0 ? tableData.map(row => `
                <tr> ${columns.map(col => `<td class="${col.className || ''}">${row[col.field]}</td>`).join('')} </tr>
              `).join('') : `<tr><td colspan="${columns.length}" class="text-center py-6 text-gray-500">ไม่พบข้อมูล</td></tr>`}
            </tbody>
          </table>
        `;
        
        resultContainer.innerHTML = _renderReportContainer(
          "รายงานรายชื่อนักเรียน",
          `ห้องเรียน: ${classText} | สถานะ: ${statusText} | ทั้งหมด ${tableData.length} คน`,
          tableHtml
        );
      } else {
        resultContainer.innerHTML = renderEmptyState(result.message || 'ไม่สามารถโหลดรายงานได้', 'fas fa-exclamation-triangle');
      }
    }
  );
}

// ===================================
// REPORT 2: รายงานผลการเรียน (GPA)
// ===================================
async function renderReport_Grade_Filters() {
  renderBreadcrumb(['หน้าแรก', 'รายงาน', 'รายงานผลการเรียน']);
  
  const html = `
    <div class="card p-6 mb-6 no-print">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">รายงานผลการเรียน (สรุป)</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="form-label">ห้องเรียน</label>
          <select id="reportClassSelect" class="form-select"></select>
        </div>
        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="reportYearSelect" class="form-select"></select>
        </div>
        <div>
          <label class="form-label">ภาคเรียน</label>
          <select class="form-select" id="reportSemesterSelect">
            <option value="all">ทั้งปีการศึกษา</option>
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2">ภาคเรียนที่ 2</option>
          </select>
        </div>
        <div class="md:mt-[28px]">
          <button onclick="loadGradeSummaryReport()" class="btn btn-primary w-full">
            <i class="fas fa-search mr-2"></i>สร้างรายงาน
          </button>
        </div>
      </div>
    </div>
    <div id="reportResultContainer" class="mt-6"></div>
  `;
  document.getElementById('pageContent').innerHTML = html;
  
  showLoading('กำลังโหลดข้อมูล...');
  try {
    await _loadClassDropdown('reportClassSelect');
    
    // ⭐️ [แก้ไข] โหลด Config และ Classes พร้อมกันเพื่อตั้งค่า Default
    const [classesResult, configResult] = await Promise.all([
      callServerFunction('getClasses'),
      callServerFunction('getConfig')
    ]);

    const yearSelect = document.getElementById('reportYearSelect');
    const semSelect = document.getElementById('reportSemesterSelect');
    
    // ตั้งค่าปี
    let currentYear = new Date().getFullYear() + 543;
    if (configResult.success && configResult.data.current_year) {
       currentYear = configResult.data.current_year;
    }
    
    if (classesResult.success && classesResult.data.length > 0) {
      const availableYears = [...new Set(classesResult.data.map(c => c.year))].sort((a, b) => b.localeCompare(a, 'th'));
      yearSelect.innerHTML = availableYears.map(year => `<option value="${year}">${year}</option>`).join('');
    } else {
      yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option>`;
    }
    yearSelect.value = currentYear; // Default Year

    // ตั้งค่าเทอม
    if (configResult.success && configResult.data.current_semester) {
       // ถ้าหน้านี้มีตัวเลือก 'all' และอยากให้ default เป็นเทอมปัจจุบัน ก็ตั้งได้เลย
       // แต่ปกตินิยมดูสรุป 'all' หรือไม่ก็เทอมปัจจุบัน
       semSelect.value = configResult.data.current_semester;
    }

  } catch(e) {
    console.error(e);
  } finally {
    hideLoading();
  }
}

async function loadGradeSummaryReport() {
  const classId = document.getElementById('reportClassSelect').value;
  const year = document.getElementById('reportYearSelect').value;
  const semester = document.getElementById('reportSemesterSelect').value;
  
  const filters = {
    classId: classId === 'all' ? null : classId,
    year: year,
    semester: semester
  };
  
  const resultContainer = document.getElementById('reportResultContainer');
  resultContainer.innerHTML = ''; 

  await waitForResponse(
    () => callServerFunction('getGradeSummaryReportData', filters),
    'กำลังสร้างรายงาน...',
    (result) => {
      if (result.success) {
        const classSelect = document.getElementById('reportClassSelect');
        const semSelect = document.getElementById('reportSemesterSelect');
        const classText = filters.classId ? classSelect.options[classSelect.selectedIndex].text : "ทุกห้องเรียน";
        const semText = semSelect.options[semSelect.selectedIndex].text;
        
        const columns = [
          { label: 'เลขที่', field: 'student_number', className: 'w-16 text-center' },
          { label: 'ชื่อ-นามสกุล', field: 'full_name' },
          { label: 'หน่วยกิต', field: 'total_credits', className: 'w-24 text-center' },
          { label: 'GPA', field: 'total_gpa', className: 'w-24 text-center font-bold' }
        ];
        
        const tableHtml = `
          <table class="print-table data-table">
            <thead> <tr> ${columns.map(col => `<th class="${col.className || ''}">${col.label}</th>`).join('')} </tr> </thead>
            <tbody>
              ${result.data.length > 0 ? result.data.map(row => `
                <tr> ${columns.map(col => `<td class="${col.className || ''}">${row[col.field]}</td>`).join('')} </tr>
              `).join('') : `<tr><td colspan="${columns.length}" class="text-center py-6 text-gray-500">ไม่พบข้อมูล</td></tr>`}
            </tbody>
          </table>
        `;
        
        resultContainer.innerHTML = _renderReportContainer(
          "รายงานผลการเรียน (สรุป)",
          `ห้องเรียน: ${classText} | ปี: ${year} | ภาคเรียน: ${semText} | ทั้งหมด ${result.data.length} คน`,
          tableHtml
        );
      } else {
        resultContainer.innerHTML = renderEmptyState(result.message || 'ไม่สามารถโหลดรายงานได้', 'fas fa-exclamation-triangle');
      }
    }
  );
}

// ===================================
// REPORT 3: รายงานการเข้าเรียน
// ===================================
async function renderReport_Attendance_Filters() {
  renderBreadcrumb(['หน้าแรก', 'รายงาน', 'รายงานการเข้าเรียน']);
  
  const html = `
    <div class="card p-6 mb-6 no-print">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">รายงานการเข้าเรียน</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="form-label">ห้องเรียน</label>
          <select id="reportClassSelect" class="form-select"></select>
        </div>
        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="reportYearSelect" class="form-select"></select>
        </div>
        <div>
          <label class="form-label">ภาคเรียน</label>
          <select class="form-select" id="reportSemesterSelect">
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2">ภาคเรียนที่ 2</option>
          </select>
        </div>
        <div class="md:mt-[28px]">
          <button onclick="loadAttendanceReport()" class="btn btn-primary w-full">
            <i class="fas fa-search mr-2"></i>สร้างรายงาน
          </button>
        </div>
      </div>
    </div>
    <div id="reportResultContainer" class="mt-6"></div>
  `;
  document.getElementById('pageContent').innerHTML = html;
  
  showLoading('กำลังโหลดข้อมูล...');
  try {
    await _loadClassDropdown('reportClassSelect');
    
    // ⭐️ [แก้ไข] โหลด Config และ Classes เพื่อตั้งค่า Default
    const [classesResult, configResult] = await Promise.all([
      callServerFunction('getClasses'),
      callServerFunction('getConfig')
    ]);
    
    const yearSelect = document.getElementById('reportYearSelect');
    const semSelect = document.getElementById('reportSemesterSelect');

    // 1. ตั้งค่าปีการศึกษา (Default จาก Config)
    let currentYear = new Date().getFullYear() + 543;
    if (configResult.success && configResult.data.current_year) {
       currentYear = configResult.data.current_year;
    }

    if (classesResult.success && classesResult.data.length > 0) {
      const availableYears = [...new Set(classesResult.data.map(c => c.year))].sort((a, b) => b.localeCompare(a, 'th'));
      yearSelect.innerHTML = availableYears.map(year => `<option value="${year}">${year}</option>`).join('');
    } else {
      yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option>`;
    }
    yearSelect.value = currentYear; // Set Default

    // 2. ตั้งค่าภาคเรียน (Default จาก Config)
    if (configResult.success && configResult.data.current_semester) {
       semSelect.value = configResult.data.current_semester;
    }

  } catch(e) {
    console.error(e);
  } finally {
    hideLoading();
  }
}

async function loadAttendanceReport() {
  const classId = document.getElementById('reportClassSelect').value;
  const year = document.getElementById('reportYearSelect').value;
  const semester = document.getElementById('reportSemesterSelect').value;
  
  const filters = {
    classId: classId === 'all' ? null : classId,
    year: year,
    semester: semester
  };
  
  const resultContainer = document.getElementById('reportResultContainer');
  resultContainer.innerHTML = ''; 

  await waitForResponse(
    () => callServerFunction('getAttendanceReportData', filters),
    'กำลังสร้างรายงาน...',
    (result) => {
      if (result.success) {
        const classSelect = document.getElementById('reportClassSelect');
        const semSelect = document.getElementById('reportSemesterSelect');
        const classText = filters.classId ? classSelect.options[classSelect.selectedIndex].text : "ทุกห้องเรียน";
        const semText = semSelect.options[semSelect.selectedIndex].text;
        
        const columns = [
          { label: 'เลขที่', field: 'student_number', className: 'w-16 text-center' },
          { label: 'ชื่อ-นามสกุล', field: 'student_name' },
          { label: 'มาเรียน', field: 'present', className: 'w-24 text-center' },
          { label: 'สาย', field: 'late', className: 'w-24 text-center' },
          { label: 'ขาด', field: 'absent', className: 'w-24 text-center' },
          { label: 'ลา', field: 'leave', className: 'w-24 text-center' },
          { label: 'รวมเวลาเรียน', field: 'total', className: 'w-24 text-center font-bold' }
        ];
        
        const tableHtml = `
          <table class="print-table data-table">
            <thead> <tr> ${columns.map(col => `<th class="${col.className || ''}">${col.label}</th>`).join('')} </tr> </thead>
            <tbody>
              ${result.data.length > 0 ? result.data.map(row => `
                <tr> ${columns.map(col => `<td class="${col.className || ''}">${row[col.field]}</td>`).join('')} </tr>
              `).join('') : `<tr><td colspan="${columns.length}" class="text-center py-6 text-gray-500">ไม่พบข้อมูล</td></tr>`}
            </tbody>
          </table>
        `;
        
        resultContainer.innerHTML = _renderReportContainer(
          "รายงานการเข้าเรียน",
          `ห้องเรียน: ${classText} | ปี: ${year} | ภาคเรียน: ${semText} | ทั้งหมด ${result.data.length} คน`,
          tableHtml
        );
      } else {
        resultContainer.innerHTML = renderEmptyState(result.message || 'ไม่สามารถโหลดรายงานได้', 'fas fa-exclamation-triangle');
      }
    }
  );
}

// ===================================
// REPORT 4: รายงานพฤติกรรม
// ===================================
async function renderReport_Behavior_Filters() {
  renderBreadcrumb(['หน้าแรก', 'รายงาน', 'รายงานพฤติกรรม']);
  
  const html = `
    <div class="card p-6 mb-6 no-print">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">รายงานพฤติกรรม</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="form-label">ห้องเรียน</label>
          <select id="reportClassSelect" class="form-select"></select>
        </div>
        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="reportYearSelect" class="form-select"></select>
        </div>
        <div>
          <label class="form-label">ภาคเรียน</label>
          <select class="form-select" id="reportSemesterSelect">
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2">ภาคเรียนที่ 2</option>
          </select>
        </div>
        <div class="md:mt-[28px]">
          <button onclick="loadBehaviorReport()" class="btn btn-primary w-full">
            <i class="fas fa-search mr-2"></i>สร้างรายงาน
          </button>
        </div>
      </div>
    </div>
    <div id="reportResultContainer" class="mt-6"></div>
  `;
  document.getElementById('pageContent').innerHTML = html;
  
  showLoading('กำลังโหลดข้อมูล...');
  try {
    await _loadClassDropdown('reportClassSelect');
    
    // ⭐️ [แก้ไข] โหลด Config เพื่อตั้งค่า Default
    const [classesResult, configResult] = await Promise.all([
      callServerFunction('getClasses'),
      callServerFunction('getConfig')
    ]);
    
    const yearSelect = document.getElementById('reportYearSelect');
    const semSelect = document.getElementById('reportSemesterSelect');

    let currentYear = new Date().getFullYear() + 543;
    if (configResult.success && configResult.data.current_year) {
       currentYear = configResult.data.current_year;
    }

    if (classesResult.success && classesResult.data.length > 0) {
      const availableYears = [...new Set(classesResult.data.map(c => c.year))].sort((a, b) => b.localeCompare(a, 'th'));
      yearSelect.innerHTML = availableYears.map(year => `<option value="${year}">${year}</option>`).join('');
    } else {
      yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option>`;
    }
    yearSelect.value = currentYear; // Set Default

    if (configResult.success && configResult.data.current_semester) {
       semSelect.value = configResult.data.current_semester; // Set Default
    }

  } catch(e) {
    console.error(e);
  } finally {
    hideLoading();
  }
}

async function loadBehaviorReport() {
  const classId = document.getElementById('reportClassSelect').value;
  const year = document.getElementById('reportYearSelect').value;
  const semester = document.getElementById('reportSemesterSelect').value;
  
  if (classId === 'all') {
    showToast('กรุณาเลือกห้องเรียน (รายงานนี้ต้องเลือกห้อง)', 'warning');
    return;
  }
  
  const resultContainer = document.getElementById('reportResultContainer');
  resultContainer.innerHTML = ''; 

  await waitForResponse(
    () => callServerFunction('getBehaviorData', classId, semester, year),
    'กำลังสร้างรายงาน...',
    (result) => {
      if (result.success) {
        const classSelect = document.getElementById('reportClassSelect');
        const semSelect = document.getElementById('reportSemesterSelect');
        const classText = classSelect.options[classSelect.selectedIndex].text;
        const semText = semSelect.options[semSelect.selectedIndex].text;
        
        const traitLabels = { '3': '3', '2': '2', '1': '1', '0': '0' };
        
        const columns = [
          { label: 'เลขที่', field: 'student_number', className: 'w-10 text-center' },
          { label: 'ชื่อ-นามสกุล', field: 'student_name' },
          ...BEHAVIOR_TRAITS.map((trait, i) => ({
            label: `${i+1}`,
            field: trait.id,
            className: 'w-10 text-center'
          })),
          { label: 'คะแนน', field: 'conduct_score', className: 'w-16 text-center font-bold' },
          { label: 'สรุปผล', field: 'overall_behavior', className: 'w-20 text-center font-bold' },
        ];
        
        const tableData = result.data.map(row => {
          let rowData = {
            student_number: row.student_number || '-',
            student_name: row.student_name,
            conduct_score: row.conduct_score,
            overall_behavior: row.overall_behavior,
          };
          BEHAVIOR_TRAITS.forEach(trait => {
            rowData[trait.id] = row.traits ? (traitLabels[row.traits[trait.id]] || '-') : '-';
          });
          return rowData;
        });

        const tableHtml = `
          <table class="print-table data-table min-w-[1024px]">
            <thead> <tr> ${columns.map(col => `<th class="${col.className || ''}">${col.label}</th>`).join('')} </tr> </thead>
            <tbody>
              ${tableData.length > 0 ? tableData.map(row => `
                <tr> ${columns.map(col => `<td class="${col.className || ''}">${row[col.field]}</td>`).join('')} </tr>
              `).join('') : `<tr><td colspan="${columns.length}" class="text-center py-6 text-gray-500">ไม่พบข้อมูล</td></tr>`}
            </tbody>
          </table>
          <div class="mt-4 text-sm print-only">
            <strong>หมายเหตุ:</strong> ${BEHAVIOR_TRAITS.map(t => t.label).join(', ')} (3=ดีเยี่ยม, 2=ดี, 1=ผ่าน, 0=ไม่ผ่าน)
          </div>
        `;
        
        resultContainer.innerHTML = _renderReportContainer(
          "รายงานสรุปคุณลักษณะอันพึงประสงค์",
          `ห้องเรียน: ${classText} | ปี: ${year} | ภาคเรียน: ${semText} | ทั้งหมด ${tableData.length} คน`,
          tableHtml
        );
      } else {
        resultContainer.innerHTML = renderEmptyState(result.message || 'ไม่สามารถโหลดรายงานได้', 'fas fa-exclamation-triangle');
      }
    }
  );
}

// ===================================
// REPORT 5: รายงานกิจกรรม
// ===================================
async function renderReport_Activity_Filters() {
  renderBreadcrumb(['หน้าแรก', 'รายงาน', 'รายงานกิจกรรม']);
  
  const html = `
    <div class="card p-6 mb-6 no-print">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">รายงานกิจกรรมพัฒนาผู้เรียน</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="form-label">ห้องเรียน</label>
          <select id="reportClassSelect" class="form-select"></select>
        </div>
        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="reportYearSelect" class="form-select"></select>
        </div>
        <div>
          <label class="form-label">ภาคเรียน</label>
          <select class="form-select" id="reportSemesterSelect">
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2">ภาคเรียนที่ 2</option>
          </select>
        </div>
        <div class="md:mt-[28px]">
          <button onclick="loadActivityReport()" class="btn btn-primary w-full">
            <i class="fas fa-search mr-2"></i>สร้างรายงาน
          </button>
        </div>
      </div>
    </div>
    <div id="reportResultContainer" class="mt-6"></div>
  `;
  document.getElementById('pageContent').innerHTML = html;
  
  showLoading('กำลังโหลดข้อมูล...');
  try {
    await _loadClassDropdown('reportClassSelect');
    
    // ⭐️ [แก้ไข] โหลด Config เพื่อตั้งค่า Default
    const [classesResult, configResult] = await Promise.all([
      callServerFunction('getClasses'),
      callServerFunction('getConfig')
    ]);
    
    const yearSelect = document.getElementById('reportYearSelect');
    const semSelect = document.getElementById('reportSemesterSelect');

    let currentYear = new Date().getFullYear() + 543;
    if (configResult.success && configResult.data.current_year) {
       currentYear = configResult.data.current_year;
    }

    if (classesResult.success && classesResult.data.length > 0) {
      const availableYears = [...new Set(classesResult.data.map(c => c.year))].sort((a, b) => b.localeCompare(a, 'th'));
      yearSelect.innerHTML = availableYears.map(year => `<option value="${year}">${year}</option>`).join('');
    } else {
      yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option>`;
    }
    yearSelect.value = currentYear; // Set Default

    if (configResult.success && configResult.data.current_semester) {
       semSelect.value = configResult.data.current_semester; // Set Default
    }

  } catch(e) {
    console.error(e);
  } finally {
    hideLoading();
  }
}

async function loadActivityReport() {
  const classId = document.getElementById('reportClassSelect').value;
  const year = document.getElementById('reportYearSelect').value;
  const semester = document.getElementById('reportSemesterSelect').value;
  
  if (classId === 'all') {
    showToast('กรุณาเลือกห้องเรียน (รายงานนี้ต้องเลือกห้อง)', 'warning');
    return;
  }
  
  const resultContainer = document.getElementById('reportResultContainer');
  resultContainer.innerHTML = ''; 

  await waitForResponse(
    () => callServerFunction('getActivityData', classId, semester, year),
    'กำลังสร้างรายงาน...',
    (result) => {
      if (result.success) {
        const classSelect = document.getElementById('reportClassSelect');
        const semSelect = document.getElementById('reportSemesterSelect');
        const classText = classSelect.options[classSelect.selectedIndex].text;
        const semText = semSelect.options[semSelect.selectedIndex].text;
        
        const getStatus = (act) => act ? (act.status === 'ผ่าน' ? 'ผ' : 'มผ') : '-';
        
        const columns = [
          { label: 'เลขที่', field: 'student_number', className: 'w-16 text-center' },
          { label: 'ชื่อ-นามสกุล', field: 'student_name' },
          { label: 'แนะแนว', field: 'guidance', className: 'w-24 text-center' },
          { label: 'ชุมนุม', field: 'club', className: 'w-24 text-center' },
          { label: 'บำเพ็ญฯ', field: 'social_service', className: 'w-24 text-center' },
          { label: 'ลูกเสือ', field: 'scout', className: 'w-24 text-center' },
        ];
        
        const tableData = result.data.map(row => ({
          student_number: row.student_number || '-',
          student_name: row.student_name,
          guidance: getStatus(row.guidance),
          club: getStatus(row.club),
          social_service: getStatus(row.social_service),
          scout: getStatus(row.scout),
        }));

        const tableHtml = `
          <table class="print-table data-table">
            <thead> <tr> ${columns.map(col => `<th class="${col.className || ''}">${col.label}</th>`).join('')} </tr> </thead>
            <tbody>
              ${tableData.length > 0 ? tableData.map(row => `
                <tr> ${columns.map(col => `<td class="${col.className || ''}">${row[col.field]}</td>`).join('')} </tr>
              `).join('') : `<tr><td colspan="${columns.length}" class="text-center py-6 text-gray-500">ไม่พบข้อมูล</td></tr>`}
            </tbody>
          </table>
          <div class="mt-4 text-sm print-only">
            <strong>หมายเหตุ:</strong> ผ=ผ่าน, มผ=ไม่ผ่าน
          </div>
        `;
        
        resultContainer.innerHTML = _renderReportContainer(
          "รายงานสรุปกิจกรรมพัฒนาผู้เรียน",
          `ห้องเรียน: ${classText} | ปี: ${year} | ภาคเรียน: ${semText} | ทั้งหมด ${tableData.length} คน`,
          tableHtml
        );
      } else {
        resultContainer.innerHTML = renderEmptyState(result.message || 'ไม่สามารถโหลดรายงานได้', 'fas fa-exclamation-triangle');
      }
    }
  );
}

// ===================================
// REPORT 6: สรุปผลการประเมิน (ปพ.5)
// ===================================
function renderReport_Summary() {
  if (typeof renderPP5SelectionPage === 'function') {
    renderPP5SelectionPage();
  } else {
    showToast('Error: ไม่พบไฟล์ JS-Pages-PP5.js', 'error');
  }
}

console.log('✅ JS-Pages-Reports (Enhanced V2) loaded successfully');
