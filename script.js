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
const loginScreen = document.getElementById('loginScreen');
const adminDashboard = document.getElementById('adminDashboard');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');
const userRole = document.getElementById('userRole');
const addAdminSection = document.getElementById('addAdminSection');
const addAdminForm = document.getElementById('addAdminForm');
const adminListSection = document.getElementById('adminListSection');
const adminListContainer = document.getElementById('adminListContainer');
const visitorModal = document.getElementById('visitorModal');
const visitorForm = document.getElementById('visitorForm');

// Constants
const MASTER_ADMIN_EMAIL = "ebadot.hossen@carrybee.com";

// Current User Data
let currentUser = null;
let currentUserData = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await checkUserRegistration(user);
        } else {
            showLoginScreen();
        }
    });

    // Login Form Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            alert(`Login failed: ${error.message}`);
        }
    });

    // Logout Button
    logoutBtn.addEventListener('click', () => {
        auth.signOut();
    });

    // Add Admin Form
    addAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const adminEmail = document.getElementById('adminEmail').value;
        
        try {
            // Add admin to Firestore
            await db.collection('admins').doc(adminEmail).set({
                email: adminEmail,
                role: 'regular',
                createdBy: currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            });
            
            alert('Admin added successfully!');
            addAdminForm.reset();
            loadAdminList();
        } catch (error) {
            alert(`Failed to add admin: ${error.message}`);
        }
    });

    // Visitor Registration Form
    visitorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('visitorName').value;
        const hub = document.getElementById('hubName').value;

        try {
            // Add visitor request to Firestore
            await db.collection('visitorRequests').add({
                email: currentUser.email,
                name: name,
                hub: hub,
                status: 'pending',
                requestedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert('Registration request submitted! Please wait for admin approval.');
            visitorModal.classList.add('hidden');
            // Sign out visitor to wait for approval
            auth.signOut();
        } catch (error) {
            alert(`Failed to submit request: ${error.message}`);
        }
    });
});

// Check User Registration
async function checkUserRegistration(user) {
    try {
        // Check if user is admin
        const adminDoc = await db.collection('admins').doc(user.email).get();
        
        if (adminDoc.exists) {
            // User is admin
            currentUserData = adminDoc.data();
            await showAdminDashboard();
            return;
        }

        // Check if user is approved visitor
        const visitorQuery = await db.collection('visitors')
            .where('email', '==', user.email)
            .where('status', '==', 'approved')
            .get();

        if (!visitorQuery.empty) {
            // Show visitor dashboard
            showVisitorDashboard();
            return;
        }

        // Check if visitor request is pending
        const requestQuery = await db.collection('visitorRequests')
            .where('email', '==', user.email)
            .where('status', '==', 'pending')
            .get();

        if (!requestQuery.empty) {
            alert('Your registration request is pending approval. Please wait for admin approval.');
            auth.signOut();
            return;
        }

        // First-time visitor - show registration form
        showVisitorRegistrationForm(user.email);

    } catch (error) {
        console.error('Error checking registration:', error);
        alert('Error checking user registration. Please try again.');
    }
}

// Show Admin Dashboard
async function showAdminDashboard() {
    loginScreen.classList.remove('active');
    adminDashboard.classList.add('active');
    loginScreen.classList.add('hidden');
    adminDashboard.classList.remove('hidden');

    // Update user info
    userEmail.textContent = currentUser.email;
    userRole.textContent = currentUserData.role === 'master' ? 'Master Admin' : 'Regular Admin';

    // Show/hide master admin features
    if (currentUser.email === MASTER_ADMIN_EMAIL || currentUserData.role === 'master') {
        addAdminSection.classList.remove('hidden');
        adminListSection.classList.remove('hidden');
    }

    // Load data
    await loadZones();
    await loadAdminList();
    await loadVisitorRequests();
    await loadUploadHistory();

    // Setup file upload forms
    setupFileUpload();
}

// Show Visitor Dashboard
function showVisitorDashboard() {
    // Redirect to visitor page or show visitor content
    alert('Welcome to Visitor Dashboard! This page would show zone reports.');
    // For now, sign out
    auth.signOut();
}

// Show Visitor Registration Form
function showVisitorRegistrationForm(email) {
    document.getElementById('visitorEmail').value = email;
    visitorModal.classList.remove('hidden');
}

// Show Login Screen
function showLoginScreen() {
    loginScreen.classList.add('active');
    adminDashboard.classList.remove('active');
    loginScreen.classList.remove('hidden');
    adminDashboard.classList.add('hidden');
    loginForm.reset();
}

// Load Zones
async function loadZones() {
    try {
        const zonesSnapshot = await db.collection('zones').orderBy('name').get();
        const zonesContainer = document.getElementById('zonesContainer');
        const morningZoneSelect = document.getElementById('morningZone');
        const finalZoneSelect = document.getElementById('finalZone');

        zonesContainer.innerHTML = '';
        morningZoneSelect.innerHTML = '<option value="">Select a zone</option>';
        finalZoneSelect.innerHTML = '<option value="">Select a zone</option>';

        zonesSnapshot.forEach(doc => {
            const zone = doc.data();
            
            // Add to zone list
            const zoneElement = document.createElement('div');
            zoneElement.className = 'zone-item';
            zoneElement.innerHTML = `
                <div class="zone-info">
                    <h4>${zone.name}</h4>
                    <p>Code: ${zone.code}</p>
                </div>
                <div class="zone-actions">
                    <button onclick="editZone('${doc.id}', '${zone.name}', '${zone.code}')" 
                            class="btn btn-small btn-secondary">Edit</button>
                    <button onclick="deleteZone('${doc.id}')" 
                            class="btn btn-small btn-danger">Delete</button>
                </div>
            `;
            zonesContainer.appendChild(zoneElement);

            // Add to dropdowns
            const option = `<option value="${doc.id}">${zone.name} (${zone.code})</option>`;
            morningZoneSelect.innerHTML += option;
            finalZoneSelect.innerHTML += option;
        });

        // Setup zone form
        setupZoneForm();
    } catch (error) {
        console.error('Error loading zones:', error);
    }
}

// Setup Zone Form
function setupZoneForm() {
    const zoneForm = document.getElementById('zoneForm');
    let editingZoneId = null;

    zoneForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('zoneName').value;
        const code = document.getElementById('zoneCode').value;

        try {
            if (editingZoneId) {
                // Update existing zone
                await db.collection('zones').doc(editingZoneId).update({
                    name: name,
                    code: code,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                editingZoneId = null;
            } else {
                // Add new zone
                await db.collection('zones').add({
                    name: name,
                    code: code,
                    createdBy: currentUser.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            zoneForm.reset();
            loadZones();
        } catch (error) {
            alert(`Error saving zone: ${error.message}`);
        }
    };
}

// Edit Zone
window.editZone = function(zoneId, name, code) {
    document.getElementById('zoneName').value = name;
    document.getElementById('zoneCode').value = code;
    document.querySelector('#zoneForm button').textContent = 'Update Zone';
    editingZoneId = zoneId;
};

// Delete Zone
window.deleteZone = async function(zoneId) {
    if (!confirm('Are you sure you want to delete this zone?')) return;

    try {
        await db.collection('zones').doc(zoneId).delete();
        loadZones();
    } catch (error) {
        alert(`Error deleting zone: ${error.message}`);
    }
};

// Load Admin List
async function loadAdminList() {
    if (currentUser.email !== MASTER_ADMIN_EMAIL && currentUserData.role !== 'master') return;

    try {
        const adminsSnapshot = await db.collection('admins').get();
        adminListContainer.innerHTML = '';

        adminsSnapshot.forEach(doc => {
            const admin = doc.data();
            const adminElement = document.createElement('div');
            adminElement.className = 'admin-item';
            adminElement.innerHTML = `
                <div class="admin-info">
                    <h4>${admin.email}</h4>
                    <p>Role: ${admin.role} | Created: ${admin.createdAt?.toDate().toLocaleDateString()}</p>
                </div>
                <div class="admin-status">
                    <span class="status-badge ${admin.status === 'active' ? 'status-active' : 'status-inactive'}">
                        ${admin.status}
                    </span>
                    <button onclick="toggleAdminStatus('${doc.id}', '${admin.status}')" 
                            class="btn btn-small ${admin.status === 'active' ? 'btn-danger' : 'btn-secondary'}">
                        ${admin.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            `;
            adminListContainer.appendChild(adminElement);
        });
    } catch (error) {
        console.error('Error loading admin list:', error);
    }
}

// Toggle Admin Status
window.toggleAdminStatus = async function(adminId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    try {
        await db.collection('admins').doc(adminId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        loadAdminList();
    } catch (error) {
        alert(`Error updating admin status: ${error.message}`);
    }
};

// Load Visitor Requests
async function loadVisitorRequests() {
    try {
        const requestsSnapshot = await db.collection('visitorRequests')
            .where('status', '==', 'pending')
            .orderBy('requestedAt', 'desc')
            .get();

        const container = document.getElementById('visitorRequestsContainer');
        container.innerHTML = '';

        if (requestsSnapshot.empty) {
            container.innerHTML = '<p>No pending requests</p>';
            return;
        }

        requestsSnapshot.forEach(doc => {
            const request = doc.data();
            const requestElement = document.createElement('div');
            requestElement.className = 'visitor-request';
            requestElement.innerHTML = `
                <div class="visitor-info">
                    <h4>${request.name}</h4>
                    <p>Email: ${request.email}</p>
                    <p>Hub: ${request.hub}</p>
                    <p>Requested: ${request.requestedAt.toDate().toLocaleString()}</p>
                </div>
                <div class="visitor-actions">
                    <button onclick="approveVisitorRequest('${doc.id}', '${request.email}', '${request.name}', '${request.hub}')" 
                            class="btn btn-small btn-primary">Approve</button>
                    <button onclick="rejectVisitorRequest('${doc.id}')" 
                            class="btn btn-small btn-danger">Reject</button>
                </div>
            `;
            container.appendChild(requestElement);
        });
    } catch (error) {
        console.error('Error loading visitor requests:', error);
    }
}

// Approve Visitor Request
window.approveVisitorRequest = async function(requestId, email, name, hub) {
    try {
        // Update request status
        await db.collection('visitorRequests').doc(requestId).update({
            status: 'approved',
            approvedBy: currentUser.email,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Add to approved visitors
        await db.collection('visitors').add({
            email: email,
            name: name,
            hub: hub,
            approvedBy: currentUser.email,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        });

        loadVisitorRequests();
    } catch (error) {
        alert(`Error approving request: ${error.message}`);
    }
};

// Reject Visitor Request
window.rejectVisitorRequest = async function(requestId) {
    try {
        await db.collection('visitorRequests').doc(requestId).update({
            status: 'rejected',
            rejectedBy: currentUser.email,
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        loadVisitorRequests();
    } catch (error) {
        alert(`Error rejecting request: ${error.message}`);
    }
};

// Setup File Upload
function setupFileUpload() {
    // Morning file upload
    document.getElementById('morningUploadForm').onsubmit = async (e) => {
        e.preventDefault();
        await uploadFile('morning', e.target);
    };

    // Final file upload
    document.getElementById('finalUploadForm').onsubmit = async (e) => {
        e.preventDefault();
        await uploadFile('final', e.target);
    };
}

// Upload File
async function uploadFile(type, form) {
    const zoneId = form.querySelector('select').value;
    const fileInput = form.querySelector('input[type="file"]');
    const file = fileInput.files[0];

    if (!zoneId) {
        alert('Please select a zone');
        return;
    }

    if (!file) {
        alert('Please select a file');
        return;
    }

    try {
        // Get zone info
        const zoneDoc = await db.collection('zones').doc(zoneId).get();
        const zone = zoneDoc.data();

        // Create storage reference
        const timestamp = Date.now();
        const fileName = `${type}_${zone.code}_${timestamp}_${file.name}`;
        const storageRef = storage.ref(`reports/${zoneId}/${fileName}`);

        // Upload file
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();

        // Save upload record
        await db.collection('uploads').add({
            type: type,
            zoneId: zoneId,
            zoneName: zone.name,
            zoneCode: zone.code,
            fileName: fileName,
            originalName: file.name,
            fileSize: file.size,
            fileType: file.type,
            downloadURL: downloadURL,
            uploadedBy: currentUser.email,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('File uploaded successfully!');
        form.reset();
        loadUploadHistory();
    } catch (error) {
        alert(`Error uploading file: ${error.message}`);
    }
}

// Load Upload History
async function loadUploadHistory() {
    try {
        const uploadsSnapshot = await db.collection('uploads')
            .orderBy('uploadedAt', 'desc')
            .limit(10)
            .get();

        const container = document.getElementById('uploadsContainer');
        container.innerHTML = '';

        if (uploadsSnapshot.empty) {
            container.innerHTML = '<p>No uploads yet</p>';
            return;
        }

        uploadsSnapshot.forEach(doc => {
            const upload = doc.data();
            const uploadElement = document.createElement('div');
            uploadElement.className = 'upload-item';
            uploadElement.innerHTML = `
                <div class="upload-info">
                    <h4>${upload.type === 'morning' ? 'Morning File' : 'Final File'}</h4>
                    <p>Zone: ${upload.zoneName} (${upload.zoneCode})</p>
                    <p>File: ${upload.originalName}</p>
                    <p>Uploaded: ${upload.uploadedAt.toDate().toLocaleString()}</p>
                </div>
                <div>
                    <a href="${upload.downloadURL}" target="_blank" class="btn btn-small btn-secondary">Download</a>
                </div>
            `;
            container.appendChild(uploadElement);
        });
    } catch (error) {
        console.error('Error loading upload history:', error);
    }
}
