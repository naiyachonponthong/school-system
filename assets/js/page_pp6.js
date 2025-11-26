
/**
 * ===================================
 * PAGE: PP.6 (พิมพ์ ปพ.6)
 * ===================================
 */

async function renderPP6SelectionPage() {
  renderBreadcrumb(['หน้าแรก', 'พิมพ์เอกสาร', 'พิมพ์ ปพ.6']);
  
  const html = `
    <div class="card p-6 mb-6"> 
      <h2 class="text-2xl font-bold text-gray-800 mb-6">พิมพ์ ปพ.6 (รายห้อง)</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="pp6YearSelect" class="form-select">
            <option value="">-- กำลังโหลดปี --</option>
          </select>
        </div>
        <div>
          <label class="form-label">ระดับชั้น</label>
          <select id="pp6LevelSelect" class="form-select">
            <option value="">-- เลือกระดับชั้น --</option>
          </select>
        </div>
        <div>
          <label class="form-label">ห้อง</label>
          <select id="pp6RoomSelect" class="form-select">
            <option value="">-- เลือกห้อง --</option>
          </select>
        </div>
      </div>
      
      <div class="text-right">
        <button onclick="loadPP6StudentList()" class="btn btn-primary px-8">
          <i class="fas fa-search mr-2"></i>แสดงรายชื่อนักเรียน
        </button>
      </div>
    </div>
    
    <div id="pp6StudentListContainer" class="mt-6"></div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
  
  showLoading('กำลังโหลดข้อมูลห้องเรียน...');
  try {
    const classesResult = await callServerFunction('getClasses');
    const yearSelect = document.getElementById('pp6YearSelect');
    const levelSelect = document.getElementById('pp6LevelSelect');

    let currentYear = new Date().getFullYear() + 543;
    if (classesResult.success && classesResult.data.length > 0) {
      // กรองห้องที่ user มีสิทธิ์เข้าถึง
      let availableClasses = classesResult.data;
      
      // ถ้าเป็น homeroom teacher ให้แสดงเฉพาะห้องที่รับผิดชอบ
      if (window.currentUser && window.currentUser.role === 'homeroom') {
        availableClasses = classesResult.data.filter(c => {
          return c.homeroom_teacher_id === window.currentUser.id;
        });
      }
      
      const availableYears = [...new Set(availableClasses.map(c => c.year))];
      availableYears.sort((a, b) => b.localeCompare(a, 'th'));
      
      yearSelect.innerHTML = '';
      availableYears.forEach(year => {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
      });
      currentYear = availableYears[0];
      yearSelect.value = currentYear;
      
      // Load levels for current year
      const levels = [...new Set(availableClasses.filter(c => c.year === currentYear).map(c => c.level))];
      levels.sort((a, b) => a.localeCompare(b, 'th'));
      levelSelect.innerHTML = '<option value="">-- เลือกระดับชั้น --</option>';
      levels.forEach(level => {
        levelSelect.innerHTML += `<option value="${level}">${level}</option>`;
      });
      
      // Store filtered classes data
      window.pp6ClassesData = availableClasses;
    } else {
      yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option>`;
      yearSelect.value = currentYear;
      window.pp6ClassesData = [];
    }
    
    // Event listeners for cascading dropdowns
    yearSelect.addEventListener('change', updatePP6Levels);
    levelSelect.addEventListener('change', updatePP6Rooms);
    
  } catch (error) {
    console.error('Error loading PP.6 filters:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
  } finally {
    hideLoading();
  }
}

function updatePP6Levels() {
  const year = document.getElementById('pp6YearSelect').value;
  const levelSelect = document.getElementById('pp6LevelSelect');
  const roomSelect = document.getElementById('pp6RoomSelect');
  
  if (!year || !window.pp6ClassesData) return;
  
  const levels = [...new Set(window.pp6ClassesData.filter(c => c.year === year).map(c => c.level))];
  levels.sort((a, b) => a.localeCompare(b, 'th'));
  
  levelSelect.innerHTML = '<option value="">-- เลือกระดับชั้น --</option>';
  levels.forEach(level => {
    levelSelect.innerHTML += `<option value="${level}">${level}</option>`;
  });
  
  roomSelect.innerHTML = '<option value="">-- เลือกห้อง --</option>';
}

function updatePP6Rooms() {
  const year = document.getElementById('pp6YearSelect').value;
  const level = document.getElementById('pp6LevelSelect').value;
  const roomSelect = document.getElementById('pp6RoomSelect');
  
  if (!year || !level || !window.pp6ClassesData) return;
  
  const rooms = window.pp6ClassesData
    .filter(c => c.year === year && c.level === level)
    .map(c => c.room)
    .sort((a, b) => a - b);
  
  roomSelect.innerHTML = '<option value="">-- เลือกห้อง --</option>';
  rooms.forEach(room => {
    roomSelect.innerHTML += `<option value="${room}">${room}</option>`;
  });
}

async function loadPP6StudentList() {
  const year = document.getElementById('pp6YearSelect').value;
  const level = document.getElementById('pp6LevelSelect').value;
  const room = document.getElementById('pp6RoomSelect').value;
  
  if (!year || !level || !room) {
    showToast('กรุณาเลือกปีการศึกษา ระดับชั้น และห้อง', 'warning');
    return;
  }
  
  const container = document.getElementById('pp6StudentListContainer');
  container.innerHTML = '';
  
  await waitForResponse(
    () => callServerFunction('getStudents'),
    'กำลังโหลดรายชื่อนักเรียน...',
    (result) => {
      if (result.success) {
        const students = result.data.filter(s => s.level === level && s.room === room);
        students.sort((a, b) => (a.student_number || 99) - (b.student_number || 99));
        
        if (students.length === 0) {
          container.innerHTML = renderEmptyState('ไม่พบนักเรียนในห้องนี้', 'fas fa-user-slash');
        } else {
          container.innerHTML = renderPP6StudentTable(students, year);
        }
      } else {
        container.innerHTML = renderEmptyState(result.message || 'ไม่สามารถโหลดรายชื่อได้', 'fas fa-exclamation-triangle');
      }
    },
    (error) => {
      container.innerHTML = renderEmptyState('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'fas fa-wifi-slash');
    }
  );
}

function renderPP6StudentTable(students, year) {
  return `
    <div class="card p-6">
      <h3 class="text-xl font-bold text-gray-800 mb-4">รายชื่อนักเรียน (${students.length} คน)</h3>
      
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="bg-gray-100 border-b-2 border-gray-300">
              <th class="px-4 py-3 text-left font-semibold text-gray-700">เลขที่</th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700">ชื่อ-นามสกุล</th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700">รหัสประจำตัว</th>
              <th class="px-4 py-3 text-center font-semibold text-gray-700">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${students.map((s, idx) => `
              <tr class="border-b border-gray-200 hover:bg-gray-50">
                <td class="px-4 py-3">${s.student_number || '-'}</td>
                <td class="px-4 py-3">${s.prefix}${s.firstname} ${s.lastname}</td>
                <td class="px-4 py-3">${s.student_code}</td>
                <td class="px-4 py-3 text-center">
                  <button onclick="openPP6Modal('${s.id}', '${year}')" class="btn btn-sm btn-primary">
                    <i class="fas fa-file-pdf mr-1"></i>ดูรายละเอียด
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// เปิด Modal แสดง ปพ.6
async function openPP6Modal(studentId, year) {
  showLoading('กำลังโหลด ปพ.6...');
  
  try {
    const result = await callServerFunction('getPP5ReportData', studentId, year);
    
    if (result.success) {
      const modalId = 'pp6Modal_' + Date.now();
      const modalContent = renderPP6ReportUI_Modal(result.data);
      
      // สร้าง Modal แบบ Custom
      const html = `
        <div id="${modalId}" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
          <div class="modal-content bg-white rounded-lg p-6 max-w-7xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-4 border-b">
              <h3 class="text-2xl font-bold text-gray-800">รายงาน ปพ.6</h3>
              <button onclick="closeModal('${modalId}')" class="text-gray-400 hover:text-gray-600 transition-colors">
                <i class="fas fa-times text-2xl"></i>
              </button>
            </div>
            ${modalContent}
          </div>
        </div>
      `;
      
      document.getElementById('modalsContainer').innerHTML = html;
    } else {
      showToast(result.message || 'ไม่สามารถโหลดรายงานได้', 'error');
    }
  } catch (error) {
    console.error('Error loading PP6 report:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดรายงาน', 'error');
  } finally {
    hideLoading();
  }
}

// Render PP6 for Modal
function renderPP6ReportUI_Modal(data) {
  const { student, config, attendance, scores, behavior, activities, gpa, readings } = data;

  const allSubjects = [...scores.sem1, ...scores.sem2, ...scores.year];
  const uniqueSubjects = allSubjects.reduce((acc, s) => {
    if (!acc.find(item => item.subject_code === s.subject_code)) {
      acc.push(s);
    }
    return acc;
  }, []).sort((a, b) => a.subject_code.localeCompare(b.subject_code));
  
  return `
    <div class="mb-4 text-right no-print">
      <button onclick="printPP6FromModal()" class="btn btn-primary">
        <i class="fas fa-print mr-2"></i>พิมพ์รายงาน
      </button>
    </div>
    
    <div id="pp6-print-area-modal" class="a4-page pp6-modal-content" style="box-shadow: none; margin: 0;">
      ${renderPP6Header(student, config)}
      ${renderPP6Attendance(attendance)}
      ${renderPP6Scores(scores, gpa, uniqueSubjects)}
      
      <div class="grid grid-cols-2 gap-x-4 pp6-no-break">
        <div>
          ${renderPP6Traits(behavior)}
        </div>
        <div>
          ${renderPP6Activities(activities)}
          ${renderPP6Reading(readings)}
        </div>
      </div>
      
      ${renderPP6Footer(student, config)}
    </div>
  `;
}

// (ไม่ใช้ loadPP6Report อีกต่อไป เนื่องจากใช้ Modal แทน)

function renderPP6ReportUI_Standard(data) {
  const { student, config, attendance, scores, behavior, activities, gpa, readings } = data;

  const allSubjects = [...scores.sem1, ...scores.sem2, ...scores.year];
  const uniqueSubjects = allSubjects.reduce((acc, s) => {
    if (!acc.find(item => item.subject_code === s.subject_code)) {
      acc.push(s);
    }
    return acc;
  }, []).sort((a, b) => a.subject_code.localeCompare(b.subject_code));
  
  return `
    <div class="card p-4 md:p-8">
      <div class="no-print mb-6 text-right">
        <button onclick="printPP6Report()" class="btn btn-primary">
          <i class="fas fa-print mr-2"></i>พิมพ์รายงาน ปพ.6
        </button>
      </div>
      
      <div id="pp6-print-area" class="a4-page">
        
        ${renderPP6Header(student, config)}
        
        ${renderPP6Attendance(attendance)}
        
        ${renderPP6Scores(scores, gpa, uniqueSubjects)}
        
        <div class="grid grid-cols-2 gap-x-4 pp6-no-break">
          <div>
            ${renderPP6Traits(behavior)}
          </div>
          <div>
            ${renderPP6Activities(activities)}
            ${renderPP6Reading(readings)}
          </div>
        </div>
        
        ${renderPP6Footer(student, config)}
        
      </div>
    </div>
  `;
}

function printPP6Report() {
  window.print();
}

function renderPP6Header(student, config) {
  const fullName = `${student.prefix || ''} ${student.firstname} ${student.lastname}`.trim();
  const address = student.address || {};
  const fullAddress = [
    address.address,
    `ต.${address.subdistrict || '-'}`,
    `อ.${address.district || '-'}`,
    `จ.${address.province || '-'}`,
    address.zipcode
  ].filter(Boolean).join(' ');

  return `
    <div class="text-center mb-4">
      <h3 class="text-xl font-bold">แบบรายงานประจำตัวนักเรียน (ปพ.6)</h3>
      <h4 class="text-lg font-semibold">ระดับประถมศึกษา</h4>
    </div>
    
    <div class="mb-4">
      <div class="flex justify-between">
        <img src="${config.school_logo_url || 'https://placehold.co/100x100?text=Logo'}" alt="School Logo" class="w-20 h-20 object-contain">
        <div class="text-center">
          <p class="font-semibold">${config.school_name || '-'}</p>
          <p>สังกัด ${config.school_district || '-'}</p>
          <p>ปีการศึกษา ${getDisplayYear_PP6(student.entry_year)}</p>
        </div>
        <div class="w-20 h-20">
          ${student.photo_url ? `
            <img src="${student.photo_url}" alt="${fullName}" class="w-20 h-24 object-cover border-2 border-gray-400">
          ` : `
            <div class="w-20 h-24 border-2 border-gray-400 flex items-center justify-center text-gray-400 text-xs">รูปถ่าย</div>
          `}
        </div>
      </div>
    </div>
    
    <div class="grid grid-cols-2 gap-x-4 text-sm mb-4">
      <div>
        <p><strong>ชื่อ-นามสกุล:</strong> ${fullName}</p>
        <p><strong>เลขประจำตัว:</strong> ${student.student_code}</p>
        <p><strong>ที่อยู่:</strong> ${fullAddress}</p>
      </div>
      <div>
        <p><strong>ชั้นประถมศึกษาปีที่:</strong> ${student.level.replace('ป.', '')}/${student.room}</p>
        <p><strong>วันเกิด:</strong> ${formatThaiDate(student.birthdate)}</p>
        <p><strong>ครูประจำชั้น:</strong> ${student.homeroom_teacher_name || '-'}</p>
      </div>
    </div>
  `;
}

function renderPP6Attendance(attendance) {
  return `
    <h5 class="pp6-header">1. สรุปเวลาเรียน</h5>
    <table class="pp6-table text-sm">
      <thead>
        <tr> <th rowspan="2">ภาคเรียนที่</th> <th rowspan="2">เวลาเรียน (วัน)</th> <th colspan="4">จำนวนวัน</th> </tr>
        <tr> <th>มาเรียน</th> <th>สาย</th> <th>ขาด</th> <th>ลา</th> </tr>
      </thead>
      <tbody>
        <tr> <td class="text-center">1</td> <td class="text-center">${attendance.sem1.totalDays}</td> <td class="text-center">${attendance.sem1.present}</td> <td class="text-center">${attendance.sem1.late}</td> <td class="text-center">${attendance.sem1.absent}</td> <td class="text-center">${attendance.sem1.leave}</td> </tr>
        <tr> <td class="text-center">2</td> <td class="text-center">${attendance.sem2.totalDays}</td> <td class="text-center">${attendance.sem2.present}</td> <td class="text-center">${attendance.sem2.late}</td> <td class="text-center">${attendance.sem2.absent}</td> <td class="text-center">${attendance.sem2.leave}</td> </tr>
        <tr> <td class="font-bold text-center">รวม</td> <td class="text-center font-bold">${attendance.total.totalDays}</td> <td class="text-center font-bold">${attendance.total.present}</td> <td class="text-center font-bold">${attendance.total.late}</td> <td class="text-center font-bold">${attendance.total.absent}</td> <td class="text-center font-bold">${attendance.total.leave}</td> </tr>
      </tbody>
    </table>
  `;
}

function renderPP6Scores(scores, gpa, uniqueSubjects) {
  return `
    <h5 class="pp6-header">2. ผลการประเมินการเรียนรู้ 8 กลุ่มสาระ</h5>
    <table class="pp6-table text-sm">
      <thead>
        <tr> 
            <th rowspan="2">รหัส</th> 
            <th rowspan="2">รายวิชา</th> 
            <th rowspan="2" class="w-10 text-center">หน่วยกิต</th> 
            <th colspan="2">ภาคเรียนที่ 1</th> 
            <th colspan="2">ภาคเรียนที่ 2</th> 
            <th colspan="2">สรุปผลทั้งปี</th> 
        </tr>
        <tr> 
            <th class="w-10 text-center">คะแนน</th> <th class="w-10 text-center">เกรด</th> 
            <th class="w-10 text-center">คะแนน</th> <th class="w-10 text-center">เกรด</th> 
            <th class="w-10 text-center">คะแนน</th> <th class="w-10 text-center">เกรด</th> 
        </tr>
      </thead>
      <tbody>
        ${uniqueSubjects.map(s => `
          <tr>
            <td>${s.subject_code}</td>
            <td class="text-left">${s.subject_name}</td>
            <td class="text-center">${s.credit}</td>
            <td class="text-center">${scores.sem1.find(i => i.subject_code === s.subject_code)?.total_score || '-'}</td>
            <td class="text-center">${getScore_PP6(scores, '1', s.subject_code)}</td>
            <td class="text-center">${scores.sem2.find(i => i.subject_code === s.subject_code)?.total_score || '-'}</td>
            <td class="text-center">${getScore_PP6(scores, '2', s.subject_code)}</td>
            <td class="text-center font-bold">${scores.year.find(i => i.subject_code === s.subject_code)?.total_score || '-'}</td>
            <td class="text-center font-bold">${getYearlyScore_PP6(scores, s.subject_code)}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr class="font-bold bg-gray-50">
          <td colspan="2" class="text-right">เฉลี่ย / GPA</td>
          <td class="text-center">${gpa.year.total_credits}</td>
          <td colspan="2" class="text-center">${gpa.sem1.total_gpa}</td>
          <td colspan="2" class="text-center">${gpa.sem2.total_gpa}</td>
          <td colspan="2" class="text-center">${gpa.year.total_gpa}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

function renderPP6Traits(behavior) {
  return `
    <h5 class="pp6-header">3. คุณลักษณะอันพึงประสงค์</h5>
    <table class="pp6-table text-sm">
      <thead> <tr> <th>คุณลักษณะ</th> <th class="w-20 text-center">ผล</th> </tr> </thead>
      <tbody>
        ${BEHAVIOR_TRAITS.map(trait => `
          <tr> <td>${trait.label}</td> <td class="text-center">${getTraitYearly_PP6(behavior, trait.id)}</td> </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr class="font-bold bg-gray-50"> <td>สรุปผล</td> <td class="text-center">${behavior.sem2?.overall_behavior || behavior.sem1?.overall_behavior || '-'}</td> </tr>
      </tfoot>
    </table>
  `;
}

function renderPP6Activities(activities) {
  return `
    <h5 class="pp6-header">4. กิจกรรมพัฒนาผู้เรียน</h5>
    <table class="pp6-table text-sm">
      <thead> <tr> <th>กิจกรรม</th> <th class="w-20 text-center">ผล</th> </tr> </thead>
      <tbody>
        ${ACTIVITY_CATEGORIES.map(cat => `
          <tr> <td>${cat.label}</td> <td class="text-center">${getActivityYearly_PP6(activities, cat.id)}</td> </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderPP6Reading(readings) {
  return `
    <h5 class="pp6-header">5. การอ่าน คิดวิเคราะห์ฯ</h5>
    <table class="pp6-table text-sm">
       <thead> <tr> <th>การประเมิน</th> <th class="w-20 text-center">ผล (เทอม 1)</th> <th class="w-20 text-center">ผล (เทอม 2)</th> </tr> </thead>
       <tbody>
         <tr> 
           <td>การอ่าน คิดวิเคราะห์ และเขียน</td> 
           <td class="text-center">${readings?.sem1?.status || '-'}</td> 
           <td class="text-center">${readings?.sem2?.status || '-'}</td> 
         </tr>
       </tbody>
    </table>
  `;
}

function renderPP6Footer(student, config) {
  return `
    <div class="pp6-no-break">
      <h5 class="pp6-header">6. สรุปผลและข้อเสนอแนะ</h5>
      <div class="pp6-box">
        <p class="font-bold mb-1">สรุปผลการประเมิน (ความเห็นครูประจำชั้น)</p>
        <p class="text-sm">..............................................................................................................................................................................................</p>
        <p class="text-sm">..............................................................................................................................................................................................</p>
      </div>
      
      <div class="grid grid-cols-2 gap-8 text-center text-sm pt-8">
        <div>
          <p>ลงชื่อ ........................................................</p>
          <p>( ${student.homeroom_teacher_name || '...........................................'} )</p>
          <p>ครูประจำชั้น</p>
        </div>
        <div>
          <p>ลงชื่อ ........................................................</p>
          <p>( ${config.principal_name || '...........................................'} )</p>
          <p>ผู้อำนวยการ ${config.school_name || ''}</p>
        </div>
      </div>
    </div>
  `;
}

function getDisplayYear_PP6(yearStr) {
  if (!yearStr) return '-';
  const yearNum = parseInt(yearStr);
  if (yearNum < 2500) { 
    return (yearNum + 543).toString();
  }
  return yearStr; 
}

function getScore_PP6(scores, semester, subject_code) {
  const semData = semester === '1' ? scores.sem1 : scores.sem2;
  const score = semData.find(s => s.subject_code === subject_code);
  return score ? score.grade : '-';
}

function getYearlyScore_PP6(scores, subject_code) {
  const score = scores.year.find(s => s.subject_code === subject_code);
  return score ? score.grade : '-';
}

function getTraitYearly_PP6(behavior, trait_id) {
  const labels = { '3': 'ดีเยี่ยม', '2': 'ดี', '1': 'ผ่าน', '0': 'ไม่ผ่าน' };
  
  const sem1Val = parseInt(behavior.sem1?.traits[trait_id] || 0);
  const sem2Val = parseInt(behavior.sem2?.traits[trait_id] || 0);
  
  const avgVal = Math.round((sem1Val + sem2Val) / 2); 
  
  return labels[avgVal.toString()] || '-';
}

function getActivityYearly_PP6(activities, activity_id) {
  const sem1Pass = (activities.sem1 && activities.sem1[activity_id]?.status === 'ผ่าน');
  const sem2Pass = (activities.sem2 && activities.sem2[activity_id]?.status === 'ผ่าน');
  
  return (sem1Pass && sem2Pass) ? 'ผ่าน' : 'ไม่ผ่าน';
}

function printPP6Report() {
  window.print();
}

// ฟังก์ชันพิมพ์เฉพาะเนื้อหา ปพ.6 จาก Modal (ไม่รวมตารางรายชื่อ)
function printPP6FromModal() {
  const printContents = document.getElementById('pp6-print-area-modal').innerHTML;
  
  // สร้างหน้าใหม่สำหรับพิมพ์
  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write(`
    <html>
      <head>
        <title>พิมพ์ ปพ.6</title>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          /* Reset & Base */
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Sarabun', sans-serif; 
            font-size: 14px;
            line-height: 1.5;
            color: #000;
            background: white;
          }
          
          /* A4 Page */
          .a4-page {
            width: 210mm;
            min-height: 297mm;
            padding: 1.5cm;
            margin: 0 auto;
            background: white;
          }
          
          /* Text Utilities */
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-sm { font-size: 0.875rem; }
          .text-xl { font-size: 1.25rem; }
          .text-lg { font-size: 1.125rem; }
          .font-bold { font-weight: 700; }
          .font-semibold { font-weight: 600; }
          .mb-1 { margin-bottom: 0.25rem; }
          .mb-2 { margin-bottom: 0.5rem; }
          .mb-4 { margin-bottom: 1rem; }
          .mb-6 { margin-bottom: 1.5rem; }
          .mt-4 { margin-top: 1rem; }
          .pt-8 { padding-top: 2rem; }
          
          /* Grid */
          .grid { display: grid; }
          .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .gap-4 { gap: 1rem; }
          .gap-8 { gap: 2rem; }
          .gap-x-4 { column-gap: 1rem; }
          
          /* Flex */
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .items-center { align-items: center; }
          .space-x-4 > * + * { margin-left: 1rem; }
          
          /* Images */
          img {
            max-width: 100%;
            height: auto;
            display: block;
          }
          
          /* Specific image sizes for PP6 */
          .w-20 { width: 5rem; }
          .h-20 { height: 5rem; }
          .h-24 { height: 6rem; }
          .object-contain { object-fit: contain; }
          .object-cover { object-fit: cover; }
          .border-2 { border-width: 2px; }
          .border-gray-400 { border-color: #9ca3af; }
          
          /* PP6 Specific */
          .pp6-header {
            font-size: 1rem;
            font-weight: 700;
            margin-top: 0.75rem;
            margin-bottom: 0.5rem;
            padding-bottom: 0.25rem;
            border-bottom: 1px solid #374151;
          }
          
          .pp6-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.75rem;
            margin-bottom: 0.5rem;
          }
          
          .pp6-table th,
          .pp6-table td {
            border: 1px solid #374151;
            padding: 4px 6px;
            text-align: left;
            vertical-align: top;
          }
          
          .pp6-table thead th {
            background-color: #f3f4f6;
            font-weight: 600;
            text-align: center;
          }
          
          .pp6-table tfoot td {
            background-color: #f9fafb;
          }
          
          .pp6-no-break {
            page-break-inside: avoid;
          }
          
          .pp6-box {
            border: 1px solid #374151;
            padding: 0.5rem;
            min-height: 5rem;
            margin-bottom: 0.5rem;
          }
          
          /* Print specific */
          @media print {
            body { margin: 0; padding: 0; }
            .a4-page { 
              margin: 0;
              padding: 1cm;
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        ${printContents}
      </body>
    </html>
  `);
  
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}

console.log('✅ JS-Pages-PP6 (Updated with correct Combobox) loaded successfully');
