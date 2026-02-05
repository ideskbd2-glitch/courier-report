// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBoInYELD9MbXamDyQPN_OSyVBaFMouSLA",
    authDomain: "courier-report-199b7.firebaseapp.com",
    projectId: "courier-report-199b7",
    storageBucket: "courier-report-199b7.firebasestorage.app",
    messagingSenderId: "985913257751",
    appId: "1:985913257751:web:1e4164beca2a945da11152",
    measurementId: "G-RZPRWQP9G2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// DOM Elements
const loginPage = document.getElementById('loginPage');
const dashboardPage = document.getElementById('dashboardPage');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const userRole = document.getElementById('userRole');
const sidebarMenu = document.getElementById('sidebarMenu');
const pageTitle = document.getElementById('pageTitle');

// Current user data
let currentUserData = null;

// Show/Hide loading
function showLoading() {
    // You can add a loading spinner here
    console.log('Loading...');
}

function hideLoading() {
    console.log('Loading complete');
}

// Show message
function showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = 'block';
    
    // Auto hide after 5 seconds for success/info messages
    if (type !== 'error') {
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

// Initialize Master Admin
async function initializeMasterAdmin(email) {
    try {
        const userRef = db.collection('users').doc(email);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            await userRef.set({
                email: email,
                name: 'Master Admin',
                role: 'master-admin',
                isActive: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                hubName: 'Head Office'
            });
            console.log('Master admin initialized');
        }
    } catch (error) {
        console.error('Error initializing master admin:', error);
    }
}

// Setup Sidebar Menu
function setupSidebarMenu(role) {
    sidebarMenu.innerHTML = '';
    
    if (role === 'master-admin') {
        sidebarMenu.innerHTML = `
            <a href="#" class="menu-item active" onclick="showSection('addAdminSection', 'Add Admin')">
                <i class="fas fa-user-plus"></i>
                <span>Add Admin</span>
            </a>
            <a href="#" class="menu-item" onclick="showSection('adminListSection', 'Admin List')">
                <i class="fas fa-users-cog"></i>
                <span>Admin List</span>
            </a>
            <a href="#" class="menu-item" onclick="showSection('zoneManagementSection', 'Zone Management')">
                <i class="fas fa-map-marker-alt"></i>
                <span>Zone Management</span>
            </a>
            <a href="#" class="menu-item" onclick="showSection('fileUploadSection', 'File Upload')">
                <i class="fas fa-cloud-upload-alt"></i>
                <span>File Upload</span>
            </a>
            <a href="#" class="menu-item" onclick="showSection('visitorRequestsSection', 'Visitor Requests')">
                <i class="fas fa-user-clock"></i>
                <span>Visitor Requests</span>
            </a>
        `;
        showSection('addAdminSection', 'Add Admin');
    } else if (role === 'admin') {
        sidebarMenu.innerHTML = `
            <a href="#" class="menu-item active" onclick="showSection('fileUploadSection', 'File Upload')">
                <i class="fas fa-cloud-upload-alt"></i>
                <span>File Upload</span>
            </a>
        `;
        showSection('fileUploadSection', 'File Upload');
    } else if (role === 'visitor') {
        if (currentUserData && currentUserData.isActive === null) {
            // Pending approval
            sidebarMenu.innerHTML = `
                <a href="#" class="menu-item active" onclick="showSection('visitorDashboardSection', 'Dashboard')">
                    <i class="fas fa-tachometer-alt"></i>
                    <span>Dashboard</span>
                </a>
            `;
            showSection('visitorDashboardSection', 'Dashboard');
        } else if (currentUserData && currentUserData.isActive === true) {
            // Approved visitor
            sidebarMenu.innerHTML = `
                <a href="#" class="menu-item active" onclick="showSection('visitorDashboardSection', 'Dashboard')">
                    <i class="fas fa-tachometer-alt"></i>
                    <span>Dashboard</span>
                </a>
            `;
            showSection('visitorDashboardSection', 'Dashboard');
        }
    }
}

// Show/Hide sections
function showSection(sectionId, title) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
    
    // Remove active class from all menu items
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => item.classList.remove('active'));
    
    // Add active class to clicked menu item
    event.target.closest('.menu-item').classList.add('active');
    
    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
        section.classList.add('active');
        pageTitle.textContent = title;
        
        // Load data for specific sections
        switch(sectionId) {
            case 'adminListSection':
                loadAdmins();
                break;
            case 'zoneManagementSection':
                loadZones();
                break;
            case 'fileUploadSection':
                loadZonesForUpload();
                loadRecentUploads();
                break;
            case 'visitorRequestsSection':
                loadVisitorRequests();
                break;
            case 'visitorDashboardSection':
                updateVisitorDashboard();
                break;
        }
    }
}

// Update visitor dashboard
function updateVisitorDashboard() {
    if (!currentUserData) return;
    
    const visitorName = document.getElementById('visitorName');
    const visitorStatus = document.getElementById('visitorStatus');
    const visitorContent = document.getElementById('visitorContent');
    
    if (visitorName) visitorName.textContent = currentUserData.name || 'Visitor';
    
    if (currentUserData.isActive === null) {
        if (visitorStatus) visitorStatus.textContent = '⏳ Waiting for Admin Approval';
        if (visitorContent) {
            visitorContent.innerHTML = `
                <div class="section-card">
                    <div class="section-body">
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 60px; color: #f6ad55; margin-bottom: 20px;">
                                <i class="fas fa-clock"></i>
                            </div>
                            <h3 style="margin-bottom: 15px; color: #2d3748;">Registration Under Review</h3>
                            <p style="color: #718096; max-width: 400px; margin: 0 auto;">
                                Your registration request has been submitted and is currently under review by the administrator.
                                You will be able to access all features once your account is approved.
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }
    } else if (currentUserData.isActive === true) {
        if (visitorStatus) visitorStatus.textContent = '✅ Account Approved';
        if (visitorContent) {
            visitorContent.innerHTML = `
                <div class="section-card">
                    <div class="section-header">
                        <h2><i class="fas fa-user-circle"></i> Profile Information</h2>
                    </div>
                    <div class="section-body">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                            <div style="background: #f7fafc; padding: 20px; border-radius: 8px;">
                                <h4 style="color: #718096; margin-bottom: 10px;">Full Name</h4>
                                <p style="font-size: 18px; font-weight: 600; color: #2d3748;">${currentUserData.name || 'N/A'}</p>
                            </div>
                            <div style="background: #f7fafc; padding: 20px; border-radius: 8px;">
                                <h4 style="color: #718096; margin-bottom: 10px;">Email Address</h4>
                                <p style="font-size: 18px; font-weight: 600; color: #2d3748;">${currentUserData.email}</p>
                            </div>
                            <div style="background: #f7fafc; padding: 20px; border-radius: 8px;">
                                <h4 style="color: #718096; margin-bottom: 10px;">Hub Name</h4>
                                <p style="font-size: 18px; font-weight: 600; color: #2d3748;">${currentUserData.hubName || 'N/A'}</p>
                            </div>
                            <div style="background: #f7fafc; padding: 20px; border-radius: 8px;">
                                <h4 style="color: #718096; margin-bottom: 10px;">Account Status</h4>
                                <p style="font-size: 18px; font-weight: 600; color: #48bb78;">Active ✓</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="section-card">
                    <div class="section-header">
                        <h2><i class="fas fa-chart-line"></i> Reports Dashboard</h2>
                    </div>
                    <div class="section-body">
                        <p style="color: #718096;">Your reports and analytics will appear here once available.</p>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px;">
                            <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: 600;">0</div>
                                <div>Today's Reports</div>
                            </div>
                            <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: 600;">0</div>
                                <div>Pending Tasks</div>
                            </div>
                            <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); color: white; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: 600;">0</div>
                                <div>Completed</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

// Load zones for upload dropdowns
async function loadZonesForUpload() {
    try {
        const snapshot = await db.collection('zones')
            .where('isActive', '==', true)
            .orderBy('name')
            .get();
        
        const morningZoneSelect = document.getElementById('morningZone');
        const finalZoneSelect = document.getElementById('finalZone');
        
        // Clear existing options except first one
        morningZoneSelect.innerHTML = '<option value="">Select a zone</option>';
        finalZoneSelect.innerHTML = '<option value="">Select a zone</option>';
        
        snapshot.forEach(doc => {
            const zone = doc.data();
            const option1 = document.createElement('option');
            option1.value = doc.id;
            option1.textContent = `${zone.name} (${zone.code})`;
            
            const option2 = document.createElement('option');
            option2.value = doc.id;
            option2.textContent = `${zone.name} (${zone.code})`;
            
            morningZoneSelect.appendChild(option1);
            finalZoneSelect.appendChild(option2);
        });
    } catch (error) {
        console.error('Error loading zones:', error);
    }
}

// Add new admin
document.getElementById('addAdminBtn').addEventListener('click', async () => {
    const email = document.getElementById('adminEmail').value.trim();
    
    if (!email || !email.includes('@')) {
        showMessage('addAdminMessage', 'Please enter a valid email address', 'error');
        return;
    }
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await db.collection('users').doc(user.email).get();
        if (!userDoc.exists || userDoc.data().role !== 'master-admin') {
            showMessage('addAdminMessage', 'Only master admin can add admins', 'error');
            return;
        }
        
        const userRef = db.collection('users').doc(email);
        const existingUser = await userRef.get();
        
        if (existingUser.exists) {
            showMessage('addAdminMessage', 'This email is already registered', 'error');
            return;
        }
        
        await userRef.set({
            email: email,
            role: 'admin',
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            addedBy: user.email,
            name: email.split('@')[0]
        });
        
        showMessage('addAdminMessage', 'Admin added successfully!', 'success');
        document.getElementById('adminEmail').value = '';
        
        // Show success toast
        showMessage('addAdminMessage', '✅ Admin added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding admin:', error);
        showMessage('addAdminMessage', 'Error: ' + error.message, 'error');
    }
});

// Load all admins
async function loadAdmins() {
    try {
        const snapshot = await db.collection('users')
            .where('role', 'in', ['master-admin', 'admin'])
            .orderBy('createdAt', 'desc')
            .get();
        
        const adminsList = document.getElementById('adminsList');
        adminsList.innerHTML = '';
        
        snapshot.forEach(doc => {
            const user = doc.data();
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${user.email}</td>
                <td>
                    <span class="status-badge ${user.role === 'master-admin' ? 'status-active' : 'status-pending'}">
                        ${user.role}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${user.isActive ? 'status-active' : 'status-blocked'}">
                        ${user.isActive ? 'Active' : 'Blocked'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        ${user.role !== 'master-admin' ? 
                            `<button class="action-btn ${user.isActive ? 'btn-block' : 'btn-unblock'}" 
                                    onclick="toggleAdminStatus('${user.email}', ${!user.isActive})">
                                <i class="fas ${user.isActive ? 'fa-ban' : 'fa-check'}"></i>
                                ${user.isActive ? 'Block' : 'Unblock'}
                            </button>` 
                            : 'Master Admin'
                        }
                    </div>
                </td>
            `;
            
            adminsList.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading admins:', error);
    }
}

// Toggle admin status
async function toggleAdminStatus(email, newStatus) {
    try {
        await db.collection('users').doc(email).update({
            isActive: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadAdmins();
        showMessage('addAdminMessage', `Admin ${newStatus ? 'activated' : 'blocked'} successfully`, 'success');
    } catch (error) {
        console.error('Error updating admin status:', error);
        showMessage('addAdminMessage', 'Error updating admin status', 'error');
    }
}

// Zone Management Functions
document.getElementById('addZoneBtn').addEventListener('click', async () => {
    const name = document.getElementById('zoneName').value.trim();
    const code = document.getElementById('zoneCode').value.trim().toUpperCase();
    
    if (!name || !code) {
        showMessage('zoneMessage', 'Please enter both zone name and code', 'error');
        return;
    }
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await db.collection('users').doc(user.email).get();
        if (!userDoc.exists || userDoc.data().role !== 'master-admin') {
            showMessage('zoneMessage', 'Only master admin can add zones', 'error');
            return;
        }
        
        // Check if zone code already exists
        const existingZones = await db.collection('zones')
            .where('code', '==', code)
            .get();
        
        if (!existingZones.empty) {
            showMessage('zoneMessage', 'Zone code already exists', 'error');
            return;
        }
        
        await db.collection('zones').add({
            name: name,
            code: code,
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: user.email
        });
        
        showMessage('zoneMessage', 'Zone added successfully!', 'success');
        document.getElementById('zoneName').value = '';
        document.getElementById('zoneCode').value = '';
        
        loadZones();
        loadZonesForUpload();
        
    } catch (error) {
        console.error('Error adding zone:', error);
        showMessage('zoneMessage', 'Error: ' + error.message, 'error');
    }
});

// Load all zones
async function loadZones() {
    try {
        const snapshot = await db.collection('zones')
            .orderBy('createdAt', 'desc')
            .get();
        
        const zonesGrid = document.getElementById('zonesGrid');
        zonesGrid.innerHTML = '';
        
        if (snapshot.empty) {
            zonesGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: #f7fafc; border-radius: 8px;">
                    <i class="fas fa-map-marker-alt" style="font-size: 48px; color: #a0aec0; margin-bottom: 20px;"></i>
                    <h3 style="color: #718096; margin-bottom: 10px;">No Zones Found</h3>
                    <p style="color: #a0aec0;">Add your first zone using the form above.</p>
                </div>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const zone = doc.data();
            const zoneCard = document.createElement('div');
            zoneCard.className = 'zone-card';
            
            zoneCard.innerHTML = `
                <div class="zone-icon">
                    <i class="fas fa-map-marker-alt"></i>
                </div>
                <div class="zone-name">${zone.name}</div>
                <div class="zone-code">Code: ${zone.code}</div>
                <div style="margin: 15px 0;">
                    <span class="status-badge ${zone.isActive ? 'status-active' : 'status-blocked'}">
                        ${zone.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div class="zone-actions">
                    <button class="btn-delete" onclick="toggleZoneStatus('${doc.id}', ${!zone.isActive})">
                        <i class="fas ${zone.isActive ? 'fa-times' : 'fa-check'}"></i>
                        ${zone.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            `;
            
            zonesGrid.appendChild(zoneCard);
        });
    } catch (error) {
        console.error('Error loading zones:', error);
    }
}

// Toggle zone status
async function toggleZoneStatus(zoneId, newStatus) {
    try {
        await db.collection('zones').doc(zoneId).update({
            isActive: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadZones();
        loadZonesForUpload();
        showMessage('zoneMessage', `Zone ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
    } catch (error) {
        console.error('Error updating zone status:', error);
        showMessage('zoneMessage', 'Error updating zone status', 'error');
    }
}

// File Upload Functions
document.getElementById('morningFile').addEventListener('change', function(e) {
    handleFileSelection(e, 'morningFileInfo');
});

document.getElementById('finalFile').addEventListener('change', function(e) {
    handleFileSelection(e, 'finalFileInfo');
});

function handleFileSelection(event, infoElementId) {
    if (event.target.files[0]) {
        const file = event.target.files[0];
        const isValid = validateFile(file);
        
        if (isValid) {
            document.getElementById(infoElementId).textContent = 
                `Selected: ${file.name} (${formatFileSize(file.size)})`;
            document.getElementById(infoElementId).className = 'file-info';
        } else {
            document.getElementById(infoElementId).textContent = 
                'Invalid file type. Please select .csv, .xlsx or .xls file';
            document.getElementById(infoElementId).className = 'file-info error';
            event.target.value = '';
        }
    }
}

function validateFile(file) {
    const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (validTypes.includes(file.type)) {
        return true;
    }
    
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    return validExtensions.some(ext => fileName.endsWith(ext));
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Upload Morning File
document.getElementById('uploadMorningBtn').addEventListener('click', async () => {
    await uploadFile('morning');
});

// Upload Final File
document.getElementById('uploadFinalBtn').addEventListener('click', async () => {
    await uploadFile('final');
});

async function uploadFile(type) {
    const fileInput = document.getElementById(`${type}File`);
    const zoneSelect = document.getElementById(`${type}Zone`);
    const fileInfo = document.getElementById(`${type}FileInfo`);
    const file = fileInput.files[0];
    const zoneId = zoneSelect.value;
    
    if (!zoneId) {
        showMessage(`${type}FileInfo`, 'Please select a zone first', 'error');
        return;
    }
    
    if (!file) {
        showMessage(`${type}FileInfo`, `Please select a ${type} file first`, 'error');
        return;
    }
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await db.collection('users').doc(user.email).get();
        if (!userDoc.exists || !['master-admin', 'admin'].includes(userDoc.data().role)) {
            showMessage(`${type}FileInfo`, 'Only admins can upload files', 'error');
            return;
        }
        
        // Get zone data
        const zoneDoc = await db.collection('zones').doc(zoneId).get();
        if (!zoneDoc.exists) {
            showMessage(`${type}FileInfo`, 'Selected zone not found', 'error');
            return;
        }
        
        const zone = zoneDoc.data();
        
        const timestamp = new Date().getTime();
        const fileName = `${type}_${zone.code}_${timestamp}_${file.name.replace(/\s+/g, '_')}`;
        const storageRef = storage.ref().child(`${type}_files/${fileName}`);
        
        // Show loading
        fileInfo.textContent = 'Uploading... Please wait';
        fileInfo.className = 'file-info info';
        
        // Upload file
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        
        // Save to Firestore
        await db.collection('uploads').add({
            fileName: file.name,
            originalName: file.name,
            storagePath: fileName,
            downloadURL: downloadURL,
            type: type,
            zoneId: zoneId,
            zoneName: zone.name,
            zoneCode: zone.code,
            uploadedBy: user.email,
            uploadedByUser: userDoc.data().name || user.email,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
            size: file.size,
            contentType: file.type
        });
        
        // Success
        fileInfo.textContent = `✅ ${type} file uploaded successfully for ${zone.name} zone!`;
        fileInfo.className = 'file-info success';
        fileInput.value = '';
        zoneSelect.value = '';
        
        loadRecentUploads();
        
    } catch (error) {
        console.error('Error uploading file:', error);
        fileInfo.textContent = `❌ Upload failed: ${error.message}`;
        fileInfo.className = 'file-info error';
    }
}

// Load recent uploads
async function loadRecentUploads() {
    try {
        const snapshot = await db.collection('uploads')
            .orderBy('uploadedAt', 'desc')
            .limit(5)
            .get();
        
        const recentUploads = document.getElementById('recentUploads');
        recentUploads.innerHTML = '';
        
        if (snapshot.empty) {
            recentUploads.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #718096;">
                    <i class="fas fa-cloud-upload-alt" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <p>No recent uploads found.</p>
                </div>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const upload = doc.data();
            const uploadItem = document.createElement('div');
            uploadItem.className = 'upload-item';
            
            const fileTypeIcon = upload.type === 'morning' ? 'fa-sun' : 'fa-flag-checkered';
            const fileTypeColor = upload.type === 'morning' ? '#ed8936' : '#4299e1';
            
            uploadItem.innerHTML = `
                <div class="upload-item-icon" style="background: ${fileTypeColor}20; color: ${fileTypeColor}">
                    <i class="fas ${fileTypeIcon}"></i>
                </div>
                <div class="upload-item-info">
                    <div class="upload-item-name">${upload.originalName}</div>
                    <div class="upload-item-meta">
                        <span><i class="fas fa-map-marker-alt"></i> ${upload.zoneName}</span>
                        <span><i class="fas fa-user"></i> ${upload.uploadedByUser}</span>
                        <span><i class="fas fa-clock"></i> ${upload.uploadedAt.toDate().toLocaleString()}</span>
                    </div>
                </div>
            `;
            
            recentUploads.appendChild(uploadItem);
        });
    } catch (error) {
        console.error('Error loading recent uploads:', error);
    }
}

// Load visitor requests
async function loadVisitorRequests() {
    try {
        const snapshot = await db.collection('users')
            .where('role', '==', 'visitor')
            .orderBy('createdAt', 'desc')
            .get();
        
        const visitorsList = document.getElementById('visitorsList');
        visitorsList.innerHTML = '';
        
        snapshot.forEach(doc => {
            const user = doc.data();
            const row = document.createElement('tr');
            const date = user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A';
            
            row.innerHTML = `
                <td>
                    <div>
                        <strong>${user.name || 'N/A'}</strong><br>
                        <small>${user.email}</small>
                    </div>
                </td>
                <td>${user.hubName || 'N/A'}</td>
                <td>${date}</td>
                <td>
                    <span class="status-badge ${user.isActive === true ? 'status-active' : 
                                           user.isActive === false ? 'status-blocked' : 'status-pending'}">
                        ${user.isActive === true ? 'Approved' : 
                         user.isActive === false ? 'Blocked' : 'Pending'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        ${user.isActive === undefined ? 
                            `<button class="action-btn btn-approve" onclick="approveVisitor('${user.email}')">
                                <i class="fas fa-check"></i> Approve
                            </button>` : ''
                        }
                        <button class="action-btn ${user.isActive ? 'btn-block' : 'btn-unblock'}" 
                                onclick="toggleVisitorStatus('${user.email}', ${!user.isActive})">
                            <i class="fas ${user.isActive ? 'fa-ban' : 'fa-check'}"></i>
                            ${user.isActive ? 'Block' : 'Unblock'}
                        </button>
                    </div>
                </td>
            `;
            
            visitorsList.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading visitors:', error);
    }
}

// Approve visitor
async function approveVisitor(email) {
    try {
        await db.collection('users').doc(email).update({
            isActive: true,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedBy: auth.currentUser.email
        });
        
        loadVisitorRequests();
        showMessage('addAdminMessage', 'Visitor approved successfully!', 'success');
    } catch (error) {
        console.error('Error approving visitor:', error);
        showMessage('addAdminMessage', 'Error approving visitor', 'error');
    }
}

// Toggle visitor status
async function toggleVisitorStatus(email, newStatus) {
    try {
        await db.collection('users').doc(email).update({
            isActive: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        loadVisitorRequests();
        showMessage('addAdminMessage', `Visitor ${newStatus ? 'activated' : 'blocked'} successfully`, 'success');
    } catch (error) {
        console.error('Error updating visitor status:', error);
        showMessage('addAdminMessage', 'Error updating visitor status', 'error');
    }
}

// Visitor Registration
document.getElementById('submitRegistrationBtn').addEventListener('click', async () => {
    const email = document.getElementById('regEmail').value;
    const name = document.getElementById('regName').value.trim();
    const hubName = document.getElementById('regHub').value.trim();
    
    if (!name || !hubName) {
        showMessage('registrationMessage', 'Please fill all fields', 'error');
        return;
    }
    
    try {
        const user = auth.currentUser;
        if (!user || user.email !== email) {
            showMessage('registrationMessage', 'Authentication error', 'error');
            return;
        }
        
        await db.collection('users').doc(email).set({
            email: email,
            name: name,
            hubName: hubName,
            role: 'visitor',
            isActive: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showMessage('registrationMessage', '✅ Registration submitted! Waiting for admin approval.', 'success');
        
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('Error submitting registration:', error);
        showMessage('registrationMessage', 'Error: ' + error.message, 'error');
    }
});

// Google Login
googleLoginBtn.addEventListener('click', async () => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        
        // Initialize master admin if it's the master email
        if (result.user.email === 'ebadot.hossen@carrybee.com') {
            await initializeMasterAdmin(result.user.email);
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showMessage('errorMessage', 'Login failed: ' + error.message, 'error');
    }
});

// Check auth state
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log('User logged in:', user.email);
        
        try {
            const userDoc = await db.collection('users').doc(user.email).get();
            
            if (!userDoc.exists) {
                // First time visitor - show registration
                loginPage.style.display = 'none';
                dashboardPage.style.display = 'block';
                document.getElementById('registrationSection').style.display = 'block';
                document.getElementById('regEmail').value = user.email;
                return;
            }
            
            const userData = userDoc.data();
            currentUserData = userData;
            
            // Check if user is active
            if (userData.isActive === false) {
                showMessage('errorMessage', 'Your account is blocked. Contact administrator.', 'error');
                await auth.signOut();
                return;
            }
            
            // Set user info
            userEmail.textContent = user.email;
            userName.textContent = userData.name || user.email.split('@')[0];
            userRole.textContent = userData.role === 'master-admin' ? 'Master Admin' : 
                                 userData.role === 'admin' ? 'Admin' : 'Visitor';
            userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || user.email)}&background=667eea&color=fff`;
            
            // Show dashboard
            loginPage.style.display = 'none';
            dashboardPage.style.display = 'block';
            
            // Setup sidebar menu
            setupSidebarMenu(userData.role);
            
        } catch (error) {
            console.error('Error checking user data:', error);
            showMessage('errorMessage', 'Error loading user data', 'error');
        }
        
    } else {
        // User is signed out
        loginPage.style.display = 'block';
        dashboardPage.style.display = 'none';
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        loginPage.style.display = 'block';
        dashboardPage.style.display = 'none';
        showMessage('errorMessage', 'Logged out successfully', 'success');
    }).catch(error => {
        console.error('Logout error:', error);
    });
});
