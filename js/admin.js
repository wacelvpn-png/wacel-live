import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    updateDoc,
    writeBatch,
    onSnapshot
} from './firebase-config.js';

// === متغيرات عامة ===
let allChannels = [];
let stats = {
    total: 0,
    healthy: 0,
    broken: 0,
    fixed: 0
};
let logs = [];

// === دوال السجلات والإحصائيات ===
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    logs.push({ message: logEntry, type });
    
    const logContainer = document.getElementById('logContainer');
    if (logContainer) {
        const logElement = document.createElement('div');
        logElement.className = type;
        logElement.textContent = logEntry;
        logContainer.appendChild(logElement);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function updateStats() {
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-healthy').textContent = stats.healthy;
    document.getElementById('stat-broken').textContent = stats.broken;
    document.getElementById('stat-fixed').textContent = stats.fixed;
}

function resetStats() {
    stats = { total: 0, healthy: 0, broken: 0, fixed: 0 };
    updateStats();
}

// === دوال التحقق من الصحة ===
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function validateChannel(channelData) {
    const issues = [];
    
    // التحقق من الحقول الأساسية
    if (!channelData.name && !channelData.اسم) {
        issues.push('اسم القناة مفقود');
    }
    
    if (!channelData.url && !channelData['عنوان URL'] && !channelData.رابط) {
        issues.push('رابط البث مفقود');
    }
    
    if (!channelData.logo && !channelData.الشعار) {
        issues.push('شعار القناة مفقود');
    }
    
    if (!channelData.category && !channelData.فئة) {
        issues.push('فئة القناة مفقود');
    }
    
    // التحقق من صحة الروابط
    const logoUrl = channelData.logo || channelData.الشعار;
    if (logoUrl && !isValidUrl(logoUrl)) {
        issues.push('رابط الشعار غير صالح');
    }
    
    const streamUrl = channelData.url || channelData['عنوان URL'] || channelData.رابط;
    if (streamUrl && !isValidUrl(streamUrl)) {
        issues.push('رابط البث غير صالح');
    }
    
    return issues;
}

function fixChannelData(channelData) {
    const changes = {};
    
    // تحويل الحقول العربية إلى إنجليزية
    const fieldMap = {
        'اسم': 'name',
        'الشعار': 'logo', 
        'عنوان URL': 'url',
        'رابط': 'url',
        'فئة': 'category'
    };
    
    for (const [arabicField, englishField] of Object.entries(fieldMap)) {
        if (channelData[arabicField] !== undefined) {
            changes[englishField] = channelData[arabicField];
        }
    }
    
    // تعيين القيم الافتراضية للحقول المفقودة
    const finalData = {
        ...channelData,
        ...changes
    };
    
    if (!finalData.name && !finalData.اسم) {
        changes.name = 'قناة بدون اسم';
    }
    
    if (!finalData.category && !finalData.فئة) {
        changes.category = 'عام';
    }
    
    if (!finalData.logo && !finalData.الشعار) {
        changes.logo = 'https://via.placeholder.com/150x80/007bff/ffffff?text=TV+Channel';
    }
    
    if (!finalData.url && !finalData['عنوان URL'] && !finalData.رابط) {
        changes.url = 'https://example.com/stream.m3u8';
    }
    
    return changes;
}

// === دوال أداة الإصلاح ===
async function scanDatabase() {
    resetStats();
    addLog('بدء فحص قاعدة البيانات...', 'info');
    
    try {
        const querySnapshot = await getDocs(collection(db, "channels"));
        stats.total = querySnapshot.size;
        
        addLog(`تم العثور على ${stats.total} قناة`, 'info');
        
        let healthyCount = 0;
        let brokenCount = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const issues = validateChannel(data);
            
            if (issues.length === 0) {
                healthyCount++;
            } else {
                brokenCount++;
                addLog(`❌ قناة تالفة: ${data.name || data.اسم || 'بدون اسم'} - ${issues.join(', ')}`, 'error');
            }
        });

        stats.healthy = healthyCount;
        stats.broken = brokenCount;
        updateStats();
        
        addLog(`اكتمل الفحص: ${healthyCount} سليمة, ${brokenCount} تالفة`, 'info');
        
    } catch (error) {
        addLog(`❌ خطأ في الفحص: ${error.message}`, 'error');
    }
}

async function fixAllChannels() {
    addLog('بدء إصلاح جميع القنوات...', 'info');
    
    try {
        const querySnapshot = await getDocs(collection(db, "channels"));
        const batch = writeBatch(db);
        let fixedCount = 0;
        
        for (const doc of querySnapshot.docs) {
            const fixedData = fixChannelData(doc.data());
            
            if (Object.keys(fixedData).length > 0) {
                batch.update(doc.ref, fixedData);
                fixedCount++;
                addLog(`🔧 تم إصلاح: ${doc.data().name || doc.data().اسم || 'بدون اسم'}`, 'success');
            }
        }
        
        if (fixedCount > 0) {
            await batch.commit();
            stats.fixed = fixedCount;
            updateStats();
            addLog(`✅ تم إصلاح ${fixedCount} قناة بنجاح`, 'success');
            
            // إعادة تحميل القائمة
            loadChannelsList();
        } else {
            addLog('✅ جميع القنوات سليمة - لا حاجة للإصلاح', 'info');
        }
        
    } catch (error) {
        addLog(`❌ خطأ في الإصلاح: ${error.message}`, 'error');
    }
}

async function deleteBrokenChannels() {
    if (!confirm('⚠️ هل أنت متأكد من حذف جميع القنوات التالفة؟')) {
        return;
    }
    
    addLog('بدء حذف القنوات التالفة...', 'warning');
    
    try {
        const querySnapshot = await getDocs(collection(db, "channels"));
        let deletedCount = 0;
        
        for (const doc of querySnapshot.docs) {
            const issues = validateChannel(doc.data());
            if (issues.length > 0) {
                await deleteDoc(doc.ref);
                deletedCount++;
                addLog(`🗑️ تم حذف: ${doc.data().name || doc.data().اسم || 'بدون اسم'}`, 'warning');
            }
        }
        
        addLog(`✅ تم حذف ${deletedCount} قناة تالفة`, 'success');
        loadChannelsList();
        
    } catch (error) {
        addLog(`❌ خطأ في الحذف: ${error.message}`, 'error');
    }
}

async function deleteAllChannels() {
    if (!confirm('💀 هل أنت متأكد من حذف جميع القنوات؟ هذا الإجراء لا يمكن التراجع عنه!')) {
        return;
    }
    
    addLog('بدء حذف جميع القنوات...', 'error');
    
    try {
        const querySnapshot = await getDocs(collection(db, "channels"));
        let deletedCount = 0;
        
        for (const doc of querySnapshot.docs) {
            await deleteDoc(doc.ref);
            deletedCount++;
            addLog(`🗑️ تم حذف: ${doc.data().name || doc.data().اسم || 'بدون اسم'}`, 'warning');
        }
        
        addLog(`✅ تم حذف ${deletedCount} قناة`, 'success');
        loadChannelsList();
        
    } catch (error) {
        addLog(`❌ خطأ في الحذف: ${error.message}`, 'error');
    }
}

async function addSampleChannels() {
    const sampleChannels = [
        {
            name: "قناة الأخبار",
            logo: "https://via.placeholder.com/150x80/007bff/ffffff?text=News",
            url: "https://example.com/news.m3u8",
            category: "أخبار",
            createdAt: new Date()
        },
        {
            name: "قناة الرياضة",
            logo: "https://via.placeholder.com/150x80/28a745/ffffff?text=Sports", 
            url: "https://example.com/sports.m3u8",
            category: "رياضة",
            createdAt: new Date()
        },
        {
            name: "قناة الأفلام",
            logo: "https://via.placeholder.com/150x80/dc3545/ffffff?text=Movies",
            url: "https://example.com/movies.m3u8", 
            category: "ترفيه",
            createdAt: new Date()
        }
    ];
    
    addLog('إضافة قنوات تجريبية...', 'info');
    
    try {
        for (const channel of sampleChannels) {
            await addDoc(collection(db, "channels"), channel);
            addLog(`➕ تم إضافة: ${channel.name}`, 'success');
        }
        addLog('✅ اكتملت إضافة القنوات التجريبية', 'success');
        loadChannelsList();
        
    } catch (error) {
        addLog(`❌ خطأ في الإضافة: ${error.message}`, 'error');
    }
}

function clearLog() {
    const logContainer = document.getElementById('logContainer');
    if (logContainer) {
        logContainer.innerHTML = '=== تم مسح السجلات ===';
    }
    logs = [];
}

// === دوال إدارة القنوات ===
document.getElementById('channel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('channel-name').value;
    const logo = document.getElementById('channel-logo').value;
    const url = document.getElementById('channel-url').value;
    const category = document.getElementById('channel-category').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الإضافة...';
        
        const docRef = await addDoc(collection(db, "channels"), {
            name: name,
            logo: logo,
            url: url,
            category: category,
            createdAt: new Date()
        });

        addLog(`✅ تم إضافة القناة: ${name}`, 'success');
        
        alert('تمت إضافة القناة بنجاح!');
        document.getElementById('channel-form').reset();
        loadChannelsList();
        
    } catch (error) {
        addLog(`❌ خطأ في إضافة القناة: ${error.message}`, 'error');
        alert('حدث خطأ أثناء إضافة القناة: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

async function loadChannelsList() {
    const channelsList = document.getElementById('channels-list');
    const channelsCount = document.getElementById('channels-count');
    
    channelsList.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><p class="mt-2">جاري تحميل القنوات...</p></div>';

    try {
        const querySnapshot = await getDocs(collection(db, "channels"));
        allChannels = [];
        
        querySnapshot.forEach((doc) => {
            allChannels.push({
                id: doc.id,
                ...doc.data()
            });
        });

        channelsCount.textContent = allChannels.length;
        displayChannels(allChannels);
        updateQuickStats();
        
    } catch (error) {
        console.error("Error loading channels: ", error);
        channelsList.innerHTML = `
            <div class="alert alert-danger">
                <p class="text-center">حدث خطأ في تحميل القنوات</p>
                <p class="text-center small">${error.message}</p>
            </div>
        `;
    }
}

function displayChannels(channels) {
    const channelsList = document.getElementById('channels-list');
    
    if (channels.length === 0) {
        channelsList.innerHTML = `
            <div class="text-center text-muted py-4">
                <h5>لا توجد قنوات مضافة</h5>
                <p>استخدم النموذج على اليسار لإضافة قنوات جديدة</p>
            </div>
        `;
        return;
    }

    let channelsHTML = '';
    
    channels.forEach((channel) => {
        const channelName = channel.name || channel.اسم || 'بدون اسم';
        const channelLogo = channel.logo || channel.الشعار || 'https://via.placeholder.com/50x50?text=No+Image';
        const channelCategory = channel.category || channel.فئة || 'عام';
        const channelUrl = channel.url || channel['عنوان URL'] || channel.رابط || '#';
        
        // التحقق من صحة القناة
        const issues = validateChannel(channel);
        const isBroken = issues.length > 0;
        
        channelsHTML += `
            <div class="card mb-3 channel-card ${isBroken ? 'border-warning' : ''}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="d-flex align-items-center">
                            <img src="${channelLogo}" alt="${channelName}" 
                                 style="width: 50px; height: 50px; object-fit: contain;"
                                 onerror="this.src='https://via.placeholder.com/50x50?text=No+Image'">
                            <div class="ms-3">
                                <h6 class="mb-1">${channelName}</h6>
                                <span class="badge bg-secondary">${channelCategory}</span>
                                ${isBroken ? '<span class="badge bg-warning ms-1">تالفة</span>' : ''}
                                <br>
                                <small class="text-muted">${channelUrl.substring(0, 50)}...</small>
                            </div>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" onclick="editChannel('${channel.id}')">
                                ✏️ تعديل
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteChannel('${channel.id}', '${channelName}')">
                                🗑️ حذف
                            </button>
                        </div>
                    </div>
                    ${isBroken ? `
                    <div class="mt-2 p-2 bg-warning bg-opacity-10 rounded">
                        <small class="text-warning">
                            <strong>المشاكل:</strong> ${issues.join(', ')}
                        </small>
                        <button class="btn btn-sm btn-warning ms-2" onclick="fixSingleChannel('${channel.id}')">
                            إصلاح
                        </button>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    });

    channelsList.innerHTML = channelsHTML;
}

// البحث في القنوات
document.getElementById('search-channels').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    if (searchTerm === '') {
        displayChannels(allChannels);
        return;
    }
    
    const filteredChannels = allChannels.filter(channel => {
        const name = (channel.name || channel.اسم || '').toLowerCase();
        const category = (channel.category || channel.فئة || '').toLowerCase();
        return name.includes(searchTerm) || category.includes(searchTerm);
    });
    
    displayChannels(filteredChannels);
});

async function deleteChannel(channelId, channelName) {
    if (!confirm(`هل أنت متأكد من حذف القناة "${channelName}"؟`)) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, "channels", channelId));
        addLog(`🗑️ تم حذف القناة: ${channelName}`, 'warning');
        loadChannelsList();
    } catch (error) {
        addLog(`❌ خطأ في حذف القناة: ${error.message}`, 'error');
        alert('حدث خطأ أثناء حذف القناة: ' + error.message);
    }
}

async function editChannel(channelId) {
    const channel = allChannels.find(c => c.id === channelId);
    if (!channel) return;
    
    document.getElementById('edit-channel-id').value = channelId;
    document.getElementById('edit-channel-name').value = channel.name || channel.اسم || '';
    document.getElementById('edit-channel-logo').value = channel.logo || channel.الشعار || '';
    document.getElementById('edit-channel-url').value = channel.url || channel['عنوان URL'] || channel.رابط || '';
    document.getElementById('edit-channel-category').value = channel.category || channel.فئة || '';
    
    const modal = new bootstrap.Modal(document.getElementById('editChannelModal'));
    modal.show();
}

async function updateChannel() {
    const channelId = document.getElementById('edit-channel-id').value;
    const name = document.getElementById('edit-channel-name').value;
    const logo = document.getElementById('edit-channel-logo').value;
    const url = document.getElementById('edit-channel-url').value;
    const category = document.getElementById('edit-channel-category').value;
    
    try {
        await updateDoc(doc(db, "channels", channelId), {
            name: name,
            logo: logo,
            url: url,
            category: category
        });
        
        addLog(`✏️ تم تحديث القناة: ${name}`, 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('editChannelModal'));
        modal.hide();
        
        loadChannelsList();
        
    } catch (error) {
        addLog(`❌ خطأ في تحديث القناة: ${error.message}`, 'error');
        alert('حدث خطأ أثناء تحديث القناة: ' + error.message);
    }
}

async function fixSingleChannel(channelId) {
    const channel = allChannels.find(c => c.id === channelId);
    if (!channel) return;
    
    try {
        const fixedData = fixChannelData(channel);
        
        if (Object.keys(fixedData).length > 0) {
            await updateDoc(doc(db, "channels", channelId), fixedData);
            addLog(`🔧 تم إصلاح القناة: ${channel.name || channel.اسم || 'بدون اسم'}`, 'success');
            loadChannelsList();
        } else {
            addLog(`ℹ️ لا حاجة لإصلاح القناة: ${channel.name || channel.اسم || 'بدون اسم'}`, 'info');
        }
        
    } catch (error) {
        addLog(`❌ خطأ في إصلاح القناة: ${error.message}`, 'error');
    }
}

function updateQuickStats() {
    const quickStats = document.getElementById('quick-stats');
    
    const categories = {};
    allChannels.forEach(channel => {
        const category = channel.category || channel.فئة || 'غير مصنف';
        categories[category] = (categories[category] || 0) + 1;
    });
    
    let statsHTML = '';
    for (const [category, count] of Object.entries(categories)) {
        statsHTML += `
            <div class="d-flex justify-content-between border-bottom py-1">
                <span>${category}</span>
                <span class="badge bg-primary">${count}</span>
            </div>
        `;
    }
    
    statsHTML += `
        <div class="d-flex justify-content-between mt-2 pt-2 border-top">
            <strong>المجموع</strong>
            <strong class="text-primary">${allChannels.length}</strong>
        </div>
    `;
    
    quickStats.innerHTML = statsHTML;
}

// === التهيئة ===
document.addEventListener('DOMContentLoaded', function() {
    addLog('نظام إدارة القنوات جاهز', 'success');
    loadChannelsList();
    scanDatabase(); // فحص تلقائي عند التحميل
});

// جعل الدوال متاحة عالمياً
window.scanDatabase = scanDatabase;
window.fixAllChannels = fixAllChannels;
window.deleteBrokenChannels = deleteBrokenChannels;
window.deleteAllChannels = deleteAllChannels;
window.addSampleChannels = addSampleChannels;
window.clearLog = clearLog;
window.loadChannelsList = loadChannelsList;
window.editChannel = editChannel;
window.deleteChannel = deleteChannel;
window.updateChannel = updateChannel;
window.fixSingleChannel = fixSingleChannel;
