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
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
} catch (error) {
    console.error("Firebase initialization error:", error);
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Global Variables
let currentUser = null;
let userRole = null;
let userData = null;
const MASTER_ADMIN_EMAIL = "ebadot.hossen@carrybee.com";

// DOM Elements
const loginPage = document.getElementById('loginPage');
const dashboardPage = document.getElementById('dashboardPage');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const adminEmailSpan = document.getElementById('adminEmail');
const adminRoleSpan = document.getElementById('adminRole');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const currentDateSpan = document.getElementById('currentDate');
const loginError = document.getElementById('loginError');
const loadingOverlay = document.getElementById('loadingOverlay');
const messageToast = document.getElementById('messageToast');
const toastMessage = document.getElementById('toastMessage');

// Menu Items
const menuItems = document.querySelectorAll('.menu-item');
const adminMenu = document.getElementById('adminMenu');
const zoneMenu = document.getElementById('zoneMenu');

// Section Elements
const sections = document.querySelectorAll('.section');

// Stats Elements
const totalZonesSpan = document.getElementById('totalZones');
const totalAdminsSpan = document.getElementById('totalAdmins');
const pendingRequestsSpan = document.getElementById('pendingRequests');
const todayUploadsSpan = document.getElementById('todayUploads');
const activityList = document.getElementById('activityList');

// Zone Management
const addZoneBtn = document.getElementById('addZoneBtn');
const zonesList = document.getElementById('zonesList');
const zoneModal = document.getElementById('zoneModal');
const closeZoneModal = document.getElementById('closeZoneModal');
const zoneForm = document.getElementById('zoneForm');
const zoneIdInput = document.getElementById('zoneId');
const zoneNameInput = document.getElementById('zoneName');
const zoneDescriptionInput = document.getElementById('zoneDescription');
const saveZoneBtn = document.getElementById('saveZoneBtn');
const cancelZoneBtn = document.getElementById('cancelZoneBtn');

// File Upload
const morningUploadForm = document.getElementById('morningUploadForm');
const finalUploadForm = document.getElementById('finalUploadForm');
const morningZoneSelect = document.getElementById('morningZoneSelect');
const finalZoneSelect = document.getElementById('finalZoneSelect');
const morningDateInput = document.getElementById('morningDate');
const finalDateInput = document.getElementById('finalDate');
const morningFileInput = document.getElementById('morningFile');
const finalFileInput = document.getElementById('finalFile');
const morningFileName = document.getElementById('morningFileName');
const finalFileName = document.getElementById('finalFileName');
const morningFileDrop = document.getElementById('morningFileDrop');
const finalFileDrop = document.getElementById('finalFileDrop');
const uploadsList = document.getElementById('uploadsList');

// Admin Management
const addAdminBtn = document.getElementById('addAdminBtn');
const addAdminForm = document.getElementById('addAdminForm');
const newAdminForm = document.getElementById('newAdminForm');
const adminEmailInput = document.getElementById('adminEmailInput');
const cancelAddAdmin = document.getElementById('cancelAddAdmin');
const adminsList = document.getElementById('adminsList');

// Visitor Requests
const visitorFilter = document.getElementById('visitorFilter');
const visitorsList = document.getElementById('visitorsList');

// Initialize Date
function initializeDate() {
    const today = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    const dateString = today.toLocaleDateString('bn-BD', options);
    if (currentDateSpan) {
        currentDateSpan.textContent = dateString;
    }
    
    // Set date inputs to today (and disable past dates)
    const todayString = today.toISOString().split('T')[0];
    
    if (morningDateInput) {
        morningDateInput.value = todayString;
        morningDateInput.min = todayString;
        morningDateInput.max = todayString;
    }
    
    if (finalDateInput) {
        finalDateInput.value = todayString;
        finalDateInput.min = todayString;
        finalDateInput.max = todayString;
    }
}

// Show Loading
function showLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    }
}

// Hide Loading
function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

// Show Toast Message
function showToast(message, type = 'success') {
    if (!messageToast || !toastMessage) return;
    
    const toastIcon = messageToast.querySelector('i');
    if (toastIcon) {
        toastIcon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
        toastIcon.style.color = type === 'success' ? '#28a745' : '#dc3545';
    }
    
    toastMessage.textContent = message;
    messageToast.classList.remove('hidden');
    messageToast.classList.add('show');
    
    setTimeout(() => {
        messageToast.classList.remove('show');
        setTimeout(() => {
            messageToast.classList.add('hidden');
        }, 300);
    }, 3000);
}

// Show Error Message
function showError(message) {
    if (!loginError) return;
    
    loginError.textContent = message;
    loginError.classList.add('show');
    
    setTimeout(() => {
        loginError.classList.remove('show');
    }, 5000);
}

// Check User Role and Create User Document
async function checkUserRole(user) {
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            userData = userDoc.data();
            return userData.role;
        } else {
            // First time login - determine role
            let role = 'visitor';
            
            if (user.email === MASTER_ADMIN_EMAIL) {
                role = 'master_admin';
            } else {
                // Check if user is in admin invites
                const adminInvite = await db.collection('admin_invites')
                    .where('email', '==', user.email)
                    .where('status', '==', 'pending')
                    .limit(1)
                    .get();
                
                if (!adminInvite.empty) {
                    role = 'regular_admin';
                    // Update invite status
                    await db.collection('admin_invites').doc(adminInvite.docs[0].id).update({
                        status: 'accepted',
                        acceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        userId: user.uid
                    });
                }
            }
            
            // Create user document
            userData = {
                email: user.email,
                role: role,
                status: role === 'visitor' ? 'pending' : 'active',
                name: user.displayName || user.email.split('@')[0],
                hub: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('users').doc(user.uid).set(userData);
            
            return role;
        }
    } catch (error) {
        console.error('Error checking user role:', error);
        return 'visitor';
    }
}

// Google Login
async function googleLogin() {
    try {
        showLoading();
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        
        const result = await auth.signInWithPopup(provider);
        
        const user = result.user;
        const role = await checkUserRole(user);
        
        currentUser = user;
        userRole = role;
        
        // Update last login time
        await db.collection('users').doc(user.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Show appropriate UI based on role
        updateUIForRole();
        
        // Switch to dashboard
        loginPage.classList.add('hidden');
        dashboardPage.classList.remove('hidden');
        
        // Initialize dashboard
        initializeDashboard();
        
        showToast('সফলভাবে লগইন হয়েছে!', 'success');
        
    } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/popup-blocked') {
            showError('পপআপ ব্লক করা আছে। দয়া করে পপআপ অনুমতি দিন।');
        } else if (error.code === 'auth/cancelled-popup-request') {
            showError('লগইন বাতিল করা হয়েছে।');
        } else {
            showError('লগইন ত্রুটি: ' + error.message);
        }
    } finally {
        hideLoading();
    }
}

// Logout
async function logout() {
    try {
        showLoading();
        await auth.signOut();
        currentUser = null;
        userRole = null;
        userData = null;
        
        dashboardPage.classList.add('hidden');
        loginPage.classList.remove('hidden');
        loginError.classList.remove('show');
        
        showToast('সফলভাবে লগআউট হয়েছে!', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showError('লগআউট ত্রুটি: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Update UI based on user role
function updateUIForRole() {
    if (!currentUser) return;
    
    if (adminEmailSpan) {
        adminEmailSpan.textContent = currentUser.email;
    }
    
    if (adminRoleSpan) {
        if (userRole === 'master_admin') {
            adminRoleSpan.textContent = 'মাস্টার অ্যাডমিন';
            adminRoleSpan.className = 'user-role master-admin';
            if (adminMenu) adminMenu.classList.remove('hidden');
            if (zoneMenu) zoneMenu.classList.remove('hidden');
        } else if (userRole === 'regular_admin') {
            adminRoleSpan.textContent = 'রেগুলার অ্যাডমিন';
            adminRoleSpan.className = 'user-role regular-admin';
            if (adminMenu) adminMenu.classList.add('hidden');
            if (zoneMenu) zoneMenu.classList.add('hidden');
        } else {
            adminRoleSpan.textContent = 'ভিজিটর';
            adminRoleSpan.className = 'user-role visitor';
            // Visitors shouldn't see admin dashboard
            logout();
            showError('আপনি অ্যাডমিন নন। ভিজিটর পেজে যান।');
            return;
        }
    }
}

// Initialize Dashboard
function initializeDashboard() {
    initializeDate();
    loadDashboardStats();
    loadZones();
    loadRecentActivities();
    loadRecentUploads();
    if (userRole === 'master_admin') {
        loadAdmins();
    }
    loadVisitorRequests();
    
    // Set up real-time listeners
    setupRealtimeListeners();
}

// Setup Real-time Listeners
function setupRealtimeListeners() {
    // Listen for zones changes
    db.collection('zones')
        .where('status', '==', 'active')
        .onSnapshot((snapshot) => {
            loadZones();
            loadDashboardStats();
        });
    
    // Listen for uploads changes
    db.collection('uploads')
        .orderBy('uploadedAt', 'desc')
        .limit(10)
        .onSnapshot((snapshot) => {
            loadRecentUploads();
            loadDashboardStats();
        });
    
    // Listen for user changes (for admins and visitors)
    db.collection('users')
        .onSnapshot((snapshot) => {
            loadDashboardStats();
            if (userRole === 'master_admin') {
                loadAdmins();
            }
            loadVisitorRequests(visitorFilter ? visitorFilter.value : 'all');
        });
}

// Load Dashboard Stats
async function loadDashboardStats() {
    try {
        // Total Zones
        const zonesSnapshot = await db.collection('zones')
            .where('status', '==', 'active')
            .get();
        if (totalZonesSpan) {
            totalZonesSpan.textContent = zonesSnapshot.size;
        }
        
        // Total Active Admins
        const adminsSnapshot = await db.collection('users')
            .where('role', 'in', ['master_admin', 'regular_admin'])
            .where('status', '==', 'active')
            .get();
        if (totalAdminsSpan) {
            totalAdminsSpan.textContent = adminsSnapshot.size;
        }
        
        // Pending Visitor Requests
        const pendingSnapshot = await db.collection('users')
            .where('role', '==', 'visitor')
            .where('status', '==', 'pending')
            .get();
        if (pendingRequestsSpan) {
            pendingRequestsSpan.textContent = pendingSnapshot.size;
        }
        
        // Today's Uploads
        const today = new Date().toISOString().split('T')[0];
        const uploadsSnapshot = await db.collection('uploads')
            .where('uploadDate', '==', today)
            .get();
        if (todayUploadsSpan) {
            todayUploadsSpan.textContent = uploadsSnapshot.size;
        }
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load Zones
async function loadZones() {
    try {
        const zonesSnapshot = await db.collection('zones')
            .where('status', '==', 'active')
            .orderBy('createdAt', 'desc')
            .get();
        
        if (zonesList) {
            zonesList.innerHTML = '';
            
            if (zonesSnapshot.empty) {
                zonesList.innerHTML = '<div class="empty-state">কোন Zone পাওয়া যায়নি</div>';
            } else {
                zonesSnapshot.forEach(doc => {
                    const zone = doc.data();
                    const zoneItem = createZoneItem(doc.id, zone);
                    zonesList.appendChild(zoneItem);
                });
            }
        }
        
        // Populate zone select for file upload
        populateZoneSelects(zonesSnapshot);
        
    } catch (error) {
        console.error('Error loading zones:', error);
    }
}

// Create Zone Item HTML
function createZoneItem(id, zone) {
    const div = document.createElement('div');
    div.className = 'zone-item';
    div.innerHTML = `
        <div class="zone-item-info">
            <div class="zone-name">${zone.name || 'No Name'}</div>
            ${zone.description ? `<div class="zone-desc">${zone.description}</div>` : ''}
            <div class="zone-meta">
                <small>আইডি: ${id.substring(0, 8)}...</small>
            </div>
        </div>
        ${userRole === 'master_admin' ? `
            <div class="zone-actions">
                <button class="action-btn edit-btn" onclick="editZone('${id}')">
                    <i class="fas fa-edit"></i> এডিট
                </button>
                <button class="action-btn delete-btn" onclick="deleteZone('${id}')">
                    <i class="fas fa-trash"></i> ডিলিট
                </button>
            </div>
        ` : ''}
    `;
    return div;
}

// Populate Zone Selects for File Upload
function populateZoneSelects(zonesSnapshot) {
    if (!morningZoneSelect || !finalZoneSelect) return;
    
    // Clear existing options except first
    while (morningZoneSelect.options.length > 1) {
        morningZoneSelect.remove(1);
    }
    while (finalZoneSelect.options.length > 1) {
        finalZoneSelect.remove(1);
    }
    
    if (zonesSnapshot && !zonesSnapshot.empty) {
        zonesSnapshot.forEach(doc => {
            const zone = doc.data();
            const option1 = document.createElement('option');
            option1.value = doc.id;
            option1.textContent = zone.name;
            morningZoneSelect.appendChild(option1.cloneNode(true));
            
            const option2 = option1.cloneNode(true);
            finalZoneSelect.appendChild(option2);
        });
    }
}

// Add/Edit Zone
async function saveZone(e) {
    e.preventDefault();
    
    const zoneId = zoneIdInput.value;
    const zoneName = zoneNameInput.value.trim();
    const zoneDescription = zoneDescriptionInput.value.trim();
    
    if (!zoneName) {
        showToast('দয়া করে Zone নাম দিন!', 'error');
        return;
    }
    
    const zoneData = {
        name: zoneName,
        description: zoneDescription,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        showLoading();
        
        if (zoneId) {
            // Update existing zone
            await db.collection('zones').doc(zoneId).update(zoneData);
            showToast('Zone সফলভাবে আপডেট হয়েছে!', 'success');
        } else {
            // Add new zone
            zoneData.createdBy = currentUser.uid;
            zoneData.createdByEmail = currentUser.email;
            zoneData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            zoneData.status = 'active';
            
            await db.collection('zones').add(zoneData);
            showToast('Zone সফলভাবে যোগ হয়েছে!', 'success');
        }
        
        closeZoneModal.click();
        zoneForm.reset();
        
    } catch (error) {
        console.error('Error saving zone:', error);
        showToast('Zone সংরক্ষণে ত্রুটি হয়েছে!', 'error');
    } finally {
        hideLoading();
    }
}

// Edit Zone
async function editZone(zoneId) {
    try {
        showLoading();
        const zoneDoc = await db.collection('zones').doc(zoneId).get();
        
        if (zoneDoc.exists) {
            const zone = zoneDoc.data();
            zoneIdInput.value = zoneId;
            zoneNameInput.value = zone.name || '';
            zoneDescriptionInput.value = zone.description || '';
            
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) {
                modalTitle.textContent = 'Zone এডিট করুন';
            }
            zoneModal.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error editing zone:', error);
        showToast('Zone লোড করতে ত্রুটি হয়েছে!', 'error');
    } finally {
        hideLoading();
    }
}

// Delete Zone
async function deleteZone(zoneId) {
    if (!confirm('আপনি কি এই Zone ডিলিট করতে চান?')) return;
    
    try {
        showLoading();
        await db.collection('zones').doc(zoneId).update({
            status: 'inactive',
            deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            deletedBy: currentUser.uid
        });
        
        showToast('Zone সফলভাবে ডিলিট হয়েছে!', 'success');
    } catch (error) {
        console.error('Error deleting zone:', error);
        showToast('Zone ডিলিট করতে ত্রুটি হয়েছে!', 'error');
    } finally {
        hideLoading();
    }
}

// File Upload Functions
async function uploadFile(e, fileType) {
    e.preventDefault();
    
    const form = e.target;
    const zoneSelect = fileType === 'morning' ? morningZoneSelect : finalZoneSelect;
    const dateInput = fileType === 'morning' ? morningDateInput : finalDateInput;
    const fileInput = fileType === 'morning' ? morningFileInput : finalFileInput;
    
    const zoneId = zoneSelect ? zoneSelect.value : '';
    const uploadDate = dateInput ? dateInput.value : '';
    const file = fileInput ? fileInput.files[0] : null;
    
    if (!zoneId) {
        showToast('দয়া করে Zone সিলেক্ট করুন!', 'error');
        return;
    }
    
    if (!file) {
        showToast('দয়া করে একটি ফাইল সিলেক্ট করুন!', 'error');
        return;
    }
    
    // Check if file is for today
    const today = new Date().toISOString().split('T')[0];
    if (uploadDate !== today) {
        showToast('শুধু আজকের তারিখের ফাইল আপলোড করা যাবে!', 'error');
        return;
    }
    
    // Check file type
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValidExtension) {
        showToast('শুধু CSV বা Excel ফাইল আপলোড করা যাবে! (csv, xlsx, xls)', 'error');
        return;
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showToast('ফাইল সাইজ 10MB এর বেশি হতে পারবে না!', 'error');
        return;
    }
    
    try {
        showLoading();
        
        // Get zone info
        const zoneDoc = await db.collection('zones').doc(zoneId).get();
        if (!zoneDoc.exists) {
            throw new Error('Zone পাওয়া যায়নি!');
        }
        
        const zone = zoneDoc.data();
        
        // Create unique filename
        const timestamp = Date.now();
        const uniqueFileName = `${fileType}_${zoneId}_${timestamp}_${file.name}`;
        
        // Upload file to Firebase Storage
        const storageRef = storage.ref();
        const fileRef = storageRef.child(`uploads/${zoneId}/${uploadDate}/${fileType}/${uniqueFileName}`);
        
        // Upload file
        await fileRef.put(file);
        
        // Get download URL
        const downloadURL = await fileRef.getDownloadURL();
        
        // Save upload record to Firestore
        await db.collection('uploads').add({
            fileName: file.name,
            originalName: file.name,
            uniqueFileName: uniqueFileName,
            fileType: fileType,
            zoneId: zoneId,
            zoneName: zone.name,
            uploadDate: uploadDate,
            uploadedBy: currentUser.uid,
            uploadedByEmail: currentUser.email,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
            fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            downloadURL: downloadURL,
            status: 'uploaded'
        });
        
        // Reset form
        form.reset();
        if (fileType === 'morning' && morningFileName) {
            morningFileName.classList.remove('show');
            morningFileName.textContent = '';
        } else if (fileType === 'final' && finalFileName) {
            finalFileName.classList.remove('show');
            finalFileName.textContent = '';
        }
        
        // Reset file input
        if (fileInput) {
            fileInput.value = '';
        }
        
        showToast(`${fileType === 'morning' ? 'মর্নিং' : 'ফাইনাল'} ফাইল সফলভাবে আপলোড হয়েছে!`, 'success');
        
    } catch (error) {
        console.error('Error uploading file:', error);
        showToast('ফাইল আপলোডে ত্রুটি হয়েছে: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Load Recent Uploads
async function loadRecentUploads() {
    try {
        const uploadsSnapshot = await db.collection('uploads')
            .orderBy('uploadedAt', 'desc')
            .limit(10)
            .get();
        
        if (uploadsList) {
            uploadsList.innerHTML = '';
            
            if (uploadsSnapshot.empty) {
                uploadsList.innerHTML = '<div class="empty-state">কোন আপলোড পাওয়া যায়নি</div>';
            } else {
                uploadsSnapshot.forEach(doc => {
                    const upload = doc.data();
                    const uploadItem = createUploadItem(doc.id, upload);
                    uploadsList.appendChild(uploadItem);
                });
            }
        }
        
    } catch (error) {
        console.error('Error loading uploads:', error);
    }
}

// Create Upload Item HTML
function createUploadItem(id, upload) {
    let uploadedAt = 'এখন';
    if (upload.uploadedAt && upload.uploadedAt.toDate) {
        const date = upload.uploadedAt.toDate();
        uploadedAt = date.toLocaleTimeString('bn-BD', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
        });
    }
    
    const div = document.createElement('div');
    div.className = 'upload-item';
    div.innerHTML = `
        <div class="upload-item-info">
            <div class="upload-name">
                <strong>${upload.fileType === 'morning' ? '☀️ মর্নিং' : '🏁 ফাইনাল'}</strong> - ${upload.zoneName || 'Zone'}
            </div>
            <div class="upload-details">
                ${upload.fileName} • ${upload.fileSize || '0 MB'} • ${uploadedAt}
            </div>
            <div class="upload-meta">
                <small>তারিখ: ${upload.uploadDate} • আপলোড করেছেন: ${upload.uploadedByEmail || currentUser.email}</small>
            </div>
        </div>
        <div class="upload-actions">
            ${upload.downloadURL ? `
                <a href="${upload.downloadURL}" target="_blank" class="action-btn" style="background: #667eea; color: white;">
                    <i class="fas fa-download"></i> ডাউনলোড
                </a>
            ` : ''}
        </div>
    `;
    return div;
}

// Load Recent Activities
async function loadRecentActivities() {
    try {
        // Get recent uploads for activities
        const uploadsSnapshot = await db.collection('uploads')
            .orderBy('uploadedAt', 'desc')
            .limit(5)
            .get();
        
        if (activityList) {
            activityList.innerHTML = '';
            
            if (uploadsSnapshot.empty) {
                activityList.innerHTML = '<div class="empty-state">কোন কার্যক্রম পাওয়া যায়নি</div>';
            } else {
                uploadsSnapshot.forEach(doc => {
                    const upload = doc.data();
                    const activityItem = createActivityItem(upload);
                    activityList.appendChild(activityItem);
                });
            }
        }
        
    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

// Create Activity Item HTML
function createActivityItem(upload) {
    let timeAgo = 'এখন';
    if (upload.uploadedAt && upload.uploadedAt.toDate) {
        const date = upload.uploadedAt.toDate();
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) timeAgo = 'এখন';
        else if (diffMins < 60) timeAgo = `${diffMins} মিনিট আগে`;
        else if (diffMins < 1440) timeAgo = `${Math.floor(diffMins / 60)} ঘন্টা আগে`;
        else timeAgo = `${Math.floor(diffMins / 1440)} দিন আগে`;
    }
    
    const div = document.createElement('div');
    div.className = 'activity-item';
    div.innerHTML = `
        <div class="activity-info">
            <div class="activity-text">
                <strong>${upload.uploadedByEmail || 'কেউ'}</strong> ${upload.fileType === 'morning' ? 'মর্নিং' : 'ফাইনাল'} ফাইল আপলোড করেছেন
            </div>
            <div class="activity-time">${timeAgo}</div>
        </div>
    `;
    return div;
}

// Admin Management Functions
async function loadAdmins() {
    if (userRole !== 'master_admin' || !adminsList) return;
    
    try {
        const adminsSnapshot = await db.collection('users')
            .where('role', 'in', ['master_admin', 'regular_admin'])
            .orderBy('createdAt', 'desc')
            .get();
        
        adminsList.innerHTML = '';
        
        if (adminsSnapshot.empty) {
            adminsList.innerHTML = '<div class="empty-state">কোন অ্যাডমিন পাওয়া যায়নি</div>';
        } else {
            adminsSnapshot.forEach(doc => {
                const admin = doc.data();
                const adminItem = createAdminItem(doc.id, admin);
                adminsList.appendChild(adminItem);
            });
        }
        
    } catch (error) {
        console.error('Error loading admins:', error);
    }
}

// Create Admin Item HTML
function createAdminItem(id, admin) {
    const isCurrentUser = currentUser && currentUser.email === admin.email;
    
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = `
        <div class="admin-item-info">
            <div class="admin-name">
                <strong>${admin.role === 'master_admin' ? '👑 মাস্টার' : '👨‍💼 রেগুলার'} অ্যাডমিন</strong>
            </div>
            <div class="admin-email">${admin.email}</div>
            <div class="admin-meta">
                <small>স্ট্যাটাস: </small>
                <span class="status-badge ${admin.status === 'active' ? 'status-approved' : 'status-blocked'}">
                    ${admin.status === 'active' ? 'সক্রিয়' : 'ব্লকড'}
                </span>
            </div>
        </div>
        ${!isCurrentUser ? `
            <div class="admin-actions">
                <button class="action-btn ${admin.status === 'active' ? 'block-btn' : 'approve-btn'}" 
                        onclick="toggleAdminStatus('${id}', '${admin.status === 'active' ? 'block' : 'activate'}')">
                    <i class="fas fa-${admin.status === 'active' ? 'ban' : 'check'}"></i>
                    ${admin.status === 'active' ? 'ব্লক' : 'আনব্লক'}
                </button>
            </div>
        ` : '<div style="padding: 10px;">(আপনি)</div>'}
    `;
    return div;
}

// Toggle Admin Status
async function toggleAdminStatus(adminId, action) {
    const confirmMessage = action === 'block' 
        ? 'আপনি কি এই অ্যাডমিনকে ব্লক করতে চান?' 
        : 'আপনি কি এই অ্যাডমিনকে আনব্লক করতে চান?';
    
    if (!confirm(confirmMessage)) return;
    
    try {
        showLoading();
        await db.collection('users').doc(adminId).update({
            status: action === 'block' ? 'blocked' : 'active',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.uid
        });
        
        showToast(`অ্যাডমিন সফলভাবে ${action === 'block' ? 'ব্লক' : 'আনব্লক'} হয়েছে!`, 'success');
        
    } catch (error) {
        console.error('Error toggling admin status:', error);
        showToast('অপারেশনে ত্রুটি হয়েছে!', 'error');
    } finally {
        hideLoading();
    }
}

// Add New Admin
async function addNewAdmin(e) {
    e.preventDefault();
    
    const email = adminEmailInput ? adminEmailInput.value.trim() : '';
    const role = document.querySelector('input[name="adminRole"]:checked') ? 
                 document.querySelector('input[name="adminRole"]:checked').value : 'regular_admin';
    
    if (!email) {
        showToast('দয়া করে জিমেইল এড্রেস দিন!', 'error');
        return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('দয়া করে সঠিক জিমেইল এড্রেস দিন!', 'error');
        return;
    }
    
    try {
        showLoading();
        
        // Check if user already exists
        const userQuery = await db.collection('users').where('email', '==', email).get();
        if (!userQuery.empty) {
            showToast('এই জিমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে!', 'error');
            hideLoading();
            return;
        }
        
        // Create admin invite
        await db.collection('admin_invites').add({
            email: email,
            role: role,
            invitedBy: currentUser.uid,
            invitedByEmail: currentUser.email,
            invitedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending'
        });
        
        // Reset form
        if (newAdminForm) newAdminForm.reset();
        if (addAdminForm) addAdminForm.classList.add('hidden');
        
        showToast(`অ্যাডমিন ইনভাইট ${email} ইমেইলে পাঠানো হয়েছে!`, 'success');
        
    } catch (error) {
        console.error('Error adding admin:', error);
        showToast('অ্যাডমিন যোগ করতে ত্রুটি হয়েছে: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Load Visitor Requests
async function loadVisitorRequests(filter = 'all') {
    try {
        let query = db.collection('users')
            .where('role', '==', 'visitor')
            .orderBy('createdAt', 'desc');
        
        if (filter !== 'all') {
            query = query.where('status', '==', filter);
        }
        
        const visitorsSnapshot = await query.get();
        
        if (visitorsList) {
            visitorsList.innerHTML = '';
            
            if (visitorsSnapshot.empty) {
                visitorsList.innerHTML = '<div class="empty-state">কোন ভিজিটর রিকোয়েস্ট পাওয়া যায়নি</div>';
            } else {
                visitorsSnapshot.forEach(doc => {
                    const visitor = doc.data();
                    const visitorItem = createVisitorItem(doc.id, visitor);
                    visitorsList.appendChild(visitorItem);
                });
            }
        }
        
    } catch (error) {
        console.error('Error loading visitors:', error);
    }
}

// Create Visitor Item HTML
function createVisitorItem(id, visitor) {
    let dateString = 'আজ';
    if (visitor.createdAt && visitor.createdAt.toDate) {
        const date = visitor.createdAt.toDate();
        dateString = date.toLocaleDateString('bn-BD');
    }
    
    const div = document.createElement('div');
    div.className = 'visitor-item';
    div.innerHTML = `
        <div class="visitor-item-info">
            <div class="visitor-name">
                <strong>${visitor.name || 'নাম নেই'}</strong>
            </div>
            <div class="visitor-email">${visitor.email}</div>
            <div class="visitor-details">
                ${visitor.hub ? `হাব: ${visitor.hub} • ` : ''}
                তারিখ: ${dateString}
            </div>
            <div class="visitor-meta">
                <small>স্ট্যাটাস: </small>
                <span class="status-badge ${visitor.status === 'approved' ? 'status-approved' : 
                                          visitor.status === 'rejected' ? 'status-rejected' : 
                                          visitor.status === 'blocked' ? 'status-blocked' : 'status-pending'}">
                    ${visitor.status === 'approved' ? 'অনুমোদিত' : 
                     visitor.status === 'rejected' ? 'প্রত্যাখ্যাত' : 
                     visitor.status === 'blocked' ? 'ব্লকড' : 'পেন্ডিং'}
                </span>
            </div>
        </div>
        <div class="visitor-actions">
            ${visitor.status === 'pending' ? `
                <button class="action-btn approve-btn" onclick="updateVisitorStatus('${id}', 'approved')">
                    <i class="fas fa-check"></i> অনুমোদন
                </button>
                <button class="action-btn reject-btn" onclick="updateVisitorStatus('${id}', 'rejected')">
                    <i class="fas fa-times"></i> প্রত্যাখ্যান
                </button>
            ` : visitor.status === 'approved' ? `
                <button class="action-btn block-btn" onclick="updateVisitorStatus('${id}', 'blocked')">
                    <i class="fas fa-ban"></i> ব্লক
                </button>
            ` : visitor.status === 'blocked' ? `
                <button class="action-btn approve-btn" onclick="updateVisitorStatus('${id}', 'approved')">
                    <i class="fas fa-check"></i> আনব্লক
                </button>
            ` : ''}
        </div>
    `;
    return div;
}

// Update Visitor Status
async function updateVisitorStatus(visitorId, status) {
    const confirmMessages = {
        'approved': 'আপনি কি এই ভিজিটরকে অনুমোদন করতে চান?',
        'rejected': 'আপনি কি এই ভিজিটরকে প্রত্যাখ্যান করতে চান?',
        'blocked': 'আপনি কি এই ভিজিটরকে ব্লক করতে চান?'
    };
    
    if (!confirm(confirmMessages[status] || 'আপনি কি নিশ্চিত?')) return;
    
    try {
        showLoading();
        await db.collection('users').doc(visitorId).update({
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            reviewedBy: currentUser.uid,
            reviewedByEmail: currentUser.email
        });
        
        showToast(`ভিজিটর সফলভাবে ${status === 'approved' ? 'অনুমোদিত' : 
                                           status === 'rejected' ? 'প্রত্যাখ্যাত' : 'ব্লকড'} হয়েছে!`, 'success');
        
    } catch (error) {
        console.error('Error updating visitor status:', error);
        showToast('অপারেশনে ত্রুটি হয়েছে!', 'error');
    } finally {
        hideLoading();
    }
}

// Initialize Database (First Time Setup)
async function initializeDatabase() {
    try {
        // Check if master admin exists
        const masterQuery = await db.collection('users')
            .where('email', '==', MASTER_ADMIN_EMAIL)
            .get();
        
        if (masterQuery.empty) {
            console.log('Master admin does not exist in database yet.');
            console.log('Please login with master admin email first.');
        }
        
        // Check if collections exist, create if not
        const collections = ['zones', 'uploads', 'admin_invites'];
        for (const collectionName of collections) {
            const snapshot = await db.collection(collectionName).limit(1).get();
            if (snapshot.empty) {
                console.log(`Collection '${collectionName}' is empty (this is normal for first time)`);
            }
        }
        
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // Initialize date
    initializeDate();
    
    // Check auth state
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('User logged in:', user.email);
            currentUser = user;
            userRole = await checkUserRole(user);
            
            updateUIForRole();
            
            if (userRole !== 'visitor') {
                loginPage.classList.add('hidden');
                dashboardPage.classList.remove('hidden');
                initializeDashboard();
                
                // Initialize database (first time setup)
                await initializeDatabase();
            }
        } else {
            console.log('No user logged in');
            currentUser = null;
            userRole = null;
            userData = null;
            loginPage.classList.remove('hidden');
            dashboardPage.classList.add('hidden');
        }
    });
    
    // Login button
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', googleLogin);
    }
    
    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Menu toggle for mobile
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }
    
    // Menu navigation
    if (menuItems.length > 0) {
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all items
                menuItems.forEach(i => i.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));
                
                // Add active class to clicked item
                item.classList.add('active');
                
                // Show corresponding section
                const section = item.getAttribute('data-section');
                const sectionElement = document.getElementById(`${section}Section`);
                if (sectionElement) {
                    sectionElement.classList.add('active');
                }
                
                // Close sidebar on mobile
                if (window.innerWidth <= 992) {
                    sidebar.classList.remove('show');
                }
            });
        });
    }
    
    // Zone Management
    if (addZoneBtn) {
        addZoneBtn.addEventListener('click', () => {
            zoneForm.reset();
            zoneIdInput.value = '';
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) {
                modalTitle.textContent = 'নতুন Zone যোগ করুন';
            }
            zoneModal.classList.remove('hidden');
        });
    }
    
    if (closeZoneModal) {
        closeZoneModal.addEventListener('click', () => {
            zoneModal.classList.add('hidden');
            zoneForm.reset();
        });
    }
    
    if (cancelZoneBtn) {
        cancelZoneBtn.addEventListener('click', () => {
            zoneModal.classList.add('hidden');
            zoneForm.reset();
        });
    }
    
    if (zoneForm) {
        zoneForm.addEventListener('submit', saveZone);
    }
    
    // File Upload
    if (morningUploadForm) {
        morningUploadForm.addEventListener('submit', (e) => uploadFile(e, 'morning'));
    }
    
    if (finalUploadForm) {
        finalUploadForm.addEventListener('submit', (e) => uploadFile(e, 'final'));
    }
    
    // File input handlers
    if (morningFileInput) {
        morningFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && morningFileName) {
                morningFileName.textContent = `ফাইল: ${file.name}`;
                morningFileName.classList.add('show');
            }
        });
    }
    
    if (finalFileInput) {
        finalFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && finalFileName) {
                finalFileName.textContent = `ফাইল: ${file.name}`;
                finalFileName.classList.add('show');
            }
        });
    }
    
    // Drag and drop for file upload
    if (morningFileDrop) {
        morningFileDrop.addEventListener('dragover', (e) => {
            e.preventDefault();
            morningFileDrop.style.borderColor = '#667eea';
            morningFileDrop.style.background = '#f0f7ff';
        });
        
        morningFileDrop.addEventListener('dragleave', () => {
            morningFileDrop.style.borderColor = '#ddd';
            morningFileDrop.style.background = '';
        });
        
        morningFileDrop.addEventListener('drop', (e) => {
            e.preventDefault();
            morningFileDrop.style.borderColor = '#ddd';
            morningFileDrop.style.background = '';
            
            const file = e.dataTransfer.files[0];
            if (file && morningFileInput) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                morningFileInput.files = dataTransfer.files;
                
                // Trigger change event
                morningFileInput.dispatchEvent(new Event('change'));
            }
        });
    }
    
    if (finalFileDrop) {
        finalFileDrop.addEventListener('dragover', (e) => {
            e.preventDefault();
            finalFileDrop.style.borderColor = '#667eea';
            finalFileDrop.style.background = '#f0f7ff';
        });
        
        finalFileDrop.addEventListener('dragleave', () => {
            finalFileDrop.style.borderColor = '#ddd';
            finalFileDrop.style.background = '';
        });
        
        finalFileDrop.addEventListener('drop', (e) => {
            e.preventDefault();
            finalFileDrop.style.borderColor = '#ddd';
            finalFileDrop.style.background = '';
            
            const file = e.dataTransfer.files[0];
            if (file && finalFileInput) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                finalFileInput.files = dataTransfer.files;
                
                // Trigger change event
                finalFileInput.dispatchEvent(new Event('change'));
            }
        });
    }
    
    // Admin Management
    if (addAdminBtn) {
        addAdminBtn.addEventListener('click', () => {
            if (addAdminForm) {
                addAdminForm.classList.remove('hidden');
            }
        });
    }
    
    if (cancelAddAdmin) {
        cancelAddAdmin.addEventListener('click', () => {
            if (addAdminForm) {
                addAdminForm.classList.add('hidden');
            }
            if (newAdminForm) {
                newAdminForm.reset();
            }
        });
    }
    
    if (newAdminForm) {
        newAdminForm.addEventListener('submit', addNewAdmin);
    }
    
    // Visitor Requests Filter
    if (visitorFilter) {
        visitorFilter.addEventListener('change', (e) => {
            loadVisitorRequests(e.target.value);
        });
    }
    
    // Close modals on outside click
    window.addEventListener('click', (e) => {
        if (e.target === zoneModal) {
            zoneModal.classList.add('hidden');
            zoneForm.reset();
        }
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 992 && sidebar && sidebar.classList.contains('show')) {
            if (!sidebar.contains(e.target) && e.target !== menuToggle) {
                sidebar.classList.remove('show');
            }
        }
    });
}

// Make functions globally available for onclick handlers
window.editZone = editZone;
window.deleteZone = deleteZone;
window.toggleAdminStatus = toggleAdminStatus;
window.updateVisitorStatus = updateVisitorStatus;

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    console.log('Admin Panel Initialized');
    
    // Check if Firebase is properly initialized
    if (!firebase.apps.length) {
        console.error('Firebase not initialized!');
        showError('Firebase initialization failed. Please check console.');
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    // Clean up if needed
});
