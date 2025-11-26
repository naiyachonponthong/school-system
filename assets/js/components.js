
/**
 * ===================================
 * REUSABLE UI COMPONENTS (FIXED FOR DROPDOWNS + ICONS)
 * ===================================
 */

// ===================================
// SIDEBAR COMPONENT
// ===================================

function renderSidebar(userRole) {
  const menuItems = getSidebarMenuByRole(userRole);
  
  // 1. ตรวจสอบว่าหน้าปัจจุบัน (window.currentPage) อยู่ในกลุ่มไหน
  let activeGroup = null;
  if (window.currentPage) {
    for (const item of menuItems) {
      if (item.type === 'group' && item.children) {
        if (item.children.some(child => child.page === window.currentPage)) {
          activeGroup = item.id;
          break;
        }
      }
    }
  }

  // 2. สร้าง HTML
  const html = `
    <div class="py-6 px-4 space-y-1">
      ${menuItems.map(item => {
        
        // ---------- กรณีเป็น "กลุ่ม" (Group) ----------
        if (item.type === 'group') {
          const isActiveGroup = (activeGroup === item.id);
          return `
            <div>
              <button 
                type="button" 
                class="sidebar-group flex items-center justify-between w-full px-4 py-3 rounded-lg ${isActiveGroup ? 'open' : ''}"
                data-group-id="${item.id}"
              >
                <span class="flex items-center space-x-3">
                  <i class="${item.icon} w-5"></i>
                  <span class="sidebar-label transition-all duration-300 ease-in-out">${item.label}</span>
                </span>
                <i class="fas fa-chevron-down w-3 transform transition-transform duration-200 ${isActiveGroup ? 'rotate-180' : ''}"></i>
              </button>
              
              <div 
                id="submenu-${item.id}" 
                class="sidebar-submenu space-y-1 pt-1 pl-5 ${isActiveGroup ? '' : 'hidden'}"
              >
                ${item.children.map(child => `
                  <a 
                    href="#" 
                    onclick="navigateTo('${child.page}'); return false;"
                    class="sidebar-subitem sidebar-link flex items-center space-x-3 px-4 py-2 rounded-lg ${window.currentPage === child.page ? 'active' : ''}"
                    data-page="${child.page}"
                  >
                    <i class="${child.icon} w-5"></i>
                    <span class="sidebar-label transition-all duration-300 ease-in-out">${child.label}</span>
                  </a>
                `).join('')}
              </div>
            </div>
          `;
        }
        
        // ---------- กรณีเป็น "ลิงก์" เดี่ยว (Link) ----------
        if (item.type === 'link') {
          return `
            <a 
              href="#" 
              onclick="navigateTo('${item.page}'); return false;"
              class="sidebar-item sidebar-link flex items-center space-x-3 px-4 py-3 rounded-lg ${window.currentPage === item.page ? 'active' : ''}"
              data-page="${item.page}"
            >
              <i class="${item.icon} w-5"></i>
              <span class="sidebar-label transition-all duration-300 ease-in-out">${item.label}</span>
            </a>
          `;
        }
        return '';
      }).join('')}
    </div>
  `;
  
  document.getElementById('sidebar').innerHTML = html;
  
  // 3. ผูก Event Listener (สำคัญมาก)
  attachSidebarEventListeners();
}

/**
 * [ ⭐️⭐️⭐️ แก้ไข: เพิ่มเมนูตารางเรียน ⭐️⭐️⭐️ ]
 * Render Sidebar สำหรับนักเรียน (menu ง่ายๆ)
 */
function renderStudentSidebar() {
  console.log('🎓 Rendering Student Sidebar...');
  
  const studentMenuItems = [
    {
      type: 'link',
      page: 'studentGrades',
      label: 'ดูเกรดของฉัน',
      icon: 'fas fa-chart-bar'
    },
    // ⭐️⭐️⭐️ START: เพิ่มเมนูนี้ ⭐️⭐️⭐️
    {
      type: 'link',
      page: 'studentTimetable', // <-- ชื่อ page ใหม่
      label: 'ตารางเรียน',
      icon: 'fas fa-calendar-alt'
    },
    // ⭐️⭐️⭐️ END: เพิ่มเมนูนี้ ⭐️⭐️⭐️
    {
      type: 'link',
      page: 'studentAttendance',
      label: 'สถิติการเข้าเรียน',
      icon: 'fas fa-calendar-check'
    }
  ];

  const html = `
    <div class="py-6 px-4 space-y-1">
      ${studentMenuItems.map(item => {
        if (item.type === 'link') {
          return `
            <a 
              href="#" 
              onclick="navigateTo('${item.page}'); return false;"
              class="sidebar-item sidebar-link flex items-center space-x-3 px-4 py-3 rounded-lg ${window.currentPage === item.page ? 'active' : ''}"
              data-page="${item.page}"
            >
              <i class="${item.icon} w-5"></i>
              <span class="sidebar-label transition-all duration-300 ease-in-out">${item.label}</span>
            </a>
          `;
        }
        return '';
      }).join('')}
    </div>
  `;
  
  // [ ⭐️⭐️⭐️ เพิ่ม: Safety timeout ให้ DOM ready ⭐️⭐️⭐️ ]
  setTimeout(() => {
    const sidebarElement = document.getElementById('sidebar');
    if (sidebarElement) {
      sidebarElement.innerHTML = html;
      console.log('✅ Student Sidebar rendered successfully');
      attachSidebarEventListeners();
    } else {
      console.error('❌ Sidebar element not found! DOM may not be ready.');
    }
  }, 0);
  // [ ⭐️⭐️⭐️ สิ้นสุดส่วนที่เพิ่ม ⭐️⭐️⭐️ ]
}

function getSidebarMenuByRole(role) {
  // ⭐️⭐️⭐️ นี่คือโครงสร้างข้อมูลใหม่ (ลบ Emojis ออกแล้ว) ⭐️⭐️⭐️
  const allMenus = [
    { 
      type: 'link', 
      page: 'dashboard', 
      label: 'หน้าแรก', 
      icon: 'fas fa-home', 
      roles: ['admin', 'principal', 'teacher', 'homeroom', 'registrar'] 
    },
    {
      type: 'group',
      id: 'group-data',
      label: 'ข้อมูลพื้นฐาน', // ⭐️ [แก้ไข] ลบ 📚
      icon: 'fas fa-database',
      roles: ['admin', 'registrar', 'homeroom'],
      children: [
        { page: 'students', label: 'จัดการนักเรียน', icon: 'fas fa-user-graduate', roles: ['admin', 'registrar', 'homeroom'] },
        { page: 'classes', label: 'จัดการห้องเรียน', icon: 'fas fa-door-open', roles: ['admin', 'registrar'] },
        { page: 'subjects-crud', label: 'จัดการรายวิชา', icon: 'fas fa-book', roles: ['admin', 'registrar'] },
        { page: 'assign-subjects', label: 'มอบหมายรายวิชา', icon: 'fas fa-chalkboard-teacher', roles: ['admin', 'registrar'] },
      ]
    },
    {
      type: 'group',
      id: 'group-entry',
      label: 'บันทึกข้อมูล', // ⭐️ [แก้ไข] ลบ 📝
      icon: 'fas fa-edit',
      roles: ['admin', 'teacher', 'homeroom', 'registrar', 'principal'], // ⭐️ [เพิ่ม Role]
      children: [
        { page: 'scores', label: 'บันทึกคะแนน', icon: 'fas fa-file-alt', roles: ['admin', 'teacher', 'homeroom'] },
        { page: 'attendance', label: 'บันทึกการเข้าเรียน', icon: 'fas fa-calendar-check', roles: ['admin', 'teacher', 'homeroom'] },
        { page: 'behaviors', label: 'บันทึกพฤติกรรม', icon: 'fas fa-heart', roles: ['admin', 'homeroom', 'registrar', 'principal'] },
        { page: 'activities', label: 'บันทึกกิจกรรม', icon: 'fas fa-running', roles: ['admin', 'homeroom', 'registrar', 'principal'] },
        { page: 'reading', label: 'บันทึกการอ่านฯ', icon: 'fas fa-book-reader', roles: ['admin', 'homeroom', 'registrar', 'principal'] } // ⭐️ [เพิ่ม]
      ]
    },
    
    // ⭐️⭐️⭐️ [เพิ่มโค้ดส่วนนี้] ⭐️⭐️⭐️
    { 
      type: 'link', 
      page: 'timetable', // <-- ชื่อ page ใหม่
      label: 'ตารางสอน', 
      icon: 'fas fa-calendar-alt', 
      roles: ['admin', 'principal', 'teacher', 'homeroom', 'registrar'] // ⭐️ ทุกคนยกเว้นนักเรียน
    },
    // ⭐️⭐️⭐️ [สิ้นสุดส่วนที่เพิ่ม] ⭐️⭐️⭐️

    {
      type: 'group',
      id: 'group-print',
      label: 'พิมพ์เอกสาร', // ⭐️ [แก้ไข] ลบ 🖨️
      icon: 'fas fa-print',
      roles: ['admin', 'registrar', 'homeroom'],
      children: [
        { page: 'pp5', label: 'พิมพ์ ปพ.5', icon: 'fas fa-id-card', roles: ['admin', 'registrar', 'homeroom'] }, // ⭐️ เปลี่ยน icon
        { page: 'pp6', label: 'พิมพ์ ปพ.6', icon: 'fas fa-file-pdf', roles: ['admin', 'registrar', 'homeroom'] },
      ]
    },
    { 
      type: 'link', 
      page: 'grades-view', 
      label: 'ดูเกรดและ GPA', 
      icon: 'fas fa-chart-line', 
      roles: ['admin', 'teacher', 'homeroom', 'registrar'] 
    },
    { 
      type: 'link', 
      page: 'reports', 
      label: 'รายงาน', 
      icon: 'fas fa-chart-bar', 
      roles: ['admin', 'principal', 'registrar'] 
    },
    {
      type: 'group',
      id: 'group-admin',
      label: 'จัดการระบบ', // ⭐️ [แก้ไข] ลบ ⚙️
      icon: 'fas fa-cogs',
      roles: ['admin'],
      children: [
        { page: 'users', label: 'จัดการผู้ใช้งาน', icon: 'fas fa-users-cog', roles: ['admin'] },
        { page: 'settings', label: 'ตั้งค่าระบบ', icon: 'fas fa-cog', roles: ['admin'] }
      ]
    }
  ];
  
  // ⭐️⭐️⭐️ ตรรกะการกรอง (เหมือนเดิม) ⭐️⭐️⭐️
  const filteredMenu = [];
  
  allMenus.forEach(item => {
    // 1. ถ้าเป็น 'link' ให้กรองตาม roles
    if (item.type === 'link') {
      if (item.roles.includes(role)) {
        filteredMenu.push(item);
      }
    } 
    // 2. ถ้าเป็น 'group'
    else if (item.type === 'group') {
      // 2.1 กรองลูก (children) ก่อน
      const allowedChildren = item.children.filter(child => child.roles.includes(role));
      
      // 2.2 ถ้ามีลูกที่ได้รับอนุญาตอย่างน้อย 1 คน ให้เพิ่มกลุ่มนี้เข้าไป
      if (allowedChildren.length > 0) {
        // (และต้องตรวจสอบ role ของกลุ่มแม่ด้วย ถ้ามี)
        if (item.roles.includes(role)) {
          filteredMenu.push({
            ...item,
            children: allowedChildren // ใช้ children ที่กรองแล้ว
          });
        }
      }
    }
  });
  
  return filteredMenu;
}

/**
 * [ ⭐️⭐️⭐️ ฟังก์ชันใหม่ ⭐️⭐️⭐️ ]
 * เพิ่ม Event Listener ให้ปุ่ม Group
 */
function attachSidebarEventListeners() {
  document.querySelectorAll('.sidebar-group').forEach(button => {
    
    // (กันเหนียว) ลบ Listener เก่าออกก่อน
    button.removeEventListener('click', handleGroupClick);
    
    // เพิ่ม Listener ใหม่
    button.addEventListener('click', handleGroupClick);
  });
}

/**
 * [ ⭐️⭐️⭐️ ฟังก์ชันใหม่ ⭐️⭐️⭐️ ]
 * ฟังก์ชันที่ถูกเรียกเมื่อคลิกปุ่ม Group
 */
function handleGroupClick() {
  const groupId = this.dataset.groupId;
  const submenu = document.getElementById(`submenu-${groupId}`);
  const arrowIcon = this.querySelector('.fa-chevron-down');

  // [⭐️⭐️⭐️ แก้ไข ⭐️⭐️⭐️]
  // ตรวจสอบว่าเป็น mini-sidebar หรือไม่
  const isMini = document.getElementById('sidebar').classList.contains('sidebar-mini');
  
  // ถ้าเป็น mini-sidebar ให้ "ห้าม" เปิด/ปิด
  if (isMini) {
    return;
  }
  
  if (submenu) {
    // 1. สลับคลาส 'hidden' ในเมนูย่อย
    submenu.classList.toggle('hidden');
    
    // 2. สลับคลาส 'open' ที่ปุ่ม (สำหรับ CSS)
    this.classList.toggle('open');
    
    // 3. หมุนลูกศร (ถ้ามี)
    if (arrowIcon) {
      arrowIcon.classList.toggle('rotate-180');
    }
  }
}

// ===================================
// BREADCRUMB COMPONENT
// ===================================

function renderBreadcrumb(path) {
  if (!path || path.length === 0) {
    document.getElementById('breadcrumb').innerHTML = '';
    return;
  }
  
  const html = `
    <div class="flex items-center space-x-2 text-sm">
      ${path.map((item, index) => `
        ${index > 0 ? '<i class="fas fa-chevron-right text-gray-400"></i>' : ''}
        <span class="${index === path.length - 1 ? 'text-blue-600 font-semibold' : 'text-gray-600'}">
          ${item}
        </span>
      `).join('')}
    </div>
  `;
  
  document.getElementById('breadcrumb').innerHTML = html;
}

// ===================================
// DATA TABLE COMPONENT
// ===================================

function renderDataTable(data, columns, options = {}) {
  const {
    actions = null,
    emptyMessage = 'ไม่พบข้อมูล',
    className = '',
    striped = true
  } = options;
  
  if (!data || data.length === 0) {
    return renderEmptyState(emptyMessage);
  }
  
  return `
    <div class="overflow-x-auto">
      <table class="data-table ${className}">
        <thead>
          <tr>
            ${columns.map(col => `
              <th class="${col.className || ''}" style="${col.width ? 'width: ' + col.width : ''}">
                ${col.label}
              </th>
            `).join('')}
            ${actions ? '<th class="text-center" style="width: 120px">จัดการ</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${data.map((row, index) => `
            <tr class="${striped && index % 2 === 1 ? 'bg-gray-50' : ''}">
              ${columns.map(col => `
                <td class="${col.className || ''}">
                  ${col.render ? col.render(row[col.field], row) : (row[col.field] || '-')}
                </td>
              `).join('')}
              ${actions ? `
                <td class="text-center">
                  <div class="flex items-center justify-center space-x-2">
                    ${actions(row)}
                  </div>
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ===================================
// PAGINATION COMPONENT
// ===================================

function renderPagination(total, current, pageSize, onChange) {
  const totalPages = Math.ceil(total / pageSize);
  
  if (totalPages <= 1) return '';
  
  const pages = [];
  const maxVisible = 5;
  
  let startPage = Math.max(1, current - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  const html = `
    <div class="flex items-center justify-between mt-6">
      <div class="text-sm text-gray-600">
        แสดง ${((current - 1) * pageSize) + 1} - ${Math.min(current * pageSize, total)} จากทั้งหมด ${total} รายการ
      </div>
      
      <div class="flex items-center space-x-1">
        <button 
          class="px-3 py-2 border rounded-lg hover:bg-gray-50 ${current === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
          ${current === 1 ? 'disabled' : ''}
          onclick="(${onChange})(${current - 1})"
        >
          <i class="fas fa-chevron-left"></i>
        </button>
        
        ${startPage > 1 ? `
          <button class="px-3 py-2 border rounded-lg hover:bg-gray-50" onclick="(${onChange})(1)">1</button>
          ${startPage > 2 ? '<span class="px-2">...</span>' : ''}
        ` : ''}
        
        ${pages.map(page => `
          <button 
            class="px-3 py-2 border rounded-lg hover:bg-gray-50 ${page === current ? 'bg-blue-600 text-white' : ''}"
            onclick="(${onChange})(${page})"
          >
            ${page}
          </button>
        `).join('')}
        
        ${endPage < totalPages ? `
          ${endPage < totalPages - 1 ? '<span class="px-2">...</span>' : ''}
          <button class="px-3 py-2 border rounded-lg hover:bg-gray-50" onclick="(${onChange})(${totalPages})">
            ${totalPages}
          </button>
        ` : ''}
        
        <button 
          class="px-3 py-2 border rounded-lg hover:bg-gray-50 ${current === totalPages ? 'opacity-50 cursor-not-allowed' : ''}"
          ${current === totalPages ? 'disabled' : ''}
          onclick="(${onChange})(${current + 1})"
        >
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
  `;
  
  return html;
}

// ===================================
// STAT CARD COMPONENT
// ===================================

function renderStatCard(title, value, icon, color = 'blue', trend = null) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    indigo: 'from-indigo-500 to-indigo-600'
  };
  
  return `
    <div class="card p-6">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <p class="text-sm text-gray-600 mb-1">${title}</p>
          <h3 class="text-3xl font-bold text-gray-800">${value}</h3>
          ${trend ? `
            <p class="text-sm mt-2 ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}">
              ${trend}
            </p>
          ` : ''}
        </div>
        <div class="w-16 h-16 rounded-full bg-gradient-to-br ${colors[color]} flex items-center justify-center">
          <i class="${icon} text-2xl text-white"></i>
        </div>
      </div>
    </div>
  `;
}

// ===================================
// EMPTY STATE COMPONENT
// ===================================

function renderEmptyState(message = 'ไม่พบข้อมูล', icon = 'fas fa-inbox') {
  return `
    <div class="empty-state">
      <i class="${icon}"></i>
      <p class="text-lg">${message}</p>
    </div>
  `;
}

// ===================================
// STUDENT CARD COMPONENT (FIXED)
// ===================================

function renderStudentCard(student) {
  const fullName = `${student.prefix || ''} ${student.firstname} ${student.lastname}`.trim();
  const initial = getInitials(fullName);
  
  return `
    <div class="card p-4" data-student-id="${student.id}">
      <div class="flex items-center space-x-4">
        <div class="flex-shrink-0">
          ${student.photo_url ? `
            <img src="${student.photo_url}" alt="${fullName}" class="w-16 h-16 rounded-full object-cover">
          ` : `
            <div class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-semibold">
              ${initial}
            </div>
          `}
        </div>
        
        <div class="flex-1 min-w-0">
          <h4 class="text-lg font-semibold text-gray-800 truncate">${fullName}</h4>
          <div class="flex items-center space-x-4 text-sm text-gray-600 mt-1">
            <span><i class="fas fa-id-card mr-1"></i>${student.student_code}</span>
            <span><i class="fas fa-door-open mr-1"></i>${student.level}/${student.room}</span>
            ${student.student_number ? `<span>เลขที่ ${student.student_number}</span>` : ''}
          </div>
        </div>
        
        <div>
          <span class="badge ${getStatusColor(student.status)}">
            ${student.status === 'active' ? 'กำลังศึกษา' : student.status}
          </span>
        </div>
        
        <div class="flex items-center space-x-2">
          <button 
            class="btn-edit-student p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            data-student-id="${student.id}"
            title="แก้ไข"
            type="button"
          >
            <i class="fas fa-edit"></i>
          </button>
          
          <button 
            class="btn-delete-student p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            data-student-id="${student.id}"
            title="ลบ"
            type="button"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

// ===================================
// EVENT LISTENERS FOR STUDENT CARDS
// ===================================

function attachStudentCardEventListeners() {
  console.log('🔗 Attaching event listeners to student cards...');
  
  document.querySelectorAll('.btn-edit-student').forEach(btn => {
    btn.removeEventListener('click', handleEditClick);
    btn.addEventListener('click', handleEditClick);
  });

  document.querySelectorAll('.btn-delete-student').forEach(btn => {
    btn.removeEventListener('click', handleDeleteClick);
    btn.addEventListener('click', handleDeleteClick);
  });
  
  console.log('✅ Event listeners attached successfully');
}

function handleEditClick(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const studentId = this.getAttribute('data-student-id');
  console.log('✏️ Edit clicked:', studentId);
  
  if (!studentId) {
    console.error('❌ No studentId found');
    showToast('เกิดข้อผิดพลาด: ไม่พบรหัสนักเรียน', 'error');
    return;
  }
  
  editStudent(studentId);
}

function handleDeleteClick(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const studentId = this.getAttribute('data-student-id');
  console.log('🗑️ Delete clicked:', studentId);
  
  if (!studentId) {
    console.error('❌ No studentId found');
    showToast('เกิดข้อผิดพลาด: ไม่พบรหัสนักเรียน', 'error');
    return;
  }
  
  deleteStudent(studentId);
}

// ===================================
// PROGRESS BAR COMPONENT
// ===================================

function renderProgressBar(value, max, color = 'blue') {
  const percent = Math.round((value / max) * 100);
  
  const colors = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600'
  };
  
  return `
    <div class="flex items-center space-x-3">
      <div class="flex-1 progress-bar">
        <div class="progress-bar-fill ${colors[color]}" style="width: ${percent}%"></div>
      </div>
      <span class="text-sm font-semibold text-gray-600">${percent}%</span>
    </div>
  `;
}

// ===================================
// SEARCH BOX COMPONENT
// ===================================

function renderSearchBox(placeholder, onSearch) {
  const searchId = 'search_' + Date.now();
  window[`debouncedSearch_${searchId}`] = debounce(onSearch, 300);
  
  return `
    <div class="relative">
      <input 
        type="text" 
        id="${searchId}"
        class="form-input pl-10"
        placeholder="${placeholder}"
        oninput="debouncedSearch_${searchId}(this.value)"
      >
      <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
    </div>
  `;
}

// ===================================
// CONFIRM MODAL COMPONENT
// ===================================

// ===================================
// CONFIRM MODAL COMPONENT (FIXED)
// ===================================

function showConfirmModal(title, message, onConfirm, options = {}) {
  const {
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    confirmColor = 'red',
    icon = 'fas fa-exclamation-triangle'
  } = options;
  
  const modalId = 'confirmModal_' + Date.now();
  const confirmBtnId = 'confirmBtn_' + Date.now(); // 1. เพิ่ม ID ให้ปุ่มยืนยัน
  
  const html = `
    <div id="${modalId}" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div class="modal-content bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div class="text-center mb-4">
          <div class="inline-block bg-${confirmColor}-100 rounded-full p-4">
            <i class="${icon} text-3xl text-${confirmColor}-600"></i>
          </div>
        </div>
        
        <h3 class="text-xl font-bold text-gray-800 text-center mb-2">${title}</h3>
        <p class="text-gray-600 text-center mb-6">${message}</p>
        
        <div class="flex space-x-3">
          <button 
            onclick="closeModal('${modalId}')"
            class="flex-1 btn btn-secondary"
          >
            ${cancelText}
          </button>
          <button 
            id="${confirmBtnId}" // 2. ใช้ ID ที่สร้างขึ้น
            class="flex-1 btn btn-${confirmColor}"
          >
            ${confirmText}
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML = html;
  
  // 3. ผูก Event Listener ด้วย JavaScript เพื่อรักษา Closure
  document.getElementById(confirmBtnId).addEventListener('click', () => {
    onConfirm(); // เรียกใช้ Callback ที่รับมา
    closeModal(modalId);
  });
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('closing');
    setTimeout(() => modal.remove(), 200);
  }
}

// ===================================
// FORM MODAL COMPONENT
// ===================================

function showFormModal(title, fields, onSubmit, initialData = {}, modalId = null) {
  // ใช้ modalId ที่รับเข้ามา หรือสร้างใหม่ถ้าไม่มี
  modalId = modalId || 'formModal_' + Date.now();
  const formId = 'form_' + Date.now();
  
  // จัดกลุ่ม Fields (กรณีมี Section)
  const sections = [];
  let currentSection = { fields: [] };
  
  fields.forEach(field => {
    if (field.type === 'section') {
      if (currentSection.fields.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: field.label, fields: [] };
    } else {
      currentSection.fields.push(field);
    }
  });
  
  if (currentSection.fields.length > 0) {
    sections.push(currentSection);
  }
  
  // สร้าง HTML
  const html = `
    <div id="${modalId}" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
      <div class="modal-content bg-white rounded-lg p-6 max-w-5xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-4 border-b">
          <h3 class="text-2xl font-bold text-gray-800">${title}</h3>
          <button onclick="closeModal('${modalId}')" class="text-gray-400 hover:text-gray-600 transition-colors">
            <i class="fas fa-times text-2xl"></i>
          </button>
        </div>
        
        <form id="${formId}" onsubmit="handleFormSubmit_${modalId}(event); return false;">
          ${sections.map(section => `
            ${section.title ? `
              <div class="mb-6">
                <h4 class="text-lg font-semibold text-gray-700 pb-2 border-b-2 border-blue-500 inline-block mb-4">
                  ${section.title}
                </h4>
              </div>
            ` : ''}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              ${section.fields.map(field => renderFormField(field, initialData[field.name])).join('')}
            </div>
          `).join('')}
          
          <div class="flex justify-end space-x-3 mt-6 pt-6 border-t sticky bottom-0 bg-white">
            <button type="button" onclick="closeModal('${modalId}')" class="btn btn-secondary px-6">
              <i class="fas fa-times mr-2"></i>ยกเลิก
            </button>
            <button type="submit" class="btn btn-primary px-6">
              <i class="fas fa-save mr-2"></i>บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML = html;
  
  // [⭐️ สำคัญ ⭐️] ฟังก์ชันจัดการเมื่อกด Submit (รอผลลัพธ์ก่อนปิด)
  window[`handleFormSubmit_${modalId}`] = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    
    // ล็อกปุ่มเพื่อป้องกันการกดซ้ำ
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'บันทึก';
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i>กำลังบันทึก...';
    }

    try {
      // เรียกฟังก์ชัน onSubmit และรอผลลัพธ์
      // ถ้า return false กลับมา แปลว่ามี Error -> "ห้ามปิด Modal"
      const shouldClose = await onSubmit(data);
      
      if (shouldClose !== false) { 
        closeModal(modalId);
      }
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดที่ไม่คาดคิด', 'error');
    } finally {
      // คืนค่าปุ่มกลับสู่สภาพเดิม (ถ้า Modal ยังเปิดอยู่)
      if (submitBtn && document.getElementById(modalId)) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  };

  // เริ่มระบบ Autocomplete ที่อยู่ (ถ้ามีช่องที่อยู่)
  if (modalId.startsWith('studentFormModal')) {
    initThailandAutoComplete_Polling();
  }
}

// Helper function สำหรับ Polling Autocomplete
function initThailandAutoComplete_Polling() {
    let attempts = 0;
    const maxAttempts = 20;
    
    function checkLib() {
      attempts++;
      let pluginFn = null;
      let jQueryObj = null;

      if (typeof jQuery !== 'undefined' && typeof jQuery.Thailand === 'function') {
          pluginFn = jQuery.Thailand;
          jQueryObj = jQuery;
      } else if (typeof $ !== 'undefined' && typeof $.Thailand === 'function') {
          pluginFn = $.Thailand;
          jQueryObj = $;
      }
      
      if (pluginFn && jQueryObj) {
          try {
              pluginFn({
                  $district: jQueryObj("#sub_district"),
                  $amphoe: jQueryObj("#district"),
                  $province: jQueryObj("#province"),
                  $zipcode: jQueryObj("#postcode")
              });
          } catch (e) { console.error(e); }
      } else if (attempts < maxAttempts) {
          setTimeout(checkLib, 100);
      }
    }
    checkLib();
}

// ===================================
// DETAILS MODAL COMPONENT (FIXED)
// ===================================

/**
 * แสดง Modal แบบอ่านอย่างเดียว
 * @param {string} title - หัวข้อ Modal
 * @param {Array<Object>} details - Array ของ { label, value }
 * @param {Object} options - ตัวเลือกเพิ่มเติม เช่น imageUrl, initials
 */
function renderDetailsModal(title, details, options = {}) {
  const { imageUrl = null, initials = '?' } = options;
  const modalId = 'detailsModal_' + Date.now();
  
  const html = `
    <div id="${modalId}" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center overflow-y-auto">
      <div class="modal-content bg-white rounded-lg p-6 max-w-3xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
        
        <div class="flex items-start justify-between mb-6 sticky top-0 bg-white z-10 pb-4 border-b">
          <div class="flex items-center space-x-4">
            ${imageUrl ? `
              <img src="${imageUrl}" alt="${title}" class="w-16 h-16 rounded-full object-cover border-2 border-gray-200">
            ` : `
              <div class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
                ${initials}
              </div>
            `}
            <div>
              <h3 class="text-2xl font-bold text-gray-800">${title}</h3>
              <p class="text-sm text-gray-500">รายละเอียดนักเรียน</p>
            </div>
          </div>
          <button onclick="closeModal('${modalId}')" class="text-gray-400 hover:text-gray-600 transition-colors">
            <i class="fas fa-times text-2xl"></i>
          </button>
        </div>
        
        <div class="max-h-[65vh] overflow-y-auto pr-2">
          <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            ${details.map(item => {
              
              // [⭐️⭐️⭐️ นี่คือจุดแก้ไข Error ⭐️⭐️⭐️]
              // บังคับให้ item.value เป็น String ก่อนเรียก .replace()
              // เพื่อป้องกัน Error กรณีข้อมูลเป็น Number (เช่น id_card, phone จาก CSV)
              const formattedValue = String(item.value || '-').replace(/\n/g, '<br>');
              
              return `
                <div class="border-b py-2">
                  <dt class="text-sm font-medium text-gray-500">${item.label}</dt>
                  <dd class="text-base font-semibold text-gray-800 mt-1">${formattedValue}</dd>
                </div>
              `
            }).join('')}
          </dl>
        </div>
        
        <div class="flex justify-end space-x-3 mt-6 pt-6 border-t sticky bottom-0 bg-white">
          <button type="button" onclick="closeModal('${modalId}')" class="btn btn-secondary px-6">
            <i class="fas fa-times mr-2"></i>ปิด
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML = html;
}

function renderFormField(field, value) {
  // [⭐️ แก้ไข ⭐️] เพิ่มการดึง id, ถ้าไม่มี ให้ใช้ name เป็น default และเพิ่ม 'numeric'
  const { name, label, type = 'text', required = false, options = [], placeholder = '', colSpan = 1, disabled = false, id = name, pattern = '', maxlength = null, numeric = false } = field;
  
  // [⭐️ แก้ไข ⭐️] เพิ่ม colSpan: 3
  const colClass = colSpan === 2 ? 'md:col-span-2' : colSpan === 3 ? 'md:col-span-3' : '';
  
  let inputHtml = '';

  const finalValue = (value !== null && value !== undefined) 
    ? value 
    : (field.value !== null && field.value !== undefined ? field.value : '');

  const safeValue = escapeHTML(finalValue);
  const safePlaceholder = escapeHTML(placeholder);
  const safeLabel = escapeHTML(label);
  
  const disabledClass = disabled ? 'bg-gray-100 cursor-not-allowed' : '';
  const disabledAttr = disabled ? 'disabled' : '';
  
  // [⭐️ แก้ไข ⭐️] กำหนด id attribute (ใช้ id ที่รับมา)
  const idAttr = `id="${id}"`;

  // [⭐️⭐️⭐️ นี่คือส่วนที่แก้ไข ⭐️⭐️⭐️]
  // ตรวจสอบ
  const patternAttr = pattern ? `pattern="${pattern}"` : (numeric ? 'pattern="[0-9]*"' : '');
  const maxlengthAttr = maxlength ? `maxlength="${maxlength}"` : '';
  const inputmodeAttr = numeric ? 'inputmode="numeric"' : '';
  // บังคับให้พิมพ์ได้แค่ตัวเลข ถ้า numeric = true
  const onInputAttr = numeric ? `oninput="this.value = this.value.replace(/[^0-9]/g, '')"` : '';

  switch (type) {
    case 'text':
    case 'email':
    case 'tel':
    case 'number':
    case 'date':
      inputHtml = `
        <input 
          type="${(type === 'number' || type === 'tel') && numeric ? 'text' : type}"  /* ใช้ type="text" เพื่อซ่อนลูกศรขึ้น/ลง */
          name="${name}" 
          ${idAttr}
          class="form-input ${disabledClass}"
          placeholder="${safePlaceholder}"
          value="${safeValue}"
          ${required ? 'required' : ''}
          ${disabledAttr}
          ${inputmodeAttr}   /* <-- ADDED */
          ${patternAttr}     /* <-- ADDED */
          ${maxlengthAttr}   /* <-- ADDED */
          ${onInputAttr}     /* <-- ADDED */
        >
      `;
      break;
      
    case 'textarea':
      inputHtml = `
        <textarea 
          name="${name}" 
          ${idAttr}
          class="form-textarea ${disabledClass}"
          rows="3"
          placeholder="${safePlaceholder}"
          ${required ? 'required' : ''}
          ${disabledAttr}
        >${safeValue}</textarea>
      `;
      break;
      
    case 'select':
      inputHtml = `
        <select 
          name="${name}" 
          ${idAttr}
          class="form-select ${disabledClass}" 
          ${required ? 'required' : ''} 
          ${disabledAttr}
        >
          <option value="">-- กรุณาเลือก --</option>
          ${options.map(opt => `
            <option value="${escapeHTML(opt.value)}" ${String(opt.value) === String(safeValue) ? 'selected' : ''}>
              ${escapeHTML(opt.label)}
            </option>
          `).join('')}
        </select>
      `;
      break;

    case 'searchable-select':
      const inputId = `search_${name}_${Date.now()}`;
      // [⭐️ แก้ไข ⭐️] ใช้ id ที่รับมา หรือสร้างใหม่
      const selectId = id || `select_${name}_${Date.now()}`;
      
      inputHtml = `
        <input 
          type="text" 
          id="${inputId}"
          class="form-input mb-2 ${disabledClass}"
          placeholder="ค้นหา${safeLabel}..."
          oninput="filterSelectOptions('${inputId}', '${selectId}')"
          ${disabledAttr}
        >
        <select 
          name="${name}" 
          id="${selectId}" 
          class="form-select ${disabledClass}" 
          ${required ? 'required' : ''}
          ${disabledAttr}
        >
          <option value="">เลือก${safeLabel}</option>
          ${options.map(opt => `
            <option value="${escapeHTML(opt.value)}" ${String(opt.value) === String(safeValue) ? 'selected' : ''}>
              ${escapeHTML(opt.label)}
            </option>
          `).join('')}
        </select>
      `;
      break;

    case 'combobox':
      // [⭐️⭐️⭐️ นี่คือส่วนที่แก้ไข ⭐️⭐️⭐️]

      // 1. ใช้ 'id' ที่ส่งเข้ามา (หรือ 'name') เป็น ID หลัก
      const comboBaseId = id || `combo_${name}_${Date.now()}`;
      
      // 2. สร้าง ID ของส่วนประกอบต่างๆ จาก ID หลัก
      const comboContainerId = `combobox_${comboBaseId}`;
      const comboInputId = `input_${comboBaseId}`; // ID สำหรับช่อง input ที่มองเห็น
      const comboHiddenId = `combo_hidden_${comboBaseId}`; // ID สำหรับช่อง hidden (ที่เก็บค่าจริง)
      const comboDropdownId = `combo_dropdown_${comboBaseId}`;

      // [⭐️⭐️⭐️ สิ้นสุดส่วนที่แก้ไข ⭐️⭐️⭐️]
      
      const selectedOption = options.find(opt => String(opt.value) === String(safeValue));
      const initialDisplayValue = selectedOption ? selectedOption.label : '';

      inputHtml = `
        <div id="${comboContainerId}" class="combobox-container relative">
          <input 
            type="hidden" 
            id="${comboHiddenId}"  /* <-- (ใช้ ID ใหม่) */
            name="${name}" 
            value="${safeValue}"
            ${required ? 'required' : ''}
          >
          <input 
            type="text" 
            id="${comboInputId}"  /* <-- (ใช้ ID ใหม่) */
            class="form-input ${disabledClass}"
            placeholder="ค้นหา ${safeLabel}..."
            value="${escapeHTML(initialDisplayValue)}"
            onfocus="if (!${disabled}) document.getElementById('${comboDropdownId}').classList.remove('hidden')"
            oninput="if (!${disabled}) filterCombobox('${comboInputId}', '${comboHiddenId}', '${comboDropdownId}')"
            autocomplete="off"
            ${disabledAttr}
          >
          <div 
            id="${comboDropdownId}" /* <-- (ใช้ ID ใหม่) */
            class="combobox-dropdown absolute z-20 w-full bg-white border border-gray-300 rounded-b-lg shadow-lg max-h-60 overflow-y-auto hidden"
          >
            ${options.map(opt => `
              <div 
                class="combobox-item p-3 hover:bg-blue-50 cursor-pointer"
                data-value="${escapeHTML(opt.value)}"
                onclick="selectComboboxItem(this, '${comboInputId}', '${comboHiddenId}', '${comboDropdownId}')"
              >
                ${escapeHTML(opt.label)}
              </div>
            `).join('')}
          </div>
        </div>
      `;
      break;

    case 'file':
      const previewId = `preview_${name}`;
      const fileInputId = `file_input_${name}`;
      const hiddenId = `hidden_${name}`;
      const currentPhoto = escapeHTML(finalValue) || 'https://placehold.co/150x150/e0e0e0/808080?text=No+Photo';
      
      inputHtml = `
        <div class="flex items-center space-x-4">
          <img 
            id="${previewId}" 
            src="${currentPhoto}" 
            alt="Profile Preview" 
            class="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
          >
          <div class="flex-1">
            <button 
              type="button"
              onclick="document.getElementById('${fileInputId}').click()"
              class="btn btn-secondary text-sm ${disabledClass}"
              ${disabledAttr}
            >
              <i class="fas fa-upload mr-2"></i>เลือกไฟล์
            </button>
            <p class="text-xs text-gray-500 mt-1">อัปโหลดรูปภาพใหม่ (PNG, JPG)</p>
            <input 
              type="file" 
              id="${fileInputId}" 
              class="hidden"
              accept="image/png, image/jpeg"
              onchange="handleFilePreview(event, '${previewId}', '${hiddenId}')"
              ${disabledAttr}
            >
            <input 
              type="hidden" 
              id="${hiddenId}" 
              name="${name}" /* [ ⭐️⭐️⭐️ แก้ไข Bug ⭐️⭐️⭐️ ] */
            >
          </div>
        </div>
      `;
      break;
  }
  
  return `
    <div class="${colClass}">
      <label class="form-label">
        ${label} ${required ? '<span class="text-red-500">*</span>' : ''}
      </label>
      ${inputHtml}
    </div>
  `;
}


function handleFilePreview(event, previewId, hiddenId) {
  const file = event.target.files[0];
  if (!file) {
    console.warn('No file selected');
    return;
  }

  const preview = document.getElementById(previewId);
  const hiddenInput = document.getElementById(hiddenId);

  // ✅ ตรวจสอบ MIME type
  if (!file.type.startsWith('image/')) {
    showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'warning');
    return;
  }

  // ✅ ตรวจสอบขนาดไฟล์ (สูงสุด 5MB)
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    showToast('ขนาดไฟล์เกินขีดจำกัด (สูงสุด 5MB)', 'warning');
    return;
  }

  const reader = new FileReader();
  
  reader.onload = (e) => {
    const base64String = e.target.result;
    
    // ✅ DEBUG
    console.log('File selected:', file.name);
    console.log('File size:', file.size, 'bytes');
    console.log('Base64 length:', base64String.length);
    console.log('Base64 starts with:', base64String.substring(0, 50));
    
    // ✅ ตรวจสอบ Base64
    if (!base64String || !base64String.includes('base64,')) {
      console.error('Invalid Base64 format');
      showToast('เกิดข้อผิดพลาดในการอ่านไฟล์', 'error');
      return;
    }
    
    // ✅ ตั้งค่า Preview
    preview.src = base64String;
    preview.onerror = function() {
      console.error('Failed to display preview');
      showToast('ไม่สามารถแสดงตัวอย่างรูปภาพได้', 'error');
    };
    
    // ✅ เก็บ Base64 ใน hidden input
    hiddenInput.value = base64String;
    
    showToast('เลือกไฟล์สำเร็จ', 'success');
  };
  
  reader.onerror = (error) => {
    console.error('FileReader error:', error);
    showToast('เกิดข้อผิดพลาดในการอ่านไฟล์', 'error');
  };
  
  reader.readAsDataURL(file);
}

// ===================================
// HELPER FUNCTIONS
// ===================================

function getInitials(name) {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function getStatusColor(status) {
  const colors = {
    'active': 'badge-success',
    'inactive': 'badge-secondary',
    'graduated': 'badge-info',
    'transferred': 'badge-warning',
    'dropped': 'badge-danger'
  };
  return colors[status] || 'badge-secondary';
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function paginateArray(arr, page, pageSize) {
  const total = arr.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  
  return {
    data: arr.slice(start, end),
    page: page,
    pageSize: pageSize,
    total: total,
    totalPages: totalPages
  };
}

function filterArray(arr, query, fields) {
  if (!query || query.trim() === '') return arr;
  
  const lowerQuery = query.toLowerCase();
  return arr.filter(item => {
    return fields.some(field => {
      const value = item[field];
      return value && value.toString().toLowerCase().includes(lowerQuery);
    });
  });
}

/**
 * (ใหม่) ฟังก์ชันสำหรับกรองตัวเลือกใน <select>
 * @param {string} inputId - ID ของช่องค้นหา
 * @param {string} selectId - ID ของ <select> ที่จะกรอง
 */
function filterSelectOptions(inputId, selectId) {
  const filter = document.getElementById(inputId).value.toLowerCase();
  const select = document.getElementById(selectId);
  if (!select) return;
  
  const options = select.getElementsByTagName('option');
  
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const text = option.textContent || option.innerText;
    
    // แสดงตัวเลือกแรกเสมอ (เช่น "เลือกครูผู้สอน")
    if (option.value === "") {
      option.style.display = "";
      continue;
    }
    
    // ตรวจสอบว่าข้อความตรงกับคำค้นหาหรือไม่
    if (text.toLowerCase().indexOf(filter) > -1) {
      option.style.display = "";
    } else {
      option.style.display = "none";
    }
  }
}

/**
 * (ใหม่) ฟังก์ชันสำหรับเลือกรายการใน Combobox
 */
function selectComboboxItem(itemEl, inputId, hiddenId, dropdownId) {
  const value = itemEl.getAttribute('data-value');
  const label = itemEl.textContent || itemEl.innerText;
  
  // 1. ตั้งค่า input ที่มองเห็น (แสดง label)
  document.getElementById(inputId).value = label.trim();
  // 2. ตั้งค่า input ที่ซ่อนไว้ (เก็บ value)
  document.getElementById(hiddenId).value = value;
  // 3. ซ่อน dropdown
  document.getElementById(dropdownId).classList.add('hidden');
  
  // 4. (สำคัญ) แจ้งเตือนว่า input ที่ซ่อนไว้มีการเปลี่ยนแปลง
  document.getElementById(hiddenId).dispatchEvent(new Event('change'));
}

/**
 * (ใหม่) ฟังก์ชันสำหรับกรองรายการใน Combobox
 */
function filterCombobox(inputId, hiddenId, dropdownId) {
  const filter = document.getElementById(inputId).value.toLowerCase();
  const dropdown = document.getElementById(dropdownId);
  const items = dropdown.getElementsByClassName('combobox-item');
  let hasVisibleItems = false;
  
  for (const item of items) {
    const text = item.textContent || item.innerText;
    if (text.toLowerCase().indexOf(filter) > -1) {
      item.style.display = "";
      hasVisibleItems = true;
    } else {
      item.style.display = "none";
    }
  }
  
  // ถ้าสิ่งที่พิมพ์ไม่ตรงกับรายการไหนเลย ให้ล้างค่าที่ซ่อนไว้
  if (!hasVisibleItems) {
     const hiddenInput = document.getElementById(hiddenId);
     if (hiddenInput) {
       hiddenInput.value = '';
     }
  }
}

/**
 * (ใหม่) เพิ่ม Event Listener 
 * เพื่อปิด Combobox ทุกตัวเมื่อคลิกที่อื่น
 */
window.addEventListener('click', (e) => {
  document.querySelectorAll('.combobox-container').forEach(container => {
    // ถ้าไม่ได้คลิกใน container ของ combobox
    if (!container.contains(e.target)) {
      // ให้ซ่อน dropdown
      const dropdown = container.querySelector('.combobox-dropdown');
      if (dropdown) {
        dropdown.classList.add('hidden');
      }
    }
  });
});

/**
 * ฟังก์ชันสำหรับ Escape อักขระ HTML
 * @param {string} str - ข้อความ
 * @returns {string} ข้อความที่ Escape แล้ว
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
     .replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/'/g, '&#39;');
}

/**
 * อัปเดตตัวเลือกใน Combobox หลังจากโหลดหน้าเสร็จแล้ว (Dynamic Update)
 * @param {string} comboboxId - ID ของ Combobox (ที่ส่งไปใน renderFormField)
 * @param {Array} options - Array ของ {value, label}
 */
function updateComboboxOptions(comboboxId, options) {
  // 1. ค้นหา Container หลัก
  const container = document.getElementById(`combobox_${comboboxId}`);
  if (!container) {
    console.warn(`updateComboboxOptions: Element combobox_${comboboxId} not found.`);
    return;
  }
  
  const dropdown = container.querySelector('.combobox-dropdown');
  const input = container.querySelector(`#input_${comboboxId}`);
  const hiddenInput = container.querySelector(`#combo_hidden_${comboboxId}`);
  
  if (!dropdown || !input || !hiddenInput) return;

  // 2. ล้างค่าเดิม (Optional: ถ้าต้องการให้ Reset ค่าที่เลือกด้วย)
  // input.value = '';
  // hiddenInput.value = '';
  
  // 3. สร้าง HTML ตัวเลือกใหม่
  if (options.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-gray-500 text-center text-sm">ไม่พบข้อมูล</div>';
  } else {
    const optionsHtml = options.map(opt => `
      <div 
        class="combobox-item p-3 hover:bg-blue-50 cursor-pointer"
        data-value="${escapeHTML(opt.value)}"
        onclick="selectComboboxItem(this, 'input_${comboboxId}', 'combo_hidden_${comboboxId}', 'combo_dropdown_${comboboxId}')"
      >
        ${escapeHTML(opt.label)}
      </div>
    `).join('');
    
    dropdown.innerHTML = optionsHtml;
  }
}

console.log('✅ JS-Components (Complete Fixed) loaded successfully');
