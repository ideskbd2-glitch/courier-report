// Firebase configuration
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
const adminPage = document.getElementById('adminPage');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const userRole = document.getElementById('userRole');
const sidebarMenu = document.getElementById('sidebarMenu');
const breadcrumb = document.getElementById('breadcrumb');

// Loading State
function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

// Show Toast Message
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    
    // Set color based on type
    const colors = {
        success: '#4cc9f0',
        error: '#f72585',
        warning: '#f8961e',
        info: '#4895ef'
    };
    
    toast.style.background = colors[type] || colors.info;
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        toast.style.display = 'none';
    }, 5000);
}

// Initialize Master Admin
async function initializeMasterAdmin(masterEmail) {
    try {
        const userRef = db.collection('users').doc(masterEmail);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            await userRef.set({
                email: masterEmail,
                name: 'Master Admin',
                role: 'master-admin',
                isActive: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Master admin initialized');
        }
    } catch (error) {
        console.error('Error initializing master admin:', error);
    }
}

// Setup Sidebar Menu based on user role
function setupSidebarMenu(role) {
    sidebarMenu.innerHTML = '';
    
    if (role === 'master-admin') {
        sidebarMenu.innerHTML = `
            <a href="#" class="menu-item active" onclick="switchTab('addAdminTab', 'Add Admin')">
                <i class="fas fa-user-plus"></i>
                <span>Add Admin</span>
            </a>
            <a href="#" class="menu-item" onclick="switchTab('adminListTab', 'Admin List')">
                <i class="fas fa-users-cog"></i>
                <span>Admin List</span>
            </a>
            <a href="#" class="menu-item" onclick="switchTab('zoneManagementTab', 'Zone Management')">
                <i class="fas fa-map-marker-alt"></i>
                <span>Zone Management</span>
            </a>
            <a href="#" class="menu-item" onclick="switchTab('fileUploadTab', 'File Upload')">
                <i class="fas fa-cloud-upload-alt"></i>
                <span>File Upload</span>
            </a>
            <a href="#" class="menu-item" onclick="switchTab('visitorRequestsTab', 'Visitor Requests')">
                <i class="fas fa-user-clock"></i>
                <span>Visitor Requests</span>
            </a>
        `;
        switchTab('addAdminTab', 'Add Admin');
    } else if (role === 'admin') {
        sidebarMenu.innerHTML = `
            <a href="#" class="menu-item active" onclick="switchTab('fileUploadTab', 'File Upload')">
                <i class="fas fa-cloud-upload-alt"></i>
                <span>File Upload</span>
            </a>
        `;
        switchTab('fileUploadTab', 'File Upload');
    } else if (role === 'visitor') {
        sidebarMenu.innerHTML = `
            <a href="#" class="menu-item active" onclick="switchTab('visitorPage', 'Dashboard')">
                <i class="fas fa-tachometer-alt"></i>
                <span>Dashboard</span>
            </a>
        `;
        switchTab('visitorPage', 'Dashboard');
    }
}

// Switch between tabs
function switchTab(tabId, tabName) {
    // Update breadcrumb
    breadcrumb.innerHTML = `<span>${tabName}</span>`;
    
    // Remove active class from all menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to clicked menu item
    event.target.closest('.menu-item').classList.add('active');
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    // Show selected tab
    const tab = document.getElementById(tabId);
    if (tab) {
        tab.style.display = 'block';
        tab.classList.add('active');
    }
    
    // Load data if needed
    if (tabId === 'adminListTab') loadAdmins();
    if (tabId === 'visitorRequestsTab') loadVisitorRequests();
    if (tabId === 'fileUploadTab') {
        loadZonesForUpload();
        loadRecentUploads();
    }
    if (tabId === 'zoneManagementTab') loadZones();
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
        while (morningZoneSelect.options.length > 1) {
            morningZoneSelect.remove(1);
        }
        while (finalZoneSelect.options.length > 1) {
            finalZoneSelect.remove(1);
        }
        
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
    const messageDiv = document.getElementById('addAdminMessage');
    
    if (!email || !email.includes('@')) {
        showMessage(messageDiv, 'Please enter a valid email address', 'error');
        return;
    }
    
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        const currentUserDoc = await db.collection('users').doc(currentUser.email).get();
        if (!currentUserDoc.exists || currentUserDoc.data().role !== 'master-admin') {
            showMessage(messageDiv, 'Only master admin can add admins', 'error');
            return;
        }
        
        const userRef = db.collection('users').doc(email);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            showMessage(messageDiv, 'This email is already registered', 'error');
            return;
        }
        
        await userRef.set({
            email: email,
            role: 'admin',
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            addedBy: currentUser.email
        });
        
        showMessage(messageDiv, 'Admin added successfully!', 'success');
        document.getElementById('adminEmail').value = '';
        showToast('Admin added successfully!', 'success');
    } catch (error) {
        console.error('Error adding admin:', error);
        showMessage(messageDiv, 'Error adding admin: ' + error.message, 'error');
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
                <td>
                    <div class="d-flex align-items-center">
                        <i class="fas fa-envelope me-2"></i>
                        ${user.email}
                    </div>
                </td>
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
                            `<button class="btn-action ${user.isActive ? 'btn-block' : 'btn-unblock'}" 
                                    onclick="toggleAdminStatus('${user.email}', ${!user.isActive})">
                                <i class="fas ${user.isActive ? 'fa-ban' : 'fa-check'}"></i>
                                ${user.isActive ? 'Block' : 'Unblock'}
                            </button>` 
                            : ''
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
        showToast(`Admin ${newStatus ? 'activated' : 'blocked'} successfully`, 'success');
    } catch (error) {
        console.error('Error updating admin status:', error);
        showToast('Error updating admin status', 'error');
    }
}

// Zone Management Functions

// Add new zone
document.getElementById('addZoneBtn').addEventListener('click', async () => {
    const name = document.getElementById('zoneName').value.trim();
    const code = document.getElementById('zoneCode').value.trim().toUpperCase();
    const messageDiv = document.getElementById('zoneMessage');
    
    if (!name || !code) {
        showMessage(messageDiv, 'Please enter both zone name and code', 'error');
        return;
    }
    
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        const currentUserDoc = await db.collection('users').doc(currentUser.email).get();
        if (!currentUserDoc.exists || currentUserDoc.data().role !== 'master-admin') {
            showMessage(messageDiv, 'Only master admin can add zones', 'error');
            return;
        }
        
        // Check if zone code already exists
        const zonesSnapshot = await db.collection('zones')
            .where('code', '==', code)
            .get();
        
        if (!zonesSnapshot.empty) {
            showMessage(messageDiv, 'Zone code already exists', 'error');
            return;
        }
        
        await db.collection('zones').add({
            name: name,
            code: code,
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.email
        });
        
        showMessage(messageDiv, 'Zone added successfully!', 'success');
        document.getElementById('zoneName').value = '';
        document.getElementById('zoneCode').value = '';
        showToast('Zone added successfully!', 'success');
        loadZones();
        loadZonesForUpload();
    } catch (error) {
        console.error('Error adding zone:', error);
        showMessage(messageDiv, 'Error adding zone: ' + error.message, 'error');
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
                <div class="col-12">
                    <div class="alert info">
                        No zones found. Add your first zone above.
                    </div>
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
                <div class="zone-status">
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
        showToast(`Zone ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
    } catch (error) {
        console.error('Error updating zone status:', error);
        showToast('Error updating zone status', 'error');
    }
}

// File Upload Functions

// File selection handlers
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

// Validate file type
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

// Format file size
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
        showToast('Please select a zone first', 'error');
        return;
    }
    
    if (!file) {
        showToast(`Please select a ${type} file first`, 'error');
        return;
    }
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await db.collection('users').doc(user.email).get();
        if (!userDoc.exists || !['master-admin', 'admin'].includes(userDoc.data().role)) {
            showToast('Only admins can upload files', 'error');
            return;
        }
        
        // Get zone data
        const zoneDoc = await db.collection('zones').doc(zoneId).get();
        if (!zoneDoc.exists) {
            showToast('Selected zone not found', 'error');
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
        fileInfo.textContent = `${type} file uploaded successfully for ${zone.name} zone!`;
        fileInfo.className = 'file-info success';
        fileInput.value = '';
        zoneSelect.value = '';
        
        showToast(`${type} file uploaded successfully!`, 'success');
        loadRecentUploads();
        
    } catch (error) {
        console.error('Error uploading file:', error);
        fileInfo.textContent = `Upload failed: ${error.message}`;
        fileInfo.className = 'file-info error';
        showToast('Upload failed: ' + error.message, 'error');
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
                <div class="alert info">
                    No recent uploads found.
                </div>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const upload = doc.data();
            const uploadItem = document.createElement('div');
            uploadItem.className = 'upload-item';
            
            const fileTypeIcon = upload.type === 'morning' ? 'fa-sun' : 'fa-flag-checkered';
            const fileTypeColor = upload.type === 'morning' ? '#f8961e' : '#4895ef';
            
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
                            `<button class="btn-action btn-approve" onclick="approveVisitor('${user.email}')">
                                <i class="fas fa-check"></i> Approve
                            </button>` : ''
                        }
                        <button class="btn-action ${user.isActive ? 'btn-block' : 'btn-unblock'}" 
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
        showToast('Visitor approved successfully!', 'success');
    } catch (error) {
        console.error('Error approving visitor:', error);
        showToast('Error approving visitor', 'error');
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
        showToast(`Visitor ${newStatus ? 'activated' : 'blocked'} successfully`, 'success');
    } catch (error) {
        console.error('Error updating visitor status:', error);
        showToast('Error updating visitor status', 'error');
    }
}

// Visitor Registration
document.getElementById('submitRegistrationBtn').addEventListener('click', async () => {
    const email = document.getElementById('regEmail').value;
    const name = document.getElementById('regName').value.trim();
    const hubName = document.getElementById('regHub').value.trim();
    const messageDiv = document.getElementById('registrationMessage');
    
    if (!name || !hubName) {
        showMessage(messageDiv, 'Please fill all fields', 'error');
        return;
    }
    
    try {
        const user = auth.currentUser;
        if (!user || user.email !== email) {
            showMessage(messageDiv, 'Authentication error', 'error');
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
        
        showMessage(messageDiv, 'Registration submitted! Waiting for admin approval.', 'success');
        showToast('Registration submitted successfully!', 'success');
        
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('Error submitting registration:', error);
        showMessage(messageDiv, 'Error: ' + error.message, 'error');
    }
});

// Show message
function showMessage(element, text, type) {
    element.textContent = text;
    element.className = `alert ${type}`;
}

// Google Login
googleLoginBtn.addEventListener('click', async () => {
    try {
        showLoading();
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        
        if (result.user.email === 'ebadot.hossen@carrybee.com') {
            await initializeMasterAdmin(result.user.email);
        }
        
        hideLoading();
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed: ' + error.message, 'error');
        hideLoading();
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
                adminPage.style.display = 'block';
                document.getElementById('registrationTab').style.display = 'block';
                document.getElementById('regEmail').value = user.email;
                setupSidebarMenu('visitor');
                return;
            }
            
            const userData = userDoc.data();
            
            // Check if user is active
            if (userData.isActive === false) {
                showToast('Your account is blocked. Contact administrator.', 'error');
                await auth.signOut();
                return;
            }
            
            // Set user info
            userEmail.textContent = user.email;
            userName.textContent = userData.name || user.email.split('@')[0];
            userRole.textContent = userData.role === 'master-admin' ? 'Master Admin' : 
                                 userData.role === 'admin' ? 'Admin' : 'Visitor';
            userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || user.email)}&background=4361ee&color=fff`;
            
            // Show appropriate page
            loginPage.style.display = 'none';
            adminPage.style.display = 'block';
            
            // Setup sidebar menu
            setupSidebarMenu(userData.role);
            
            // Setup visitor page
            if (userData.role === 'visitor') {
                const visitorName = document.getElementById('visitorName');
                const visitorStatus = document.getElementById('visitorStatus');
                const visitorContent = document.getElementById('visitorContent');
                
                visitorName.textContent = userData.name;
                
                if (userData.isActive === null) {
                    visitorStatus.textContent = 'Waiting for admin approval';
                    visitorContent.innerHTML = `
                        <div class="card">
                            <div class="card-body text-center">
                                <div class="mb-3">
                                    <i class="fas fa-clock fa-3x text-warning"></i>
                                </div>
                                <h3>Registration Pending</h3>
                                <p class="text-muted">Your registration is under review by the administrator.</p>
                                <p>You will be notified once approved.</p>
                            </div>
                        </div>
                    `;
                } else if (userData.isActive === true) {
                    visitorStatus.textContent = 'Account Approved';
                    visitorContent.innerHTML = `
                        <div class="row">
                            <div class="col-md-4">
                                <div class="card">
                                    <div class="card-body">
                                        <h5><i class="fas fa-user text-primary"></i> Your Profile</h5>
                                        <p><strong>Name:</strong> ${userData.name}</p>
                                        <p><strong>Email:</strong> ${userData.email}</p>
                                        <p><strong>Hub:</strong> ${userData.hubName}</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-8">
                                <div class="card">
                                    <div class="card-body">
                                        <h5><i class="fas fa-chart-line text-success"></i> Reports</h5>
                                        <p>Your reports dashboard will be available here.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }
            
        } catch (error) {
            console.error('Error checking user data:', error);
            showToast('Error loading user data', 'error');
        }
        
    } else {
        // User is signed out
        loginPage.style.display = 'block';
        adminPage.style.display = 'none';
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        showToast('Logged out successfully', 'success');
    }).catch(error => {
        console.error('Logout error:', error);
        showToast('Logout failed', 'error');
    });
});

// Sidebar toggle for mobile
document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
});

// Initialize
showLoading();
setTimeout(hideLoading, 1000);
