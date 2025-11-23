
/**
 * ===================================
 * PAGE: GRADES VIEW (ดูเกรดและ GPA)
 * ===================================
 */

/**
 * 1. Render หน้าหลัก (ตัวเลือก)
 */
async function renderGradesViewPage_Entry() {
  renderBreadcrumb(['หน้าแรก', 'ดูเกรดและ GPA']);
  
  const html = `
    <div class="card p-6 mb-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">เลือกข้อมูลเพื่อดูผลการเรียน</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="md:col-span-2">
          ${renderFormField({ 
              name: 'student_id', 
              label: 'นักเรียน',
              type: 'combobox', 
              required: true, 
              options: [], 
              id: 'gradeStudentSelect' 
            })}
        </div>
        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="gradeYearSelect" class="form-select">
            <option value="">-- กำลังโหลดปี --</option>
          </select>
        </div>
        <div>
          <label class="form-label">ภาคเรียน</label>
          <select class="form-select" id="gradeSemesterSelect">
            <option value="all">สรุปทั้งปีการศึกษา</option>
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2">ภาคเรียนที่ 2</option>
          </select>
        </div>
      </div>
      
      <div class="mt-6 text-right">
        <button onclick="loadGradeReport()" class="btn btn-primary px-8">
          <i class="fas fa-search mr-2"></i>แสดงรายงาน
        </button>
      </div>
    </div>
    
    <div id="gradesViewContainer" class="mt-6">
      </div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
  
  showLoading('กำลังโหลดข้อมูลนักเรียน...');
  try {
    // 1. โหลดข้อมูลนักเรียน
    const studentsResult = await callServerFunction('getStudents');
    if (studentsResult.success) {
      const studentOptions = (studentsResult.data || [])
        .sort((a, b) => a.level.localeCompare(b.level, 'th') || (a.student_number || 99) - (b.student_number || 99))
        .map(s => ({
          value: s.id,
          label: `(${s.level}/${s.room} เลขที่ ${s.student_number || '-'}) ${s.prefix}${s.firstname} ${s.lastname}`
        }));
      
      // เรียกใช้ฟังก์ชันจาก JS-Components.js
      updateComboboxOptions('gradeStudentSelect', studentOptions);
    }

    // 2. โหลดข้อมูลปีการศึกษา
    const classesResult = await callServerFunction('getClasses');
    const yearSelect = document.getElementById('gradeYearSelect');
    const semesterSelect = document.getElementById('gradeSemesterSelect');

    let currentYear = new Date().getFullYear() + 543;
    if (classesResult.success && classesResult.data.length > 0) {
      const availableYears = [...new Set(classesResult.data.map(c => c.year))];
      availableYears.sort((a, b) => b.localeCompare(a, 'th'));
      
      yearSelect.innerHTML = ''; 
      availableYears.forEach(year => {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
      });
      currentYear = availableYears[0]; 
    } else {
      yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option>`;
    }
    yearSelect.value = currentYear;

    // 3. ตั้งค่าภาคเรียนปัจจุบัน
    const configResult = await callServerFunction('getConfig');
    if (configResult.success) {
      semesterSelect.value = configResult.data.current_semester || '1';
    }
    
  } catch (error) {
    console.error('Error loading grades view filters:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * 2. โหลดข้อมูลรายงานผลการเรียน
 */
async function loadGradeReport() {
  const studentId = document.getElementById('combo_hidden_gradeStudentSelect').value;
  const year = document.getElementById('gradeYearSelect').value;
  const semester = document.getElementById('gradeSemesterSelect').value;

  if (!studentId || !year) {
    showToast('กรุณาเลือกนักเรียนและปีการศึกษา', 'warning');
    return;
  }

  const resultContainer = document.getElementById('gradesViewContainer');
  resultContainer.innerHTML = '';

  await waitForResponse(
    () => callServerFunction('getStudentGradeReport', studentId, year, semester),
    'กำลังประมวลผลรายงาน...',
    (result) => {
      if (result.success) {
        resultContainer.innerHTML = renderGradeReportUI(result.data);
      } else {
        resultContainer.innerHTML = renderEmptyState(result.message || 'ไม่สามารถโหลดรายงานได้', 'fas fa-exclamation-triangle');
      }
    },
    (error) => {
      resultContainer.innerHTML = renderEmptyState('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'fas fa-wifi-slash');
    }
  );
}

/**
 * 3. วาด UI ผลการเรียน (ใบเกรด) - ปรับปรุงให้รองรับมือถือ (Responsive)
 */
function renderGradeReportUI(data) {
  const { studentInfo, scores, behavior, activities, gpa, year, semester } = data;
  
  if (!studentInfo) {
    return renderEmptyState('ไม่พบข้อมูลนักเรียน', 'fas fa-user-times');
  }
  
  const fullName = `${studentInfo.prefix || ''} ${studentInfo.firstname} ${studentInfo.lastname}`.trim();
  const initial = getInitials(fullName);
  const semesterText = semester === 'all' ? 'ทั้งปีการศึกษา' : `ภาคเรียนที่ ${semester}`;

  return `
    <div class="card p-4 md:p-8"> <div class="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 mb-6 pb-6 border-b">
        ${studentInfo.photo_url ? `
          <img src="${studentInfo.photo_url}" alt="${fullName}" class="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-gray-100 shadow-md">
        ` : `
          <div class="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl md:text-4xl font-semibold shadow-md">
            ${initial}
          </div>
        `}
        <div class="flex-1 text-center sm:text-left w-full">
          <h3 class="text-xl md:text-2xl font-bold text-gray-800 break-words">${fullName}</h3>
          <p class="text-base md:text-lg text-gray-600">ชั้น ${studentInfo.level}/${studentInfo.room} (เลขที่ ${studentInfo.student_number || '-'})</p>
          <p class="text-xs md:text-sm text-gray-500">รหัสนักเรียน: ${studentInfo.student_code}</p>
        </div>
        <div class="text-center sm:text-right w-full sm:w-auto bg-blue-50 sm:bg-transparent p-2 rounded-lg sm:p-0">
          <p class="text-xs text-gray-500">รายงานผลการเรียน</p>
          <p class="text-base md:text-lg font-semibold text-blue-600">ปีการศึกษา ${year}</p>
          <p class="text-sm md:text-md font-semibold text-blue-600">${semesterText}</p>
        </div>
      </div>

      <div class="mb-8">
        <h4 class="text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center">
          <i class="fas fa-book mr-2 text-blue-500"></i> ผลการเรียนรายวิชา
        </h4>

        <div class="hidden md:block overflow-x-auto border rounded-lg">
          <table class="data-table w-full">
            <thead class="bg-gray-100">
              <tr>
                <th class="w-24 text-left">รหัสวิชา</th>
                <th class="text-left">รายวิชา</th>
                <th class="w-20 text-center">หน่วยกิต</th>
                <th class="w-20 text-center">คะแนน</th>
                <th class="w-20 text-center">เกรด</th>
                <th class="w-24 text-center">ผลการตัดสิน</th>
              </tr>
            </thead>
            <tbody>
              ${scores.length > 0 ? scores.map((s, index) => `
                <tr class="${index % 2 === 1 ? 'bg-gray-50' : ''} hover:bg-blue-50 transition-colors">
                  <td class="font-mono text-sm">${s.subject_code}</td>
                  <td class="font-semibold text-gray-700">${s.subject_name}</td>
                  <td class="text-center">${s.credit}</td>
                  <td class="text-center">${s.total_score}</td>
                  <td class="text-center font-bold text-lg ${getGradeColor(s.gpa_value)}">${s.grade}</td>
                  <td class="text-center font-semibold ${s.pass_status === 'ผ่าน' ? 'text-green-600' : 'text-red-600'}">
                    ${s.pass_status}
                  </td>
                </tr>
              `).join('') : `
                <tr><td colspan="6" class="text-center py-6 text-gray-500">ไม่พบข้อมูลผลการเรียน</td></tr>
              `}
            </tbody>
          </table>
        </div>

        <div class="md:hidden space-y-3">
          ${scores.length > 0 ? scores.map(s => `
            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div class="absolute left-0 top-0 bottom-0 w-1 ${s.pass_status === 'ผ่าน' ? 'bg-green-500' : 'bg-red-500'}"></div>
              
              <div class="pl-2">
                <div class="flex justify-between items-start mb-2">
                  <div class="flex-1 pr-2">
                    <h5 class="font-bold text-gray-800 text-base">${s.subject_name}</h5>
                    <span class="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">${s.subject_code}</span>
                  </div>
                  <div class="flex flex-col items-end">
                    <span class="text-2xl font-bold ${getGradeColor(s.gpa_value)}">${s.grade}</span>
                    <span class="text-[10px] text-gray-400">เกรด</span>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-dashed border-gray-200">
                  <div class="text-center">
                    <span class="block text-xs text-gray-400">หน่วยกิต</span>
                    <span class="font-semibold text-gray-700">${s.credit}</span>
                  </div>
                  <div class="text-center border-l border-gray-100">
                    <span class="block text-xs text-gray-400">คะแนน</span>
                    <span class="font-semibold text-gray-700">${s.total_score}</span>
                  </div>
                  <div class="text-center border-l border-gray-100">
                    <span class="block text-xs text-gray-400">ผล</span>
                    <span class="font-bold ${s.pass_status === 'ผ่าน' ? 'text-green-600' : 'text-red-600'}">
                      ${s.pass_status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          `).join('') : renderEmptyState('ไม่พบข้อมูล', 'fas fa-clipboard-list')}
        </div>

      </div>
      
      <div class="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 md:p-6">
        <h4 class="text-sm font-bold text-blue-800 mb-4 uppercase tracking-wide opacity-70">สรุปผลการเรียน</h4>
        <dl class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <dt class="text-xs text-gray-500 mb-1">หน่วยกิตสะสม</dt>
            <dd class="text-xl md:text-2xl font-bold text-gray-800">${gpa.total_credits}</dd>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm ring-2 ring-blue-100">
            <dt class="text-xs text-blue-600 font-semibold mb-1">เกรดเฉลี่ย (GPA)</dt>
            <dd class="text-2xl md:text-3xl font-bold text-blue-600">${gpa.total_gpa}</dd>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <dt class="text-xs text-gray-500 mb-1">คะแนนความประพฤติ</dt>
            <dd class="text-xl md:text-2xl font-bold text-green-600">${behavior ? behavior.conduct_score : '-'}</dd>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <dt class="text-xs text-gray-500 mb-1">ประเมินพฤติกรรม</dt>
            <dd class="text-lg md:text-xl font-bold text-gray-800 truncate">${behavior ? behavior.overall_behavior : '-'}</dd>
          </div>
        </dl>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div class="bg-white border rounded-xl p-4 md:p-5 shadow-sm">
          <h4 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <i class="fas fa-heart mr-2 text-red-500"></i> คุณลักษณะอันพึงประสงค์
          </h4>
          ${behavior ? `
            <dl class="space-y-3">
              ${BEHAVIOR_TRAITS.map(trait => `
                <div class="flex justify-between items-start text-sm border-b border-dashed border-gray-100 pb-2 last:border-0">
                  <dt class="text-gray-600 flex-1 pr-2">${trait.label}</dt>
                  <dd class="font-semibold whitespace-nowrap ${getTraitColor(behavior.traits[trait.id])}">
                    ${getTraitLabel(behavior.traits[trait.id])}
                  </dd>
                </div>
              `).join('')}
            </dl>
          ` : `<div class="text-center py-8 text-gray-400 italic">ยังไม่มีการบันทึกข้อมูล</div>`}
        </div>
        
        <div class="bg-white border rounded-xl p-4 md:p-5 shadow-sm">
          <h4 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <i class="fas fa-running mr-2 text-orange-500"></i> กิจกรรมพัฒนาผู้เรียน
          </h4>
          ${activities ? `
            <dl class="space-y-3">
              ${ACTIVITY_CATEGORIES.map(cat => `
                <div class="flex justify-between items-center text-sm border-b border-dashed border-gray-100 pb-2 last:border-0">
                  <dt class="text-gray-600">${cat.label}</dt>
                  <dd>
                    <span class="px-2 py-1 rounded text-xs font-bold ${activities[cat.id]?.status === 'ผ่าน' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                      ${activities[cat.id]?.status || 'ไม่ผ่าน'}
                    </span>
                  </dd>
                </div>
              `).join('')}
            </dl>
          ` : `<div class="text-center py-8 text-gray-400 italic">ยังไม่มีการบันทึกข้อมูล</div>`}
        </div>

      </div>

    </div>
  `;
}

function getGradeColor(gpa_value) {
  if (gpa_value >= 4.0) return 'text-green-600';
  if (gpa_value >= 3.0) return 'text-blue-600';
  if (gpa_value >= 2.0) return 'text-yellow-600';
  if (gpa_value >= 1.0) return 'text-orange-500';
  return 'text-red-600';
}

function getTraitLabel(value) {
  const labels = { '3': 'ดีเยี่ยม', '2': 'ดี', '1': 'ผ่าน', '0': 'ไม่ผ่าน' };
  return labels[value] || '-';
}

function getTraitColor(value) {
  const colors = { '3': 'text-green-600', '2': 'text-blue-600', '1': 'text-yellow-600', '0': 'text-red-600' };
  return colors[value] || 'text-gray-500';
}

/**
 * (⭐️⭐️⭐️ โค้ดที่ถูกต้อง ⭐️⭐️⭐️)
 * แสดงหน้า "ดูเกรดของฉัน" (มีฟิลเตอร์)
 */
function renderStudentGradesPage_Entry() {
  renderBreadcrumb(['หน้าแรก', 'ดูเกรดของฉัน']);
  
  const html = `
    <div id="student-grade-filters" class="card p-6 mb-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">เลือกข้อมูลเพื่อดูผลการเรียน</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="studentGradeYearSelect" class="form-select">
            <option value="">-- กำลังโหลดปี --</option>
          </select>
        </div>
        <div>
          <label class="form-label">ภาคเรียน</label>
          <select class="form-select" id="studentGradeSemesterSelect">
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2">ภาคเรียนที่ 2</option>
          </select>
        </div>
        
        <div class="md:mt-[28px]">
          <button onclick="loadStudentGradeReport()" class="btn btn-primary w-full">
            <i class="fas fa-search mr-2"></i>แสดงรายงาน
          </button>
        </div>
      </div>
    </div>
    
    <div id="studentGradesContainer" class="mt-6">
      </div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
  
  // ⭐️ โหลดฟิลเตอร์
  showLoading('กำลังโหลดข้อมูลตัวกรอง...');
  try {
    loadStudentFilterOptions('studentGradeYearSelect', 'studentGradeSemesterSelect');
  } catch (error) {
    console.error('Error loading filters:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดตัวกรอง', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * (⭐️⭐️⭐️ โค้ดที่ถูกต้อง ⭐️⭐️⭐️)
 * โหลดข้อมูลเกรดของนักเรียน (ไม่มีการซ่อนฟิลเตอร์)
 */
async function loadStudentGradeReport() {
  const sessionToken = localStorage.getItem('sessionToken');
  const year = document.getElementById('studentGradeYearSelect').value;
  const semester = document.getElementById('studentGradeSemesterSelect').value;

  if (!year || !semester) {
    showToast('กรุณาเลือกปีการศึกษาและภาคเรียน', 'warning');
    return;
  }

  const resultContainer = document.getElementById('studentGradesContainer');
  resultContainer.innerHTML = '';
  
  // 1. แสดง "กำลังโหลด..."
  showLoading('กำลังโหลดข้อมูล...');
  
  // ⭐️ สังเกต: ไม่มีโค้ดซ่อนการ์ดฟิลเตอร์ตรงนี้ ⭐️
  
  try {
    const result = await new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .getStudentGrades(sessionToken, year, semester);
    });
    
    hideLoading();
    if (result.success) {
      renderStudentGradesContent(result); // (ชื่อฟังก์ชันเดิม)
    } else {
      resultContainer.innerHTML = renderEmptyState(result.message || 'ไม่พบข้อมูล', 'fas fa-exclamation-triangle');
    }
  } catch (error) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
  }
}

/**
 * แสดงผลหน้าดูเกรดของนักเรียน (Responsive)
 */
function renderStudentGradesContent(data) {
  const { studentInfo, scores, behavior, activities, gpa, year, semester } = data;
  
  if (!studentInfo) {
    document.getElementById('pageContent').innerHTML = renderEmptyState('ไม่พบข้อมูลนักเรียน', 'fas fa-user-times');
    return;
  }
  
  const fullName = `${studentInfo.prefix || ''} ${studentInfo.firstname} ${studentInfo.lastname}`.trim();
  const initial = getInitials(fullName);
  const semesterText = semester === 'all' ? 'ทั้งปีการศึกษา' : `ภาคเรียนที่ ${semester}`;

  const html = `
    <div class="card p-4 md:p-8"> <div class="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 mb-6 pb-6 border-b">
        ${studentInfo.photo_url ? `
          <img src="${studentInfo.photo_url}" alt="${fullName}" class="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-gray-100 shadow-md">
        ` : `
          <div class="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl md:text-4xl font-semibold shadow-md">
            ${initial}
          </div>
        `}
        <div class="flex-1 text-center sm:text-left w-full">
          <h3 class="text-xl md:text-2xl font-bold text-gray-800 break-words">${fullName}</h3>
          <p class="text-base md:text-lg text-gray-600">ชั้น ${studentInfo.level}/${studentInfo.room} (เลขที่ ${studentInfo.student_number || '-'})</p>
          <p class="text-xs md:text-sm text-gray-500">รหัสนักเรียน: ${studentInfo.student_code}</p>
        </div>
        <div class="text-center sm:text-right w-full sm:w-auto bg-blue-50 sm:bg-transparent p-2 rounded-lg sm:p-0">
          <p class="text-xs text-gray-500">ผลการเรียนของฉัน</p>
          <p class="text-base md:text-lg font-semibold text-blue-600">ปีการศึกษา ${year}</p>
          <p class="text-sm md:text-md font-semibold text-blue-600">${semesterText}</p>
        </div>
      </div>

      <div class="mb-8">
        <h4 class="text-lg md:text-xl font-bold text-gray-800 mb-4 flex items-center">
          <i class="fas fa-book mr-2 text-blue-500"></i> รายวิชาและผลการเรียน
        </h4>

        <div class="hidden md:block overflow-x-auto border rounded-lg">
          <table class="data-table w-full">
            <thead class="bg-gray-100">
              <tr>
                <th class="w-24 text-left">รหัสวิชา</th>
                <th class="text-left">รายวิชา</th>
                <th class="w-20 text-center">หน่วยกิต</th>
                <th class="w-20 text-center">คะแนน</th>
                <th class="w-20 text-center">เกรด</th>
                <th class="w-24 text-center">ผลการตัดสิน</th>
              </tr>
            </thead>
            <tbody>
              ${scores && scores.length > 0 ? scores.map((s, index) => {
                const isPassed = parseFloat(s.total_score) >= 50;
                return `
                <tr class="${index % 2 === 1 ? 'bg-gray-50' : ''} hover:bg-blue-50 transition-colors">
                  <td class="font-mono text-sm">${s.subject_code}</td>
                  <td class="font-semibold text-gray-700">${s.subject_name}</td>
                  <td class="text-center">${s.credit}</td>
                  <td class="text-center">${s.total_score ? parseFloat(s.total_score).toFixed(2) : '-'}</td>
                  <td class="text-center font-bold text-lg ${getGradeColor(s.gpa_value)}">${s.grade || '-'}</td>
                  <td class="text-center font-semibold ${isPassed ? 'text-green-600' : 'text-red-600'}">
                    ${isPassed ? 'ผ่าน' : 'ไม่ผ่าน'}
                  </td>
                </tr>
              `}).join('') : `
                <tr><td colspan="6" class="text-center py-6 text-gray-500">ยังไม่มีข้อมูลผลการเรียน</td></tr>
              `}
            </tbody>
          </table>
        </div>

        <div class="md:hidden space-y-3">
          ${scores && scores.length > 0 ? scores.map(s => {
            const isPassed = parseFloat(s.total_score) >= 50;
            return `
            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div class="absolute left-0 top-0 bottom-0 w-1 ${isPassed ? 'bg-green-500' : 'bg-red-500'}"></div>
              
              <div class="pl-2">
                <div class="flex justify-between items-start mb-2">
                  <div class="flex-1 pr-2">
                    <h5 class="font-bold text-gray-800 text-base">${s.subject_name}</h5>
                    <span class="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">${s.subject_code}</span>
                  </div>
                  <div class="flex flex-col items-end">
                    <span class="text-2xl font-bold ${getGradeColor(s.gpa_value)}">${s.grade || '-'}</span>
                    <span class="text-[10px] text-gray-400">เกรด</span>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-dashed border-gray-200">
                  <div class="text-center">
                    <span class="block text-xs text-gray-400">หน่วยกิต</span>
                    <span class="font-semibold text-gray-700">${s.credit}</span>
                  </div>
                  <div class="text-center border-l border-gray-100">
                    <span class="block text-xs text-gray-400">คะแนน</span>
                    <span class="font-semibold text-gray-700">${s.total_score ? parseFloat(s.total_score).toFixed(0) : '-'}</span>
                  </div>
                  <div class="text-center border-l border-gray-100">
                    <span class="block text-xs text-gray-400">ผล</span>
                    <span class="font-bold ${isPassed ? 'text-green-600' : 'text-red-600'}">
                      ${isPassed ? 'ผ่าน' : 'ไม่ผ่าน'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          `}).join('') : renderEmptyState('ยังไม่มีข้อมูล', 'fas fa-clipboard-list')}
        </div>

      </div>
      
      <div class="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-4 md:p-6">
        <h4 class="text-sm font-bold text-indigo-800 mb-4 uppercase tracking-wide opacity-70">สรุปภาพรวม</h4>
        <dl class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <dt class="text-xs text-gray-500 mb-1">หน่วยกิตสะสม</dt>
            <dd class="text-xl md:text-2xl font-bold text-gray-800">${gpa.total_credits}</dd>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm ring-2 ring-indigo-100">
            <dt class="text-xs text-indigo-600 font-semibold mb-1">เกรดเฉลี่ย (GPA)</dt>
            <dd class="text-2xl md:text-3xl font-bold text-indigo-600">${gpa.total_gpa}</dd>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <dt class="text-xs text-gray-500 mb-1">คะแนนความประพฤติ</dt>
            <dd class="text-xl md:text-2xl font-bold text-green-600">${behavior ? behavior.conduct_score : '-'}</dd>
          </div>
          <div class="bg-white p-3 rounded-lg shadow-sm">
            <dt class="text-xs text-gray-500 mb-1">ประเมินพฤติกรรม</dt>
            <dd class="text-lg md:text-xl font-bold text-gray-800 truncate">${behavior ? behavior.overall_behavior : '-'}</dd>
          </div>
        </dl>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div class="bg-white border rounded-xl p-4 md:p-5 shadow-sm">
          <h4 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <i class="fas fa-heart mr-2 text-pink-500"></i> คุณลักษณะอันพึงประสงค์
          </h4>
          ${behavior ? `
            <dl class="space-y-3">
              ${BEHAVIOR_TRAITS.map(trait => `
                <div class="flex justify-between items-start text-sm border-b border-dashed border-gray-100 pb-2 last:border-0">
                  <dt class="text-gray-600 flex-1 pr-2">${trait.label}</dt>
                  <dd class="font-semibold whitespace-nowrap ${getTraitColor(behavior.traits[trait.id])}">
                    ${getTraitLabel(behavior.traits[trait.id])}
                  </dd>
                </div>
              `).join('')}
            </dl>
          ` : `<div class="text-center py-8 text-gray-400 italic">ยังไม่มีการบันทึกข้อมูล</div>`}
        </div>
        
        <div class="bg-white border rounded-xl p-4 md:p-5 shadow-sm">
          <h4 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <i class="fas fa-running mr-2 text-orange-500"></i> กิจกรรมพัฒนาผู้เรียน
          </h4>
          ${activities ? `
            <dl class="space-y-3">
              ${ACTIVITY_CATEGORIES.map(cat => `
                <div class="flex justify-between items-center text-sm border-b border-dashed border-gray-100 pb-2 last:border-0">
                  <dt class="text-gray-600">${cat.label}</dt>
                  <dd>
                    <span class="px-2 py-1 rounded text-xs font-bold ${activities[cat.id]?.status === 'ผ่าน' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                      ${activities[cat.id]?.status || 'ไม่ผ่าน'}
                    </span>
                  </dd>
                </div>
              `).join('')}
            </dl>
          ` : `<div class="text-center py-8 text-gray-400 italic">ยังไม่มีการบันทึกข้อมูล</div>`}
        </div>

      </div>

    </div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
}

function getGPAColor(gpa_value) {
  gpa_value = parseFloat(gpa_value);
  if (isNaN(gpa_value)) return 'text-gray-600';
  if (gpa_value >= 4.0) return 'text-green-600';
  if (gpa_value >= 3.0) return 'text-blue-600';
  if (gpa_value >= 2.0) return 'text-yellow-600';
  if (gpa_value >= 1.0) return 'text-orange-500';
  return 'text-red-600';
}
