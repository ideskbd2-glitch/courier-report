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
const userAvatar = document.getElementById('userAvatar');
const tabsContainer = document.getElementById('tabsContainer');

// Initialize Master Admin
async function initializeMasterAdmin(masterEmail) {
    const userRef = db.collection('users').doc(masterEmail);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
        await userRef.set({
            email: masterEmail,
            role: 'master-admin',
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}

// Show/Hide Tabs based on user role
function setupTabs(role) {
    tabsContainer.innerHTML = '';
    
    if (role === 'master-admin') {
        tabsContainer.innerHTML = `
            <button class="tab-btn active" onclick="switchTab('addAdminTab')">Add Admin</button>
            <button class="tab-btn" onclick="switchTab('adminListTab')">Admin List</button>
            <button class="tab-btn" onclick="switchTab('visitorRequestsTab')">Visitor Requests</button>
            <button class="tab-btn" onclick="switchTab('fileUploadTab')">File Upload</button>
        `;
        switchTab('addAdminTab');
    } else if (role === 'admin') {
        tabsContainer.innerHTML = `
            <button class="tab-btn active" onclick="switchTab('fileUploadTab')">File Upload</button>
        `;
        switchTab('fileUploadTab');
    } else if (role === 'visitor') {
        tabsContainer.innerHTML = `
            <button class="tab-btn active" onclick="switchTab('visitorPage')">Dashboard</button>
        `;
        switchTab('visitorPage');
    }
}

// Switch between tabs
function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const tab = document.getElementById(tabId);
    if (tab) {
        tab.style.display = 'block';
        tab.classList.add('active');
    }
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    // Load data if needed
    if (tabId === 'adminListTab') loadAdmins();
    if (tabId === 'visitorRequestsTab') loadVisitorRequests();
}

// Add new admin
document.getElementById('addAdminBtn').addEventListener('click', async () => {
    const email = document.getElementById('adminEmail').value.trim();
    const messageDiv = document.getElementById('addAdminMessage');
    
    if (!email) {
        showMessage(messageDiv, 'Please enter an email address', 'error');
        return;
    }
    
    try {
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
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showMessage(messageDiv, 'Admin added successfully!', 'success');
        document.getElementById('adminEmail').value = '';
        loadAdmins();
    } catch (error) {
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
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td class="${user.isActive ? 'status-active' : 'status-blocked'}">
                    ${user.isActive ? 'Active' : 'Blocked'}
                </td>
                <td>
                    ${user.role !== 'master-admin' ? 
                        `<button class="action-btn ${user.isActive ? 'block-btn' : 'unblock-btn'}" 
                                onclick="toggleAdminStatus('${user.email}', ${!user.isActive})">
                            ${user.isActive ? 'Block' : 'Unblock'}
                        </button>` 
                        : 'Master Admin'
                    }
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
            isActive: newStatus
        });
        loadAdmins();
    } catch (error) {
        console.error('Error updating admin status:', error);
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
                <td>${user.email}</td>
                <td>${user.name || 'N/A'}</td>
                <td>${user.hubName || 'N/A'}</td>
                <td class="${user.isActive ? 'status-active' : user.isActive === false ? 'status-blocked' : 'status-pending'}">
                    ${user.isActive === true ? 'Approved' : user.isActive === false ? 'Blocked' : 'Pending'}
                </td>
                <td>${date}</td>
                <td>
                    ${user.isActive === undefined ? 
                        `<button class="action-btn approve-btn" onclick="approveVisitor('${user.email}')">Approve</button>` : ''
                    }
                    <button class="action-btn ${user.isActive ? 'block-btn' : 'unblock-btn'}" 
                            onclick="toggleVisitorStatus('${user.email}', ${!user.isActive})">
                        ${user.isActive ? 'Block' : 'Unblock'}
                    </button>
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
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        loadVisitorRequests();
    } catch (error) {
        console.error('Error approving visitor:', error);
    }
}

// Toggle visitor status
async function toggleVisitorStatus(email, newStatus) {
    try {
        await db.collection('users').doc(email).update({
            isActive: newStatus
        });
        loadVisitorRequests();
    } catch (error) {
        console.error('Error updating visitor status:', error);
    }
}

// File upload handlers
document.getElementById('morningFile').addEventListener('change', function(e) {
    if (e.target.files[0]) {
        const file = e.target.files[0];
        const isValid = validateFile(file);
        
        if (isValid) {
            document.getElementById('morningFileInfo').textContent = 
                `Selected file: ${file.name} (${formatFileSize(file.size)})`;
            document.getElementById('morningFileInfo').className = 'file-info';
        } else {
            document.getElementById('morningFileInfo').textContent = 
                'Invalid file type. Please select .csv, .xlsx or .xls file';
            document.getElementById('morningFileInfo').className = 'file-info error';
            e.target.value = '';
        }
    }
});

document.getElementById('finalFile').addEventListener('change', function(e) {
    if (e.target.files[0]) {
        const file = e.target.files[0];
        const isValid = validateFile(file);
        
        if (isValid) {
            document.getElementById('finalFileInfo').textContent = 
                `Selected file: ${file.name} (${formatFileSize(file.size)})`;
            document.getElementById('finalFileInfo').className = 'file-info';
        } else {
            document.getElementById('finalFileInfo').textContent = 
                'Invalid file type. Please select .csv, .xlsx or .xls file';
            document.getElementById('finalFileInfo').className = 'file-info error';
            e.target.value = '';
        }
    }
});

// Validate file type
function validateFile(file) {
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    return validTypes.some(type => fileName.endsWith(type));
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
    const fileInput = document.getElementById('morningFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a morning file first');
        return;
    }
    
    await uploadFile(file, 'morning');
});

// Upload Final File
document.getElementById('uploadFinalBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('finalFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a final file first');
        return;
    }
    
    await uploadFile(file, 'final');
});

// Upload file to Firebase Storage
async function uploadFile(file, type) {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const timestamp = new Date().getTime();
        const fileName = `${type}_${timestamp}_${file.name}`;
        const storageRef = storage.ref(`${type}_files/${fileName}`);
        
        // Show uploading message
        const message = type === 'morning' ? 
            document.getElementById('morningFileInfo') : 
            document.getElementById('finalFileInfo');
        message.textContent = 'Uploading...';
        message.className = 'file-info info';
        
        // Upload file
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        
        // Save file info to Firestore
        await db.collection('uploads').add({
            fileName: file.name,
            storagePath: fileName,
            downloadURL: downloadURL,
            type: type,
            uploadedBy: user.email,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
            size: file.size
        });
        
        // Show success message
        message.textContent = `${type} file uploaded successfully!`;
        message.className = 'file-info success';
        
        // Clear file input
        if (type === 'morning') {
            document.getElementById('morningFile').value = '';
        } else {
            document.getElementById('finalFile').value = '';
        }
        
    } catch (error) {
        console.error('Error uploading file:', error);
        const message = type === 'morning' ? 
            document.getElementById('morningFileInfo') : 
            document.getElementById('finalFileInfo');
        message.textContent = 'Upload failed: ' + error.message;
        message.className = 'file-info error';
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
        await db.collection('users').doc(email).set({
            email: email,
            name: name,
            hubName: hubName,
            role: 'visitor',
            isActive: null, // Pending approval
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showMessage(messageDiv, 'Registration submitted! Waiting for admin approval.', 'success');
        
        // Wait 2 seconds and reload to check status
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        showMessage(messageDiv, 'Error submitting registration: ' + error.message, 'error');
    }
});

// Show message
function showMessage(element, text, type) {
    element.textContent = text;
    element.className = `message ${type}`;
    element.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

// Google Login
googleLoginBtn.addEventListener('click', async () => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        
        // Initialize master admin on first login
        if (result.user.email === 'ebadot.hossen@carrybee.com') {
            await initializeMasterAdmin(result.user.email);
        }
        
    } catch (error) {
        showMessage(document.getElementById('errorMessage'), error.message, 'error');
    }
});

// Check auth state
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in
        const userDoc = await db.collection('users').doc(user.email).get();
        
        if (!userDoc.exists) {
            // First time visitor - show registration
            loginPage.style.display = 'none';
            adminPage.style.display = 'block';
            document.getElementById('registrationTab').style.display = 'block';
            document.getElementById('regEmail').value = user.email;
            setupTabs('visitor');
            return;
        }
        
        const userData = userDoc.data();
        
        // Check if user is active
        if (userData.isActive === false) {
            // User is blocked
            showMessage(document.getElementById('errorMessage'), 'Your account is blocked. Contact administrator.', 'error');
            await auth.signOut();
            return;
        }
        
        // Set user info
        userEmail.textContent = user.email;
        userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
        
        // Show appropriate page
        loginPage.style.display = 'none';
        adminPage.style.display = 'block';
        
        // Setup tabs based on role
        setupTabs(userData.role);
        
        // If visitor is pending approval
        if (userData.role === 'visitor' && userData.isActive === null) {
            document.getElementById('visitorPage').innerHTML = `
                <h2>⏳ Waiting for Approval</h2>
                <p>Your registration is pending approval from admin.</p>
                <p>You will be notified once approved.</p>
            `;
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
        loginPage.style.display = 'block';
        adminPage.style.display = 'none';
    });
});
