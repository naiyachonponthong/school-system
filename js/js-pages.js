
/**
 * ===================================
 * PAGE RENDERING FUNCTIONS (COMPLETE)
 * ===================================
 */


// ===================================
// DASHBOARD PAGE (ROLE-BASED)
// ===================================

async function renderDashboard() {
  const role = window.currentUser.role;
  
  // 1. แยกการแสดงผลตาม Role
  if (role === 'student') {
    await renderStudentDashboard();
  } else if (role === 'teacher' || role === 'homeroom') {
    await renderTeacherDashboard();
  } else {
    // Admin, Principal, Registrar
    await renderAdminDashboard();
  }
}

/**
 * 🏢 Dashboard สำหรับผู้บริหาร / Admin / ทะเบียน
 * (แสดงภาพรวมทั้งโรงเรียน)
 */
async function renderAdminDashboard() {
  renderBreadcrumb(['หน้าแรก (ภาพรวมระบบ)']);
  showLoading('กำลังโหลดข้อมูลภาพรวม...');
  
  try {
    // 1. ดึงข้อมูลทั้งหมดรวมถึง getActiveUserCount
    const [studentsResult, classesResult, subjectsResult, activeUserResult] = await Promise.all([
      callServerFunction('getStudents'),
      callServerFunction('getClasses'),
      callServerFunction('getSubjects'),
      callServerFunction('getActiveUserCount') // ⭐️ เพิ่มการดึงจำนวนคนออนไลน์
    ]);
    
    const students = studentsResult.success ? studentsResult.data : [];
    const classes = classesResult.success ? classesResult.data : [];
    const subjects = subjectsResult.success ? subjectsResult.data : [];
    
    // 2. เตรียมตัวเลขสถิติ
    const activeStudents = students.filter(s => s.status === 'active').length;
    const activeClasses = classes.filter(c => c.status === 'active').length;
    const activeSubjects = subjects.filter(s => s.status === 'active').length;
    
    // ⭐️ ใช้ค่าที่ดึงมา หรือถ้าไม่มีให้เป็น 1 (ตัวเราเอง)
    const onlineCount = (activeUserResult !== undefined && activeUserResult !== null) ? activeUserResult : 1;
    
    const html = `
      <div class="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl p-8 mb-6 shadow-lg">
        <h2 class="text-3xl font-bold mb-2">สวัสดี, ${window.currentUser.name}</h2>
        <p class="text-blue-100 opacity-90">ผู้ดูแลระบบ / ฝ่ายบริหารวิชาการ</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        ${renderStatCard('จำนวนนักเรียน', activeStudents, 'fas fa-user-graduate', 'blue')}
        ${renderStatCard('จำนวนห้องเรียน', activeClasses, 'fas fa-door-open', 'green')}
        ${renderStatCard('จำนวนวิชา', activeSubjects, 'fas fa-book', 'purple')}
        ${renderStatCard('ผู้ใช้งานออนไลน์', onlineCount, 'fas fa-users', 'yellow')}
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 card p-6">
          <h3 class="text-lg font-bold text-gray-800 mb-4">เมนูจัดการระบบ</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button onclick="navigateTo('students')" class="btn btn-outline-primary flex-col py-6 h-full hover:shadow-md transition-all">
              <i class="fas fa-user-graduate text-3xl mb-2"></i>
              <span>จัดการนักเรียน</span>
            </button>
            <button onclick="navigateTo('classes')" class="btn btn-outline-success flex-col py-6 h-full hover:shadow-md transition-all">
              <i class="fas fa-door-open text-3xl mb-2"></i>
              <span>จัดการห้องเรียน</span>
            </button>
            <button onclick="navigateTo('assign-subjects')" class="btn btn-outline-secondary flex-col py-6 h-full hover:shadow-md transition-all">
              <i class="fas fa-chalkboard-teacher text-3xl mb-2"></i>
              <span>มอบหมายวิชา</span>
            </button>
            <button onclick="navigateTo('reports')" class="btn btn-outline-warning flex-col py-6 h-full hover:shadow-md transition-all">
              <i class="fas fa-chart-pie text-3xl mb-2"></i>
              <span>ดูรายงาน</span>
            </button>
          </div>
        </div>

        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800">นักเรียนล่าสุด</h3>
            <button onclick="navigateTo('students')" class="text-blue-600 hover:text-blue-800 text-sm">ดูทั้งหมด</button>
          </div>
          <div class="space-y-3">
            ${students.slice(0, 5).map(s => renderMiniStudentRow(s)).join('')}
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('pageContent').innerHTML = html;
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * 👨‍🏫 Dashboard สำหรับครู (Teacher / Homeroom)
 * (เน้นงานสอน, งานประจำชั้น)
 */
async function renderTeacherDashboard() {
  renderBreadcrumb(['หน้าแรก (ครูผู้สอน)']);
  showLoading('กำลังโหลดข้อมูลการสอน...');
  
  try {
    const [profileResult, studentsResult] = await Promise.all([
      callServerFunction('getProfileData'),
      callServerFunction('getStudents') // จะได้เฉพาะนักเรียนที่เกี่ยวข้องตามสิทธิ์
    ]);
    
    const mySubjects = profileResult.success ? profileResult.data.subjects : [];
    const myHomeroom = profileResult.success ? profileResult.data.homeroom : [];
    const myStudents = studentsResult.success ? studentsResult.data : [];
    
    // นับจำนวนนักเรียนที่ปรึกษา
    let homeroomStudentCount = 0;
    if (myHomeroom.length > 0) {
      const homeroomClassIds = myHomeroom.map(c => c.id); // ดึง ID ห้องที่ประจำชั้น
      homeroomStudentCount = myStudents.filter(s => homeroomClassIds.includes(s.class_id)).length;
    } else {
       // กรณี Logic getStudents กรองมาให้แล้ว (Fallback)
       homeroomStudentCount = myStudents.length;
    }

    const html = `
      <div class="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl p-8 mb-6 shadow-lg">
        <h2 class="text-3xl font-bold mb-2">สวัสดี, คุณครู${window.currentUser.name}</h2>
        <p class="text-emerald-100 opacity-90">
          ${myHomeroom.length > 0 ? `ครูประจำชั้น ${myHomeroom[0].level}/${myHomeroom[0].room}` : 'ครูผู้สอน'} 
          | รับผิดชอบ ${mySubjects.length} รายวิชา
        </p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        ${renderStatCard('วิชาที่สอน', mySubjects.length, 'fas fa-book-open', 'purple')}
        ${renderStatCard('นักเรียน (ที่ดูแล)', myStudents.length, 'fas fa-users', 'blue')}
        ${renderStatCard('ห้องประจำชั้น', myHomeroom.length > 0 ? `${myHomeroom[0].level}/${myHomeroom[0].room}` : '-', 'fas fa-home', 'green')}
      </div>
      
      <h3 class="text-xl font-bold text-gray-800 mb-4">งานวิชาการ</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div onclick="navigateTo('scores')" class="card p-6 cursor-pointer hover:shadow-lg hover:border-blue-500 border-2 border-transparent transition-all group">
          <div class="flex items-center space-x-4">
            <div class="bg-blue-100 text-blue-600 p-4 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <i class="fas fa-file-pen text-2xl"></i>
            </div>
            <div>
              <h4 class="font-bold text-lg text-gray-800">บันทึกคะแนน</h4>
              <p class="text-sm text-gray-500">กรอกคะแนนเก็บ/สอบ</p>
            </div>
          </div>
        </div>

        <div onclick="navigateTo('attendance')" class="card p-6 cursor-pointer hover:shadow-lg hover:border-yellow-500 border-2 border-transparent transition-all group">
          <div class="flex items-center space-x-4">
            <div class="bg-yellow-100 text-yellow-600 p-4 rounded-full group-hover:bg-yellow-500 group-hover:text-white transition-colors">
              <i class="fas fa-calendar-check text-2xl"></i>
            </div>
            <div>
              <h4 class="font-bold text-lg text-gray-800">เช็คชื่อเข้าเรียน</h4>
              <p class="text-sm text-gray-500">บันทึกเวลาเรียนรายวัน</p>
            </div>
          </div>
        </div>

        <div onclick="navigateTo('grades-view')" class="card p-6 cursor-pointer hover:shadow-lg hover:border-indigo-500 border-2 border-transparent transition-all group">
          <div class="flex items-center space-x-4">
            <div class="bg-indigo-100 text-indigo-600 p-4 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <i class="fas fa-chart-line text-2xl"></i>
            </div>
            <div>
              <h4 class="font-bold text-lg text-gray-800">ดูผลการเรียน</h4>
              <p class="text-sm text-gray-500">ตรวจสอบเกรดนักเรียน</p>
            </div>
          </div>
        </div>
      </div>

      ${myHomeroom.length > 0 ? `
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800">
              <i class="fas fa-user-graduate text-blue-500 mr-2"></i>
              นักเรียนในที่ปรึกษา (${myHomeroom[0].level}/${myHomeroom[0].room})
            </h3>
            <button onclick="navigateTo('students')" class="btn btn-sm btn-secondary">ดูทั้งหมด</button>
          </div>
          <div class="space-y-2">
             ${myStudents
                .filter(s => s.class_id === myHomeroom[0].id)
                .slice(0, 5)
                .map(s => renderMiniStudentRow(s))
                .join('') || '<p class="text-gray-500 text-center">ไม่พบข้อมูลนักเรียน</p>'}
          </div>
        </div>
      ` : ''}
    `;
    
    document.getElementById('pageContent').innerHTML = html;
  } catch (error) {
    console.error('Error loading teacher dashboard:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * 🎓 Dashboard สำหรับนักเรียน (Student)
 * (เน้นดูเกรด, เวลาเรียนของตัวเอง)
 */
async function renderStudentDashboard() {
  renderBreadcrumb(['หน้าแรก (นักเรียน)']);
  showLoading('กำลังโหลดข้อมูลการเรียน...');
  
  try {
    const sessionToken = localStorage.getItem('sessionToken');
    const [gradesResult, attendanceResult] = await Promise.all([
      callServerFunction('getStudentGrades', sessionToken), // ใช้ Token ส่งไปเพื่อระบุตัวตน
      callServerFunction('getStudentAttendance', sessionToken)
    ]);
    
    const gpaData = gradesResult.success ? gradesResult.gpa : { total_gpa: '0.00' };
    const attendanceData = attendanceResult.success ? attendanceResult.data : { attendance_rate: 0 };
    const studentInfo = window.currentUser;

    const html = `
      <div class="bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl p-8 mb-6 shadow-lg relative overflow-hidden">
        <div class="relative z-10">
          <h2 class="text-3xl font-bold mb-2">ยินดีต้อนรับ, ${studentInfo.name}</h2>
          <p class="text-purple-100 opacity-90">
            รหัสนักเรียน: ${studentInfo.student_code || '-'} | 
            ${studentInfo.class_id ? 'กำลังศึกษา' : 'นักเรียน'}
          </p>
        </div>
        <i class="fas fa-graduation-cap absolute -bottom-4 -right-4 text-9xl text-white opacity-10 transform rotate-12"></i>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="card p-6 flex items-center justify-between border-l-4 border-purple-500 shadow-md">
          <div>
            <p class="text-gray-500 font-medium mb-1">เกรดเฉลี่ยสะสม (GPA)</p>
            <h3 class="text-4xl font-bold text-purple-600">${gpaData.total_gpa}</h3>
          </div>
          <div class="bg-purple-100 p-4 rounded-full text-purple-600">
            <i class="fas fa-star text-3xl"></i>
          </div>
        </div>

        <div class="card p-6 flex items-center justify-between border-l-4 border-pink-500 shadow-md">
          <div>
            <p class="text-gray-500 font-medium mb-1">การเข้าเรียน</p>
            <h3 class="text-4xl font-bold ${parseFloat(attendanceData.attendance_rate) >= 80 ? 'text-green-600' : 'text-red-500'}">
              ${attendanceData.attendance_rate}%
            </h3>
          </div>
          <div class="bg-pink-100 p-4 rounded-full text-pink-600">
            <i class="fas fa-user-clock text-3xl"></i>
          </div>
        </div>
      </div>
      
      <h3 class="text-xl font-bold text-gray-800 mb-4">เมนูของฉัน</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div onclick="navigateTo('studentGrades')" class="card p-6 cursor-pointer hover:shadow-lg transition-all group flex items-center space-x-4">
          <div class="bg-blue-500 text-white w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
            <i class="fas fa-file-alt"></i>
          </div>
          <div>
            <h4 class="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors">ดูผลการเรียน</h4>
            <p class="text-sm text-gray-500">ตรวจสอบเกรดรายวิชา</p>
          </div>
          <i class="fas fa-chevron-right ml-auto text-gray-300"></i>
        </div>

        <div onclick="navigateTo('studentAttendance')" class="card p-6 cursor-pointer hover:shadow-lg transition-all group flex items-center space-x-4">
          <div class="bg-green-500 text-white w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
            <i class="fas fa-calendar-alt"></i>
          </div>
          <div>
            <h4 class="font-bold text-lg text-gray-800 group-hover:text-green-600 transition-colors">สถิติการมาเรียน</h4>
            <p class="text-sm text-gray-500">เช็ควันลา / มาสาย</p>
          </div>
          <i class="fas fa-chevron-right ml-auto text-gray-300"></i>
        </div>

        <div onclick="navigateTo('profile')" class="card p-6 cursor-pointer hover:shadow-lg transition-all group flex items-center space-x-4 md:col-span-2">
          <div class="bg-gray-500 text-white w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
            <i class="fas fa-user-circle"></i>
          </div>
          <div>
            <h4 class="font-bold text-lg text-gray-800 group-hover:text-gray-600 transition-colors">ข้อมูลส่วนตัว</h4>
            <p class="text-sm text-gray-500">ดูประวัติและข้อมูลติดต่อ</p>
          </div>
          <i class="fas fa-chevron-right ml-auto text-gray-300"></i>
        </div>

      </div>
    `;
    
    document.getElementById('pageContent').innerHTML = html;
  } catch (error) {
    console.error('Error loading student dashboard:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Helper: สร้างแถวนักเรียนขนาดเล็ก (สำหรับ Dashboard)
 */
function renderMiniStudentRow(student) {
  const fullName = `${student.prefix || ''} ${student.firstname} ${student.lastname}`.trim();
  const initial = getInitials(fullName);
  
  return `
    <div class="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors border-b last:border-0 border-gray-100">
      ${student.photo_url ? `
        <img src="${student.photo_url}" alt="${fullName}" class="w-10 h-10 rounded-full object-cover shadow-sm">
      ` : `
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs shadow-sm">
          ${initial}
        </div>
      `}
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-gray-800 truncate">${fullName}</p>
        <p class="text-xs text-gray-500">${student.student_code} - ${student.level}/${student.room}</p>
      </div>
      <span class="badge ${getStatusColor(student.status)} text-[10px] px-2">
        ${student.status === 'active' ? 'ปกติ' : student.status}
      </span>
    </div>
  `;
}

// ===================================
// STUDENTS PAGE
// ===================================

function getStudentFormFields(options = {}) {
  const { isEditMode = false, homeroomClass = null } = options;
  
  // 1. เตรียมตัวเลือกระดับชั้น
  let levelOptions = [];
  if (window.allClassesData && window.allClassesData.length > 0) {
    const uniqueLevels = [...new Set(window.allClassesData.map(c => c.level))];
    uniqueLevels.sort((a, b) => a.localeCompare(b, 'th'));
    levelOptions = uniqueLevels.map(l => ({ value: l, label: l }));
  } else {
    levelOptions = [
      { value: 'ป.1', label: 'ป.1' }, { value: 'ป.2', label: 'ป.2' },
      { value: 'ป.3', label: 'ป.3' }, { value: 'ป.4', label: 'ป.4' },
      { value: 'ป.5', label: 'ป.5' }, { value: 'ป.6', label: 'ป.6' }
    ];
  }

  const fields = [
    { name: 'photo_url', label: 'รูปนักเรียน', type: 'file', colSpan: 3 },

    // Section 1: ข้อมูลนักเรียน
    { type: 'section', label: 'ข้อมูลนักเรียน' },
    { name: 'student_code', label: 'รหัสนักเรียน', type: 'text', required: true, colSpan: 1 },
    { name: 'id_card', label: 'เลขบัตรประชาชน (13 หลัก)', type: 'text', colSpan: 2, numeric: true, maxlength: 13 },
    { name: 'prefix', label: 'คำนำหน้า', type: 'select', required: true, options: [
      { value: 'เด็กชาย', label: 'เด็กชาย' }, { value: 'เด็กหญิง', label: 'เด็กหญิง' },
      { value: 'นาย', label: 'นาย' }, { value: 'นางสาว', label: 'นางสาว' }
    ]},
    { name: 'firstname', label: 'ชื่อ', type: 'text', required: true },
    { name: 'lastname', label: 'นามสกุล', type: 'text', required: true },
    { name: 'nickname', label: 'ชื่อเล่น', type: 'text' },
    { name: 'birthdate', label: 'วันเกิด', type: 'date', required: true },
    { name: 'gender', label: 'เพศ', type: 'select', options: [
      { value: 'male', label: 'ชาย' }, { value: 'female', label: 'หญิง' }, { value: 'other', label: 'อื่นๆ' }
    ]},
    { name: 'blood_type', label: 'กลุ่มเลือด', type: 'select', options: [
      { value: '', label: 'ไม่ระบุ' }, { value: 'A', label: 'A' }, { value: 'B', label: 'B' },
      { value: 'AB', label: 'AB' }, { value: 'O', label: 'O' }
    ]},

    // [⭐️ แก้ไขตรงนี้ ⭐️] เปลี่ยนเป็น Text ตามที่ต้องการ
    { name: 'ethnicity', label: 'เชื้อชาติ', type: 'text' },
    { name: 'nationality', label: 'สัญชาติ', type: 'text' },
    
    // ศาสนายังคงเป็น Dropdown (หรือจะเปลี่ยนเป็น text ก็ได้ถ้าต้องการ)
    { name: 'religion', label: 'ศาสนา', type: 'select', options: [
      { value: 'พุทธ', label: 'พุทธ' },
      { value: 'อิสลาม', label: 'อิสลาม' },
      { value: 'คริสต์', label: 'คริสต์' },
      { value: 'ฮินดู', label: 'ฮินดู' },
      { value: 'ซิกข์', label: 'ซิกข์' },
      { value: 'อื่นๆ', label: 'อื่นๆ' }
    ]},

    { name: 'phone', label: 'เบอร์โทรศัพท์', type: 'text', numeric: true, maxlength: 10 },
    { name: 'email', label: 'อีเมล', type: 'email' },
    
    // Section 2: ข้อมูลการศึกษา
    { type: 'section', label: 'ข้อมูลการศึกษา' },
    { 
      name: 'level', 
      label: 'ระดับชั้น', 
      type: 'select', 
      required: true, 
      options: levelOptions,
      disabled: !!homeroomClass,
      value: homeroomClass ? homeroomClass.level : '',
      id: 'input_student_level'
    },
    { 
      name: 'room', 
      label: 'ห้อง', 
      type: 'select', 
      required: true,
      options: [],
      disabled: !!homeroomClass,
      value: homeroomClass ? homeroomClass.room : '',
      id: 'input_student_room'
    },
    { name: 'student_number', label: 'เลขที่', type: 'number' },
    
    { name: 'entry_year', label: 'ปีที่เข้าเรียน (พ.ศ.)', type: 'text', 
      disabled: !!homeroomClass,
      value: homeroomClass ? homeroomClass.year : (new Date().getFullYear() + 543)
    },
    ...(isEditMode ? [{ 
      name: 'status', label: 'สถานะ', type: 'select', required: true, options: [
        { value: 'active', label: 'กำลังศึกษา' },
        { value: 'graduated', label: 'จบการศึกษา' },
        { value: 'transferred', label: 'ย้ายโรงเรียน' },
        { value: 'dropped', label: 'พ้นสภาพ' }
      ], colSpan: 2
    }] : []),

    // Section 3: ข้อมูลที่อยู่
    { type: 'section', label: 'ข้อมูลที่อยู่' },
    { name: 'address_main', label: 'ที่อยู่ (บ้านเลขที่, ถนน)', type: 'text', colSpan: 3 },
    { name: 'address_subdistrict', label: 'ตำบล/แขวง', type: 'text', id: 'sub_district' },
    { name: 'address_district', label: 'อำเภอ/เขต', type: 'text', id: 'district' },
    { name: 'address_province', label: 'จังหวัด', type: 'text', id: 'province' },
    { name: 'address_zipcode', label: 'รหัสไปรษณีย์', type: 'text', id: 'postcode' },

    // Section 4: ข้อมูลผู้ปกครอง
    { type: 'section', label: 'ข้อมูลผู้ปกครอง' },
    { name: 'father_name', label: 'ชื่อ-สกุลบิดา', type: 'text' },
    { name: 'father_occupation', label: 'อาชีพบิดา', type: 'text' },
    { name: 'father_phone', label: 'เบอร์บิดา', type: 'text', numeric: true, maxlength: 10 },
    { name: 'mother_name', label: 'ชื่อ-สกุลมารดา', type: 'text' },
    { name: 'mother_occupation', label: 'อาชีพมารดา', type: 'text' },
    { name: 'mother_phone', label: 'เบอร์มารดา', type: 'text', numeric: true, maxlength: 10 },
    { name: 'parent_marital_status', label: 'สถานภาพสมรสของบิดา - มารดา', type: 'select', options: [
        { value: '', label: 'ไม่ระบุ' }, { value: 'อยู่ด้วยกัน', label: 'อยู่ด้วยกัน' },
        { value: 'แยกกันอยู่', label: 'แยกกันอยู่' }, { value: 'บิดาถึงแก่กรรม', label: 'บิดาถึงแก่กรรม' },
        { value: 'มารดาถึงแก่กรรม', label: 'มารดาถึงแก่กรรม' }, { value: 'บิดาและมารดาถึงแก่กรรม', label: 'บิดาและมารดาถึงแก่กรรม' }
      ], colSpan: 3 },
    { name: 'guardian_name', label: 'ชื่อ-สกุลผู้ปกครอง', type: 'text', colSpan: 3 },
    { name: 'guardian_relation', label: 'ความเกี่ยวข้องกับนักเรียน', type: 'text' },
    { name: 'guardian_occupation', label: 'อาชีพ', type: 'text' },
    { name: 'guardian_phone', label: 'เบอร์ผู้ปกครอง', type: 'text', numeric: true, maxlength: 10 }
  ];
  return fields;
}

function prepareStudentData(data) {
  // ตรวจสอบว่ามีข้อมูล address_main หรือไม่
  if (data.address_main !== undefined) {
    data.address = {
      address: data.address_main || '',
      subdistrict: data.address_subdistrict || '',
      district: data.address_district || '',
      province: data.address_province || '',
      zipcode: data.address_zipcode || ''
    };
    // ลบ key ย่อยๆ ออก
    delete data.address_main;
    delete data.address_subdistrict;
    delete data.address_district;
    delete data.address_province;
    delete data.address_zipcode;
  }
  return data;
}


async function renderStudentsPage() {
  renderBreadcrumb(['หน้าแรก', 'จัดการนักเรียน']);
  showLoading('กำลังโหลดข้อมูลนักเรียน...');
  
  try {
    const [studentsResult, classesResult] = await Promise.all([
      callServerFunction('getStudents'),
      callServerFunction('getClasses') // ⭐️ โหลดข้อมูลห้องเรียน
    ]);
    
    if (!studentsResult.success) {
      showToast(studentsResult.message, 'error');
      return;
    }
    
    window.studentsData = studentsResult.data || [];
    window.allClassesData = classesResult.success ? classesResult.data : []; // ⭐️ เก็บข้อมูลห้องเรียนไว้
    window.filteredStudents = [...window.studentsData];
    window.currentStudentsPage = 1;
    renderStudentsList();
  } catch (error) {
    console.error('Error loading students:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  } finally {
    hideLoading();
  }
}

function renderStudentsList() {
  const pageSize = 20;
  const currentUser = window.currentUser;

  // 1. ตรวจสอบสิทธิ์และตั้งค่า Lock
  let lockedLevel = null;
  let lockedRoom = null;

  if (currentUser.role === 'homeroom' && window.allClassesData) {
    const myClass = window.allClassesData.find(c => c.homeroom_teacher_id === currentUser.id && c.status === 'active');
    if (myClass) {
      lockedLevel = myClass.level;
      lockedRoom = myClass.room;
    }
  }

  // 2. อ่านค่าจาก Filter
  const currentQuery = document.getElementById('studentSearch') ? document.getElementById('studentSearch').value : '';
  const currentLevel = lockedLevel !== null ? lockedLevel : (document.getElementById('levelFilter') ? document.getElementById('levelFilter').value : '');
  const currentRoom = lockedRoom !== null ? lockedRoom : (document.getElementById('roomFilter') ? document.getElementById('roomFilter').value : '');
  const currentStatus = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : '';

  // 3. เตรียมตัวเลือก Level & Room
  let levelOptionsHtml = `<option value="" ${currentLevel === '' ? 'selected' : ''}>ทุกระดับชั้น</option>`;
  let uniqueLevels = [];
  
  if (window.allClassesData && window.allClassesData.length > 0) {
    uniqueLevels = [...new Set(window.allClassesData.map(c => c.level))];
    
    // ✅ FIXED: ป้องกัน undefined ใน localeCompare
    uniqueLevels.sort((a, b) => (a || '').toString().localeCompare((b || '').toString(), 'th', { numeric: true }));
    
    uniqueLevels.forEach(level => {
      const isSelected = currentLevel === level;
      levelOptionsHtml += `<option value="${level}" ${isSelected ? 'selected' : ''}>${level}</option>`;
    });
  } else {
    ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'].forEach(level => {
       levelOptionsHtml += `<option value="${level}" ${currentLevel === level ? 'selected' : ''}>${level}</option>`;
    });
  }

  let roomOptionsHtml = `<option value="" ${currentRoom === '' ? 'selected' : ''}>ทุกห้อง</option>`;
  if (window.allClassesData && window.allClassesData.length > 0) {
    let classesForRoom = window.allClassesData;
    if (currentLevel) {
      classesForRoom = classesForRoom.filter(c => c.level === currentLevel);
    }
    
    const uniqueRooms = [...new Set(classesForRoom.map(c => c.room))];
    // ✅ FIXED: ป้องกัน undefined
    uniqueRooms.sort((a, b) => (a || '').toString().localeCompare((b || '').toString(), 'th', { numeric: true }));
    
    uniqueRooms.forEach(room => {
      const isSelected = currentRoom === room;
      roomOptionsHtml += `<option value="${room}" ${isSelected ? 'selected' : ''}>ห้อง ${room}</option>`;
    });
  }

  // 4. กรองข้อมูล
  let results = [...window.studentsData];
  
  if (currentQuery) {
    results = filterArray(results, currentQuery, ['firstname', 'lastname', 'student_code']);
  }
  if (currentLevel) {
    results = results.filter(s => s.level === currentLevel);
  }
  if (currentRoom) {
    results = results.filter(s => s.room === currentRoom);
  }
  if (currentStatus) {
    results = results.filter(s => s.status === currentStatus);
  }

  // 5. Pagination & Columns
  window.filteredStudents = results;
  const paginated = paginateArray(window.filteredStudents, window.currentStudentsPage, pageSize);
  
  const columns = [
    { 
      label: 'รูปภาพ', 
      field: 'photo_url', 
      render: (val, row) => {
        const fullName = `${row.prefix || ''} ${row.firstname} ${row.lastname}`.trim();
        const initial = getInitials(fullName);
        return val 
          ? `<img src="${val}" alt="${fullName}" class="w-10 h-10 rounded-full object-cover">`
          : `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">${initial}</div>`;
      } 
    },
    { label: 'รหัสนักเรียน', field: 'student_code', className: 'font-mono' },
    { label: 'ชื่อ-นามสกุล', field: 'firstname', render: (val, row) => `${row.prefix || ''} ${row.firstname} ${row.lastname}`.trim() },
    { label: 'ชั้น/ห้อง', field: 'level', render: (val, row) => `${row.level}/${row.room}` },
    { label: 'เลขที่', field: 'student_number', render: (val) => val || '-' },
    { label: 'สถานะ', field: 'status', render: (val) => `<span class="badge ${getStatusColor(val)}">${val === 'active' ? 'กำลังศึกษา' : val}</span>` }
  ];

  const actions = (student) => `
    <button onclick="showStudentDetails('${student.id}')" class="p-2 text-gray-600 hover:bg-gray-50 rounded" title="ดูรายละเอียด">
      <i class="fas fa-eye"></i>
    </button>
    <button 
      class="btn-edit-student p-2 text-blue-600 hover:bg-blue-50 rounded" 
      title="แก้ไข" 
      data-student-id="${student.id}"
    >
      <i class="fas fa-edit"></i>
    </button>
    <button 
      class="btn-delete-student p-2 text-red-600 hover:bg-red-50 rounded" 
      title="ลบ" 
      data-student-id="${student.id}"
    >
      <i class="fas fa-trash"></i>
    </button>
  `;

  const levelDisabledAttr = lockedLevel ? 'disabled class="form-select bg-gray-100 cursor-not-allowed"' : 'class="form-select"';
  const roomDisabledAttr = lockedRoom ? 'disabled class="form-select bg-gray-100 cursor-not-allowed"' : 'class="form-select"';

  const html = `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">จัดการนักเรียน</h2>
      <div class="flex space-x-2">
        <button onclick="showImportCSVModal()" class="btn btn-success">
          <i class="fas fa-file-csv mr-2"></i>นำเข้า CSV
        </button>
        <button onclick="showAddStudentModal()" class="btn btn-primary">
          <i class="fas fa-plus mr-2"></i>เพิ่มนักเรียน
        </button>
      </div>
    </div>
    
    <div class="card p-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="relative">
          <input 
            type="text" 
            id="studentSearch"
            class="form-input pl-10"
            placeholder="ค้นหา (ชื่อ, รหัส)"
            oninput="debouncedApplyStudentFilters()"
            value="${currentQuery}" 
          >
          <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
        </div>
        <select id="levelFilter" ${levelDisabledAttr} onchange="applyStudentFilters()">
          ${levelOptionsHtml}
        </select>
        <select id="roomFilter" ${roomDisabledAttr} onchange="applyStudentFilters()">
          ${roomOptionsHtml}
        </select>
        <select class="form-select" id="statusFilter" onchange="applyStudentFilters()">
          <option value="" ${currentStatus === '' ? 'selected' : ''}>ทุกสถานะ</option>
          <option value="active" ${currentStatus === 'active' ? 'selected' : ''}>กำลังศึกษา</option>
          <option value="graduated" ${currentStatus === 'graduated' ? 'selected' : ''}>จบการศึกษา</option>
          <option value="transferred" ${currentStatus === 'transferred' ? 'selected' : ''}>ย้ายโรงเรียน</option>
          <option value="dropped" ${currentStatus === 'dropped' ? 'selected' : ''}>พ้นสภาพ</option>
        </select>
      </div>
    </div>
    
    <div class="card p-0 md:p-4 hidden md:block">
      ${renderDataTable(paginated.data, columns, {
        actions: actions,
        emptyMessage: 'ไม่พบข้อมูลนักเรียน'
      })}
    </div>
    
    <div class="grid grid-cols-1 gap-4 md:hidden">
      ${paginated.data.length > 0 ? paginated.data.map(student => renderStudentCard(student)).join('') : renderEmptyState('ไม่พบข้อมูลนักเรียน')}
    </div>
    
    ${renderPagination(paginated.total, paginated.page, paginated.pageSize, (page) => {
      window.currentStudentsPage = page;
      renderStudentsList();
    })}
  `;
  
  document.getElementById('pageContent').innerHTML = html;
  attachStudentCardEventListeners();
}

// สร้างฟังก์ชัน debounced สำหรับการค้นหา
window.debouncedApplyStudentFilters = debounce(applyStudentFilters, 300);

/**
 * สั่งให้ทำการกรองและวาดตารางใหม่
 */
function applyStudentFilters() {
  window.currentStudentsPage = 1;
  renderStudentsList();
}

/**
 * [⭐️ แก้ไข ⭐️] แสดง Modal สำหรับนำเข้า CSV (ปรับ UI Preview)
 */
function showImportCSVModal() {
  const modalId = 'importCSVModal_' + Date.now();
  
  const html = `
    <div id="${modalId}" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
      <div class="modal-content bg-white rounded-lg p-6 max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto"> <div class="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-4 border-b">
          <h3 class="text-2xl font-bold text-gray-800">นำเข้าข้อมูลนักเรียน (CSV)</h3>
          <button onclick="closeModal('${modalId}')" class="text-gray-400 hover:text-gray-600 transition-colors">
            <i class="fas fa-times text-2xl"></i>
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 class="text-lg font-semibold text-gray-700 mb-2">1. ดาวน์โหลดไฟล์ตัวอย่าง</h4>
            <p class="text-sm text-gray-600 mb-3">
              ใช้ไฟล์ Template นี้เพื่อกรอกข้อมูล (รองรับภาษาไทย)
            </p>
            <button onclick="downloadCSVTemplate()" class="btn btn-outline-primary text-sm w-full md:w-auto">
              <i class="fas fa-download mr-2"></i>ดาวน์โหลด Template
            </button>
          </div>
          
          <div>
            <h4 class="text-lg font-semibold text-gray-700 mb-2">2. อัปโหลดไฟล์</h4>
            <div class="flex items-center justify-center w-full">
                <label for="csvFileInput" class="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div class="flex flex-col items-center justify-center pt-5 pb-6">
                        <i class="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
                        <p class="text-sm text-gray-500"><span class="font-semibold">คลิกเพื่อเลือกไฟล์</span> หรือลากไฟล์มาวาง</p>
                        <p class="text-xs text-gray-500">CSV (UTF-8)</p>
                    </div>
                    <input id="csvFileInput" type="file" accept=".csv" class="hidden" onchange="handleCSVFileSelect(event)" />
                </label>
            </div>
          </div>
        </div>
        
        <div class="mb-6">
          <div class="flex justify-between items-end mb-2">
            <h4 class="text-lg font-semibold text-gray-700">ตัวอย่างข้อมูล (5 แถวแรก)</h4>
            <span id="rowCountDisplay" class="text-xs text-gray-500 font-medium"></span>
          </div>
          
          <div id="csvPreviewContainer" class="border rounded-lg max-h-80 overflow-auto bg-gray-50 relative">
            <div class="flex flex-col items-center justify-center h-40 text-gray-400">
              <i class="fas fa-table text-4xl mb-3 opacity-50"></i>
              <p>กรุณาเลือกไฟล์ CSV เพื่อแสดงตัวอย่าง</p>
            </div>
          </div>
        </div>
        
        <div id="csvErrorLog" class="hidden text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm mb-6">
        </div>

        <div class="flex justify-end space-x-3 mt-6 pt-6 border-t sticky bottom-0 bg-white">
          <button type="button" onclick="closeModal('${modalId}')" class="btn btn-secondary px-6">
            ยกเลิก
          </button>
          <button 
            type="button" 
            id="confirmUploadBtn" 
            class="btn btn-primary px-6" 
            onclick="confirmCSVUpload()"
            disabled
          >
            <i class="fas fa-check mr-2"></i>ยืนยันการนำเข้า
          </button>
        </div>
        
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML = html;
  window.csvUploadData = null;
}

/**
 * [⭐️ ปรับปรุงใหม่ ⭐️] ดาวน์โหลดไฟล์ CSV ตัวอย่าง (มีข้อมูลครบถ้วน 3 แถว)
 */
function downloadCSVTemplate() {
  const headers = [
    // ข้อมูลนักเรียน
    'student_code', 'prefix', 'firstname', 'lastname', 'nickname', 'birthdate', 'id_card', 
    'gender', 'blood_type', 
    'ethnicity', 'nationality', 'religion', // (ข้อมูลใหม่)
    'phone', 'email',
    
    // ข้อมูลการเรียน
    'level', 'room', 'student_number', 'entry_year',
    
    // ที่อยู่
    'address_main', 'address_subdistrict', 'address_district', 'address_province', 'address_zipcode',
    
    // ข้อมูลบิดา-มารดา
    'father_name', 'father_occupation', 'father_phone',
    'mother_name', 'mother_occupation', 'mother_phone',
    'parent_marital_status',
    
    // ข้อมูลผู้ปกครอง
    'guardian_name', 'guardian_relation', 'guardian_occupation', 'guardian_phone'
  ];
  
  // สร้างข้อมูลตัวอย่าง 3 คน (3 กรณี)
  const examples = [
    [
      '10001', 'เด็กชาย', 'รักเรียน', 'เพียรศึกษา', 'เอก', '2016-05-15', '1100012345678',
      'male', 'O', 'ไทย', 'ไทย', 'พุทธ', '0811111111', '',
      'ป.1', '1', '1', '2567',
      '12/3 หมู่ 4', 'บางเขน', 'เมืองนนทบุรี', 'นนทบุรี', '11000',
      'นายสมชาย เพียรศึกษา', 'รับราชการ', '0812222222',
      'นางสมหญิง เพียรศึกษา', 'ค้าขาย', '0813333333',
      'อยู่ด้วยกัน',
      'นายสมชาย เพียรศึกษา', 'บิดา', 'รับราชการ', '0812222222'
    ],
    [
      '10002', 'เด็กหญิง', 'ใจดี', 'มีสุข', 'บี', '2016-08-20', '1100087654321',
      'female', 'A', 'ไทย', 'ไทย', 'คริสต์', '0822222222', 'bee@example.com',
      'ป.1', '1', '2', '2567',
      '55/8 ถ.แจ้งวัฒนะ', 'คลองเกลือ', 'ปากเกร็ด', 'นนทบุรี', '11120',
      'นายใจมั่น มีสุข', 'พนักงานบริษัท', '0823333333',
      'นางใจงาม มีสุข', 'แม่บ้าน', '0824444444',
      'แยกกันอยู่',
      'นางใจงาม มีสุข', 'มารดา', 'แม่บ้าน', '0824444444'
    ],
    [
      '10003', 'เด็กชาย', 'อาหมัด', 'ศรัทธา', 'มัด', '2015-12-10', '1100099988877',
      'male', 'B', 'ไทย', 'ไทย', 'อิสลาม', '0833333333', '',
      'ป.1', '2', '1', '2567',
      '99 หมู่ 1', 'หนองจอก', 'หนองจอก', 'กรุงเทพมหานคร', '10530',
      'นายฮารูน ศรัทธา', 'เกษตรกร', '0834444444',
      'นางฟาติมา ศรัทธา', 'เกษตรกร', '0835555555',
      'อยู่ด้วยกัน',
      'นายฮารูน ศรัทธา', 'บิดา', 'เกษตรกร', '0834444444'
    ]
  ];
  
  // แปลงข้อมูลเป็น CSV String (ใส่ "..." ครอบข้อมูลเผื่อมี comma)
  const csvContent = [
    headers.join(','),
    ...examples.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');
  
  // สร้างไฟล์ดาวน์โหลด (เพิ่ม BOM \uFEFF เพื่อให้ Excel อ่านภาษาไทยออก)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'student_import_template_full.csv';
  link.click();
}

/**
 * [⭐️ แก้ไข ⭐️] จัดการเมื่อเลือกไฟล์ CSV (แสดงเป็นตารางสวยงาม)
 */
function handleCSVFileSelect(event) {
  const file = event.target.files[0];
  const container = document.getElementById('csvPreviewContainer');
  const rowCountDisplay = document.getElementById('rowCountDisplay');
  const confirmBtn = document.getElementById('confirmUploadBtn');
  
  if (!file) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-40 text-gray-400">
        <p>กรุณาเลือกไฟล์ CSV...</p>
      </div>`;
    confirmBtn.disabled = true;
    window.csvUploadData = null;
    return;
  }
  
  const reader = new FileReader();
  
  reader.onload = (e) => {
    const text = e.target.result;
    
    // เรียกใช้ parser จาก JS-Utils.js
    const data = parseCSV(text);
    
    if (data.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-40 text-red-500">
          <i class="fas fa-exclamation-circle text-3xl mb-2"></i>
          <p>ไม่พบข้อมูลในไฟล์ หรือรูปแบบไฟล์ไม่ถูกต้อง</p>
        </div>`;
      confirmBtn.disabled = true;
      window.csvUploadData = null;
      rowCountDisplay.textContent = '';
      return;
    }
    
    // สร้างตาราง HTML
    const headers = Object.keys(data[0]);
    const previewRows = data.slice(0, 5); // เอาแค่ 5 แถวแรก
    
    let tableHtml = `
      <table class="min-w-full divide-y divide-gray-200 text-sm border-collapse">
        <thead class="bg-gray-100 sticky top-0 z-10 shadow-sm">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-100 border-b w-12 text-center">#</th>
            ${headers.map(h => `
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-100 border-b whitespace-nowrap">
                ${h}
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          ${previewRows.map((row, index) => `
            <tr class="hover:bg-blue-50 transition-colors">
              <td class="px-4 py-2 whitespace-nowrap text-gray-500 text-center bg-gray-50 font-mono text-xs border-r">
                ${index + 1}
              </td>
              ${headers.map(h => `
                <td class="px-4 py-2 whitespace-nowrap text-gray-700 border-r last:border-r-0">
                  ${row[h] || '<span class="text-gray-300">-</span>'}
                </td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    // ถ้ามีข้อมูลมากกว่า 5 แถว ให้แสดงข้อความบอก
    if (data.length > 5) {
        tableHtml += `
            <div class="p-3 text-center text-xs text-gray-500 bg-gray-50 border-t">
                ... และอีก ${data.length - 5} รายการ ...
            </div>
        `;
    }

    container.innerHTML = tableHtml;
    container.classList.remove('bg-gray-50'); // เอาสีพื้นหลังออกเพื่อให้ตารางขาวสวย
    container.classList.add('bg-white');
    
    rowCountDisplay.textContent = `พบข้อมูลทั้งหมด ${data.length} รายการ`;
    
    window.csvUploadData = data;
    confirmBtn.disabled = false;
    document.getElementById('csvErrorLog').classList.add('hidden');
  };
  
  reader.onerror = () => {
    container.innerHTML = '<div class="p-4 text-red-500 text-center">ไม่สามารถอ่านไฟล์ได้</div>';
    confirmBtn.disabled = true;
    window.csvUploadData = null;
  };
  
  reader.readAsText(file, 'UTF-8');
}

/**
 * [⭐️ ใหม่ ⭐️] ยืนยันการอัปโหลด CSV
 */
async function confirmCSVUpload() {
  const data = window.csvUploadData;
  if (!data || data.length === 0) {
    showToast('ไม่มีข้อมูลให้อัปโหลด', 'warning');
    return;
  }

  const confirmBtn = document.getElementById('confirmUploadBtn');
  confirmBtn.disabled = true;
  
  await waitForResponse(
    () => callServerFunction('batchCreateStudents', data),
    `กำลังนำเข้าข้อมูลนักเรียน ${data.length} รายการ...`,
    (result) => {
      if (result.success) {
        const summary = result.summary;
        const message = `นำเข้าสำเร็จ ${summary.added} รายการ\nล้มเหลว ${summary.failed} รายการ`;
        
        if (summary.failed > 0) {
          const errorLogEl = document.getElementById('csvErrorLog');
          errorLogEl.innerHTML = `<strong>พบข้อผิดพลาด ${summary.failed} รายการ:</strong><br>` + summary.errors.join('<br>');
          errorLogEl.classList.remove('hidden');
          showToast(message, 'warning', 5000);
          confirmBtn.disabled = false; // เปิดให้ลองใหม่
        } else {
          showToast(message, 'success');
          closeModal(document.querySelector('.modal-overlay').id); // ปิด Modal
        }
        
        renderStudentsPage(); // รีเฟรชหน้า
      } else {
        showToast('เกิดข้อผิดพลาด: ' + result.message, 'error');
        confirmBtn.disabled = false;
      }
    },
    (error) => {
      // กรณี network error
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
      confirmBtn.disabled = false;
    }
  );
  
  window.csvUploadData = null; // เคลียร์ข้อมูลหลังอัปโหลด
}


/**
 * [⭐️ แก้ไข ⭐️] แสดง Modal เพิ่มนักเรียน (Validation + Error Handling)
 */
async function showAddStudentModal() {
  // ตรวจสอบว่าโหลดข้อมูลห้องเรียนหรือยัง
  if (!window.allClassesData) {
    try {
        const result = await callServerFunction('getClasses');
        if(result.success) window.allClassesData = result.data;
    } catch(e) { console.error(e); }
  }
  
  _showAddStudentModalLogic();
}

function _showAddStudentModalLogic() {
  let fields;
  let initialData = {};
  const role = window.currentUser.role;

  // ถ้าเป็นครูประจำชั้น ให้ล็อกห้องเรียนไว้เลย
  if (role === 'homeroom' && window.allClassesData) {
    const myClass = window.allClassesData.find(c => c.homeroom_teacher_id === window.currentUser.id && c.status === 'active');
    if (myClass) {
      fields = getStudentFormFields({ homeroomClass: myClass });
      initialData = { level: myClass.level, room: myClass.room, entry_year: myClass.year };
    } else {
      fields = getStudentFormFields({ isEditMode: false }); 
    }
  } else {
    fields = getStudentFormFields({ isEditMode: false });
  }

  const modalId = 'studentFormModal';

  // เรียกใช้ showFormModal
  showFormModal('เพิ่มนักเรียนใหม่', fields, async (data) => {
    
    // --- 1. ตรวจสอบข้อมูลฝั่ง Client (Validation) ---
    
    // เช็คเลขบัตรประชาชน (ต้องมี 13 หลัก และถูกต้องตามสูตร)
    if (data.id_card && !validateIDCard(data.id_card)) {
      showToast('เลขบัตรประชาชนไม่ถูกต้อง (ต้องเป็นตัวเลข 13 หลัก)', 'warning');
      return false; // ❌ ห้ามปิด Modal
    }
    
    // เช็ครหัสนักเรียน (ต้องเป็นตัวเลข)
    if (data.student_code && !/^\d+$/.test(data.student_code)) {
      showToast('รหัสนักเรียนต้องเป็นตัวเลขเท่านั้น', 'warning');
      return false; // ❌ ห้ามปิด Modal
    }

    // เติมข้อมูลห้องเรียนอัตโนมัติ (กรณีครูประจำชั้น)
    if (role === 'homeroom' && initialData.level) {
      data.level = initialData.level;
      data.room = initialData.room;
      data.entry_year = initialData.entry_year;
    }
    
    // จัดการรูปภาพ
    if (data.photo_url && data.photo_url.startsWith('data:image')) {
        data.photo_base64 = data.photo_url;
        delete data.photo_url;
    }

    const studentData = prepareStudentData(data);
    let isSuccess = false;

    // --- 2. ส่งข้อมูลไป Server ---
    await waitForResponse(
      () => callServerFunction('createStudent', studentData),
      'กำลังบันทึกข้อมูล...',
      (result) => {
        if (result.success) {
          showToast('เพิ่มนักเรียนสำเร็จ', 'success');
          renderStudentsPage(); // รีเฟรชตาราง
          isSuccess = true; // ✅ บันทึกผ่าน -> ปิด Modal ได้
        } else {
          // กรณี Server แจ้ง Error (เช่น รหัสซ้ำ)
          // waitForResponse จะแสดง Toast Error ให้อยู่แล้ว
          console.error(result.message);
          isSuccess = false; // ❌ บันทึกไม่ผ่าน -> ห้ามปิด Modal
        }
      }
    );
    
    return isSuccess; // ส่งผลลัพธ์กลับไปให้ showFormModal

  }, initialData, modalId);

  // โหลด Dropdown ห้องเรียน
  setTimeout(() => { setupDynamicRoomDropdown(initialData.room || ''); }, 200);
}

/**
 * [⭐️ แก้ไข ⭐️] แก้ไขข้อมูลนักเรียน (Validation + Error Handling)
 */
async function editStudent(studentId) {
  showLoading('กำลังโหลดข้อมูล...');
  try {
    // โหลดข้อมูลพื้นฐานถ้ายังไม่มี
    if (!window.studentsData || window.studentsData.length === 0) {
      const result = await callServerFunction('getStudents');
      if (result.success) window.studentsData = result.data || [];
    }
    if (!window.allClassesData) {
      const cResult = await callServerFunction('getClasses');
      if (cResult.success) window.allClassesData = cResult.data || [];
    }
    
    const student = window.studentsData ? window.studentsData.find(s => s.id === studentId) : null;
    if (!student) {
      showToast('ไม่พบข้อมูลนักเรียน', 'error');
      hideLoading();
      return;
    }
    
    hideLoading();

    const role = window.currentUser.role;
    let myClass = null;
    let shouldLockFields = false;

    if (role === 'homeroom' && window.allClassesData) {
      myClass = window.allClassesData.find(c => c.homeroom_teacher_id === window.currentUser.id && c.status === 'active');
      if (myClass && student.level === myClass.level && student.room === myClass.room) {
        shouldLockFields = true;
      }
    }

    const fields = getStudentFormFields({ 
      isEditMode: true, 
      homeroomClass: shouldLockFields ? myClass : null 
    });
    
    const initialData = {
      ...student,
      address_main: student.address?.address || '',
      address_subdistrict: student.address?.subdistrict || '',
      address_district: student.address?.district || '',
      address_province: student.address?.province || '',
      address_zipcode: student.address?.zipcode || '',
      photo_url: student.photo_url 
    };
    
    const modalId = 'studentFormModal';

    showFormModal('แก้ไขข้อมูลนักเรียน', fields, async (data) => {
      
      // --- 1. Validation ---
      if (data.id_card && !validateIDCard(data.id_card)) {
        showToast('เลขบัตรประชาชนไม่ถูกต้อง (ต้องเป็นตัวเลข 13 หลัก)', 'warning');
        return false; // ❌ ห้ามปิด Modal
      }

      if (shouldLockFields && myClass) {
        data.level = myClass.level;
        data.room = myClass.room;
        data.entry_year = myClass.year;
      }

      if (data.photo_url && data.photo_url.startsWith('data:image')) {
          data.photo_base64 = data.photo_url;
          delete data.photo_url; 
      } else {
          delete data.photo_url;
      }

      const studentData = prepareStudentData(data);
      let isSuccess = false;
      
      // --- 2. Call Server ---
      await waitForResponse(
        () => callServerFunction('updateStudent', studentId, studentData),
        'กำลังบันทึกข้อมูล...',
        (result) => {
          if (result.success) {
            showToast('บันทึกข้อมูลสำเร็จ', 'success');
            // อัปเดตข้อมูลในเครื่องทันที ไม่ต้องโหลดใหม่หมด
            if (window.studentsData) {
              const index = window.studentsData.findIndex(s => s.id === studentId);
              if (index !== -1) window.studentsData[index] = result.data;
            }
            if (window.currentPage === 'students') {
              renderStudentsList();
            }
            isSuccess = true; // ✅ ผ่าน
          } else {
            // กรณี Server แจ้ง Error (เช่น เลขบัตรซ้ำ)
            console.error(result.message);
            isSuccess = false; // ❌ ไม่ผ่าน
          }
        }
      );
      
      return isSuccess;

    }, initialData, modalId);

    setTimeout(() => { setupDynamicRoomDropdown(student.room || ''); }, 200);

  } catch (error) {
    console.error('Error editing student:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
    hideLoading();
  }
}

function setupDynamicRoomDropdown(initialRoomValue = '') {
  const levelSelect = document.getElementById('input_student_level');
  const roomSelect = document.getElementById('input_student_room');
  
  if (!levelSelect || !roomSelect) return;

  const allClasses = window.allClassesData || [];

  const updateRooms = () => {
    const selectedLevel = levelSelect.value;
    
    // 1. กรองห้องที่มีในระดับชั้นนี้
    const validRooms = allClasses
      .filter(c => c.level === selectedLevel)
      .map(c => c.room);
      
    // 2. ทำให้ไม่ซ้ำและเรียงลำดับ
    const uniqueRooms = [...new Set(validRooms)].sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));

    // 3. อัปเดต options ใน select
    roomSelect.innerHTML = '<option value="">-- เลือกห้อง --</option>';
    
    if (uniqueRooms.length === 0) {
        // กรณีไม่มีห้องในระดับชั้นนี้ (อาจจะให้กรอกเอง หรือแสดงข้อความ)
        // ในที่นี้ให้เป็น dropdown ว่างๆ ไว้
    } else {
        uniqueRooms.forEach(r => {
          const option = document.createElement('option');
          option.value = r;
          option.textContent = r;
          roomSelect.appendChild(option);
        });
    }
    
    // 4. เลือกค่าเดิม (ถ้ามี)
    // ต้องเช็คว่าค่าเดิมมีอยู่ในรายการห้องใหม่หรือไม่ หรือถ้ามีห้องเดียวก็เลือกเลย
    if (initialRoomValue && uniqueRooms.includes(initialRoomValue)) {
      roomSelect.value = initialRoomValue;
    } else if (uniqueRooms.length === 1) {
      roomSelect.value = uniqueRooms[0];
    }
  };

  // ผูก Event Listener
  levelSelect.addEventListener('change', updateRooms);
  
  // เรียกทำงานครั้งแรกทันทีเพื่อโหลดห้องของระดับชั้นปัจจุบัน
  updateRooms();
  
  // บังคับเลือกค่าเดิมอีกครั้ง (กันเหนียว)
  if(initialRoomValue) {
      // ตรวจสอบอีกทีว่าห้องเดิมยังอยู่ใน list มั้ย (กรณีเปลี่ยน level ไปแล้วห้องเดิมอาจจะหายไป)
      // แต่ในการโหลดครั้งแรก level ยังเป็นค่าเดิม ดังนั้นห้องเดิมควรจะอยู่
      const options = Array.from(roomSelect.options).map(o => o.value);
      if(options.includes(initialRoomValue)){
          roomSelect.value = initialRoomValue;
      }
  }
}

async function showStudentDetails(studentId) {
  // โหลดข้อมูล studentsData ถ้ายังไม่มี
  if (!window.studentsData || window.studentsData.length === 0) {
      showLoading('กำลังโหลดข้อมูล...');
      try {
        const result = await callServerFunction('getStudents');
        if (result.success) {
          window.studentsData = result.data || [];
        } else {
          showToast(result.message, 'error');
          return;
        }
      } catch (error) {
        showToast('เกิดข้อผิดพลาด', 'error');
        return;
      } finally {
        hideLoading();
      }
  }

  const student = window.studentsData.find(s => s.id === studentId);
  if (!student) {
    showToast('ไม่พบข้อมูลนักเรียน', 'error');
    return;
  }

  const fullName = `${student.prefix || ''} ${student.firstname} ${student.lastname}`.trim();
  const address = student.address || {};
  const fullAddress = [
    address.address,
    `ต.${address.subdistrict || '-'} อ.${address.district || '-'}`,
    `จ.${address.province || '-'} ${address.zipcode || '-'}`
  ].filter(Boolean).join('\n');

  const details = [
    // ข้อมูลส่วนตัว
    { label: 'ชื่อเล่น', value: student.nickname },
    { label: 'เลขบัตรประชาชน', value: student.id_card },
    { label: 'วันเกิด', value: student.birthdate ? formatThaiDate(student.birthdate) : '-' },
    { label: 'เพศ', value: student.gender === 'male' ? 'ชาย' : (student.gender === 'female' ? 'หญิง' : student.gender) },
    { label: 'กลุ่มเลือด', value: student.blood_type },
    
    // [⭐️ เพิ่มตรงนี้ ⭐️] แสดงข้อมูลใหม่
    { label: 'เชื้อชาติ', value: student.ethnicity || '-' },
    { label: 'สัญชาติ', value: student.nationality || '-' },
    { label: 'ศาสนา', value: student.religion || '-' },

    // ข้อมูลการศึกษา
    { label: 'สถานะ', value: student.status === 'active' ? 'กำลังศึกษา' : student.status },
    { label: 'รหัสนักเรียน', value: student.student_code },
    { label: 'ระดับชั้น', value: `${student.level}/${student.room}` },
    { label: 'เลขที่', value: student.student_number || '-' },
    { label: 'ปีที่เข้าเรียน', value: student.entry_year },
    { label: 'วันที่เข้าเรียน', value: student.entry_date ? formatThaiDate(student.entry_date) : '-' },
    { label: 'วันที่จบการศึกษา', value: student.graduation_date ? formatThaiDate(student.graduation_date) : '-' },

    // ข้อมูลติดต่อ
    { label: 'เบอร์โทรศัพท์', value: student.phone },
    { label: 'อีเมล', value: student.email },
    { label: 'ที่อยู่', value: fullAddress },
    
    // ข้อมูลผู้ปกครอง
    { label: 'ชื่อ-สกุลบิดา', value: student.father_name },
    { label: 'อาชีพบิดา', value: student.father_occupation },
    { label: 'เบอร์บิดา', value: student.father_phone },
    { label: 'ชื่อ-สกุลมารดา', value: student.mother_name },
    { label: 'อาชีพมารดา', value: student.mother_occupation },
    { label: 'เบอร์มารดา', value: student.mother_phone },
    { label: 'สถานภาพบิดา-มารดา', value: student.parent_marital_status },
    { label: 'ชื่อ-สกุลผู้ปกครอง', value: student.guardian_name },
    { label: 'ความเกี่ยวข้อง', value: student.guardian_relation },
    { label: 'อาชีพผู้ปกครอง', value: student.guardian_occupation },
    { label: 'เบอร์ผู้ปกครอง', value: student.guardian_phone },
  ];

  const modalOptions = {
    imageUrl: student.photo_url,
    initials: getInitials(fullName)
  };

  renderDetailsModal(fullName, details, modalOptions);
}

function deleteStudent(studentId) {
  if (!studentId || studentId === 'undefined' || (typeof studentId === 'string' && studentId.trim() === '')) {
    console.error('❌ studentId is invalid:', studentId);
    showToast('เกิดข้อผิดพลาด: ไม่พบรหัสนักเรียน', 'error');
    return;
  }

  const student = window.studentsData && window.studentsData.find(s => s.id === studentId);
  if (!student) {
    console.error('❌ Student not found with id:', studentId);
    showToast('ไม่พบข้อมูลนักเรียน', 'error');
    return;
  }

  const fullName = `${student.prefix || ''} ${student.firstname} ${student.lastname}`.trim();

  showConfirmModal(
    'ยืนยันการลบ',
    `ต้องการลบนักเรียน ${fullName} ใช่หรือไม่?`,
    async () => {
      await waitForResponse(
        () => callServerFunction('deleteStudent', studentId),
        'กำลังลบข้อมูล...',
        (result) => {
          if (result.success) {
            showToast('ลบนักเรียนสำเร็จ', 'success');
            if (window.studentsData) {
              window.studentsData = window.studentsData.filter(s => s.id !== studentId);
            }
            if (window.filteredStudents) {
              window.filteredStudents = window.filteredStudents.filter(s => s.id !== studentId);
            }
            renderStudentsList();
          } else {
            showToast('เกิดข้อผิดพลาด: ' + result.message, 'error');
          }
        }
      );
    },
    { confirmText: 'ลบ', confirmColor: 'red' }
  );
}

// ===================================
// CLASSES PAGE
// ===================================

async function renderClassesPage() {
  renderBreadcrumb(['หน้าแรก', 'จัดการห้องเรียน']);
  showLoading('กำลังโหลดข้อมูลห้องเรียน...');
  
  try {
    const [classesResult, studentsResult] = await Promise.all([
      callServerFunction('getClasses'),
      callServerFunction('getStudents')
    ]);
    
    if (!classesResult.success) {
      showToast(classesResult.message, 'error');
      return;
    }
    
    window.classesData = classesResult.data || [];
    const allStudents = studentsResult.success ? (studentsResult.data || []) : [];
    
    const studentCounts = {};
    allStudents.forEach(student => {
      if (student.status === 'active') {
        const classKey = `${student.level}-${student.room}`;
        studentCounts[classKey] = (studentCounts[classKey] || 0) + 1;
      }
    });

// ✅ แก้ไข: เพิ่ม ( || '') เพื่อกันค่า Null
window.classesData.sort((a, b) => {
  const levelA = (a.level || '').toString();
  const levelB = (b.level || '').toString();
  const roomA = (a.room || '').toString();
  const roomB = (b.room || '').toString();

  if (levelA !== levelB) {
    return levelA.localeCompare(levelB, 'th-TH-u-nu-thai');
  }
  return roomA.localeCompare(roomB, 'th-TH-u-nu-thai');
});
    
    const html = `
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">จัดการห้องเรียน</h2>
        <button onclick="showAddClassModal()" class="btn btn-primary">
          <i class="fas fa-plus mr-2"></i>เพิ่มห้องเรียน
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${window.classesData.map(cls => { 
          const classKey = `${cls.level}-${cls.room}`;
          const studentCount = studentCounts[classKey] || 0;
          
          return `
          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="bg-blue-100 rounded-full p-3">
                <i class="fas fa-door-open text-2xl text-blue-600"></i>
              </div>
              <span class="badge ${getStatusColor(cls.status)}">
                ${cls.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              </span>
            </div>
            
            <h3 class="text-xl font-bold text-gray-800 mb-2">${cls.level}/${cls.room}</h3>
            <p class="text-sm text-gray-600 mb-4">ปีการศึกษา ${cls.year}</p>
            
            <div class="space-y-2 text-sm mb-4">
              <div class="flex items-center justify-between">
                <span class="text-gray-600">ครูประจำชั้น:</span>
                <span class="font-semibold">${cls.homeroom_teacher_name || '-'}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-600">นักเรียน:</span>
                <span class="font-semibold">${studentCount} / ${cls.capacity}</span>
              </div>
            </div>
            
            ${renderProgressBar(studentCount, cls.capacity, studentCount >= cls.capacity ? 'red' : 'blue')}
            
            <div class="flex space-x-2 mt-4">
              <button onclick="editClass('${cls.id}')" class="flex-1 btn btn-secondary text-sm">
                <i class="fas fa-edit mr-1"></i>แก้ไข
              </button>
              <button onclick="viewClassStudents('${cls.id}')" class="flex-1 btn btn-primary text-sm">
                <i class="fas fa-users mr-1"></i>นักเรียน
              </button>
              <button onclick="deleteClass('${cls.id}')" class="btn btn-danger px-3" title="ลบห้องเรียน">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
        }).join('')}
      </div>
    `;
    
    document.getElementById('pageContent').innerHTML = html;
  } catch (error) {
    console.error('Error loading classes:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * [⭐️ แก้ไข ⭐️] อัปเดต UI เป็น Hybrid (Checkbox + Buttons)
 */
async function viewClassStudents(classId) {
  showLoading('กำลังโหลดข้อมูลนักเรียน...');
  
  try {
    // 1. ดึงข้อมูลนักเรียนและห้องเรียน
    const [studentsResult, classesResult] = await Promise.all([
      callServerFunction('getStudents'),
      callServerFunction('getClasses')
    ]);

    if (!studentsResult.success || !classesResult.success) {
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
      return;
    }
    
    // 2. ค้นหาห้องเรียนและนักเรียนในห้อง
    const allStudents = studentsResult.data || [];
    const classes = classesResult.data || [];
    const selectedClass = classes.find(c => c.id === classId);
    
    if (!selectedClass) {
      showToast('ไม่พบข้อมูลห้องเรียน', 'error');
      return;
    }
    
    const classStudents = allStudents
      .filter(s => s.level === selectedClass.level && s.room === selectedClass.room && s.status === 'active')
      .sort((a, b) => (a.student_number || 99) - (b.student_number || 99));
      
    // [⭐️ ใหม่ ⭐️] เก็บข้อมูลไว้ใน window เพื่อให้ฟังก์ชันอื่นเรียกใช้
    window.currentModalStudents = classStudents;
    window.currentModalClass = selectedClass;
    
    const modalId = 'viewStudentsModal_' + Date.now();
    
    // 3. สร้าง HTML สำหรับ Modal
    const html = `
      <div id="${modalId}" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
        <div class="modal-content bg-white rounded-lg p-6 max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
          
          <div class="flex items-start justify-between mb-4 sticky top-0 bg-white z-10 pb-4 border-b">
            <div>
              <h3 class="text-2xl font-bold text-gray-800">นักเรียน ${selectedClass.level}/${selectedClass.room}</h3>
              <p class="text-sm text-gray-500">จำนวน ${classStudents.length} คน (ปีการศึกษา ${selectedClass.year})</p>
            </div>
            <button onclick="closeModal('${modalId}')" class="text-gray-400 hover:text-gray-600">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>

          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border mb-2">
            <label class="flex items-center space-x-3">
              <input type="checkbox" id="select-all-students-${modalId}" onchange="handleToggleSelectAllStudents('${modalId}', this.checked)" class="form-checkbox h-5 w-5">
              <span class="font-semibold text-gray-700">เลือกทั้งหมด</span>
            </label>
            <span class="text-sm text-gray-600">${classStudents.length} รายการ</span>
          </div>
          
          <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-2" id="student-list-container-${modalId}">
            ${classStudents.length > 0 ? classStudents.map((student, index) => {
              const fullName = `${student.prefix || ''} ${student.firstname} ${student.lastname}`.trim();
              const initial = getInitials(fullName);
              return `
                <div class="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg border">
                  <input type="checkbox" class="form-checkbox h-5 w-5 student-checkbox" data-student-id="${student.id}">

                  ${student.photo_url ? `
                    <img src="${student.photo_url}" alt="${fullName}" class="w-10 h-10 rounded-full object-cover ml-3">
                  ` : `
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold ml-3">
                      ${initial}
                    </div>
                  `}
                  
                  <div class="flex-1 min-w-0">
                    <p class="font-semibold text-gray-800 truncate">${fullName}</p>
                    <p class="text-sm text-gray-500">รหัส: ${student.student_code} (เลขที่ ${student.student_number || '-'})</p>
                  </div>

                  <div class="flex-shrink-0 flex space-x-1">
                    <button onclick="closeModal('${modalId}'); showStudentDetails('${student.id}')" class="p-2 text-gray-600 hover:bg-gray-50 rounded-lg" title="ดูรายละเอียด">
                      <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="closeModal('${modalId}'); editStudent('${student.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="แก้ไขข้อมูลนักเรียน">
                      <i class="fas fa-edit"></i>
                    </button>
                  </div>
                </div>
              `;
            }).join('') : '<p class="text-center text-gray-500 py-8">ยังไม่มีนักเรียนในห้องนี้</p>'}
          </div>
          
          <div class="flex justify-between items-center mt-6 pt-6 border-t sticky bottom-0 bg-white">
            <button onclick="closeModal('${modalId}')" class="btn btn-secondary px-6">ปิด</button>
            <button onclick="handleBatchMoveClick('${modalId}', '${classId}')" class="btn btn-primary px-6">
              <i class="fas fa-random mr-2"></i>ย้ายนักเรียนที่เลือก...
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('modalsContainer').innerHTML = html;
  } catch (error) {
    console.error('Error viewing class students:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * [⭐️ ใหม่ ⭐️] ฟังก์ชันสำหรับ ติ๊ก/ไม่ติ๊ก "เลือกทั้งหมด"
 * @param {string} modalId - ID ของ Modal
 * @param {boolean} checked - สถานะของ Checkbox
 */
function handleToggleSelectAllStudents(modalId, checked) {
  const container = document.getElementById(`student-list-container-${modalId}`);
  if (container) {
    container.querySelectorAll('.student-checkbox').forEach(checkbox => {
      checkbox.checked = checked;
    });
  }
}

/**
 * [⭐️ ใหม่ ⭐️] ฟังก์ชันสำหรับเริ่มกระบวนการ "ย้ายห้อง" (Batch)
 * @param {string} modalId - ID ของ Modal
 * @param {string} currentClassId - ID ห้องเรียนปัจจุบัน
 */
function handleBatchMoveClick(modalId, currentClassId) {
  const container = document.getElementById(`student-list-container-${modalId}`);
  if (!container) return;

  const selectedStudentIds = [];
  container.querySelectorAll('.student-checkbox:checked').forEach(checkbox => {
    selectedStudentIds.push(checkbox.dataset.studentId);
  });

  if (selectedStudentIds.length === 0) {
    showToast('กรุณาเลือกนักเรียนอย่างน้อย 1 คน', 'warning');
    return;
  }
  
  // ปิด Modal ปัจจุบัน ก่อนเปิด Modal ใหม่
  closeModal(modalId);
  
  // เรียกใช้ Modal ย้ายห้อง (ฟังก์ชันนี้มีอยู่แล้ว)
  showMoveStudentsModal(selectedStudentIds, currentClassId);
}


/**
 * [⭐️ คงไว้ ⭐️] แสดง Modal สำหรับ "ย้ายห้อง" (รองรับ 1 หรือหลายคน)
 * @param {Array<string>} studentIds - Array ของ ID นักเรียนที่จะย้าย
 * @param {string} currentClassId - ID ห้องเรียนปัจจุบัน (เพื่อกรองออกจาก List)
 */
async function showMoveStudentsModal(studentIds, currentClassId) {
  if (!studentIds || studentIds.length === 0) {
    showToast('กรุณาเลือกนักเรียนที่ต้องการย้าย', 'warning');
    return;
  }

  showLoading('กำลังโหลดข้อมูลห้องเรียน...');
  
  try {
    // 1. ดึงข้อมูลห้องเรียนทั้งหมด (ถ้ายังไม่มี)
    if (!window.classesData) {
      const result = await callServerFunction('getClasses');
      if (result.success) {
        window.classesData = result.data || [];
      } else {
        throw new Error('ไม่สามารถโหลดข้อมูลห้องเรียนได้');
      }
    }
    
    // 2. สร้าง options สำหรับห้องเรียนปลายทาง (กรองห้องปัจจุบันออก)
    const classOptions = window.classesData
      .filter(c => c.id !== currentClassId && c.status === 'active')
      .sort((a, b) => a.class_id.localeCompare(b.class_id))
      .map(c => ({ value: c.id, label: `${c.level}/${c.room} (ปี ${c.year})` }));

    hideLoading();
    
    if (classOptions.length === 0) {
      showAlert('ไม่พบห้องเรียนปลายทาง (ที่ใช้งานอยู่) ที่จะย้ายไป', 'info');
      return;
    }

    // 3. สร้าง Modal
    const modalId = 'moveStudentModal_' + Date.now();
    const formId = 'moveStudentForm_' + Date.now();
    const selectId = 'targetClassSelect_' + Date.now();
    
    const html = `
      <div id="${modalId}" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div class="modal-content bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <form id="${formId}">
            <h3 class="text-xl font-bold text-gray-800 mb-4">ย้ายนักเรียน (${studentIds.length} คน)</h3>
            <p class="text-sm text-gray-600 mb-6">เลือกห้องเรียนปลายทางที่ต้องการย้ายนักเรียนไป</p>
            
            <label for="${selectId}" class="form-label">ห้องเรียนปลายทาง</label>
            <select id="${selectId}" name="targetClassId" class="form-select" required>
              <option value="">-- เลือกห้องเรียน --</option>
              ${classOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
            </select>
            
            <div class="flex justify-end space-x-3 mt-8">
              <button type="button" onclick="closeModal('${modalId}')" class="btn btn-secondary">
                ยกเลิก
              </button>
              <button type_submit" class="btn btn-primary">
                <i class="fas fa-check mr-2"></i>ยืนยันการย้าย
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.getElementById('modalsContainer').innerHTML = html;
    
    // 4. จัดการการ Submit
    document.getElementById(formId).onsubmit = async (e) => {
      e.preventDefault();
      const targetClassId = document.getElementById(selectId).value;
      if (!targetClassId) {
        showToast('กรุณาเลือกห้องเรียนปลายทาง', 'warning');
        return;
      }
      
      closeModal(modalId);
      
      await waitForResponse(
        () => callServerFunction('batchMoveStudents', studentIds, targetClassId),
        `กำลังย้ายนักเรียน ${studentIds.length} คน...`,
        (result) => {
          if (result.success) {
            showToast(result.message, 'success');
            // รีเฟรชข้อมูลทั้ง 2 ส่วน
            // viewClassStudents(currentClassId); // ไม่ต้องเปิด Modal เดิมซ้ำ
            renderClassesPage(); // โหลดหน้าการ์ดห้องเรียนใหม่
          }
        }
      );
    };
    
  } catch (error) {
    console.error('Error showing move modal:', error);
    showToast(error.message, 'error');
    hideLoading();
  }
}


async function editClass(classId) {
  showLoading('กำลังโหลดข้อมูล...');
  
  try {
    // [⭐️ แก้ไข ⭐️] โหลดข้อมูลครูและห้องเรียนพร้อมกัน
    const [classesResult, teachersResult] = await Promise.all([
      callServerFunction('getClasses'),
      callServerFunction('getTeachers')
    ]);

    if (!classesResult.success) {
      showToast(classesResult.message, 'error');
      return;
    }
    
    const classes = classesResult.data || [];
    const classData = classes.find(c => c.id === classId);
    
    if (!classData) {
      showToast('ไม่พบข้อมูลห้องเรียน', 'error');
      return;
    }

    // สร้าง options ครู
    const teacherOptions = (teachersResult.data || []).map(teacher => ({
      value: teacher.id,
      label: `${teacher.name} (${getRoleLabel(teacher.role)})`
    }));
    
    hideLoading();
    
    const fields = [
      { name: 'level', label: 'ระดับชั้น', type: 'select', required: true, options: [
        { value: 'ป.1', label: 'ป.1' }, { value: 'ป.2', label: 'ป.2' },
        { value: 'ป.3', label: 'ป.3' }, { value: 'ป.4', label: 'ป.4' },
        { value: 'ป.5', label: 'ป.5' }, { value: 'ป.6', label: 'ป.6' }
      ]},
      { name: 'room', label: 'ห้อง', type: 'text', required: true },
      // [⭐️ แก้ไข ⭐️] ล็อกปีการศึกษา
      { name: 'year', label: 'ปีการศึกษา', type: 'text', required: true, value: classData.year, disabled: true },
      { name: 'capacity', label: 'ความจุ', type: 'number', required: true },
      // [⭐️ แก้ไข ⭐️] เปลี่ยนเป็น Combobox
      { 
        name: 'homeroom_teacher_id', 
        label: 'ครูประจำชั้น', 
        type: 'combobox', 
        options: teacherOptions 
      },
      { name: 'status', label: 'สถานะ', type: 'select', required: true, options: [
        { value: 'active', label: 'เปิดใช้งาน' },
        { value: 'inactive', label: 'ปิดใช้งาน' }
      ]}
    ];
    
    showFormModal('แก้ไขข้อมูลห้องเรียน', fields, async (data) => {
      // [⭐️ แก้ไข ⭐️] เพิ่มตรรกะค้นหาชื่อครู และส่งค่า year ที่ถูก disable
      const selectedTeacher = (teachersResult.data || []).find(t => t.id === data.homeroom_teacher_id);
      data.homeroom_teacher_name = selectedTeacher ? selectedTeacher.name : '';
      data.year = classData.year; // ส่งค่าปีการศึกษาเดิมกลับไป

      await waitForResponse(
        () => callServerFunction('updateClass', classId, data),
        'กำลังบันทึกข้อมูล...',
        (result) => {
          showToast('บันทึกข้อมูลสำเร็จ', 'success');
          renderClassesPage();
        }
      );
    }, classData); // ส่ง classData เดิมเข้าไป (รวม homeroom_teacher_id)
    
  } catch (error) {
    console.error('Error editing class:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
    hideLoading();
  }
}

async function showAddClassModal() {
  showLoading('กำลังโหลดข้อมูล...');
  
  try {
    // [⭐️ แก้ไข ⭐️] โหลดข้อมูลครูและ Config พร้อมกัน
    const [teachersResult, configResult] = await Promise.all([
      callServerFunction('getTeachers'),
      callServerFunction('getConfig')
    ]);
    
    const teacherOptions = (teachersResult.data || []).map(teacher => ({
      value: teacher.id,
      label: `${teacher.name} (${getRoleLabel(teacher.role)})`
    }));
    
    const currentYear = configResult.success ? (configResult.data.current_year || new Date().getFullYear() + 543) : new Date().getFullYear() + 543;
    
    hideLoading();

    const fields = [
      { name: 'level', label: 'ระดับชั้น', type: 'select', required: true, options: [
        { value: 'ป.1', label: 'ป.1' }, { value: 'ป.2', label: 'ป.2' },
        { value: 'ป.3', label: 'ป.3' }, { value: 'ป.4', label: 'ป.4' },
        { value: 'ป.5', label: 'ป.5' }, { value: 'ป.6', label: 'ป.6' }
      ]},
      { name: 'room', label: 'ห้อง', type: 'text', required: true },
      // [⭐️ แก้ไข ⭐️] ล็อกปีการศึกษา
      { name: 'year', label: 'ปีการศึกษา', type: 'text', required: true, value: currentYear, disabled: true },
      { name: 'capacity', label: 'ความจุ', type: 'number', required: true, value: '40' },
      // [⭐️ แก้ไข ⭐️] เปลี่ยนเป็น Combobox
      { 
        name: 'homeroom_teacher_id', 
        label: 'ครูประจำชั้น', 
        type: 'combobox', 
        options: teacherOptions 
      }
    ];
    
    showFormModal('เพิ่มห้องเรียนใหม่', fields, async (data) => {
      // [⭐️ แก้ไข ⭐️] เพิ่มตรรกะค้นหาชื่อครู และส่งค่า year ที่ถูก disable
      const selectedTeacher = (teachersResult.data || []).find(t => t.id === data.homeroom_teacher_id);
      data.homeroom_teacher_name = selectedTeacher ? selectedTeacher.name : '';
      data.year = currentYear; // ส่งค่าปีการศึกษาที่ล็อกไว้

      await waitForResponse(
        () => callServerFunction('createClass', data),
        'กำลังบันทึกข้อมูล...',
        (result) => {
          showToast('เพิ่มห้องเรียนสำเร็จ', 'success');
          renderClassesPage();
        }
      );
    });
  } catch (error) {
    console.error('Error adding class modal:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
    hideLoading();
  }
}

/**
 * [⭐️ ใหม่ ⭐️] ฟังก์ชันสำหรับลบห้องเรียน (ฝั่ง Client)
 * @param {string} classId - ID ห้องเรียน
 */
function deleteClass(classId) {
  // 1. ค้นหาข้อมูลห้องเรียนจาก window
  if (!window.classesData) {
    showToast('เกิดข้อผิดพลาด: ไม่พบข้อมูลห้องเรียน', 'error');
    return;
  }
  const classData = window.classesData.find(c => c.id === classId);
  if (!classData) {
    showToast('เกิดข้อผิดพลาด: ไม่พบข้อมูลห้องเรียน', 'error');
    return;
  }

  // 2. แสดง Modal ยืนยัน
  showConfirmModal(
    'ยืนยันการลบ',
    `ต้องการลบห้องเรียน ${classData.level}/${classData.room} ปีการศึกษา ${classData.year} ใช่หรือไม่?`,
    async () => {
      // 3. ถ้าผู้ใช้ยืนยัน ให้เรียก Server
      await waitForResponse(
        () => callServerFunction('deleteClass', classId),
        'กำลังลบห้องเรียน...',
        (result) => {
          // 4. เมื่อ Server ตอบกลับ
          if (result.success) {
            showToast('ลบห้องเรียนสำเร็จ', 'success');
            renderClassesPage(); // โหลดหน้าใหม่เพื่ออัปเดตข้อมูล
          } else {
            // showToast(result.message, 'error'); // waitForResponse จัดการให้แล้ว
            console.error(result.message);
          }
        }
      );
    },
    { confirmText: 'ลบ', confirmColor: 'red' }
  );
}


// ===================================
// [⭐️ ใหม่ ⭐️] SUBJECTS (CRUD) PAGE
// ===================================

/**
 * [⭐️ ใหม่ ⭐️] หน้าสำหรับ จัดการรายวิชา (เพิ่ม/ลบ/แก้ไข)
 */
async function renderSubjectsCrudPage() {
  if (!checkPermission('registrar')) {
    showNoPermission();
    return;
  }
  
  renderBreadcrumb(['หน้าแรก', 'จัดการรายวิชา']);
  showLoading('กำลังโหลดข้อมูลรายวิชา...');
  
  try {
    const subjectsResult = await callServerFunction('getSubjects');
    
    if (!subjectsResult.success) {
      showToast(subjectsResult.message, 'error');
      return;
    }
    
    // [⭐️ แก้ไข ⭐️] ใช้ชื่อตัวแปรใหม่
    window.allSubjectsCrudData = subjectsResult.data || [];
    window.filteredSubjectsCrud = [...window.allSubjectsCrudData];
    window.currentSubjectsCrudPage = 1;
    
    renderSubjectsCrudList();
    
  } catch (error) {
    console.error('Error loading subjects page:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * [⭐️ ใหม่ ⭐️] แสดงตารางรายวิชา (สำหรับหน้า CRUD)
 */
function renderSubjectsCrudList() {
  const pageSize = 20;
  
  // [⭐️ แก้ไข ⭐️] ใช้ตัวแปรของหน้า CRUD
  const query = document.getElementById('subjectCrudSearch') ? document.getElementById('subjectCrudSearch').value : '';
  const group = document.getElementById('subjectCrudGroupFilter') ? document.getElementById('subjectCrudGroupFilter').value : '';
  
  let filtered = [...window.allSubjectsCrudData];
  if (query) {
    filtered = filterArray(filtered, query, ['subject_name', 'subject_code']);
  }
  if (group) {
    filtered = filtered.filter(s => s.subject_group === group);
  }
  
  window.filteredSubjectsCrud = filtered;
  
  const paginated = paginateArray(window.filteredSubjectsCrud, window.currentSubjectsCrudPage, pageSize);
  
  const html = `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">จัดการรายวิชา</h2>
      <button onclick="showAddSubjectCrudModal()" class="btn btn-primary">
        <i class="fas fa-plus mr-2"></i>เพิ่มรายวิชา
      </button>
    </div>
    
    <div class="card p-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div class="relative">
          <input 
            type="text" 
            id="subjectCrudSearch"
            class="form-input pl-10"
            placeholder="ค้นหารายวิชา (ชื่อ, รหัส)"
            oninput="debouncedFilterSubjectCrud()"
            value="${query}"
          >
          <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
        </div>
        
        <select class="form-select" id="subjectCrudGroupFilter" onchange="filterSubjectCrud()">
          <option value="">ทุกกลุ่มวิชา</option>
          <option value="พื้นฐาน" ${group === 'พื้นฐาน' ? 'selected' : ''}>พื้นฐาน</option>
          <option value="เพิ่มเติม" ${group === 'เพิ่มเติม' ? 'selected' : ''}>เพิ่มเติม</option>
        </select>
      </div>
    </div>
    
    <div class="overflow-x-auto card p-0 md:p-4 hidden md:block">
<table class="data-table">
        <thead>
          <tr>
            <th>รหัสวิชา</th>
            <th>ชื่อวิชา</th>
            <th>กลุ่มวิชา</th>
            <th>หน่วยกิจ</th>
            <th>ระดับชั้น</th> <th>ครูผู้สอน</th>
            <th>สถานะ</th>
            <th class="text-center" style="width: 120px">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${paginated.data.length > 0 ? paginated.data.map((subject, index) => `
<tr class="${index % 2 === 1 ? 'bg-gray-50' : ''}">
              <td>${subject.subject_code}</td>
              <td>${subject.subject_name}</td>
              <td>${subject.subject_group}</td>
              <td>${subject.credit}</td>
              <td>${subject.level === 'all' ? 'ทุกระดับชั้น' : subject.level}</td> <td class="font-semibold">${subject.teacher_name || '<span class="text-gray-400">ยังไม่มอบหมาย</span>'}</td>
              <td>
                <span class="badge ${getStatusColor(subject.status)}">
                  ${subject.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </span>
              </td>
              <td class="text-center">
                <button onclick="editSubjectCrud('${subject.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded" title="แก้ไข">
                  <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteSubjectCrud('${subject.id}')" class="p-2 text-red-600 hover:bg-red-50 rounded" title="ลบ">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="8" class="text-center py-8 text-gray-500">ไม่พบข้อมูลรายวิชา</td></tr>'} </tbody>
      </table>
    </div>
    
    <div class="grid grid-cols-1 gap-4 md:hidden">
      ${paginated.data.length > 0 ? paginated.data.map(subject => `
        <div class="card p-4 shadow-lg">
          <div class="flex items-center justify-between mb-3 pb-2 border-b">
            <span class="font-mono font-semibold text-blue-600 text-lg">${subject.subject_code}</span>
            <span class="badge ${getStatusColor(subject.status)}">
              ${subject.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
            </span>
          </div>
          
          <div class="mb-4">
            <h3 class="font-bold text-gray-800 text-lg">${subject.subject_name}</h3>
            <p class="text-sm text-gray-600">
              กลุ่ม: ${subject.subject_group} | หน่วยกิจ: ${subject.credit} | ชั้น: ${subject.level === 'all' ? 'ทุกระดับชั้น' : subject.level}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button onclick="editSubjectCrud('${subject.id}')" class="btn btn-primary text-sm">
              <i class="fas fa-edit mr-1"></i> แก้ไข
            </button>
            <button onclick="deleteSubjectCrud('${subject.id}')" class="btn btn-danger text-sm">
              <i class="fas fa-trash mr-1"></i> ลบ
            </button>
          </div>
        </div>
      `).join('') : renderEmptyState('ไม่พบข้อมูลรายวิชา')}
    </div>
    ${renderPagination(paginated.total, paginated.page, paginated.pageSize, (page) => {
      window.currentSubjectsCrudPage = page;
      renderSubjectsCrudList();
    })}
  `;
  
  document.getElementById('pageContent').innerHTML = html;
}


/**
 * [⭐️ ใหม่ ⭐️] ฟังก์ชันกรองสำหรับหน้า CRUD
 */
function filterSubjectCrud() {
  window.currentSubjectsCrudPage = 1;
  renderSubjectsCrudList();
}
window.debouncedFilterSubjectCrud = debounce(filterSubjectCrud, 300);

/**
 * [⭐️ ใหม่ ⭐️] แสดง Modal เพิ่มวิชา (หน้า CRUD)
 */
function showAddSubjectCrudModal() {
  const fields = [
    { name: 'subject_code', label: 'รหัสวิชา', type: 'text', required: true },
    { name: 'subject_name', label: 'ชื่อวิชา', type: 'text', required: true, colSpan: 2 },
    { name: 'subject_group', label: 'กลุ่มวิชา', type: 'select', options: [
      { value: 'พื้นฐาน', label: 'พื้นฐาน' },
      { value: 'เพิ่มเติม', label: 'เพิ่มเติม' }
    ]},
    { name: 'credit', label: 'หน่วยกิจ', type: 'number', value: '1' },
    { name: 'level', label: 'ระดับชั้น', type: 'select', options: [
      { value: 'all', label: 'ทุกระดับชั้น' },
      { value: 'ป.1', label: 'ป.1' }, { value: 'ป.2', label: 'ป.2' },
      { value: 'ป.3', label: 'ป.3' }, { value: 'ป.4', label: 'ป.4' },
      { value: 'ป.5', label: 'ป.5' }, { value: 'ป.6', label: 'ป.6' }
    ]}
  ];
  
  showFormModal('เพิ่มรายวิชาใหม่', fields, async (data) => {
    // หน้านี้ไม่จำเป็นต้องส่ง teacher_name
    data.teacher_id = '';
    data.teacher_name = '';

    await waitForResponse(
      () => callServerFunction('createSubject', data),
      'กำลังบันทึกข้อมูล...',
      (result) => {
        showToast('เพิ่มรายวิชาสำเร็จ', 'success');
        renderSubjectsCrudPage(); // รีเฟรชหน้า CRUD
      }
    );
  });
}

/**
 * [⭐️ ใหม่ ⭐️] แสดง Modal แก้ไขวิชา (หน้า CRUD)
 */
async function editSubjectCrud(subjectId) {
  const subject = window.allSubjectsCrudData.find(s => s.id === subjectId);
  if (!subject) {
    showToast('ไม่พบข้อมูลวิชา', 'error');
    return;
  }

  const fields = [
    { name: 'subject_code', label: 'รหัสวิชา', type: 'text', required: true },
    { name: 'subject_name', label: 'ชื่อวิชา', type: 'text', required: true, colSpan: 2 },
    { name: 'subject_group', label: 'กลุ่มวิชา', type: 'select', options: [
      { value: 'พื้นฐาน', label: 'พื้นฐาน' },
      { value: 'เพิ่มเติม', label: 'เพิ่มเติม' }
    ]},
    { name: 'credit', label: 'หน่วยกิจ', type: 'number' },
    { name: 'level', label: 'ระดับชั้น', type: 'select', options: [
      { value: 'all', label: 'ทุกระดับชั้น' },
      { value: 'ป.1', label: 'ป.1' }, { value: 'ป.2', label: 'ป.2' },
      { value: 'ป.3', label: 'ป.3' }, { value: 'ป.4', label: 'ป.4' },
      { value: 'ป.5', label: 'ป.5' }, { value: 'ป.6', label: 'ป.6' }
    ]},
    {
      name: 'status', label: 'สถานะ', type: 'select', required: true, options: [
        { value: 'active', label: 'เปิดใช้งาน' },
        { value: 'inactive', label: 'ปิดใช้งาน' }
      ]
    }
  ];
  
  // [⭐️ แก้ไข ⭐️] ไม่ต้องส่งข้อมูลครู
  showFormModal('แก้ไขรายวิชา', fields, async (data) => {
    
    // ส่ง teacher_id/name เดิมไป (ถ้ามี) เพื่อไม่ให้ค่าหาย
    data.teacher_id = subject.teacher_id || '';
    data.teacher_name = subject.teacher_name || '';
    
    await waitForResponse(
      () => callServerFunction('updateSubject', subjectId, data),
      'กำลังบันทึกข้อมูล...',
      (result) => {
        showToast('บันทึกข้อมูลสำเร็จ', 'success');
        renderSubjectsCrudPage(); // รีเฟรชหน้า CRUD
      }
    );
  }, subject);
}

/**
 * [⭐️ ใหม่ ⭐️] ลบวิชา (หน้า CRUD)
 */
function deleteSubjectCrud(subjectId) {
  showConfirmModal(
    'ยืนยันการลบ',
    'ต้องการลบรายวิชานี้ใช่หรือไม่? (การดำเนินการนี้จะลบการมอบหมายครูผู้สอนด้วย)',
    async () => {
      await waitForResponse(
        () => callServerFunction('deleteSubject', subjectId),
        'กำลังลบข้อมูล...',
        (result) => {
          showToast('ลบรายวิชาสำเร็จ', 'success');
          renderSubjectsCrudPage(); // รีเฟรชหน้า CRUD
        }
      );
    },
    { confirmText: 'ลบ', confirmColor: 'red' }
  );
}


// ===================================
// [⭐️ แก้ไข ⭐️] ASSIGN SUBJECTS PAGE
// ===================================

/**
 * [⭐️ แก้ไข ⭐️] เปลี่ยนชื่อฟังก์ชันเป็น renderAssignSubjectsPage
 */
async function renderAssignSubjectsPage() {
  // [⭐️ แก้ไข ⭐️] เปลี่ยน Breadcrumb
  renderBreadcrumb(['หน้าแรก', 'มอบหมายรายวิชา']);
  showLoading('กำลังโหลดข้อมูล...');
  
  try {
    const [subjectsResult, teachersResult] = await Promise.all([
      callServerFunction('getSubjects'),
      callServerFunction('getTeachers') 
    ]);
    
    if (!subjectsResult.success) {
      showToast(subjectsResult.message, 'error');
      return;
    }
    
    // [⭐️ แก้ไข ⭐️] ใช้ชื่อตัวแปรใหม่สำหรับหน้านี้
    window.allSubjectsAssignData = subjectsResult.data || [];
    window.filteredSubjectsAssign = [...window.allSubjectsAssignData];
    window.currentSubjectsAssignPage = 1;
    
    window.teachersData = [];
    if (teachersResult.success) {
        window.teachersData = teachersResult.data;
    } else {
        console.warn('Could not load teachers list:', teachersResult.message);
    }
    
    renderAssignSubjectsList();
    
  } catch (error) {
    console.error('Error loading subjects page:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * [⭐️ แก้ไข ⭐️] เปลี่ยนชื่อฟังก์ชันเป็น renderAssignSubjectsList
 * (เวอร์ชันอัปเดต: เพิ่มคอลัมน์ "ระดับชั้น")
 */
function renderAssignSubjectsList() {
  const pageSize = 20;
  
  // [⭐️ แก้ไข ⭐️] ใช้ตัวแปรของหน้านี้
  const query = document.getElementById('subjectAssignSearch') ? document.getElementById('subjectAssignSearch').value : '';
  const group = document.getElementById('subjectAssignGroupFilter') ? document.getElementById('subjectAssignGroupFilter').value : '';
  
  let filtered = [...window.allSubjectsAssignData];
  if (query) {
    filtered = filterArray(filtered, query, ['subject_name', 'subject_code', 'teacher_name']);
  }
  if (group) {
    filtered = filtered.filter(s => s.subject_group === group);
  }
  
  window.filteredSubjectsAssign = filtered;
  
  const paginated = paginateArray(window.filteredSubjectsAssign, window.currentSubjectsAssignPage, pageSize);
  
  const html = `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">มอบหมายรายวิชา</h2>
      
      <button onclick="showAssignByTeacherModal()" class="btn btn-primary">
        <i class="fas fa-user-plus mr-2"></i>มอบหมายงานสอน (ตามครู)
      </button>
      </div>
    
    <div class="card p-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div class="relative">
          <input 
            type="text" 
            id="subjectAssignSearch"
            class="form-input pl-10"
            placeholder="ค้นหา (ชื่อวิชา, รหัส, ชื่อครู)"
            oninput="debouncedFilterAssignSubject()"
            value="${query}"
          >
          <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
        </div>
        
        <select class="form-select" id="subjectAssignGroupFilter" onchange="filterAssignSubject()">
          <option value="">ทุกกลุ่มวิชา</option>
          <option value="พื้นฐาน" ${group === 'พื้นฐาน' ? 'selected' : ''}>พื้นฐาน</option>
          <option value="เพิ่มเติม" ${group === 'เพิ่มเติม' ? 'selected' : ''}>เพิ่มเติม</option>
        </select>
      </div>
    </div>
    
    <div class="overflow-x-auto card p-0 md:p-4 hidden md:block">
      <table class="data-table">
        <thead>
          <tr>
            <th>รหัสวิชา</th>
            <th>ชื่อวิชา</th>
            <th>กลุ่มวิชา</th>
            <th>หน่วยกิจ</th>
            <th>ระดับชั้น</th> <th>ครูผู้สอน</th>
            <th>สถานะ</th>
            <th class="text-center" style="width: 120px">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${paginated.data.length > 0 ? paginated.data.map((subject, index) => `
            <tr class="${index % 2 === 1 ? 'bg-gray-50' : ''}">
              <td>${subject.subject_code}</td>
              <td>${subject.subject_name}</td>
              <td>${subject.subject_group}</td>
              <td>${subject.credit}</td>
              <td>${subject.level === 'all' ? 'ทุกระดับชั้น' : subject.level}</td> <td class="font-semibold">${subject.teacher_name || '<span class="text-gray-400">ยังไม่มอบหมาย</span>'}</td>
              <td>
                <span class="badge ${getStatusColor(subject.status)}">
                  ${subject.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </span>
              </td>
              <td class="text-center">
                <button onclick="editSubjectAssignment('${subject.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded" title="แก้ไขการมอบหมาย">
                  <i class="fas fa-edit"></i>
                </button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="8" class="text-center py-8 text-gray-500">ไม่พบข้อมูลรายวิชา</td></tr>'} </tbody>
      </table>
    </div>
    
    <div class="grid grid-cols-1 gap-4 md:hidden">
      ${paginated.data.length > 0 ? paginated.data.map(subject => `
        <div class="card p-4 shadow-lg">
          <div class="flex items-center justify-between mb-3 pb-2 border-b">
            <span class="font-mono font-semibold text-blue-600 text-lg">${subject.subject_code}</span>
            <span class="badge ${getStatusColor(subject.status)}">
              ${subject.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
            </span>
          </div>
          
          <div class="mb-4">
            <h3 class="font-bold text-gray-800 text-lg">${subject.subject_name}</h3>
            <p class="text-sm text-gray-600">
              กลุ่ม: ${subject.subject_group} | หน่วยกิจ: ${subject.credit} | ชั้น: ${subject.level === 'all' ? 'ทุกระดับชั้น' : subject.level} </p>
            <div class="mt-3">
              <span class="text-sm text-gray-500">ครูผู้สอน:</span>
              <p class="font-semibold text-gray-800">
                ${subject.teacher_name || '<span class="text-gray-400">ยังไม่มอบหมาย</span>'}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-2">
            <button onclick="editSubjectAssignment('${subject.id}')" class="btn btn-primary text-sm">
              <i class="fas fa-edit mr-1"></i> แก้ไขการมอบหมาย
            </button>
          </div>
        </div>
      `).join('') : renderEmptyState('ไม่พบข้อมูลรายวิชา')}
    </div>
    ${renderPagination(paginated.total, paginated.page, paginated.pageSize, (page) => {
      window.currentSubjectsAssignPage = page;
      renderAssignSubjectsList();
    })}
  `;
  
  document.getElementById('pageContent').innerHTML = html;
}


/**
 * [⭐️ ใหม่ ⭐️] ฟังก์ชันกรองสำหรับหน้า Assign
 */
function filterAssignSubject() {
  window.currentSubjectsAssignPage = 1;
  renderAssignSubjectsList();
}
window.debouncedFilterAssignSubject = debounce(filterAssignSubject, 300);

/**
 * [ ⭐️⭐️⭐️ ฟังก์ชันใหม่ (1/3) ⭐️⭐️⭐️ ]
 * แสดง Modal สำหรับ "มอบหมายงานสอนตามครู"
 */
function showAssignByTeacherModal() {
  const modalId = 'assignByTeacherModal_' + Date.now();
  
  // 1. สร้าง options ครู
  const teacherOptions = (window.teachersData || [])
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
    .map(teacher => ({
      value: teacher.id,
      label: `${teacher.name} (${getRoleLabel(teacher.role)})`
  }));

  // 2. สร้าง HTML ของ Modal
  const html = `
    <div id="${modalId}" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
      <div class="modal-content bg-white rounded-lg p-6 max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
        
        <div class="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-4 border-b">
          <h3 class="text-2xl font-bold text-gray-800">มอบหมายงานสอน (ตามครู)</h3>
          <button onclick="closeModal('${modalId}')" class="text-gray-400 hover:text-gray-600 transition-colors">
            <i class="fas fa-times text-2xl"></i>
          </button>
        </div>
        
        <div class="space-y-4">
          <div>
            <label class="form-label">ขั้นตอนที่ 1: เลือกครูผู้สอน</label>
            ${renderFormField({ 
              name: 'teacher_id', 
              label: 'ครูผู้สอน',
              type: 'combobox', 
              required: true, 
              options: teacherOptions, 
              id: `assign_teacher_id_${modalId}` 
            })}
          </div>
          
          <div class="border-t pt-4">
            <div class="flex justify-between items-center mb-2">
              <label class="form-label">ขั้นตอนที่ 2: เลือกวิชาที่รับผิดชอบ</label>
              
              <div class="relative w-full md:w-1/2">
                <input 
                  type="text" 
                  id="subject-search-${modalId}" 
                  oninput="filterSubjectChecklist('${modalId}')"
                  class="form-input text-sm pl-8" 
                  placeholder="ค้นหาวิชา..."
                >
                <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
              </div>
            </div>
            
            <div id="subject-checklist-container" 
                 class="p-2 bg-gray-50 rounded-lg border max-h-64 overflow-y-auto"
                 data-modal-id="${modalId}" >
              <p class="text-gray-500 text-center py-4">กรุณาเลือกครูผู้สอนก่อน...</p>
            </div>
          </div>
          </div>
        
        <div class="flex justify-end space-x-3 mt-6 pt-6 border-t sticky bottom-0 bg-white">
          <button type="button" onclick="closeModal('${modalId}')" class="btn btn-secondary px-6">
            <i class="fas fa-times mr-2"></i>ยกเลิก
          </button>
          <button 
            type="button" 
            id="saveTeacherAssignBtn"
            onclick="handleSaveTeacherAssignments('${modalId}')"
            class="btn btn-primary px-6"
            disabled
          >
            <i class="fas fa-save mr-2"></i>บันทึกภาระงาน
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML = html;
  
  // 3. เพิ่ม Event Listener ให้ Combobox ครู
  setTimeout(() => {
    const teacherSelectInput = document.getElementById(`combo_hidden_assign_teacher_id_${modalId}`);
    if (teacherSelectInput) {
      teacherSelectInput.addEventListener('change', (e) => {
        const teacherId = e.target.value;
        if (teacherId) {
          renderSubjectChecklistForTeacher(teacherId);
          document.getElementById('saveTeacherAssignBtn').disabled = false;
        } else {
          document.getElementById('subject-checklist-container').innerHTML = 
            '<p class="text-gray-500 text-center py-4">กรุณาเลือกครูผู้สอนก่อน...</p>';
          document.getElementById('saveTeacherAssignBtn').disabled = true;
          
          // เคลียร์ช่องค้นหา
          const searchInput = document.getElementById(`subject-search-${modalId}`);
          if (searchInput) searchInput.value = '';
        }
      });
    }
  }, 200);
}

/**
 * [ ⭐️⭐️⭐️ ฟังก์ชันใหม่ (2/3) - (อัปเดต Layout) ⭐️⭐️⭐️ ]
 * วาดรายการ Checkbox ของวิชา หลังจากเลือกครู
 */
function renderSubjectChecklistForTeacher(teacherId) {
  const container = document.getElementById('subject-checklist-container');
  
  // [ ⭐️⭐️⭐️ เพิ่ม ⭐️⭐️⭐️ ]
  // ดึง modalId มาจาก container เพื่อเคลียร์ช่องค้นหา
  const modalId = container.dataset.modalId; 
  const searchInput = document.getElementById(`subject-search-${modalId}`);
  if (searchInput) searchInput.value = ''; // เคลียร์ช่องค้นหา
  // [ ⭐️⭐️⭐️ สิ้นสุด ⭐️⭐️⭐️ ]
  
  container.innerHTML = '<div class="text-center text-gray-500 py-4">กำลังโหลดรายวิชา...</div>';

  // 1. หาวิชาที่ครูคนนี้สอนอยู่แล้ว
  const currentSubjectIds = new Set(
    (window.allSubjectsAssignData || [])
      .filter(s => s.teacher_id === teacherId)
      .map(s => s.id)
  );
  
  // 2. หาวิชาทั้งหมด (ที่ Active)
  const allActiveSubjects = (window.allSubjectsAssignData || [])
    .filter(s => s.status === 'active')
    .sort((a, b) => {
      // เรียงตาม ระดับชั้น -> รหัสวิชา
      if (a.level !== b.level) return a.level.localeCompare(b.level, 'th');
      return a.subject_code.localeCompare(b.subject_code, 'th');
    });
    
  if (allActiveSubjects.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">ไม่พบรายวิชาที่ (Active) ในระบบ</p>';
    return;
  }

  // 3. จัดกลุ่มตามระดับชั้น
  const subjectsByLevel = allActiveSubjects.reduce((acc, subject) => {
    const level = subject.level === 'all' ? 'ทุกระดับชั้น' : subject.level;
    if (!acc[level]) {
      acc[level] = [];
    }
    acc[level].push(subject);
    return acc;
  }, {});

  // 4. สร้าง HTML
  const levels = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ทุกระดับชั้น'];
  
  // [ ⭐️⭐️⭐️ แก้ไข Layout ⭐️⭐️⭐️ ]
  let html = '<div class="space-y-1">';
  
  levels.forEach(level => {
    if (subjectsByLevel[level]) {
      
      // ส่วนหัวของกลุ่ม (Sticky Header)
      html += `<div class="sticky top-0 bg-gray-100 z-10 p-2 border-y subject-checklist-header">
                 <strong class="text-gray-700 font-semibold">${level}</strong>
               </div>`;
               
      subjectsByLevel[level].forEach(subject => {
        const isChecked = currentSubjectIds.has(subject.id);
        
        // รายการวิชา (แนวตั้ง)
        html += `
          <label class="flex items-center space-x-3 p-3 hover:bg-gray-200 rounded-lg cursor-pointer subject-checklist-item">
            <input 
              type="checkbox" 
              class="form-checkbox h-5 w-5 rounded subject-assign-checkbox" 
              value="${subject.id}" 
              ${isChecked ? 'checked' : ''}
            >
            <span class="flex-1 min-w-0">
              <span class="text-gray-800">${subject.subject_name}</span>
              <span class="text-sm font-mono text-gray-500 ml-2">(${subject.subject_code})</span>
            </span>
          </label>
        `;
      });
    }
  });
  
  html += '</div>';
  container.innerHTML = html;
  // [ ⭐️⭐️⭐️ สิ้นสุดการแก้ไข Layout ⭐️⭐️⭐️ ]
}

/**
 * [ ⭐️⭐️⭐️ ฟังก์ชันใหม่ (เพิ่มเข้ามา) ⭐️⭐️⭐️ ]
 * กรองรายวิชาใน Checkbox (Client-side)
 */
function filterSubjectChecklist(modalId) {
  const query = document.getElementById(`subject-search-${modalId}`).value.toLowerCase();
  const container = document.getElementById('subject-checklist-container');
  
  const items = container.querySelectorAll('.subject-checklist-item');
  const headers = container.querySelectorAll('.subject-checklist-header');
  
  headers.forEach(header => {
    header.style.display = 'flex'; // แสดงหัวข้อไว้ก่อน
  });

  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    if (text.includes(query)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });

  // (Optional) ซ่อนหัวข้อที่ไม่มีรายการลูก
  headers.forEach(header => {
    let nextElement = header.nextElementSibling;
    let hasVisibleItem = false;
    while (nextElement && nextElement.classList.contains('subject-checklist-item')) {
      if (nextElement.style.display === 'flex') {
        hasVisibleItem = true;
        break;
      }
      nextElement = nextElement.nextElementSibling;
    }
    if (!hasVisibleItem) {
      header.style.display = 'none';
    }
  });
}

/**
 * [ ⭐️⭐️⭐️ ฟังก์ชันใหม่ (3/3) ⭐️⭐️⭐️ ]
 * บันทึกการมอบหมายงานสอน (Batch)
 */
async function handleSaveTeacherAssignments(modalId) {
  // 1. ดึงข้อมูลครู
  const teacherId = document.getElementById(`combo_hidden_assign_teacher_id_${modalId}`).value;
  if (!teacherId) {
    showToast('กรุณาเลือกครูผู้สอน', 'warning');
    return;
  }
  
  const teacher = (window.teachersData || []).find(t => t.id === teacherId);
  const teacherName = teacher ? teacher.name : '';
  
  // 2. ดึงรายวิชาที่เลือก
  const selectedSubjectIds = [];
  document.querySelectorAll('.subject-assign-checkbox:checked').forEach(checkbox => {
    selectedSubjectIds.push(checkbox.value);
  });
  
  closeModal(modalId);
  
  // 3. เรียก Backend
  await waitForResponse(
    () => callServerFunction('batchUpdateTeacherAssignments', teacherId, teacherName, selectedSubjectIds),
    'กำลังบันทึกภาระงานสอน...',
    (result) => {
      if (result.success) {
        showToast(result.message, 'success');
        renderAssignSubjectsPage(); // รีเฟรชหน้า
      }
    }
  );
}

/**
 * [⭐️ ใหม่ ⭐️] Modal สำหรับ "แก้ไขการมอบหมาย"
 */
async function editSubjectAssignment(subjectId) {
  const subject = window.allSubjectsAssignData.find(s => s.id === subjectId);
  if (!subject) {
    showToast('ไม่พบข้อมูลวิชา', 'error');
    return;
  }

  const teacherOptions = (window.teachersData || []).map(teacher => ({
    value: teacher.id,
    label: `${teacher.name} (${getRoleLabel(teacher.role)})`
  }));

  const fields = [
    // ข้อมูลวิชา (Disabled)
    { name: 'subject_code', label: 'รหัสวิชา', type: 'text', disabled: true },
    { name: 'subject_name', label: 'ชื่อวิชา', type: 'text', disabled: true, colSpan: 2 },
    { name: 'subject_group', label: 'กลุ่มวิชา', type: 'text', disabled: true },
    { name: 'credit', label: 'หน่วยกิจ', type: 'text', disabled: true },
    { name: 'level', label: 'ระดับชั้น', type: 'text', disabled: true },
    // ครูผู้สอน (Editable)
    { 
      name: 'teacher_id', 
      label: 'ครูผู้สอน', 
      type: 'combobox', 
      required: true,
      options: teacherOptions,
      colSpan: 3
    }
  ];
  
  // [⭐️ แก้ไข ⭐️] เตรียม initialData
  const initialData = {
    ...subject,
    level: subject.level === 'all' ? 'ทุกระดับชั้น' : subject.level // แปลง all เป็นข้อความ
  };

  showFormModal('แก้ไขการมอบหมายครู', fields, async (data) => {
    
    // ค้นหาชื่อครู
    const selectedTeacher = (window.teachersData || []).find(t => t.id === data.teacher_id);
    
    // สร้าง object ที่จะอัปเดต (ใช้ข้อมูลเดิมจาก subject)
    const updateData = {
      ...subject, // ใช้ข้อมูลเดิมทั้งหมด
      teacher_id: data.teacher_id,
      teacher_name: selectedTeacher ? selectedTeacher.name : ''
    };

    await waitForResponse(
      () => callServerFunction('updateSubject', subjectId, updateData),
      'กำลังบันทึกข้อมูล...',
      (result) => {
        showToast('บันทึกข้อมูลสำเร็จ', 'success');
        renderAssignSubjectsPage(); // รีเฟรชหน้า Assign
      }
    );
  }, initialData); // ใช้ initialData ที่เตรียมไว้
}


// ===================================
// SCORES PAGE
// ===================================

async function renderScoresPage() {
  renderBreadcrumb(['หน้าแรก', 'บันทึกคะแนน']);
  
  const html = `
    <div class="card p-6 mb-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">เลือกข้อมูลเพื่อบันทึกคะแนน</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="scoreYearSelect" class="form-select">
            <option value="">-- กำลังโหลดปี --</option>
          </select>
        </div>
        <div>
          <label class="form-label">ภาคเรียน</label>
          <select class="form-select" id="scoreSemesterSelect">
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2">ภาคเรียนที่ 2</option>
          </select>
        </div>
        <div>
          <label class="form-label">วิชา</label>
          <select class="form-select" id="scoreSubjectSelect" onchange="handleSubjectChangeForScores(this.value)">
            <option value="">-- กรุณาเลือกวิชา --</option>
          </select>
        </div>
        <div>
          <label class="form-label">ห้องเรียน</label>
          <select class="form-select bg-gray-100 cursor-not-allowed" id="scoreClassSelect" disabled>
            <option value="">-- กรุณาเลือกวิชาก่อน --</option>
          </select>
        </div>
        
        <div>
          <label class="form-label">อัตราส่วนคะแนน</label>
          <select class="form-select" id="scoreRatioSelect">
            <option value="70">70 : 30 (เก็บ : ปลายภาค)</option>
            <option value="80">80 : 20 (เก็บ : ปลายภาค)</option>
          </select>
        </div>
      </div>
      
      <div class="mt-6 text-right">
        <button onclick="loadScoreEntry()" class="btn btn-primary px-8">
          <i class="fas fa-arrow-right mr-2"></i>เริ่มบันทึกคะแนน
        </button>
      </div>
    </div>
    
    <div id="scoreEntryContainer" class="mt-6">
    </div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
  
  showLoading('กำลังโหลดข้อมูล...');
  try {
    const currentUserId = window.currentUser.id;
    const currentUserRole = window.currentUser.role;
    const adminRoles = ['admin', 'principal', 'registrar'];

    const [classesResult, subjectsResult, configResult] = await Promise.all([
      callServerFunction('getClasses'),
      callServerFunction('getSubjects'),
      callServerFunction('getConfig')
    ]);
    
    window.allClassesForScores = classesResult.success ? classesResult.data : [];
    window.allSubjectsForScores = subjectsResult.success ? subjectsResult.data : [];

    let currentYear = new Date().getFullYear() + 543; // Fallback
    let currentSemester = '1';
    if (configResult.success) {
      currentYear = configResult.data.current_year || currentYear.toString();
      currentSemester = configResult.data.current_semester || '1';
    }

    document.getElementById('scoreSemesterSelect').value = currentSemester;

    const yearSelect = document.getElementById('scoreYearSelect');
    let availableYears = [];
    if (classesResult.success) {
      const allYears = classesResult.data.map(c => c.year); 
      availableYears = [...new Set(allYears)]; 
      availableYears.sort((a, b) => b.localeCompare(a, 'th-TH-u-nu-thai')); 
    }
    
    if (availableYears.length === 0 || !availableYears.includes(currentYear.toString())) {
      availableYears.unshift(currentYear.toString()); 
    }
    
    yearSelect.innerHTML = ''; // ล้าง "กำลังโหลด..."
    availableYears.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === currentYear.toString()) {
        option.selected = true; 
      }
      yearSelect.appendChild(option);
    });
    
    if (subjectsResult.success) {
      const subjectSelect = document.getElementById('scoreSubjectSelect');
      
      let subjectsToShow = [];
      if (adminRoles.includes(currentUserRole)) {
        subjectsToShow = window.allSubjectsForScores; 
      } else {
        subjectsToShow = window.allSubjectsForScores.filter(s => s.teacher_id === currentUserId); 
      }

      if (subjectsToShow.length === 0) {
         const option = document.createElement('option');
         option.value = "";
         option.textContent = "ไม่พบรายวิชาที่รับผิดชอบ";
         option.disabled = true;
         subjectSelect.appendChild(option);
      } else {
        subjectsToShow
          .filter(s => s.status === 'active')
          .sort((a, b) => a.subject_code.localeCompare(b.subject_code))
          .forEach(subj => {
            const option = document.createElement('option');
            option.value = subj.id;
            option.textContent = `(${subj.subject_code}) ${subj.subject_name} (ชั้น ${subj.level})`;
            subjectSelect.appendChild(option);
          });
      }
    }
    
  } catch (error) {
    console.error('Error loading data:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
  } finally {
    hideLoading();
  }
}


/**
 * [ ⭐️⭐️⭐️ ฟังก์ชันที่ต้องเพิ่ม ⭐️⭐️⭐️ ]
 * ฟังก์ชันสำหรับกรองห้องเรียน หลังจากเลือกวิชา
 * (แก้ไข Bug: การเรียงลำดับ .sort)
 * @param {string} subjectId - ID วิชาที่เลือก
 */
function handleSubjectChangeForScores(subjectId) {
  const classSelect = document.getElementById('scoreClassSelect');
  
  classSelect.innerHTML = '<option value="">-- กำลังโหลด... --</option>';
  classSelect.disabled = true;
  classSelect.classList.add('bg-gray-100', 'cursor-not-allowed');

  if (!subjectId) {
    classSelect.innerHTML = '<option value="">-- กรุณาเลือกวิชาก่อน --</option>';
    return;
  }

  const subject = window.allSubjectsForScores.find(s => s.id === subjectId);
  if (!subject) {
    classSelect.innerHTML = '<option value="">-- เกิดข้อผิดพลาด --</option>';
    return;
  }

  const subjectLevel = subject.level;
  
  let classesToShow = [];
  if (subjectLevel === 'all') {
    classesToShow = window.allClassesForScores;
  } else {
    classesToShow = window.allClassesForScores.filter(c => c.level === subjectLevel);
  }

  classSelect.innerHTML = '<option value="">-- เลือกห้องเรียน --</option>';
  
  if (classesToShow.length === 0) {
     const option = document.createElement('option');
     option.value = "";
     option.textContent = "ไม่พบห้องเรียนสำหรับวิชานี้";
     option.disabled = true;
     classSelect.appendChild(option);
  } else {
    classesToShow
      .filter(c => c.status === 'active')
      // ✅ FIXED: ป้องกัน null/undefined
      .sort((a, b) => {
        const levelA = (a.level || '').toString();
        const levelB = (b.level || '').toString();
        const roomA = (a.room || '').toString();
        const roomB = (b.room || '').toString();

        if (levelA !== levelB) {
          return levelA.localeCompare(levelB, 'th-TH-u-nu-thai');
        }
        return roomA.localeCompare(roomB, 'th-TH-u-nu-thai');
      })
      .forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.id;
        option.textContent = `${cls.level}/${cls.room}`;
        classSelect.appendChild(option);
      });
    
    classSelect.disabled = false;
    classSelect.classList.remove('bg-gray-100', 'cursor-not-allowed');
  }
}

/**
 * [ ⭐️⭐️⭐️ วางทับ/เพิ่ม ฟังก์ชันนี้ ⭐️⭐️⭐️ ]
 * โหลดข้อมูลคะแนนดิบและนักเรียนจาก Server
 */
async function loadScoreEntry() {
  // 1. ดึงข้อมูลจาก Dropdown
  const year = document.getElementById('scoreYearSelect').value;
  const semester = document.getElementById('scoreSemesterSelect').value;
  const subjectId = document.getElementById('scoreSubjectSelect').value;
  const classId = document.getElementById('scoreClassSelect').value;

  // 2. ตรวจสอบข้อมูล
  if (!year || !semester || !subjectId || !classId) {
    showToast('กรุณาเลือก ปี, ภาคเรียน, วิชา และ ห้องเรียน ให้ครบถ้วน', 'warning');
    return;
  }

  // 3. เรียก Server
  await waitForResponse(
    () => callServerFunction('getScoresForEntry', classId, subjectId, semester, year),
    'กำลังโหลดข้อมูลนักเรียนและคะแนน...',
    (result) => {
      if (result.success) {
        // 4. Server จะส่ง { studentsWithScores, subject } กลับมา
        const { studentsWithScores, subject } = result.data;

        // (กันเหนียว) เก็บข้อมูลไว้ใน window
        window.currentStudentsWithScores = studentsWithScores;
        window.currentSubjectData = subject; 

        // 5. ดึงข้อมูลห้องเรียน (สำหรับแสดงหัวตาราง)
        const classData = (window.allClassesForScores || []).find(c => c.id === classId) || { level: '?', room: '?' };
        classData.semester = semester; // เพิ่ม semester/year เข้าไป
        classData.year = year;
        
        // 6. วาดตาราง (นี่คือส่วนที่สำคัญ)
        renderScoreEntryTable(studentsWithScores, subject, classData);
      } else {
        // กรณี Server ส่ง error กลับมา
        document.getElementById('scoreEntryContainer').innerHTML = 
          renderEmptyState('ไม่สามารถโหลดข้อมูลได้', 'fas fa-exclamation-triangle');
      }
    },
    (error) => {
      // กรณี Network error
      document.getElementById('scoreEntryContainer').innerHTML = 
        renderEmptyState('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'fas fa-wifi-slash');
    }
  );
}

/**
 * [ ⭐️⭐️⭐️ วางทับ/เพิ่ม ฟังก์ชันนี้ ⭐️⭐️⭐️ ]
 * (แก้ไข Bug: window.currentModalClass undefined)
 * @param {Array<Object>} studentsWithScores - ข้อมูลนักเรียนพร้อมคะแนน
 * @param {Object} subject - ข้อมูลวิชา
 * @param {Object} classData - ข้อมูลห้องเรียน (รวม semester/year)
 */
function renderScoreEntryTable(students, subject, classData) {
  // 1. อ่านค่าอัตราส่วนจาก Dropdown
  const ratio = document.getElementById('scoreRatioSelect').value;
  const courseworkRatio = parseInt(ratio);
  const finalRatio = 100 - courseworkRatio;
  
  // 2. เตรียมข้อมูลวิชา (ป้องกัน Error)
  subject.indicators = subject.indicators || [];
  subject.coursework_ratio = courseworkRatio;
  subject.final_ratio = finalRatio;
  window.currentSubjectData = subject; // ⭐️ เก็บข้อมูลวิชาไว้ใน window
  
  window.currentModalClass = classData;

  const { year, semester, id: class_id } = classData;
  const subject_id = subject.id;
  
  // 3. คำนวณคะแนนเต็มของตัวชี้วัด
  const totalIndicatorMax = subject.indicators.reduce((sum, ind) => sum + (ind.max || 0), 0);

  const html = `
    <div class="card p-0 md:p-4">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-0 mb-4">
        <div>
          <h3 class="text-xl font-bold text-gray-800">บันทึกคะแนน: ${subject.subject_name}</h3>
          <p class="text-sm text-gray-500">
            ห้อง ${classData.level}/${classData.room} | ภาคเรียน ${semester}/${year}
          </p>
          <p class="text-sm text-gray-600 font-semibold">
            อัตราส่วนคะแนน ${courseworkRatio} : ${finalRatio} (คะแนนเก็บรวม ${totalIndicatorMax} คะแนน)
          </p>
        </div>
        
        <button 
          onclick="handleSaveAllScores('${subject_id}', '${class_id}', '${semester}', '${year}')" 
          class="btn btn-success px-6 hidden md:flex mt-4 md:mt-0"
        >
          <i class="fas fa-save mr-2"></i>บันทึกคะแนนทั้งหมด
        </button>
      </div>
      
      <!-- ✅ DESKTOP TABLE VIEW (Fixed Width) -->
      <div class="overflow-x-auto hidden lg:block border rounded-lg shadow-sm">
        <table class="w-full border-collapse score-entry-table">
          <thead class="bg-gray-100 sticky top-0 z-20">
            <tr>
              <th class="w-12 text-center border border-gray-300 p-2 text-xs font-bold">เลขที่</th>
              <th class="w-20 border border-gray-300 p-2 text-xs font-bold">รหัส</th>
              <th class="min-w-40 border border-gray-300 p-2 text-xs font-bold text-left">ชื่อ-สกุล</th>
              
              ${subject.indicators.map(ind => `
                <th class="min-w-28 border border-gray-300 p-1 text-xs font-bold text-center">
                  <div class="text-blue-600 font-semibold">เต็ม ${ind.max || 0}</div>
                  <div class="text-gray-700 text-xs mt-1 line-clamp-2">${ind.name}</div>
                  <div class="text-gray-500 text-xs mt-0.5 flex gap-0.5 justify-center">
                    <button onclick="showEditIndicatorModal('${subject.id}', '${ind.id}')" class="p-0.5 text-blue-500 hover:text-blue-700" title="แก้ไข">
                      <i class="fas fa-edit text-xs"></i>
                    </button>
                    <button onclick="handleDeleteIndicator('${subject.id}', '${ind.id}')" class="p-0.5 text-red-500 hover:text-red-700" title="ลบ">
                      <i class="fas fa-trash text-xs"></i>
                    </button>
                  </div>
                </th>
              `).join('')}
              
              <th class="border border-gray-300 p-1 text-xs font-bold text-center">
                <button onclick="addIndicatorColumn('${subject.id}')" class="btn btn-primary btn-sm px-2 py-1 text-xs">
                  <i class="fas fa-plus"></i> เพิ่ม
                </button>
              </th>
              
              <th class="min-w-20 border border-gray-300 p-1 text-xs font-bold text-center">
                <span class="block text-gray-700 font-semibold">คะแนนเก็บ</span>
                <span class="text-xs font-normal text-gray-500">(${courseworkRatio})</span>
              </th>
              <th class="min-w-20 border border-gray-300 p-1 text-xs font-bold text-center">
                <span class="block text-gray-700 font-semibold">ปลายภาค</span>
                <span class="text-xs font-normal text-gray-500">(${finalRatio})</span>
              </th>
              <th class="min-w-20 border border-gray-300 p-1 text-xs font-bold text-center">
                <span class="block text-gray-700 font-semibold">รวม</span>
                <span class="text-xs font-normal text-gray-500">(100)</span>
              </th>
              <th class="w-16 border border-gray-300 p-1 text-xs font-bold text-center">
                <span class="block text-gray-700 font-semibold">เกรด</span>
              </th>
            </tr>
          </thead>
          <tbody>
            ${students.map((s, index) => {
              s.scores = s.scores || { indicators: {}, final: null };
              s.scores.indicators = s.scores.indicators || {};
              
              return `
              <tr id="score-row-${s.student_id}" data-student-id="${s.student_id}" class="${index % 2 === 1 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50 transition-colors">
                <td class="text-center text-xs border border-gray-300 p-1 font-medium">${s.student_number || index + 1}</td>
                <td class="text-xs border border-gray-300 p-1 font-mono">${s.student_code}</td>
                <td class="text-xs border border-gray-300 p-1 font-semibold text-gray-800">${s.student_name}</td>
                
                ${subject.indicators.map(ind => `
                  <td class="border border-gray-300 p-0.5 text-center">
                    <input 
                      type="number" 
                      class="form-input text-center w-full px-1 py-1 score-indicator-input text-xs bg-white border border-gray-200 rounded" 
                      data-ind-id="${ind.id}" 
                      data-ind-max="${ind.max || 0}"
                      value="${s.scores.indicators[ind.id] || ''}" 
                      placeholder="0"
                      min="0"
                      max="${ind.max || 0}"
                      oninput="calculateRowTotal('${s.student_id}')"
                    >
                  </td>
                `).join('')}
                
                <td class="border border-gray-300 p-0.5"></td>
                
                <td class="text-center text-xs font-bold border border-gray-300 p-1 bg-blue-50 text-blue-700" id="coursework-total-${s.student_id}">0</td>
                
                <td class="border border-gray-300 p-0.5 text-center">
                  <input 
                    type="number" 
                    class="form-input text-center w-full px-1 py-1 score-final-input text-xs bg-white border border-gray-200 rounded" 
                    data-score-type="final"
                    data-final-max="${finalRatio}"
                    value="${s.scores.final || ''}" 
                    placeholder="0"
                    min="0"
                    max="${finalRatio}"
                    oninput="calculateRowTotal('${s.student_id}')"
                  >
                </td>
                
                <td class="text-center text-xs font-bold border border-gray-300 p-1 bg-green-50 text-green-700" id="total-score-${s.student_id}">0</td>
                <td class="text-center text-xs font-bold border border-gray-300 p-1 bg-purple-50 text-purple-700" id="grade-${s.student_id}">-</td>
              </tr>
            `}).join('')}
            ${students.length === 0 ? '<tr><td colspan="20" class="text-center py-8 text-gray-500 text-sm">ไม่พบข้อมูลนักเรียนในห้องนี้</td></tr>' : ''}
          </tbody>
        </table>
      </div>

      <!-- [ ⭐️⭐️⭐️ ส่วนมือถือ: คงเดิม ⭐️⭐️⭐️ ] -->
      <div class="grid grid-cols-1 gap-4 md:hidden p-4">
        
        <div class="card p-4 shadow-md bg-gray-50 border">
          <h4 class="text-lg font-semibold text-gray-700 mb-3">จัดการตัวชี้วัด</h4>
          <div class="grid grid-cols-3 gap-2">
            <button onclick="addIndicatorColumn('${subject_id}')" class="btn btn-primary text-sm">
              <i class="fas fa-plus mr-1"></i> เพิ่ม
            </button>
            <button onclick="showMobileEditIndicatorList('${subject_id}')" class="btn btn-secondary text-sm">
              <i class="fas fa-edit mr-1"></i> แก้ไข
            </button>
            <button onclick="showMobileDeleteIndicatorList('${subject_id}')" class="btn btn-danger text-sm">
              <i class="fas fa-trash mr-1"></i> ลบ
            </button>
          </div>
        </div>

        ${students.length > 0 ? students.map((s, index) => `
          <div class="card p-4 shadow-lg border" id="mobile-score-card-${s.student_id}">
            <div class="flex items-center justify-between mb-3">
              <span class="font-mono font-semibold text-blue-600 text-lg">
                เลขที่ ${s.student_number || index + 1} (${s.student_code})
              </span>
            </div>
            
            <h3 class="font-bold text-gray-800 text-lg mb-3">${s.student_name}</h3>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div class="text-center">
                <label class="form-label text-sm">คะแนนรวม</label>
                <p class="text-2xl font-bold text-gray-800" id="mobile-total-score-${s.student_id}">
                  ${s.total_score}
                </p>
              </div>
              <div class="text-center">
                <label class="form-label text-sm">เกรด</label>
                <p class="text-2xl font-bold text-gray-800" id="mobile-grade-${s.student_id}">
                  ${s.grade}
                </p>
              </div>
            </div>
            
            <button 
              onclick="showScoreEntryModal('${s.student_id}')" 
              class="btn btn-primary w-full"
            >
              <i class="fas fa-edit mr-2"></i>กรอกคะแนน
            </button>
          </div>
        `).join('') : renderEmptyState('ไม่พบข้อมูลนักเรียน')}
      </div>

      <!-- [ ⭐️⭐️⭐️ ปุ่ม Save สำหรับมือถือ ⭐️⭐️⭐️ ] -->
      <div class="md:hidden sticky bottom-0 left-0 right-0 p-4 bg-white border-t mt-4">
        <button 
          onclick="handleSaveAllScores('${subject_id}', '${class_id}', '${semester}', '${year}')" 
          class="btn btn-success w-full"
        >
          <i class="fas fa-save mr-2"></i>บันทึกคะแนนทั้งหมด
        </button>
      </div>
    </div>
  `;
  
  document.getElementById('scoreEntryContainer').innerHTML = html;
  
  // คำนวณคะแนนรวมทั้งหมดหลังจากวาดตารางเสร็จ
  students.forEach(s => calculateRowTotal(s.student_id, true));
}

/**
 * [ ⭐️⭐️⭐️ ฟังก์ชันใหม่ (2/3) ⭐️⭐️⭐️ ]
 * (สำหรับมือถือ) แสดง Modal รายการตัวชี้วัดให้ "เลือกเพื่อแก้ไข"
 * @param {string} subjectId - ID วิชา
 */
function showMobileEditIndicatorList(subjectId) {
  const subject = window.currentSubjectData;
  if (!subject || !subject.indicators || subject.indicators.length === 0) {
    showToast('ยังไม่มีตัวชี้วัดให้แก้ไข', 'info');
    return;
  }

  const modalId = 'mobileEditListModal_' + Date.now();
  
  let listHtml = subject.indicators.map(ind => `
    <button 
      type="button" 
      class="btn btn-secondary w-full text-left justify-start"
      onclick="closeModal('${modalId}'); showEditIndicatorModal('${subjectId}', '${ind.id}')"
    >
      (${ind.max} คะแนน) ${ind.name}
    </button>
  `).join('');

  const html = `
    <div id="${modalId}" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
      <div class="modal-content bg-white rounded-lg p-6 max-w-md w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6 pb-4 border-b">
          <h3 class="text-2xl font-bold text-gray-800">เลือกตัวชี้วัดที่จะแก้ไข</h3>
          <button onclick="closeModal('${modalId}')" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        <div class="space-y-2">${listHtml}</div>
        <div class="mt-6 pt-6 border-t flex justify-end">
          <button type="button" onclick="closeModal('${modalId}')" class="btn btn-secondary px-6">ปิด</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML = html;
}

/**
 * [ ⭐️⭐️⭐️ ฟังก์ชันใหม่ (3/3) ⭐️⭐️⭐️ ]
 * (สำหรับมือถือ) แสดง Modal รายการตัวชี้วัดให้ "เลือกเพื่อลบ"
 * @param {string} subjectId - ID วิชา
 */
function showMobileDeleteIndicatorList(subjectId) {
  const subject = window.currentSubjectData;
  if (!subject || !subject.indicators || subject.indicators.length === 0) {
    showToast('ยังไม่มีตัวชี้วัดให้ลบ', 'info');
    return;
  }

  const modalId = 'mobileDeleteListModal_' + Date.now();
  
  let listHtml = subject.indicators.map(ind => `
    <button 
      type="button" 
      class="btn btn-danger w-full text-left justify-start"
      onclick="closeModal('${modalId}'); handleDeleteIndicator('${subjectId}', '${ind.id}')"
    >
      <i class="fas fa-trash mr-2"></i> (${ind.max} คะแนน) ${ind.name}
    </button>
  `).join('');

  const html = `
    <div id="${modalId}" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
      <div class="modal-content bg-white rounded-lg p-6 max-w-md w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6 pb-4 border-b">
          <h3 class="text-2xl font-bold text-gray-800">เลือกตัวชี้วัดที่จะลบ</h3>
          <button onclick="closeModal('${modalId}')" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        <div class="space-y-2">${listHtml}</div>
        <div class="mt-6 pt-6 border-t flex justify-end">
          <button type="button" onclick="closeModal('${modalId}')" class="btn btn-secondary px-6">ปิด</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML = html;
}

/**
 * [⭐️⭐️⭐️ โค้ดแก้ไข ⭐️⭐️⭐️]
 * (ทับฟังก์ชันเดิม) คำนวณคะแนนรวมของแถว (Client-side)
 * (แก้ไข: เปลี่ยนเป็นปัดเศษแบบ Math.round() เพื่อให้ .50 ปัดขึ้น)
 */
function calculateRowTotal(studentId, isInitialLoad = false) {
  const row = document.getElementById(`score-row-${studentId}`);
  if (!row) return;

  const subject = window.currentSubjectData;
  if (!subject) {
    console.error('ไม่พบข้อมูลวิชา (window.currentSubjectData)');
    return;
  }
  
  const ratioSelect = document.getElementById('scoreRatioSelect');
  const courseworkRatio = ratioSelect ? parseInt(ratioSelect.value) : (subject.coursework_ratio || 70);
  const finalRatio = 100 - courseworkRatio;
  
  const indicators = subject.indicators || [];

  // 1. คำนวณคะแนนเก็บ (Coursework)
  let studentIndicatorScore = 0;
  let totalIndicatorMax = 0;
  
  row.querySelectorAll('input.score-indicator-input').forEach(input => {
    let score = parseFloat(input.value) || 0;
    const max = parseFloat(input.dataset.indMax) || 0;
    
    if (score > max) {
      score = max;
      if (!isInitialLoad) input.value = max; 
    }
    studentIndicatorScore += score;
    totalIndicatorMax += max;
  });
  
  // 2. คำนวณคะแนนสอบปลายภาค
  const finalInput = row.querySelector('input.score-final-input');
  let finalScore = 0;
  if (finalInput) {
    const finalMax = parseFloat(finalInput.dataset.finalMax) || finalRatio;
    let score = parseFloat(finalInput.value) || 0;
    
    if (score > finalMax) {
      score = finalMax;
      if (!isInitialLoad) finalInput.value = finalMax; 
    }
    // [ ⭐️⭐️⭐️ นี่คือส่วนที่แก้ไข (1/3) ⭐️⭐️⭐️ ]
    // (ปัดเศษคะแนนปลายภาคด้วย เผื่อกรอกทศนิยม)
    finalScore = Math.round(score);
  }

  // 3. รวมคะแนน (ปรับสัดส่วน)
  let courseworkTotalScaled = 0;
  if (totalIndicatorMax > 0) {
    // [ ⭐️⭐️⭐️ นี่คือส่วนที่แก้ไข (2/3) ⭐️⭐️⭐️ ]
    // (ใช้ Math.round() เพื่อปัดเศษ .50 ขึ้น)
    courseworkTotalScaled = Math.round((studentIndicatorScore / totalIndicatorMax) * courseworkRatio);
  }
  
  // 4. รวมคะแนน (เป็นจำนวนเต็ม)
  const totalScore = courseworkTotalScaled + finalScore;
  
  // 5. คำนวณเกรด
  const gradeInfo = getGradeFromScore(totalScore);

  // [ ⭐️⭐️⭐️ นี่คือส่วนที่แก้ไข (3/3) ⭐️⭐️⭐️ ]
  // 6. อัปเดต UI (แสดงผลเป็นเลขจำนวนเต็ม)
  document.getElementById(`coursework-total-${studentId}`).textContent = courseworkTotalScaled;
  document.getElementById(`total-score-${studentId}`).textContent = totalScore;
  // [ ⭐️⭐️⭐️ สิ้นสุดส่วนที่แก้ไข (3/3) ⭐️⭐️⭐️ ]
  
  document.getElementById(`grade-${studentId}`).textContent = gradeInfo.grade;
  
  // 7. อัปเดต Mobile UI (ถ้ามี)
  const mobileTotal = document.getElementById(`mobile-total-score-${studentId}`);
  const mobileGrade = document.getElementById(`mobile-grade-${studentId}`);
  if (mobileTotal) mobileTotal.textContent = totalScore;
  if (mobileGrade) mobileGrade.textContent = gradeInfo.grade;
}

/**
 * [⭐️ แก้ไข ⭐️] แสดง Modal สำหรับเพิ่มตัวชี้วัด
 * (แก้ไขโดยการเอาตรรกะ "คะแนนที่เหลืออยู่" ออก)
 * @param {string} subjectId - ID วิชา
 */
function addIndicatorColumn(subjectId) {
  const subject = window.currentSubjectData;
  if (!subject) return;

  const fields = [
    { name: 'name', label: 'ชื่อตัวชี้วัด/ผลการเรียนรู้', type: 'text', required: true, colSpan: 3 },
    { 
      name: 'max', 
      label: 'คะแนนเต็ม (เช่น 10, 20)',
      type: 'number', 
      required: true,
      colSpan: 3
    }
  ];
  
  showFormModal('เพิ่มตัวชี้วัดใหม่', fields, async (data) => {
    const newMax = parseFloat(data.max);
    
    if (newMax <= 0) {
      showToast('คะแนนเต็มต้องมากกว่า 0', 'warning');
      return;
    }

    // ⭐️ [แก้ไข] ⭐️
    // ดึงภาคเรียนปัจจุบันจาก window
    const semester = window.currentSubjectData.current_semester || '1';

    await waitForResponse(
      () => callServerFunction('addIndicatorToSubject', subjectId, data.name, newMax, semester), // ⭐️ ส่ง semester ⭐️
      'กำลังเพิ่มตัวชี้วัด...',
      (result) => {
        if (result.success) {
          showToast('เพิ่มตัวชี้วัดสำเร็จ', 'success');
          // ⭐️ โหลดข้อมูลคะแนนใหม่ (สำคัญมาก)
          loadScoreEntry(); 
        }
      }
    );
  });
}

/**
 * [ ⭐️⭐️⭐️ ฟังก์ชัน (1/2) ⭐️⭐️⭐️ ]
 * แสดง Modal สำหรับ "แก้ไข" ตัวชี้วัด
 * @param {string} subjectId - ID วิชา
 * @param {string} indicatorId - ID ของตัวชี้วัด
 */
function showEditIndicatorModal(subjectId, indicatorId) {
  const subject = window.currentSubjectData;
  const indicator = subject.indicators.find(ind => ind.id === indicatorId);
  if (!indicator) return;

  const fields = [
    { name: 'name', label: 'ชื่อตัวชี้วัด', type: 'text', required: true, colSpan: 3 },
    { name: 'max', label: 'คะแนนเต็ม (เช่น 10, 20)', type: 'number', required: true, colSpan: 3 }
  ];
  
  showFormModal(`แก้ไขตัวชี้วัด: ${indicator.name}`, fields, async (data) => {
    const newMax = parseFloat(data.max);
    if (newMax <= 0) {
      showToast('คะแนนเต็มต้องมากกว่า 0', 'warning');
      return;
    }
    
    // ⭐️ [แก้ไข] ⭐️
    // ดึงภาคเรียนปัจจุบันจาก window
    const semester = window.currentSubjectData.current_semester || '1';

    await waitForResponse(
      () => callServerFunction('updateIndicatorInSubject', subjectId, indicatorId, data.name, newMax, semester), // ⭐️ ส่ง semester ⭐️
      'กำลังอัปเดตตัวชี้วัด...',
      (result) => {
        showToast('อัปเดตสำเร็จ', 'success');
        loadScoreEntry(); // Reload ตารางคะแนนใหม่
      }
    );
  }, { name: indicator.name, max: indicator.max }); // ⭐️ ส่งข้อมูลเดิมเข้าไปในฟอร์ม
}
/**
 * [ ⭐️⭐️⭐️ ฟังก์ชันใหม่ (2/2) ⭐️⭐️⭐️ ]
 * แสดง Modal ยืนยัน "ลบ" ตัวชี้วัด
 * @param {string} subjectId - ID วิชา
 * @param {string} indicatorId - ID ของตัวชี้วัด
 */
function handleDeleteIndicator(subjectId, indicatorId) {
  const subject = window.currentSubjectData;
  const indicator = subject.indicators.find(ind => ind.id === indicatorId);
  if (!indicator) return;

  showConfirmModal(
    'ยืนยันการลบตัวชี้วัด',
    // ⭐️ [แก้ไข] ⭐️
    `คุณต้องการลบ "${indicator.name} (เต็ม ${indicator.max})" ใช่หรือไม่? (คะแนนของตัวชี้วัดนี้จะถูกลบออกจากระบบถาวร)`,
    async () => {
      
      // ⭐️ [แก้ไข] ⭐️
      // ดึงภาคเรียนปัจจุบันจาก window
      const semester = window.currentSubjectData.current_semester || '1';

      await waitForResponse(
        () => callServerFunction('deleteIndicatorFromSubject', subjectId, indicatorId, semester), // ⭐️ ส่ง semester ⭐️
        'กำลังลบตัวชี้วัดและคะแนนที่เกี่ยวข้อง...', // ⭐️ [แก้ไข]
        (result) => {
          showToast('ลบตัวชี้วัดสำเร็จ', 'success');
          loadScoreEntry(); // Reload ตารางคะแนนใหม่
        }
      );
    },
    { confirmText: 'ลบถาวร', confirmColor: 'red' } // ⭐️ [แก้ไข]
  );
}

/**
 * [⭐️⭐️⭐️ โค้ดแก้ไข ⭐️⭐️⭐️]
 * (ทับฟังก์ชันเดิม) คำนวณคะแนนรวมของแถว (Client-side)
 * (แก้ไข: เปลี่ยนเป็นปัดเศษแบบ Math.round() เพื่อให้ .50 ปัดขึ้น)
 */
function calculateRowTotal(studentId, isInitialLoad = false) {
  const row = document.getElementById(`score-row-${studentId}`);
  if (!row) return;

  const subject = window.currentSubjectData;
  if (!subject) {
    console.error('ไม่พบข้อมูลวิชา (window.currentSubjectData)');
    return;
  }
  
  const ratioSelect = document.getElementById('scoreRatioSelect');
  const courseworkRatio = ratioSelect ? parseInt(ratioSelect.value) : (subject.coursework_ratio || 70);
  const finalRatio = 100 - courseworkRatio;
  
  const indicators = subject.indicators || [];

  // 1. คำนวณคะแนนเก็บ (Coursework)
  let studentIndicatorScore = 0;
  let totalIndicatorMax = 0;
  
  row.querySelectorAll('input.score-indicator-input').forEach(input => {
    let score = parseFloat(input.value) || 0;
    const max = parseFloat(input.dataset.indMax) || 0;
    
    if (score > max) {
      score = max;
      if (!isInitialLoad) input.value = max; 
    }
    studentIndicatorScore += score;
    totalIndicatorMax += max;
  });
  
  // 2. คำนวณคะแนนสอบปลายภาค
  const finalInput = row.querySelector('input.score-final-input');
  let finalScore = 0;
  if (finalInput) {
    const finalMax = parseFloat(finalInput.dataset.finalMax) || finalRatio;
    let score = parseFloat(finalInput.value) || 0;
    
    if (score > finalMax) {
      score = finalMax;
      if (!isInitialLoad) finalInput.value = finalMax; 
    }
    // [ ⭐️⭐️⭐️ นี่คือส่วนที่แก้ไข (1/3) ⭐️⭐️⭐️ ]
    // (ปัดเศษคะแนนปลายภาคด้วย เผื่อกรอกทศนิยม)
    finalScore = Math.round(score);
  }

  // 3. รวมคะแนน (ปรับสัดส่วน)
  let courseworkTotalScaled = 0;
  if (totalIndicatorMax > 0) {
    // [ ⭐️⭐️⭐️ นี่คือส่วนที่แก้ไข (2/3) ⭐️⭐️⭐️ ]
    // (ใช้ Math.round() เพื่อปัดเศษ .50 ขึ้น)
    courseworkTotalScaled = Math.round((studentIndicatorScore / totalIndicatorMax) * courseworkRatio);
  }
  
  // 4. รวมคะแนน (เป็นจำนวนเต็ม)
  const totalScore = courseworkTotalScaled + finalScore;
  
  // 5. คำนวณเกรด
  const gradeInfo = getGradeFromScore(totalScore);

  // [ ⭐️⭐️⭐️ นี่คือส่วนที่แก้ไข (3/3) ⭐️⭐️⭐️ ]
  // 6. อัปเดต UI (แสดงผลเป็นเลขจำนวนเต็ม)
  document.getElementById(`coursework-total-${studentId}`).textContent = courseworkTotalScaled;
  document.getElementById(`total-score-${studentId}`).textContent = totalScore;
  // [ ⭐️⭐️⭐️ สิ้นสุดส่วนที่แก้ไข (3/3) ⭐️⭐️⭐️ ]
  
  document.getElementById(`grade-${studentId}`).textContent = gradeInfo.grade;
  
  // 7. อัปเดต Mobile UI (ถ้ามี)
  const mobileTotal = document.getElementById(`mobile-total-score-${studentId}`);
  const mobileGrade = document.getElementById(`mobile-grade-${studentId}`);
  if (mobileTotal) mobileTotal.textContent = totalScore;
  if (mobileGrade) mobileGrade.textContent = gradeInfo.grade;
}

/**
 * [⭐️⭐️⭐️ โค้ดแก้ไข ⭐️⭐️⭐️]
 * (ทับฟังก์ชันเดิม) รวบรวมข้อมูลจากตารางไดนามิกและส่งไปบันทึก
 * (แก้ไข: เพิ่มการส่ง Ratio (70:30) ไปยัง Server)
 */
async function handleSaveAllScores(subjectId, classId, semester, year) {
  const studentScores = [];
  const rows = document.querySelectorAll('tr[data-student-id]');
  
  if (rows.length === 0) {
    showToast('ไม่มีข้อมูลนักเรียนให้บันทึก', 'info');
    return;
  }
  
  // [ ⭐️⭐️⭐️ นี่คือส่วนที่แก้ไข (1/2) ⭐️⭐️⭐️ ]
  // 1. ดึง Ratio จาก Dropdown
  const ratioSelect = document.getElementById('scoreRatioSelect');
  const courseworkRatio = ratioSelect ? parseInt(ratioSelect.value) : 70;
  const finalRatio = 100 - courseworkRatio;
  // [ ⭐️⭐️⭐️ สิ้นสุดส่วนที่แก้ไข (1/2) ⭐️⭐️⭐️ ]


  rows.forEach(row => {
    const student_id = row.dataset.studentId;
    
    // 2. รวบรวมคะแนนตัวชี้วัด
    const indicators = {};
    row.querySelectorAll('input.score-indicator-input').forEach(input => {
      const max = parseFloat(input.dataset.indMax) || 0;
      let score = parseFloat(input.value) || 0;
      if (score > max) score = max; // ⭐️ ตรวจสอบคะแนนก่อนส่ง
      
      indicators[input.dataset.indId] = score;
    });
    
    // 3. รวบรวมคะแนนปลายภาค
    const finalInput = row.querySelector('input.score-final-input');
    let final = 0;
    if (finalInput) {
      const finalMax = parseFloat(finalInput.dataset.finalMax) || 0;
      final = parseFloat(finalInput.value) || 0;
      if (final > finalMax) final = finalMax; // ⭐️ ตรวจสอบคะแนนก่อนส่ง
    }
    
    // 4. สร้าง Object ใหม่
    studentScores.push({ 
      student_id, 
      scores: { 
        indicators, 
        final 
      } 
    });
  });

  // [ ⭐️⭐️⭐️ นี่คือส่วนที่แก้ไข (2/2) ⭐️⭐️⭐️ ]
  // 5. เรียก Server (เพิ่ม courseworkRatio และ finalRatio)
  await waitForResponse(
    () => callServerFunction('batchSaveScores', subjectId, classId, semester, year, studentScores, courseworkRatio, finalRatio),
    // [ ⭐️⭐️⭐️ สิ้นสุดส่วนที่แก้ไข (2/2) ⭐️⭐️⭐️ ]
    
    'กำลังบันทึกคะแนนทั้งหมด...',
    (result) => {
      if (result.success) {
        showToast('บันทึกคะแนนสำเร็จ', 'success');
        
        window.currentStudentsWithScores = result.data;
        
        // (สำคัญ) อัปเดต Ratio ใน subject data (ที่เก็บใน window)
        // เพื่อให้ calculateRowTotal ทำงานถูกต้อง
        if (window.currentSubjectData) {
          window.currentSubjectData.coursework_ratio = courseworkRatio;
          window.currentSubjectData.final_ratio = finalRatio;
        }
        
        const classData = (window.allClassesForScores || []).find(c => c.id === classId) || { level: '?', room: '?' };
        classData.semester = semester;
        classData.year = year;
        
        // อัปเดตตารางด้วยข้อมูลใหม่ที่เพิ่งบันทึก
        renderScoreEntryTable(result.data, window.currentSubjectData, classData);
      } else {
        console.error(result.message);
      }
    }
  );
}

/**
 * [⭐️⭐️⭐️ ฟังก์ชันแก้ไข (1/2) ⭐️⭐️⭐️]
 * แสดง Modal สำหรับกรอกคะแนน (มือถือ) - (เวอร์ชันไดนามิก)
 */
async function showScoreEntryModal(studentId) {
  if (!window.currentStudentsWithScores || !window.currentSubjectData) {
    showToast('เกิดข้อผิดพลาด: ไม่พบข้อมูลนักเรียนหรือวิชา', 'error');
    return;
  }
  
  const student = window.currentStudentsWithScores.find(s => s.student_id === studentId);
  const subject = window.currentSubjectData;
  
  if (!student) {
    showToast('เกิดข้อผิดพลาด: ไม่พบข้อมูลนักเรียน', 'error');
    return;
  }

  const { year, semester, id: class_id } = window.currentModalClass; // ⭐️ สมมติว่า classData อยู่ในนี้
  const subject_id = subject.id;
  const courseworkRatio = subject.coursework_ratio || 70;
  const finalRatio = subject.final_ratio || 30;
  
  // 1. สร้าง Fields สำหรับ Modal แบบไดนามิก
  const fields = [];
  
  // 1.1 เพิ่มตัวชี้วัด
  if (subject.indicators && subject.indicators.length > 0) {
    fields.push({ type: 'section', label: `คะแนนเก็บ (${courseworkRatio}%)` });
    subject.indicators.forEach(ind => {
      fields.push({
        name: `indicator_${ind.id}`,
        label: `${ind.name} (เต็ม ${ind.max || 0})`,
        type: 'number',
        colSpan: 1 // ⭐️ ทำให้เป็น 1 คอลัมน์
      });
    });
  }
  
  // 1.2 เพิ่มคะแนนปลายภาค
  fields.push({ type: 'section', label: `คะแนนปลายภาค (${finalRatio}%)` });
  fields.push({
    name: 'final',
    label: `คะแนนปลายภาค (เต็ม ${finalRatio})`,
    type: 'number',
    colSpan: 1 // ⭐️ ทำให้เป็น 1 คอลัมน์
  });

  const modalId = 'scoreEntryModal_' + Date.now();
  
  // 2. เตรียม initialData
  const initialData = {};
  student.scores = student.scores || { indicators: {}, final: null };
  student.scores.indicators = student.scores.indicators || {};
  
  subject.indicators.forEach(ind => {
    initialData[`indicator_${ind.id}`] = student.scores.indicators[ind.id] || '';
  });
  initialData['final'] = student.scores.final || '';

  // 3. แสดง Modal
  showFormModal(
    `กรอกคะแนน: ${student.student_name}`,
    fields,
    async (data) => {
      // 4. รวบรวมข้อมูลเมื่อ Submit
      const indicators = {};
      subject.indicators.forEach(ind => {
        indicators[ind.id] = parseFloat(data[`indicator_${ind.id}`]) || 0;
      });
      const final = parseFloat(data.final) || 0;
      
      const studentData = { 
        student_id: studentId, 
        scores: { indicators, final } 
      };
      
      // 5. เรียก Server (ส่งไปแค่คนเดียว)
      await waitForResponse(
        () => callServerFunction('batchSaveScores', subject.id, class_id, semester, year, [studentData]),
        'กำลังบันทึกคะแนน...',
        (result) => {
          if (result.success) {
            showToast('บันทึกคะแนนสำเร็จ', 'success');
            
            // 6. (สำคัญ) อัปเดตข้อมูลใน window
            window.currentStudentsWithScores = result.data; 
            
            const classData = (window.allClassesForScores || []).find(c => c.id === class_id) || { level: '?', room: '?' };
            classData.semester = semester;
            classData.year = year;
            
            // 7. วาดตาราง/การ์ดใหม่ทั้งหมด
            renderScoreEntryTable(result.data, subject, classData);
          }
        }
      );
    },
    initialData, // initialData
    modalId // ส่ง ID
  );

  // 8. (ใหม่) เพิ่มตัวคำนวณคะแนนสดใน Modal
  setTimeout(() => {
    addScorePreviewToModal(modalId, subject);
  }, 200); // หน่วงเวลาให้ Modal สร้างเสร็จ
}

/**
 * [⭐️⭐️⭐️ ฟังก์ชันใหม่ (2/2) ⭐️⭐️⭐️]
 * (Helper) เพิ่มส่วน Preview คะแนนใน Modal
 */
function addScorePreviewToModal(modalId, subject) {
  const form = document.getElementById(`form_${modalId.split('_')[1]}`);
  if (!form) return;

  const courseworkRatio = subject.coursework_ratio || 70;
  const finalRatio = subject.final_ratio || 30;
  
  const totalEl = document.createElement('div');
  totalEl.className = 'grid grid-cols-2 gap-4 mt-6 p-4 border-t';
  totalEl.innerHTML = `
    <div class="text-center">
      <label class="form-label text-sm">คะแนนรวม (Preview)</label>
      <p class="text-3xl font-bold text-blue-600" id="modal-preview-total">0.00</p>
    </div>
    <div class="text-center">
      <label class="form-label text-sm">เกรด (Preview)</label>
      <p class="text-3xl font-bold text-blue-600" id="modal-preview-grade">-</p>
    </div>
  `;
  // เพิ่มเข้าไปหลัง grid ของ field แต่ก่อนปุ่ม
  form.querySelector('.grid.grid-cols-1').insertAdjacentElement('afterend', totalEl);

  const updatePreview = () => {
    const formData = new FormData(form);
    
    let studentIndicatorScore = 0;
    let totalIndicatorMax = 0;
    
    subject.indicators.forEach(ind => {
      const score = parseFloat(formData.get(`indicator_${ind.id}`)) || 0;
      const max = ind.max || 0;
      studentIndicatorScore += score;
      totalIndicatorMax += max;
    });
    
    const finalScore = parseFloat(formData.get('final')) || 0;
    
    let courseworkTotalScaled = 0;
    if (totalIndicatorMax > 0) {
      courseworkTotalScaled = (studentIndicatorScore / totalIndicatorMax) * courseworkRatio;
    }
    
    const totalScore = courseworkTotalScaled + finalScore;
    const gradeInfo = getGradeFromScore(totalScore);
    
    document.getElementById('modal-preview-total').textContent = totalScore.toFixed(2);
    document.getElementById('modal-preview-grade').textContent = gradeInfo.grade;
  };
  
  form.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('input', updatePreview);
  });
  
  updatePreview(); // คำนวณครั้งแรก
}

// ===================================
// GRADES VIEW PAGE
// ===================================

function renderGradesViewPage() {
  // ฟังก์ชันนี้ถูกย้ายไปอยู่ใน JS-Pages-GradesView.js
  if (typeof renderGradesViewPage_Entry === 'function') {
    renderGradesViewPage_Entry();
  } else {
    renderBreadcrumb(['หน้าแรก', 'ดูเกรดและ GPA']);
    document.getElementById('pageContent').innerHTML = '<p class="text-center py-12 text-red-500">Error: ไม่พบไฟล์ JS-Pages-GradesView.js</p>';
  }
}

/**
 * Student Grades Page
 */
function renderStudentGradesPage() {
  console.log('📚 Rendering Student Grades Page...');
  
  if (typeof renderStudentGradesPage_Entry === 'function') {
    console.log('✅ renderStudentGradesPage_Entry found');
    renderStudentGradesPage_Entry();
  } else {
    console.error('❌ renderStudentGradesPage_Entry NOT found - JS-Pages-GradesView.js may not be loaded');
    renderBreadcrumb(['หน้าแรก', 'ดูเกรดของฉัน']);
    document.getElementById('pageContent').innerHTML = '<p class="text-center py-12 text-red-500">Error: ไม่พบไฟล์ JS-Pages-GradesView.js</p>';
  }
}

/**
 * (⭐️⭐️⭐️ ฟังก์ชันใหม่: Helper โหลดฟิลเตอร์สำหรับนักเรียน ⭐️⭐️⭐️)
 */
async function loadStudentFilterOptions(yearSelectId, semesterSelectId) {
  try {
    const yearSelect = document.getElementById(yearSelectId);
    const semesterSelect = document.getElementById(semesterSelectId);
    
    // โหลดปี/เทอม ปัจจุบัน
    const [classesResult, configResult] = await Promise.all([
      callServerFunction('getClasses'), // ⭐️ เราดึงปีจากห้องเรียน
      callServerFunction('getConfig')  // ⭐️ เราดึงปี/เทอม ปัจจุบัน
    ]);

    let currentYear = new Date().getFullYear() + 543;
    if (configResult.success) {
      currentYear = configResult.data.current_year || currentYear.toString();
      semesterSelect.value = configResult.data.current_semester || '1';
    }

    // สร้าง Dropdown ปี
    if (classesResult.success && classesResult.data.length > 0) {
      const availableYears = [...new Set(classesResult.data.map(c => c.year))];
      availableYears.sort((a, b) => b.localeCompare(a, 'th'));
      
      yearSelect.innerHTML = ''; 
      availableYears.forEach(year => {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
      });
      yearSelect.value = currentYear; 
    } else {
      yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option>`;
    }

  } catch (error) {
    console.error('Error loading student filters:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดตัวกรอง', 'error');
  }
}

/**
 * (⭐️⭐️⭐️ โค้ดที่ถูกต้อง ⭐️⭐️⭐️)
 * Student Attendance Page
 */
async function renderStudentAttendancePage() { // 1. เพิ่ม async
  renderBreadcrumb(['หน้าแรก', 'สถิติการเข้าเรียน']);
  
  const html = `
    <div id="student-attendance-filters" class="card p-6 mb-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">เลือกข้อมูลเพื่อดูสถิติการเข้าเรียน</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="form-label">ปีการศึกษา</label>
          <select id="studentAttYearSelect" class="form-select">
            <option value="">-- กำลังโหลดปี --</option>
          </select>
        </div>
        <div>
          <label class="form-label">ภาคเรียน</label>
          <select class="form-select" id="studentAttSemesterSelect">
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2">ภาคเรียนที่ 2</option>
          </select>
        </div>
        
        <div class="md:mt-[28px]">
          <button onclick="loadStudentAttendanceReport()" class="btn btn-primary w-full">
            <i class="fas fa-search mr-2"></i>แสดงรายงาน
          </button>
        </div>
      </div>
    </div>
    
    <div id="studentAttendanceContainer" class="mt-6">
      </div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
  
  // ⭐️ 2. เพิ่ม showLoading() และ try...finally
  showLoading('กำลังโหลดข้อมูลตัวกรอง...');
  try {
    await loadStudentFilterOptions('studentAttYearSelect', 'studentAttSemesterSelect'); // 3. เพิ่ม await
  } catch (error) {
    console.error('Error loading filters:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดตัวกรอง', 'error');
  } finally {
    hideLoading(); // 4. เพิ่ม hideLoading()
  }
}

/**
 * (⭐️⭐️⭐️ โค้ดที่ถูกต้อง ⭐️⭐️⭐️)
 * โหลดข้อมูลสถิติของนักเรียน (ไม่มีการซ่อนฟิลเตอร์)
 */
async function loadStudentAttendanceReport() {
  const sessionToken = localStorage.getItem('sessionToken');
  const year = document.getElementById('studentAttYearSelect').value;
  const semester = document.getElementById('studentAttSemesterSelect').value;

  if (!year || !semester) {
    showToast('กรุณาเลือกปีการศึกษาและภาคเรียน', 'warning');
    return;
  }

  const resultContainer = document.getElementById('studentAttendanceContainer');
  resultContainer.innerHTML = '';

  // 1. แสดง "กำลังโหลด..."
  showLoading('กำลังโหลดข้อมูล...');
  
  // ⭐️ สังเกต: ไม่มีโค้ดซ่อนการ์ดฟิลเตอร์ตรงนี้ ⭐️
  
  try {
    const result = await new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .getStudentAttendance(sessionToken, year, semester);
    });
    
    hideLoading();
    if (result.success) {
      renderStudentAttendanceContent(result.data); // (ชื่อฟังก์ชันเดิม)
    } else {
      resultContainer.innerHTML = renderEmptyState(result.message || 'ไม่พบข้อมูล', 'fas fa-exclamation-triangle');
    }
  } catch (error) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
  }
}

/**
 * แสดงผลหน้าสถิติการเข้าเรียน (UI ใหม่ + กราฟ)
 */
function renderStudentAttendanceContent(attendanceData) {
  // 1. เตรียมข้อมูล
  const rate = parseFloat(attendanceData.attendance_rate || 0);
  let rateColor = 'text-red-600';
  let rateBg = 'bg-red-100';
  if (rate >= 80) { rateColor = 'text-green-600'; rateBg = 'bg-green-100'; }
  else if (rate >= 50) { rateColor = 'text-yellow-600'; rateBg = 'bg-yellow-100'; }

  // 2. สร้าง HTML
  const html = `
    <div class="space-y-6">
      
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-800">สถิติการเข้าเรียน</h2>
          <p class="text-gray-500 text-sm mt-1">ปีการศึกษาปัจจุบัน</p>
        </div>
        <div class="mt-4 md:mt-0 flex items-center space-x-4">
          <div class="text-right">
            <p class="text-sm text-gray-500">อัตราการเข้าเรียน</p>
            <p class="text-3xl font-bold ${rateColor}">${rate}%</p>
          </div>
          <div class="w-16 h-16 rounded-full ${rateBg} flex items-center justify-center">
            <i class="fas fa-chart-pie text-2xl ${rateColor}"></i>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white p-4 rounded-xl shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3 mb-2">
            <div class="p-2 bg-blue-50 rounded-lg text-blue-600"><i class="fas fa-calendar-day"></i></div>
            <span class="text-gray-600 text-sm font-medium">ทั้งหมด</span>
          </div>
          <p class="text-2xl font-bold text-gray-800">${attendanceData.total_days || 0} <span class="text-xs font-normal text-gray-400">วัน</span></p>
        </div>

        <div class="bg-white p-4 rounded-xl shadow-sm border border-green-100 hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3 mb-2">
            <div class="p-2 bg-green-50 rounded-lg text-green-600"><i class="fas fa-user-check"></i></div>
            <span class="text-gray-600 text-sm font-medium">มาเรียน</span>
          </div>
          <p class="text-2xl font-bold text-green-600">${attendanceData.present_days || 0} <span class="text-xs font-normal text-gray-400">วัน</span></p>
        </div>

        <div class="bg-white p-4 rounded-xl shadow-sm border border-yellow-100 hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3 mb-2">
            <div class="p-2 bg-yellow-50 rounded-lg text-yellow-600"><i class="fas fa-clock"></i></div>
            <span class="text-gray-600 text-sm font-medium">มาสาย</span>
          </div>
          <p class="text-2xl font-bold text-yellow-600">${attendanceData.late_days || 0} <span class="text-xs font-normal text-gray-400">วัน</span></p>
        </div>

        <div class="bg-white p-4 rounded-xl shadow-sm border border-red-100 hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3 mb-2">
            <div class="p-2 bg-red-50 rounded-lg text-red-600"><i class="fas fa-user-times"></i></div>
            <span class="text-gray-600 text-sm font-medium">ขาด/ลา</span>
          </div>
          <p class="text-2xl font-bold text-red-600">${attendanceData.absent_days || 0} <span class="text-xs font-normal text-gray-400">วัน</span></p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
          <h3 class="font-bold text-gray-800 mb-4">สัดส่วนการมาเรียน</h3>
          <div class="relative h-64">
            <canvas id="attendanceDoughnutChart"></canvas>
          </div>
        </div>

        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <h3 class="font-bold text-gray-800 mb-4">สถิติรายเดือน</h3>
          <div class="relative h-64">
            <canvas id="attendanceBarChart"></canvas>
          </div>
        </div>

      </div>
    </div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;

  // 3. เรียกฟังก์ชันสร้างกราฟ (ต้องรอให้ HTML render เสร็จก่อน)
  setTimeout(() => {
    renderAttendanceCharts(attendanceData);
  }, 100);
}

/**
 * Helper: สร้างกราฟด้วย Chart.js
 */
function renderAttendanceCharts(data) {
  // --- 1. Donut Chart (สัดส่วน) ---
  const ctxDonut = document.getElementById('attendanceDoughnutChart').getContext('2d');
  new Chart(ctxDonut, {
    type: 'doughnut',
    data: {
      labels: ['มาเรียน', 'มาสาย', 'ขาด/ลา'],
      datasets: [{
        data: [data.present_days || 0, data.late_days || 0, data.absent_days || 0],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], // Green, Yellow, Red
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
      },
      cutout: '70%'
    }
  });

  // --- 2. Bar Chart (รายเดือน) ---
  // แปลงข้อมูล monthly_stats เป็น Array สำหรับกราฟ
  const months = Object.keys(data.monthly_stats || {});
  // เรียงลำดับเดือน (ถ้าจำเป็น) - ปกติ Object keys อาจไม่เรียง, แต่สมมติว่า data มาเรียงแล้ว
  
  const presentData = months.map(m => data.monthly_stats[m].present || 0);
  const lateData = months.map(m => data.monthly_stats[m].late || 0);
  const absentData = months.map(m => (data.monthly_stats[m].absent || 0) + (data.monthly_stats[m].leave || 0));

  const ctxBar = document.getElementById('attendanceBarChart').getContext('2d');
  new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: months, // ['ม.ค. 68', 'ก.พ. 68', ...]
      datasets: [
        {
          label: 'มาเรียน',
          data: presentData,
          backgroundColor: '#10b981',
          borderRadius: 4
        },
        {
          label: 'มาสาย',
          data: lateData,
          backgroundColor: '#f59e0b',
          borderRadius: 4
        },
        {
          label: 'ขาด/ลา',
          data: absentData,
          backgroundColor: '#ef4444',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', align: 'end', labels: { usePointStyle: true } }
      },
      scales: {
        y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ===================================
// BEHAVIORS PAGE
// ===================================

function renderBehaviorsPage() {
  // ฟังก์ชันนี้ถูกย้ายไปอยู่ใน JS-Pages-Behaviors.js
  if (typeof renderBehaviorSelectionPage === 'function') {
    renderBehaviorSelectionPage();
  } else {
    renderBreadcrumb(['หน้าแรก', 'บันทึกพฤติกรรม']);
    document.getElementById('pageContent').innerHTML = '<p class="text-center py-12 text-red-500">Error: ไม่พบไฟล์ JS-Pages-Behaviors.js</p>';
  }
}

// ===================================
// ACTIVITIES PAGE
// ===================================

function renderActivitiesPage() {
  // ฟังก์ชันนี้ถูกย้ายไปอยู่ใน JS-Pages-Activities.js
  if (typeof renderActivitySelectionPage === 'function') {
    renderActivitySelectionPage();
  } else {
    renderBreadcrumb(['หน้าแรก', 'บันทึกกิจกรรม']);
    document.getElementById('pageContent').innerHTML = '<p class="text-center py-12 text-red-500">Error: ไม่พบไฟล์ JS-Pages-Activities.js</p>';
  }
}

// ===================================
// READING PAGE (NEW)
// ===================================

function renderReadingSelectionPage() {
  // ฟังก์ชันนี้ถูกย้ายไปอยู่ใน JS-Pages-Reading.js
  if (typeof renderReadingSelectionPage === 'function') {
    renderReadingSelectionPage();
  } else {
    renderBreadcrumb(['หน้าแรก', 'บันทึกการอ่านฯ']);
    document.getElementById('pageContent').innerHTML = '<p class="text-center py-12 text-red-500">Error: ไม่พบไฟล์ JS-Pages-Reading.js</p>';
  }
}

// ===================================
// PP5 PAGE
// ===================================

function renderPP5Page() {
  // ฟังก์ชันนี้ถูกย้ายไปอยู่ใน JS-Pages-PP5.js
  if (typeof renderPP5SelectionPage === 'function') {
    renderPP5SelectionPage();
  } else {
    renderBreadcrumb(['หน้าแรก', 'พิมพ์ ปพ.5']);
    document.getElementById('pageContent').innerHTML = '<p class="text-center py-12 text-red-500">Error: ไม่พบไฟล์ JS-Pages-PP5.js</p>';
  }
}


// ===================================
// PP6 PAGE
// ===================================

function renderPP6Page() {
  // ฟังก์ชันนี้ถูกย้ายไปอยู่ใน JS-Pages-PP6.js
  if (typeof renderPP6SelectionPage === 'function') {
    renderPP6SelectionPage();
  } else {
    renderBreadcrumb(['หน้าแรก', 'พิมพ์ ปพ.6']);
    document.getElementById('pageContent').innerHTML = '<p class="text-center py-12 text-red-500">Error: ไม่พบไฟล์ JS-Pages-PP6.js</p>';
  }
}

// ===================================
// REPORTS PAGE
// ===================================

function renderReportsPage() {
  // ฟังก์ชันนี้ถูกย้ายไปอยู่ใน JS-Pages-Reports.js
  if (typeof renderReportsPage === 'function') {
    renderReportsPage();
  } else {
    renderBreadcrumb(['หน้าแรก', 'รายงาน']);
    document.getElementById('pageContent').innerHTML = '<p class="text-center py-12 text-red-500">Error: ไม่พบไฟล์ JS-Pages-Reports.js</p>';
  }
}

// ===================================
// USERS PAGE
// ===================================

async function renderUsersPage() {
  if (!checkPermission('admin')) {
    showNoPermission();
    return;
  }
  
  renderBreadcrumb(['หน้าแรก', 'จัดการผู้ใช้งาน']);
  showLoading('กำลังโหลดข้อมูลผู้ใช้...');
  
  try {
    const result = await callServerFunction('getUsers');
    
    if (!result.success) {
      showToast(result.message, 'error');
      return;
    }
    
    // [ ⭐️ แก้ไข ⭐️ ] เก็บข้อมูลไว้ใน window สำหรับ Pagination
    window.allUsersData = result.data || [];
    window.filteredUsersData = [...window.allUsersData];
    window.currentUsersPage = 1;
    
    // [ ⭐️ แก้ไข ⭐️ ] เรียกใช้ฟังก์ชันวาด List
    renderUsersList();
    
  } catch (error) {
    console.error('Error loading users:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * [ ⭐️ ใหม่ ⭐️ ]
 * วาดรายการผู้ใช้งาน + Pagination
 */
function renderUsersList() {
  const pageSize = 20; // ⭐️ แสดง 20 รายการต่อหน้า
  
  // กรอง (เผื่ออนาคต)
  window.filteredUsersData = [...window.allUsersData];
  
  const paginated = paginateArray(window.filteredUsersData, window.currentUsersPage, pageSize);
  
  const columns = [
    { label: 'ผู้ใช้', field: 'name', render: (val, row) => {
        const initial = getInitials(row.name);
        const photoHtml = row.photo_url
          ? `<img src="${row.photo_url}" alt="${row.name}" class="w-10 h-10 rounded-full object-cover">`
          : `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
               ${initial}
             </div>`;
        return `
          <div class="flex items-center space-x-3">
            ${photoHtml}
            <div>
              <p class="font-semibold text-gray-800">${row.name}</p>
              <p class="text-sm text-gray-500">${row.username}</p>
            </div>
          </div>
        `;
    } },
    { label: 'Role', field: 'role', render: (value) => getRoleLabel(value) },
    { label: 'อีเมล', field: 'email' },
    { label: 'สถานะ', field: 'active', render: (value) => `
        <span class="badge ${value ? 'badge-success' : 'badge-secondary'}">
          ${value ? 'เปิดใช้งาน' : 'ระงับ'}
        </span>
      `},
    { label: 'เข้าสู่ระบบล่าสุด', field: 'last_login', render: (value) => value ? formatThaiDate(value, true) : '-' }
  ];
  
  const actions = (user) => `
    <button onclick="editUser('${user.id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded" title="แก้ไข">
      <i class="fas fa-edit"></i>
    </button>
    <button onclick="deleteUser('${user.id}')" class="p-2 text-red-600 hover:bg-red-50 rounded" title="ลบ">
      <i class="fas fa-trash"></i>
    </button>
  `;

  const html = `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">จัดการผู้ใช้งาน</h2>
      <button onclick="showAddUserModal()" class="btn btn-primary">
        <i class="fas fa-plus mr-2"></i>เพิ่มผู้ใช้
      </button>
    </div>
    
    <div class="card p-0 md:p-4 hidden md:block">
      ${renderDataTable(paginated.data, columns, {
        actions: actions,
        emptyMessage: 'ไม่พบข้อมูลผู้ใช้งาน'
      })}
    </div>
    
    <div class="grid grid-cols-1 gap-4 md:hidden">
      ${paginated.data.length > 0 ? paginated.data.map(user => {
        const initial = getInitials(user.name);
        const photoHtml = user.photo_url
          ? `<img src="${user.photo_url}" alt="${user.name}" class="w-16 h-16 rounded-full object-cover shadow-md">`
          : `<div class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xl shadow-md">
               ${initial}
             </div>`;
        
        return `
          <div class="card p-4 shadow-lg">
            <div class="flex items-center justify-between mb-3 pb-2 border-b">
              <span class="font-mono font-semibold text-blue-600 text-lg">${user.username}</span>
              <span class="badge ${user.active ? 'badge-success' : 'badge-secondary'}">
                ${user.active ? 'เปิดใช้งาน' : 'ระงับ'}
              </span>
            </div>
            
            <div class="flex items-center space-x-3 mb-4">
              ${photoHtml}
              <div class="flex-1">
                <h3 class="font-bold text-gray-800 text-lg">${user.name}</h3>
                <p class="text-gray-600">${getRoleLabel(user.role)}</p>
                <p class="text-sm text-gray-500">${user.email || '-'}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button onclick="editUser('${user.id}')" class="btn btn-primary text-sm">
                <i class="fas fa-edit mr-1"></i> แก้ไข
              </button>
              <button onclick="deleteUser('${user.id}')" class="btn btn-danger text-sm">
                <i class="fas fa-trash mr-1"></i> ลบ
              </button>
            </div>
          </div>
        `;
      }).join('') : renderEmptyState('ไม่พบข้อมูลผู้ใช้งาน')}
    </div>
    
    ${renderPagination(paginated.total, paginated.page, paginated.pageSize, (page) => {
      window.currentUsersPage = page;
      renderUsersList();
    })}
  `;
  
  document.getElementById('pageContent').innerHTML = html;
}

function showAddUserModal() {
  const fields = [
    { name: 'username', label: 'Username', type: 'text', required: true },
    { name: 'password', label: 'Password', type: 'text', required: true },
    { name: 'name', label: 'ชื่อ-นามสกุล', type: 'text', required: true },
    { name: 'role', label: 'Role', type: 'select', required: true, options: [
      { value: 'admin', label: 'ผู้ดูแลระบบ' },
      { value: 'principal', label: 'ผู้อำนวยการ' },
      { value: 'teacher', label: 'ครู' },
      { value: 'homeroom', label: 'ครูประจำชั้น' },
      { value: 'registrar', label: 'งานทะเบียน' }
    ]},
    { name: 'email', label: 'อีเมล', type: 'email' },
    { name: 'phone', label: 'เบอร์โทรศัพท์', type: 'tel' }
  ];
  
  showFormModal('เพิ่มผู้ใช้ใหม่', fields, async (data) => {
    await waitForResponse(
      () => callServerFunction('createUser', data),
      'กำลังบันทึกข้อมูล...',
      (result) => {
        showToast('เพิ่มผู้ใช้สำเร็จ', 'success');
        renderUsersPage();
      }
    );
  });
}

async function editUser(userId) {
  // [ ⭐️ แก้ไข ⭐️ ] ทำให้ฟังก์ชันทำงานได้
  showLoading('กำลังโหลดข้อมูล...');
  try {
    // 1. ค้นหาผู้ใช้จากข้อมูลใน window
    if (!window.allUsersData) {
      // (กันเหนียว) ถ้าข้อมูลหายไป ให้โหลดใหม่
      await renderUsersPage();
      return;
    }
    
    const user = window.allUsersData.find(u => u.id === userId);
    if (!user) {
      showToast('ไม่พบข้อมูลผู้ใช้', 'error');
      hideLoading();
      return;
    }
    
    hideLoading();
    
    // 2. กำหนด Fields สำหรับ Modal
    const fields = [
      { name: 'username', label: 'Username', type: 'text', required: true, disabled: true, colSpan: 1 }, // ห้ามแก้ Username
      { name: 'name', label: 'ชื่อ-นามสกุล', type: 'text', required: true, colSpan: 2 },
      { name: 'role', label: 'Role', type: 'select', required: true, options: [
        { value: 'admin', label: 'ผู้ดูแลระบบ' },
        { value: 'principal', label: 'ผู้อำนวยการ' },
        { value: 'teacher', label: 'ครู' },
        { value: 'homeroom', label: 'ครูประจำชั้น' },
        { value: 'registrar', label: 'งานทะเบียน' }
      ]},
      { name: 'email', label: 'อีเมล', type: 'email', colSpan: 2 },
      { name: 'active', label: 'สถานะ', type: 'select', required: true, options: [
        { value: 'true', label: 'เปิดใช้งาน' }, // ใช้ string "true"
        { value: 'false', label: 'ระงับ' }   // ใช้ string "false"
      ]}
    ];
    
    // 3. เตรียม initialData (แปลง boolean เป็น string)
    const initialData = {
      ...user,
      active: user.active.toString()
    };

    // 4. แสดง Modal
    showFormModal('แก้ไขข้อมูลผู้ใช้', fields, async (data) => {
      
      // 5. แปลงค่ากลับเป็น Boolean ก่อนส่ง
      const updateData = {
        ...data,
        active: (data.active === 'true' || data.active === true)
      };

      await waitForResponse(
        () => callServerFunction('updateUser', userId, updateData),
        'กำลังบันทึกข้อมูล...',
        (result) => {
          showToast('บันทึกข้อมูลสำเร็จ', 'success');
          // 6. รีเฟรชหน้า (ดึงข้อมูลใหม่ทั้งหมด)
          renderUsersPage(); 
        }
      );
    }, initialData); // ⭐️ ส่ง initialData เข้าไป
    
  } catch (error) {
    console.error('Error editing user:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
    hideLoading();
  }
}

function deleteUser(userId) {
  // [ ⭐️ แก้ไข ⭐️ ] ทำให้ฟังก์ชันทำงานได้
  
  // 1. (กันเหนียว) ห้ามลบตัวเอง
  if (window.currentUser && window.currentUser.user_id === userId) {
    showAlert('คุณไม่สามารถลบผู้ใช้งานของตนเองได้', 'warning');
    return;
  }
  
  // 2. ค้นหาชื่อผู้ใช้เพื่อแสดงใน Modal
  const user = window.allUsersData ? window.allUsersData.find(u => u.id === userId) : null;
  const userName = user ? user.name : 'ผู้ใช้คนนี้';

  showConfirmModal(
    'ยืนยันการลบ',
    `ต้องการลบผู้ใช้ "${userName}" ใช่หรือไม่? (การดำเนินการนี้ไม่สามารถย้อนกลับได้)`,
    async () => {
      // 3. เรียก Server เพื่อลบ
      await waitForResponse(
        () => callServerFunction('deleteUser', userId),
        'กำลังลบข้อมูล...',
        (result) => {
          if (result.success) {
            showToast('ลบผู้ใช้สำเร็จ', 'success');
            // 4. รีเฟรชหน้า (ดึงข้อมูลใหม่ทั้งหมด)
            renderUsersPage();
          } else {
            // showToast(result.message, 'error'); // (waitForResponse จัดการให้แล้ว)
            console.error('Delete failed:', result.message);
          }
        }
      );
    },
    { confirmText: 'ลบ', confirmColor: 'red' }
  );
}

// ===================================
// SETTINGS PAGE
// ===================================

async function renderSettingsPage() {
  if (!checkPermission('admin')) {
    showNoPermission();
    return;
  }
  
  renderBreadcrumb(['หน้าแรก', 'ตั้งค่าระบบ']);
  showLoading('กำลังโหลดข้อมูลการตั้งค่า...');
  
  try {
    const result = await callServerFunction('getConfig');
    
    if (!result.success) {
      showToast('ไม่สามารถโหลดข้อมูลการตั้งค่าได้', 'error');
      return;
    }
    
    window.systemConfig = result.data;
    const config = window.systemConfig;
    
    // ✅ ตรวจสอบ Logo URL
    const logoUrl = config.school_logo_url && config.school_logo_url.trim() !== '' 
      ? config.school_logo_url 
      : 'https://placehold.co/150x150/e0e0e0/808080?text=School+Logo';
    
    // ⭐️ [ใหม่] เรียกฟังก์ชันวาด Input ของคาบเวลา [อ้างอิง: code.gs, source 607-608]
    const timetableInputsHtml = renderTimetablePeriodInputs(config.timetable_periods || []);
    
    const html = `
      <form id="settingsForm" onsubmit="handleSaveSettings(event); return false;">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-800">ตั้งค่าระบบ</h2>
          <button type="submit" class="btn btn-primary">
            <i class="fas fa-save mr-2"></i>บันทึกการเปลี่ยนแปลง
          </button>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div class="card p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">ข้อมูลระบบและโรงเรียน</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label class="form-label">ชื่อระบบ (App Name)</label>
                <input 
                  type="text" 
                  name="app_name" 
                  class="form-input" 
                  value="${escapeHTML(config.app_name || 'ระบบ ปพ.5 และ ปพ.6')}"
                  required
                >
              </div>

              <div>
                <label class="form-label">ชื่อโรงเรียน</label>
                <input 
                  type="text" 
                  name="school_name" 
                  class="form-input" 
                  value="${escapeHTML(config.school_name || '')}"
                  required
                >
              </div>

              <div>
                <label class="form-label">ชื่อโรงเรียน (อังกฤษ)</label>
                <input 
                  type="text" 
                  name="school_name_en" 
                  class="form-input" 
                  value="${escapeHTML(config.school_name_en || '')}"
                >
              </div>

              <div>
                <label class="form-label">รหัสโรงเรียน</label>
                <input 
                  type="text" 
                  name="school_code" 
                  class="form-input" 
                  value="${escapeHTML(config.school_code || '')}"
                >
              </div>

              <div>
                <label class="form-label">ชื่อผู้อำนวยการ</label>
                <input 
                  type="text" 
                  name="principal_name" 
                  class="form-input" 
                  value="${escapeHTML(config.principal_name || '')}"
                >
              </div>

              <div>
                <label class="form-label">เขตพื้นที่การศึกษา</label>
                <input 
                  type="text" 
                  name="school_district" 
                  class="form-input" 
                  value="${escapeHTML(config.school_district || '')}"
                >
              </div>
              
              <div class="md:col-span-2">
                <label class="form-label">โลโก้โรงเรียน</label>
                <div class="flex items-center space-x-4">
                  <img 
                    id="logoPreview" 
                    src="${logoUrl}" 
                    alt="Logo Preview" 
                    class="w-24 h-24 rounded-lg object-contain border-2 border-gray-200 bg-gray-50"
                    onerror="this.src='https://placehold.co/150x150/e0e0e0/808080?text=Logo+Error'"
                  >
                  
                  <div class="flex-1">
                    <button 
                      type="button"
                      onclick="document.getElementById('logoFileInput').click()"
                      class="btn btn-secondary text-sm"
                    >
                      <i class="fas fa-upload mr-2"></i>เลือกไฟล์
                    </button>
                    <p class="text-xs text-gray-500 mt-1">อัปโหลดรูปภาพใหม่ (PNG, JPG)</p>
                    
                    <input 
                      type="file" 
                      id="logoFileInput" 
                      class="hidden"
                      accept="image/png, image/jpeg"
                      onchange="handleFilePreview(event, 'logoPreview', 'logoHiddenInput')"
                    >
                    
                    <input 
                      type="hidden" 
                      id="logoHiddenInput" 
                      name="school_logo_base64" 
                    >
                  </div>
                </div>
              </div>
              
              <div class="md:col-span-2">
                <label class="form-label">ที่อยู่ (บ้านเลขที่, ถนน)</label>
                <input 
                  type="text" 
                  name="address_main" 
                  class="form-input" 
                  value="${escapeHTML(config.school_address?.address || '')}"
                >
              </div>
              
              <div>
                <label class="form-label">ตำบล/แขวง</label>
                <input 
                  type="text" 
                  name="address_subdistrict" 
                  class="form-input" 
                  id="sub_district" 
                  value="${escapeHTML(config.school_address?.subdistrict || '')}"
                >
              </div>

              <div>
                <label class="form-label">อำเภอ/เขต</label>
                <input 
                  type="text" 
                  name="address_district" 
                  class="form-input" 
                  id="district" 
                  value="${escapeHTML(config.school_address?.district || '')}"
                >
              </div>

              <div>
                <label class="form-label">จังหวัด</label>
                <input 
                  type="text" 
                  name="address_province" 
                  class="form-input" 
                  id="province" 
                  value="${escapeHTML(config.school_address?.province || '')}"
                >
              </div>

              <div>
                <label class="form-label">รหัสไปรษณีย์</label>
                <input 
                  type="text" 
                  name="address_zipcode" 
                  class="form-input" 
                  id="postcode" 
                  value="${escapeHTML(config.school_address?.zipcode || '')}"
                >
              </div>
              
              <div>
                <label class="form-label">เบอร์โทรศัพท์</label>
                <input 
                  type="text" 
                  name="school_phone" 
                  class="form-input" 
                  value="${escapeHTML(config.school_phone || '')}"
                  placeholder="0812345678"
                >
              </div>

              <div>
                <label class="form-label">โทรสาร (Fax)</label>
                <input 
                  type="text" 
                  name="school_fax" 
                  class="form-input" 
                  value="${escapeHTML(config.school_fax || '')}"
                  placeholder="02-1234567"
                >
              </div>

              <div>
                <label class="form-label">เว็บไซต์</label>
                <input 
                  type="url" 
                  name="school_website" 
                  class="form-input" 
                  value="${escapeHTML(config.school_website || '')}"
                  placeholder="https://example.com"
                >
              </div>

              <div>
                <label class="form-label">อีเมล</label>
                <input 
                  type="email" 
                  name="school_email" 
                  class="form-input" 
                  value="${escapeHTML(config.school_email || '')}"
                  placeholder="info@school.ac.th"
                >
              </div>

            </div>
          </div>
          
          <div class="flex flex-col space-y-6">
            <div class="card p-6">
              <h3 class="text-lg font-bold text-gray-800 mb-4">ปีการศึกษา</h3>
              <div class="grid grid-cols-2 gap-4">
                
                <div>
                  <label class="form-label">ปีการศึกษาปัจจุบัน</label>
                  <input 
                    type="text" 
                    name="current_year" 
                    class="form-input" 
                    value="${escapeHTML(config.current_year || '2567')}"
                    required
                  >
                </div>

                <div>
                  <label class="form-label">ภาคเรียนปัจจุบัน</label>
                  <select name="current_semester" class="form-select" required>
                    <option value="1" ${config.current_semester === '1' ? 'selected' : ''}>ภาคเรียนที่ 1</option>
                    <option value="2" ${config.current_semester === '2' ? 'selected' : ''}>ภาคเรียนที่ 2</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="card p-6">
              <h3 class="text-lg font-bold text-gray-800 mb-4">ตั้งค่าคาบเวลา</h3>
              <p class="text-sm text-gray-500 mb-4">
                กำหนดชื่อและช่วงเวลาของแต่ละคาบเรียน (เรียงลำดับ 1, 2, 3...)
              </p>
              
              <div id="timetablePeriodsContainer" class="space-y-3">
                ${timetableInputsHtml}
              </div>
              
              <div class="mt-4">
                <button 
                  type="button" 
                  onclick="addTimetablePeriodInput()" 
                  class="btn btn-secondary text-sm"
                >
                  <i class="fas fa-plus mr-2"></i>เพิ่มคาบ
                </button>
              </div>
            </div>
            <div class="card p-6">
              <h3 class="text-lg font-bold text-gray-800 mb-4">Google Drive Folders</h3>
              
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div class="flex">
                  <i class="fas fa-info-circle text-blue-600 mr-3 mt-1"></i>
                  <div class="text-sm text-blue-800">
                    <strong>สำคัญ:</strong> ตั้งค่า "Photos Folder ID" เพื่อใช้เก็บรูปนักเรียนและโลโก้โรงเรียน
                  </div>
                </div>
              </div>
              
              <p class="text-sm text-gray-500 mb-4">
                วาง ID ของ Folder ที่คุณสร้างไว้ใน Google Drive
              </p>
              
              <div class="space-y-4">
                <div>
                  <label class="form-label">Photos Folder ID (รูปนักเรียน + โลโก้)</label>
                  <input 
                    type="text" 
                    name="photos_folder_id" 
                    class="form-input" 
                    value="${escapeHTML(config.drive_settings?.photos_folder_id || '')}"
                    placeholder="ตัวอย่าง: 1a2b3c4d5e6f7g8h9i..."
                  >
                  <p class="text-xs text-gray-500 mt-1">
                    วิธีหา Folder ID: เปิด Folder ใน Google Drive → ดู URL → ID คือส่วนหลังจาก /folders/
                  </p>
                </div>

                <div>
                  <label class="form-label">Documents Folder ID (เอกสาร)</label>
                  <input 
                    type="text" 
                    name="documents_folder_id" 
                    class="form-input" 
                    value="${escapeHTML(config.drive_settings?.documents_folder_id || '')}"
                    placeholder="ตัวอย่าง: 1a2b3c4d5e6f7g8h9i..."
                  >
                  <p class="text-xs text-gray-500 mt-1">
                    สำหรับเก็บเอกสารต่างๆของโรงเรียน (เอกสารตัวอย่าง PDF ฯลฯ)
                  </p>
                </div>
              </div>
            </div>
          </div>
          
        </div>

        <div class="flex justify-end space-x-3 mt-6 pt-6 border-t sticky bottom-0 bg-white z-10">
          
          <button 
            type="submit" 
            class="btn btn-primary px-6"
          >
            <i class="fas fa-save mr-2"></i>บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      </form>
    `;
    
    document.getElementById('pageContent').innerHTML = html;

    // ✅ เรียกใช้ Thailand Autocomplete สำหรับที่อยู่
    if (typeof initializeSettingsPageThailandAutoComplete === 'function') {
      initializeSettingsPageThailandAutoComplete();
    }
    
  } catch (error) {
    console.error('Error loading settings:', error);
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * ⭐️ [ฟังก์ชันใหม่ 1/4]
 * สร้าง HTML สำหรับช่องกรอกคาบเวลา
 */
function renderTimetablePeriodInputs(periods) {
  if (!periods || periods.length === 0) {
    // ถ้าไม่มีข้อมูล ให้สร้างช่องว่าง 8 คาบ
    periods = [
      { id: 1, label: 'คาบที่ 1', time: '' }, { id: 2, label: 'คาบที่ 2', time: '' },
      { id: 3, label: 'คาบที่ 3', time: '' }, { id: 4, label: 'คาบที่ 4', time: '' },
      { id: 5, label: 'คาบที่ 5', time: '' }, { id: 6, label: 'คาบที่ 6', time: '' },
      { id: 7, label: 'คาบที่ 7', time: '' }, { id: 8, label: 'คาบที่ 8', time: '' }
    ];
  }
  
  return periods.map((period, index) => `
    <div class="period-row flex items-center space-x-2">
      <span class="font-semibold text-gray-500 w-8 text-right">${index + 1}.</span>
      <input 
        type="text" 
        name="period_label" 
        class="form-input text-sm" 
        placeholder="ชื่อคาบ (เช่น คาบที่ 1)" 
        value="${escapeHTML(period.label || '')}"
      >
      <input 
        type="text" 
        name="period_time" 
        class="form-input text-sm w-48" 
        placeholder="ช่วงเวลา (เช่น 08:30-09:30)" 
        value="${escapeHTML(period.time || '')}"
      >
      <button 
        type="button" 
        onclick="removeTimetablePeriodInput(this)"
        class="btn btn-danger btn-sm p-2 h-9 w-9"
      >
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
}

/**
 * ⭐️ [ฟังก์ชันใหม่ 2/4]
 * เพิ่มช่องกรอกคาบเวลาใหม่
 */
function addTimetablePeriodInput() {
  const container = document.getElementById('timetablePeriodsContainer');
  const newIndex = container.querySelectorAll('.period-row').length + 1;
  
  const newRow = document.createElement('div');
  newRow.className = 'period-row flex items-center space-x-2';
  newRow.innerHTML = `
    <span class="font-semibold text-gray-500 w-8 text-right">${newIndex}.</span>
    <input 
      type="text" 
      name="period_label" 
      class="form-input text-sm" 
      placeholder="ชื่อคาบ (เช่น คาบที่ ${newIndex})" 
      value="คาบที่ ${newIndex}"
    >
    <input 
      type="text" 
      name="period_time" 
      class="form-input text-sm w-48" 
      placeholder="ช่วงเวลา (เช่น 08:30-09:30)" 
      value=""
    >
    <button 
      type="button" 
      onclick="removeTimetablePeriodInput(this)"
      class="btn btn-danger btn-sm p-2 h-9 w-9"
    >
      <i class="fas fa-trash"></i>
    </button>
  `;
  container.appendChild(newRow);
  
  // อัปเดตเลขลำดับ
  updatePeriodRowNumbers();
}

/**
 * ⭐️ [ฟังก์ชันใหม่ 3/4]
 * ลบช่องกรอกคาบเวลา
 */
function removeTimetablePeriodInput(buttonEl) {
  const row = buttonEl.closest('.period-row');
  if (row) {
    row.remove();
    updatePeriodRowNumbers();
  }
}

/**
 * ⭐️ [ฟังก์ชันใหม่ 4/4]
 * (Helper) อัปเดตเลขลำดับ
 */
function updatePeriodRowNumbers() {
  const container = document.getElementById('timetablePeriodsContainer');
  container.querySelectorAll('.period-row').forEach((row, index) => {
    const numberSpan = row.querySelector('span:first-child');
    if (numberSpan) {
      numberSpan.textContent = `${index + 1}.`;
    }
  });
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function handleSaveSettings(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData);
  
  // ⭐️ 1. รวบรวมข้อมูลคาบเวลาจาก Input ที่เพิ่มใหม่
  const timetablePeriods = [];
  document.querySelectorAll('#timetablePeriodsContainer .period-row').forEach((row, index) => {
    const label = row.querySelector('input[name="period_label"]').value.trim();
    const time = row.querySelector('input[name="period_time"]').value.trim();
    
    // บันทึกเฉพาะอันที่มีชื่อ
    if (label) {
      timetablePeriods.push({
        id: index + 1, // ⭐️ ID จะเรียงลำดับใหม่เสมอ (1, 2, 3...)
        label: label,
        time: time
      });
    }
  });
  
  // ✅ DEBUG: ตรวจสอบ Base64 ที่ส่งมา
  console.log('Form data school_logo_base64 length:', data.school_logo_base64 ? data.school_logo_base64.length : 'null');
  console.log('Form data school_logo_base64 starts with:', data.school_logo_base64 ? data.school_logo_base64.substring(0, 50) : 'none');
  
  const newConfig = {
    ...window.systemConfig,

    app_name: data.app_name, 
    school_name: data.school_name,
    school_name_en: data.school_name_en,
    school_code: data.school_code,
    principal_name: data.principal_name,
    school_district: data.school_district,
    school_phone: data.school_phone,
    school_fax: data.school_fax,
    school_website: data.school_website,
    school_email: data.school_email || '',

    // ✅ แก้ไข: เก็บ Base64 หรือ null
    school_logo_base64: (data.school_logo_base64 && data.school_logo_base64.trim() !== '' && data.school_logo_base64 !== 'undefined') 
      ? data.school_logo_base64 
      : null,

    current_year: data.current_year,
    current_semester: data.current_semester,
    
    // ⭐️ 2. ใส่ข้อมูลคาบเวลาที่รวบรวมได้ ลงใน Config
    timetable_periods: timetablePeriods,

    school_address: {
      address: data.address_main || '',
      subdistrict: data.address_subdistrict || '',
      district: data.address_district || '',
      province: data.address_province || '',
      zipcode: data.address_zipcode || ''
    },
    drive_settings: {
      ...window.systemConfig.drive_settings,
      photos_folder_id: data.photos_folder_id || '',
      documents_folder_id: data.documents_folder_id || ''
    }
  };
  
  // ✅ DEBUG: ตรวจสอบ newConfig
  console.log('newConfig.school_logo_base64 length:', newConfig.school_logo_base64 ? newConfig.school_logo_base64.length : 'null');
  
  await waitForResponse(
    () => callServerFunction('updateConfig', newConfig),
    'กำลังบันทึกการตั้งค่า...',
    (result) => {
      if (result.success) {
        showToast('บันทึกการตั้งค่าสำเร็จ', 'success');
        window.systemConfig = result.data;
        
        // ✅ DEBUG
        console.log('Result data school_logo_url:', result.data.school_logo_url);
        
        // ✅ อัปเดต Logo Preview
        if (result.data.school_logo_url && result.data.school_logo_url.trim() !== '') {
          const logoPreview = document.getElementById('logoPreview');
          if (logoPreview) {
            const cacheBuster = new Date().getTime();
            const newUrl = result.data.school_logo_url + '?t=' + cacheBuster;
            
            // ✅ DEBUG
            console.log('Setting logo preview URL:', newUrl);
            
            logoPreview.src = newUrl;
            logoPreview.onerror = function() {
              console.error('Logo preview failed to load:', newUrl);
              this.src = 'https://placehold.co/150x150/e0e0e0/808080?text=Logo+Error';
            };
          }
          
          // ✅ อัปเดต Navbar Logo
          const navLogos = document.querySelectorAll('nav img');
          navLogos.forEach(logo => {
            if (logo.alt && (logo.alt.includes('Logo') || logo.alt.includes('logo'))) {
              const cacheBuster = new Date().getTime();
              logo.src = result.data.school_logo_url + '?t=' + cacheBuster;
            }
          });
        } else {
          console.warn('No school_logo_url returned from server');
        }
        
        // ✅ อัปเดต Title
        const navAppName = document.querySelector('#mainApp nav h1');
        const navSchoolName = document.querySelector('#mainApp nav p');
        
        if (navAppName) navAppName.textContent = result.data.app_name || 'ระบบ';
        if (navSchoolName) navSchoolName.textContent = result.data.school_name || '';
        
        document.title = `${result.data.app_name || 'ระบบ'} | ${result.data.school_name || 'โรงเรียน'}`;

      } else {
        console.error('Save settings failed:', result.message);
        showToast('บันทึกไม่สำเร็จ: ' + result.message, 'error');
      }
    },
    (error) => {
      console.error('Settings save error:', error);
      showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
  );
}

// ===================================
// UTILITY FUNCTIONS (SHARED)
// ===================================

function getRoleLabel(role) {
  const roles = {
    'admin': 'ผู้ดูแลระบบ',
    'principal': 'ผู้อำนวยการ',
    'teacher': 'ครู',
    'homeroom': 'ครูประจำชั้น',
    'registrar': 'งานทะเบียน',
    'student': 'นักเรียน',
    'parent': 'ผู้ปกครอง'
  };
  return roles[role] || role;
}

function showNoPermission() {
  const html = `
    <div class="text-center py-12">
      <i class="fas fa-lock text-6xl text-gray-300 mb-4"></i>
      <h3 class="text-2xl font-bold text-gray-700 mb-2">ไม่มีสิทธิ์เข้าถึง</h3>
      <p class="text-gray-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
    </div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
  renderBreadcrumb(['ไม่มีสิทธิ์เข้าถึง']);
}

function checkPermission(requiredRole) {
  if (!window.currentUser) return false;
  
  const roleHierarchy = {
    'admin': 5,
    'principal': 4,
    'registrar': 3,
    'homeroom': 2,
    'teacher': 1
  };
  
  const userLevel = roleHierarchy[window.currentUser.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  
  return userLevel >= requiredLevel;
}

function refreshCurrentPage() {
  navigateTo(window.currentPage);
}

function showAlert(message, type = 'info') {
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-times-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };
  
  const colors = {
    success: 'blue',
    error: 'red',
    warning: 'yellow',
    info: 'blue'
  };
  
  const modalId = 'alertModal_' + Date.now();
  
  const html = `
    <div id="${modalId}" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div class="modal-content bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div class="text-center">
          <div class="inline-block bg-${colors[type]}-100 rounded-full p-4 mb-4">
            <i class="${icons[type]} text-3xl text-${colors[type]}-600"></i>
          </div>
          <p class="text-gray-700 mb-6">${message}</p>
          <button onclick="closeModal('${modalId}')" class="btn btn-primary w-full">
            ตกลง
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML = html;
}

function formatThaiDate(dateString, includeTime = false) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear() + 543; // Convert to Buddhist Era
  
  let result = `${day} ${month} ${year}`;
  
  if (includeTime) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    result += ` ${hours}:${minutes}`;
  }
  
  return result;
}

// ===================================
// [⭐️ แก้ไข ⭐️] PROFILE PAGE
// ===================================

async function renderProfilePage() {
  renderBreadcrumb(['หน้าแรก', 'โปรไฟล์ส่วนตัว']);
  showLoading('กำลังโหลดข้อมูลโปรไฟล์...');
  
  try {
    const profileResult = await callServerFunction('getProfileData');
    
    if (!profileResult.success) {
      showToast(profileResult.message, 'error');
      return;
    }
    
    const profileData = profileResult.data;
    const user = profileData.user; 
    
    // ตรวจสอบว่า user ไม่ใช่ null
    if (!user) {
      console.error('Error loading profile: User data is null.');
      showToast('ไม่พบข้อมูลผู้ใช้ อาจถูกลบออกจากระบบ', 'error');
      document.getElementById('pageContent').innerHTML = renderEmptyState('ไม่พบข้อมูลผู้ใช้', 'fas fa-user-times');
      hideLoading();
      return;
    }
    
    // [ ⭐️⭐️⭐️ เพิ่ม: Define isStudent ที่นี่ ⭐️⭐️⭐️ ]
    const isStudent = user.role === 'student';
    
    // (โค้ดนี้ปลอดภัยแล้ว เพราะ user ไม่ใช่ null)
    window.currentUserFullData = user; 
    const userPhoto = user.photo_url || 'https://placehold.co/150x150/e0e0e0/808080?text=No+Photo';

    const html = `
      <div class="max-w-5xl mx-auto">
        <div class="card p-6 mb-6">
          <div class="flex items-center space-x-6">
            <img id="profilePagePhoto" src="${userPhoto}" alt="Profile" class="w-24 h-24 rounded-full object-cover border-4 border-gray-100 shadow-md">
            <div>
              <h2 class="text-3xl font-bold text-gray-800">${user.name}</h2>
              <p class="text-lg text-gray-600">${getRoleLabel(user.role)}</p>
              <p class="text-sm text-gray-500">Username: ${user.username || user.student_code || ''}</p>
            </div>
          </div>
        </div>

    <div class="flex border-b border-gray-200 mb-6">
      <button id="tabBtn1" onclick="switchProfileTab(1)" class="profile-tab-btn active">
        <i class="fas fa-user-edit mr-2"></i>ข้อมูลส่วนตัว
      </button>
      ${!isStudent ? `
      <button id="tabBtn2" onclick="switchProfileTab(2)" class="profile-tab-btn">
        <i class="fas fa-tasks mr-2"></i>ภาระงาน
      </button>
      ` : ''}
    </div>

    <div id="tabContent1" class="profile-tab-content">
      ${renderProfileTab1(user)}
    </div>
    
    ${!isStudent ? `
    <div id="tabContent2" class="profile-tab-content card p-6 hidden">
      ${renderProfileTab2(profileData)}
    </div>
    ` : ''}
      </div>
    `;
    
    document.getElementById('pageContent').innerHTML = html;
    
  } catch (error) {
    console.error('Error loading profile:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * [ ⭐️ ใหม่ ⭐️ ] สลับ Tab ในหน้าโปรไฟล์
 */
function switchProfileTab(tabIndex) {
  document.querySelectorAll('.profile-tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.profile-tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(`tabContent${tabIndex}`).classList.remove('hidden');
  document.getElementById(`tabBtn${tabIndex}`).classList.add('active');
}

/**
 * [ ⭐️ แก้ไข ⭐️ ] สร้าง HTML สำหรับ Tab 1 (ข้อมูลส่วนตัว)
 * (เพิ่ม เชื้อชาติ, สัญชาติ, ศาสนา ในหน้าโปรไฟล์นักเรียน)
 */
function renderProfileTab1(user) {
  const isStudent = user.role === 'student';
  
  // 1. Fields สำหรับฟอร์ม "แก้ไขข้อมูล" (สำหรับครู/Admin - คงเดิม)
  const profileFields = [
    { name: 'name', label: 'ชื่อ-นามสกุล', type: 'text', required: true, colSpan: 2 },
    { name: 'email', label: 'อีเมล', type: 'email', colSpan: 2 },
    { name: 'phone', label: 'เบอร์โทรศัพท์', type: 'text', colSpan: 2, numeric: true, maxlength: 10 },
    { name: 'photo_url', label: 'อัปโหลดรูปโปรไฟล์ใหม่', type: 'file', colSpan: 3 }
  ];
  
  const initialData = {
    name: user.name,
    email: user.email || '',
    phone: user.phone || ''
  };

  let displayHTML = '';

  if (isStudent) {
    // [⭐️ สำหรับนักเรียน: แสดงเป็น Tabs ⭐️]
    
    const addr = user.address || {};
    const fullAddress = [
        addr.address, 
        addr.subdistrict ? `ต.${addr.subdistrict}` : '',
        addr.district ? `อ.${addr.district}` : '',
        addr.province ? `จ.${addr.province}` : '',
        addr.zipcode
    ].filter(Boolean).join(' ');

    const lastLogin = user.last_login || window.currentUser?.login_time || '-';

    displayHTML = `
      <div>
        <div class="border-b border-gray-200 mb-6">
          <nav class="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
            <button onclick="switchSubProfileTab('personal')" id="btn-subtab-personal" class="sub-profile-btn whitespace-nowrap py-4 px-1 border-b-2 border-blue-500 font-medium text-sm text-blue-600">
              ข้อมูลทั่วไป
            </button>
            <button onclick="switchSubProfileTab('contact')" id="btn-subtab-contact" class="sub-profile-btn whitespace-nowrap py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">
              การติดต่อ
            </button>
            <button onclick="switchSubProfileTab('family')" id="btn-subtab-family" class="sub-profile-btn whitespace-nowrap py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">
              ครอบครัว
            </button>
            <button onclick="switchSubProfileTab('system')" id="btn-subtab-system" class="sub-profile-btn whitespace-nowrap py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">
              ข้อมูลระบบ
            </button>
          </nav>
        </div>

        <div id="subtab-personal" class="sub-profile-content space-y-6">
          <div class="card p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">ข้อมูลพื้นฐาน</h3>
            <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">ชื่อ-นามสกุล</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.name}</dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">ชื่อเล่น</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.nickname || '-'}</dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">รหัสนักเรียน</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.student_code || '-'}</dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">เลขประจำตัวประชาชน</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.id_card || '-'}</dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">วันเกิด</dt><dd class="text-base font-semibold text-gray-800 mt-1">${formatThaiDate(user.birthdate)}</dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">เพศ</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.gender === 'male' ? 'ชาย' : (user.gender === 'female' ? 'หญิง' : '-')}</dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">กลุ่มเลือด</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.blood_type || '-'}</dd></div>
              
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">เชื้อชาติ</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.ethnicity || '-'}</dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">สัญชาติ</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.nationality || '-'}</dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">ศาสนา</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.religion || '-'}</dd></div>
            </dl>
          </div>
        </div>

        <div id="subtab-contact" class="sub-profile-content hidden space-y-6">
          <div class="card p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">ข้อมูลการติดต่อ</h3>
            <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">เบอร์โทรศัพท์</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.phone || '-'}</dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">อีเมล</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.email || '-'}</dd></div>
              <div class="col-span-1 md:col-span-2 border-b py-2"><dt class="text-sm font-medium text-gray-500">ที่อยู่ตามทะเบียนบ้าน/ปัจจุบัน</dt><dd class="text-base font-semibold text-gray-800 mt-1">${fullAddress || '-'}</dd></div>
            </dl>
          </div>
        </div>

        <div id="subtab-family" class="sub-profile-content hidden space-y-6">
          <div class="card p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">ข้อมูลครอบครัว</h3>
            <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">บิดา</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.father_name || '-'} <br><span class="text-sm text-gray-500 font-normal">เบอร์โทร: ${user.father_phone || '-'}</span></dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">อาชีพบิดา</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.father_occupation || '-'}</dd></div>
              
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">มารดา</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.mother_name || '-'} <br><span class="text-sm text-gray-500 font-normal">เบอร์โทร: ${user.mother_phone || '-'}</span></dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">อาชีพมารดา</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.mother_occupation || '-'}</dd></div>
              
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">ผู้ปกครอง</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.guardian_name || '-'} <br><span class="text-sm text-gray-500 font-normal">เบอร์โทร: ${user.guardian_phone || '-'}</span></dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">ความเกี่ยวข้อง</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.guardian_relation || '-'}</dd></div>
            </dl>
          </div>
        </div>

        <div id="subtab-system" class="sub-profile-content hidden space-y-6">
          <div class="card p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">ข้อมูลในระบบ</h3>
            <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">สถานะ</dt><dd class="text-base font-semibold text-gray-800 mt-1"><span class="badge badge-success">${user.status === 'active' ? 'กำลังศึกษา' : user.status}</span></dd></div>
              <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">เข้าสู่ระบบล่าสุด</dt><dd class="text-base font-semibold text-blue-600 mt-1">${formatThaiDate(lastLogin, true)}</dd></div>
            </dl>
          </div>
          
          <div class="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start">
            <i class="fas fa-info-circle text-blue-500 mt-1 mr-3"></i>
            <p class="text-sm text-blue-700">หากข้อมูลไม่ถูกต้อง กรุณาติดต่อครูประจำชั้นหรือเจ้าหน้าที่งานทะเบียนเพื่อทำการแก้ไข</p>
          </div>
        </div>
      </div>
    `;
  } else {
    // [สำหรับ Teacher/Admin: แสดงฟอร์มแก้ไขได้ (คงเดิม)]
    displayHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card p-6">
          <form id="profileEditForm" onsubmit="handleSaveProfile(event); return false;">
            <h3 class="text-xl font-bold text-gray-800 mb-6">แก้ไขข้อมูล</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              ${profileFields.map(field => renderFormField(field, initialData[field.name])).join('')}
            </div>
            <div class="mt-6 pt-6 border-t flex justify-end">
              <button type="submit" class="btn btn-primary px-6">
                <i class="fas fa-save mr-2"></i>บันทึกข้อมูล
              </button>
            </div>
          </form>
        </div>
        
        <div class="card p-6">
          <h3 class="text-xl font-bold text-gray-800 mb-6">ข้อมูลระบบ</h3>
          <dl class="grid grid-cols-1 gap-y-4">
            <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">ชื่อ-นามสกุล</dt><dd class="text-base font-semibold text-gray-800 mt-1">${user.name}</dd></div>
            <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">Role</dt><dd class="text-base font-semibold text-gray-800 mt-1">${getRoleLabel(user.role)}</dd></div>
            <div class="border-b py-2"><dt class="text-sm font-medium text-gray-500">เข้าสู่ระบบล่าสุด</dt><dd class="text-base font-semibold text-gray-800 mt-1">${formatThaiDate(user.last_login, true)}</dd></div>
          </dl>
        </div>
      </div>
    `;
  }

  return displayHTML;
}

/**
 * [⭐️ ใหม่ ⭐️] ฟังก์ชันสลับแท็บย่อยในหน้าโปรไฟล์นักเรียน
 */
function switchSubProfileTab(tabName) {
  // 1. ซ่อนเนื้อหาทั้งหมด
  const contents = document.querySelectorAll('.sub-profile-content');
  contents.forEach(el => el.classList.add('hidden'));
  
  // 2. เอาสถานะ Active ออกจากปุ่มทั้งหมด
  const btns = document.querySelectorAll('.sub-profile-btn');
  btns.forEach(el => {
    el.classList.remove('border-blue-500', 'text-blue-600');
    el.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
  });
  
  // 3. แสดงเนื้อหาที่เลือก
  document.getElementById(`subtab-${tabName}`).classList.remove('hidden');
  
  // 4. เซ็ตปุ่มที่เลือกให้ Active
  const activeBtn = document.getElementById(`btn-subtab-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    activeBtn.classList.add('border-blue-500', 'text-blue-600');
  }
}

/**
 * [ ⭐️ ใหม่ ⭐️ ] สร้าง HTML สำหรับ Tab 2 (ภาระงาน)
 */
function renderProfileTab2(data) {
  const { homeroom = [], subjects = [] } = data;
  
  return `
    <h3 class="text-xl font-bold text-gray-800 mb-6">ภาระงานที่รับผิดชอบ</h3>
    
    <div class="mb-6">
      <h4 class="text-lg font-semibold text-gray-700 mb-3">ครูประจำชั้น</h4>
      ${homeroom.length > 0 ? 
        homeroom.map(cls => `
          <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span class="font-bold text-blue-700">ชั้น ${cls.level}/${cls.room} (ปี ${cls.year})</span>
          </div>
        `).join('') :
        '<p class="text-gray-500">ไม่ได้เป็นครูประจำชั้น</p>'
      }
    </div>

    <div>
      <h4 class="text-lg font-semibold text-gray-700 mb-3">วิชาที่สอน (${subjects.length} วิชา)</h4>
      <div class="space-y-2">
      ${subjects.length > 0 ? 
        subjects.map(subj => `
          <div class="p-3 bg-gray-50 border rounded-lg flex justify-between items-center">
            <div>
              <p class="font-semibold text-gray-800">${subj.subject_name}</p>
              <p class="text-sm text-gray-600">(${subj.subject_code}) - ชั้น ${subj.level === 'all' ? 'ทุกระดับชั้น' : subj.level}</p>
            </div>
            <span class="badge badge-secondary">${subj.subject_group}</span>
          </div>
        `).join('') :
        '<p class="text-gray-500">ไม่พบวิชาที่รับผิดชอบ</p>'
      }
      </div>
    </div>
  `;
}

/**
 * [ ⭐️ แก้ไข ⭐️ ] บันทึกข้อมูลโปรไฟล์ (Tab 1)
 */
async function handleSaveProfile(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData);
  
  // แก้ไข: ใช้ photo_url แทน photo_base64 (ตรงกับชื่อ field ในฟอร์ม)
  const updateData = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    photo_base64: data.photo_url || null  // ⭐️ แก้ไข: data.photo_url (Base64 string จาก hidden input)
  };
  
  await waitForResponse(
    // [⭐️ แก้ไข ⭐️] ใช้ ID ผู้ใช้จาก window.currentUserFullData
    () => callServerFunction('updateUser', window.currentUserFullData.id, updateData),
    'กำลังบันทึกข้อมูล...',
    (result) => {
      if (result.success) {
        showToast('บันทึกข้อมูลสำเร็จ', 'success');
        
        // อัปเดตข้อมูลใน Frontend (ทั้ง 2 ที่)
        window.currentUser.name = result.data.name;
        window.currentUser.photo_url = result.data.photo_url;
        window.currentUserFullData = result.data; // อัปเดตข้อมูลตัวเต็มด้วย
        
        // อัปเดต UI Navbar
        document.getElementById('userName').textContent = result.data.name;
        // document.getElementById('userInitial').textContent = getInitials(result.data.name); // <-- ลบบรรทัดนี้

        if (result.data.photo_url) {
          // อัปเดตรูปในหน้าโปรไฟล์
          document.getElementById('profilePagePhoto').src = result.data.photo_url;
        }

        // [ ⭐️ แก้ไข ⭐️ ] เรียกฟังก์ชันอัปเดต Avatar ส่วนกลาง
        if (typeof updateNavbarAvatar === 'function') {
          updateNavbarAvatar();
        }
      }
    }
  );
}

/**
 * [ ⭐️ ใหม่ ⭐️ ] บันทึกการเปลี่ยนรหัสผ่าน (Tab 1)
 */
async function handleChangePassword(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  
  // 1. ตรวจสอบรหัสผ่านใหม่ตรงกัน
  if (data.new_password !== data.confirm_password) {
    showToast('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน', 'warning');
    return;
  }
  
  // 2. ตรวจสอบความยาว
  if (data.new_password.length < 6) {
    showToast('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', 'warning');
    return;
  }
  
  // 3. เรียก Server
  await waitForResponse(
    () => callServerFunction('changePassword', data.old_password, data.new_password),
    'กำลังเปลี่ยนรหัสผ่าน...',
    (result) => {
      if (result.success) {
        showToast('เปลี่ยนรหัสผ่านสำเร็จ', 'success');
        form.reset(); // ล้างค่าในฟอร์ม
      } else {
        // showToast(result.message, 'error'); // waitForResponse จัดการให้แล้ว
        console.error(result.message);
      }
    }
  );
}

/**
 * (สำหรับหน้า Settings)
 * เริ่มการทำงานของ jquery.Thailand.js สำหรับช่องที่อยู่โรงเรียน
 * (ใช้ Polling แบบเดียวกับใน JS-Components.js เพื่อรอให้ Library โหลดเสร็จ)
 */
function initializeSettingsPageThailandAutoComplete() {
  
  let attempts = 0;
  const maxAttempts = 20; // 20 * 100ms = 2 วินาที
  
  function initLogic() {
    attempts++;
    
    let pluginFn = null;
    let jQueryObj = null;

    // ตรวจสอบทั้ง jQuery และ $
    if (typeof jQuery !== 'undefined' && typeof jQuery.Thailand === 'function') {
        pluginFn = jQuery.Thailand;
        jQueryObj = jQuery;
    } else if (typeof $ !== 'undefined' && typeof $.Thailand === 'function') {
        pluginFn = $.Thailand;
        jQueryObj = $;
    }
    
    if (pluginFn && jQueryObj) {
        // 1. ถ้า Library พร้อม: เรียกใช้งาน Plugin
        console.log(`jquery.Thailand.js loaded for Settings Page.`);
        try {
            pluginFn({
                $district: jQueryObj("#sub_district"), // ตำบล/แขวง
                $amphoe: jQueryObj("#district"),     // อำเภอ/เขต
                $province: jQueryObj("#province"),   // จังหวัด
                $zipcode: jQueryObj("#postcode"),    // รหัสไปรษณีย์
                onDataFill: function(data){
                    console.log('Settings Page Address Filled:', data);
                }
            });
        } catch (e) {
             console.error('Error executing jquery.Thailand.js on Settings Page:', e);
             showToast('เกิดข้อผิดพลาดในการรันระบบที่อยู่', 'error');
        }
        
    } else if (attempts < maxAttempts) {
        // 2. ถ้ายังไม่พร้อม: ลองใหม่ใน 100ms
        setTimeout(initLogic, 100);
    } else {
        // 3. ถ้าหมดเวลา
        console.error(`Error initializing jquery.Thailand.js (Settings Page): Plugin not loaded.`);
        showToast('ไม่สามารถโหลดระบบที่อยู่อัตโนมัติได้', 'error');
    }
  }
  
  // 4. เริ่มการตรวจสอบ
  initLogic();
}

console.log('✅ JS-Pages (Complete) loaded successfully');
