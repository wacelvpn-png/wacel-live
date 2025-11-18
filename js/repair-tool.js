import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    updateDoc,
    writeBatch
} from './firebase-config.js';

// إحصائيات
let stats = {
    total: 0,
    fixed: 0,
    broken: 0,
    deleted: 0
};

// سجلات النظام
let logs = [];

// وظيفة إضافة سجل
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    logs.push({ message: logEntry, type });
    
    const logContainer = document.getElementById('logContainer');
    const logElement = document.createElement('div');
    logElement.className = type;
    logElement.textContent = logEntry;
    logContainer.appendChild(logElement);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// وظيفة تحديث الإحصائيات
function updateStats() {
    document.getElementById('total-channels').textContent = stats.total;
    document.getElementById('fixed-channels').textContent = stats.fixed;
    document.getElementById('broken-channels').textContent = stats.broken;
    document.getElementById('deleted-channels').textContent = stats.deleted;
}

// إعادة تعيين الإحصائيات
function resetStats() {
    stats = { total: 0, fixed: 0, broken: 0, deleted: 0 };
    updateStats();
}

// اختبار اتصال Firebase
async function testFirebaseConnection() {
    addLog('بدء اختبار اتصال Firebase...', 'info');
    
    try {
        const querySnapshot = await getDocs(collection(db, "channels"));
        addLog(`✅ اتصال Firebase ناجح - تم العثور على ${querySnapshot.size} قناة`, 'success');
        return true;
    } catch (error) {
        addLog(`❌ فشل اختبار الاتصال: ${error.message}`, 'error');
        return false;
    }
}

// فحص جميع القنوات
async function scanDatabase() {
    resetStats();
    addLog('بدء فحص قاعدة البيانات...', 'info');
    
    try {
        const querySnapshot = await getDocs(collection(db, "channels"));
        stats.total = querySnapshot.size;
        
        addLog(`تم العثور على ${stats.total} قناة`, 'info');
        
        const resultsContainer = document.getElementById('scanResults');
        resultsContainer.innerHTML = '';
        
        if (querySnapshot.empty) {
            addLog('❌ لا توجد قنوات في قاعدة البيانات', 'warning');
            resultsContainer.innerHTML = '<div class="alert alert-warning">لا توجد قنوات في قاعدة البيانات</div>';
            return;
        }

        let healthyCount = 0;
        let brokenCount = 0;
        const brokenChannels = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const issues = validateChannel(data);
            
            if (issues.length === 0) {
                healthyCount++;
                addLog(`✅ قناة سليمة: ${data.name || data.اسم || 'بدون اسم'}`, 'success');
            } else {
                brokenCount++;
                stats.broken++;
                brokenChannels.push({ id: doc.id, data, issues });
                
                addLog(`❌ قناة تالفة: ${data.name || data.اسم || 'بدون اسم'} - المشاكل: ${issues.join(', ')}`, 'error');
            }
        });

        // عرض النتائج
        let resultsHTML = `
            <div class="alert alert-success">
                <h6>القنوات السليمة: ${healthyCount}</h6>
            </div>
        `;

        if (brokenCount > 0) {
            resultsHTML += `
                <div class="alert alert-danger">
                    <h6>القنوات التالفة: ${brokenCount}</h6>
                </div>
                <div class="mt-3">
                    <h6>تفاصيل القنوات التالفة:</h6>
            `;
            
            brokenChannels.forEach(channel => {
                resultsHTML += `
                    <div class="card mb-2">
                        <div class="card-body">
                            <h6>${channel.data.name || channel.data.اسم || 'بدون اسم'}</h6>
                            <p class="text-danger">المشاكل: ${channel.issues.join(', ')}</p>
                            <button class="btn btn-sm btn-warning" onclick="fixSingleChannel('${channel.id}')">إصلاح هذه القناة</button>
                        </div>
                    </div>
                `;
            });
            
            resultsHTML += `</div>`;
        }

        resultsContainer.innerHTML = resultsHTML;
        updateStats();
        addLog(`اكتمل الفحص: ${healthyCount} سليمة, ${brokenCount} تالفة`, 'info');

    } catch (error) {
        addLog(`❌ خطأ في الفحص: ${error.message}`, 'error');
    }
}

// التحقق من صحة القناة
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

// التحقق من صحة الرابط
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// إصلاح جميع القنوات تلقائياً
async function fixAllChannels() {
    resetStats();
    addLog('بدء إصلاح جميع القنوات...', 'info');
    
    try {
        const querySnapshot = await getDocs(collection(db, "channels"));
        stats.total = querySnapshot.size;
        
        addLog(`جاري إصلاح ${stats.total} قناة...`, 'info');
        
        const batch = writeBatch(db);
        let fixedCount = 0;
        
        for (const doc of querySnapshot.docs) {
            const fixedData = fixChannelData(doc.data());
            
            // إذا كانت هناك تغييرات، قم بتحديث المستند
            if (Object.keys(fixedData.changes).length > 0) {
                batch.update(doc.ref, fixedData.changes);
                fixedCount++;
                addLog(`🔧 تم إصلاح: ${fixedData.name}`, 'success');
            }
        }
        
        if (fixedCount > 0) {
            await batch.commit();
            stats.fixed = fixedCount;
            addLog(`✅ تم إصلاح ${fixedCount} قناة بنجاح`, 'success');
        } else {
            addLog('✅ جميع القنوات سليمة - لا حاجة للإصلاح', 'info');
        }
        
        updateStats();
        
    } catch (error) {
        addLog(`❌ خطأ في الإصلاح: ${error.message}`, 'error');
    }
}

// إصلاح بيانات قناة واحدة
function fixChannelData(channelData) {
    const changes = {};
    const fieldMap = {
        'اسم': 'name',
        'الشعار': 'logo', 
        'عنوان URL': 'url',
        'رابط': 'url',
        'فئة': 'category'
    };
    
    // نسخ البيانات الأصلية
    const fixedData = { ...channelData };
    
    // تحويل الحقول العربية إلى إنجليزية
    for (const [arabicField, englishField] of Object.entries(fieldMap)) {
        if (channelData[arabicField] !== undefined) {
            changes[englishField] = channelData[arabicField];
            fixedData[englishField] = channelData[arabicField];
            // لا نحذف الحقول العربية للحفاظ على التوافق
        }
    }
    
    // تعيين القيم الافتراضية للحقول المفقودة
    if (!fixedData.name && !fixedData.اسم) {
        changes.name = 'قناة بدون اسم';
        fixedData.name = 'قناة بدون اسم';
    }
    
    if (!fixedData.category && !fixedData.فئة) {
        changes.category = 'عام';
        fixedData.category = 'عام';
    }
    
    if (!fixedData.logo && !fixedData.الشعار) {
        changes.logo = 'https://via.placeholder.com/150x80/007bff/ffffff?text=TV+Channel';
        fixedData.logo = 'https://via.placeholder.com/150x80/007bff/ffffff?text=TV+Channel';
    }
    
    if (!fixedData.url && !fixedData['عنوان URL'] && !fixedData.رابط) {
        changes.url = 'https://example.com/stream.m3u8';
        fixedData.url = 'https://example.com/stream.m3u8';
    }
    
    return {
        ...fixedData,
        name: fixedData.name || fixedData.اسم,
        changes: changes
    };
}

// إصلاح قناة واحدة
async function fixSingleChannel(channelId) {
    try {
        const docRef = doc(db, "channels", channelId);
        const channelDoc = await getDocs(collection(db, "channels"));
        const channelData = channelDoc.docs.find(d => d.id === channelId)?.data();
        
        if (!channelData) {
            addLog(`❌ لم أتمكن من العثور على القناة ${channelId}`, 'error');
            return;
        }
        
        const fixedData = fixChannelData(channelData);
        
        if (Object.keys(fixedData.changes).length > 0) {
            await updateDoc(docRef, fixedData.changes);
            addLog(`✅ تم إصلاح القناة: ${fixedData.name}`, 'success');
            stats.fixed++;
            updateStats();
        } else {
            addLog(`ℹ️ لا حاجة لإصلاح القناة: ${fixedData.name}`, 'info');
        }
        
    } catch (error) {
        addLog(`❌ خطأ في إصلاح القناة: ${error.message}`, 'error');
    }
}

// حذف القنوات التالفة فقط
async function deleteBrokenChannels() {
    if (!confirm('⚠️ هل أنت متأكد من حذف جميع القنوات التالفة؟ لا يمكن التراجع عن هذا الإجراء!')) {
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
                addLog(`🗑️ تم حذف قناة تالفة: ${doc.data().name || doc.data().اسم || 'بدون اسم'}`, 'warning');
            }
        }
        
        stats.deleted = deletedCount;
        updateStats();
        addLog(`✅ تم حذف ${deletedCount} قناة تالفة`, 'success');
        
    } catch (error) {
        addLog(`❌ خطأ في الحذف: ${error.message}`, 'error');
    }
}

// حذف جميع القنوات
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
        
        stats.deleted = deletedCount;
        updateStats();
        addLog(`✅ تم حذف ${deletedCount} قناة`, 'success');
        
    } catch (error) {
        addLog(`❌ خطأ في الحذف: ${error.message}`, 'error');
    }
}

// إضافة قنوات تجريبية
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
    } catch (error) {
        addLog(`❌ خطأ في الإضافة: ${error.message}`, 'error');
    }
}

// إضافة قنوات مختلطة (للفحص)
async function addMixedChannels() {
    const mixedChannels = [
        // قنوات سليمة
        {
            name: "قناة سليمة ١",
            logo: "https://via.placeholder.com/150x80/007bff/ffffff?text=Good1",
            url: "https://example.com/stream1.m3u8",
            category: "أخبار",
            createdAt: new Date()
        },
        // قنوات تالفة
        {
            اسم: "قناة تالفة ١",
            الشعار: "https://via.placeholder.com/150x80/ff0000/ffffff?text=Bad1", 
            'عنوان URL': "https://example.com/bad1.m3u8",
            فئة: "رياضة",
            createdAt: new Date()
        },
        {
            name: "قناة تالفة ٢",
            logo: "invalid-url",
            url: "also-invalid",
            category: "ترفيه", 
            createdAt: new Date()
        }
    ];
    
    addLog('إضافة قنوات مختلطة للفحص...', 'info');
    
    try {
        for (const channel of mixedChannels) {
            await addDoc(collection(db, "channels"), channel);
            addLog(`➕ تم إضافة قناة مختلطة`, 'success');
        }
        addLog('✅ اكتملت إضافة القنوات المختلطة', 'success');
    } catch (error) {
        addLog(`❌ خطأ في الإضافة: ${error.message}`, 'error');
    }
}

// مسح السجلات
function clearLog() {
    const logContainer = document.getElementById('logContainer');
    logContainer.innerHTML = '=== تم مسح السجلات ===';
    logs = [];
}

// جعل الدوال متاحة عالمياً
window.scanDatabase = scanDatabase;
window.testFirebaseConnection = testFirebaseConnection;
window.fixAllChannels = fixAllChannels;
window.fixSingleChannel = fixSingleChannel;
window.deleteBrokenChannels = deleteBrokenChannels;
window.deleteAllChannels = deleteAllChannels;
window.addSampleChannels = addSampleChannels;
window.addMixedChannels = addMixedChannels;
window.clearLog = clearLog;

// التشغيل التلقائي عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    addLog('نظام الإصلاح جاهز للاستخدام', 'success');
    testFirebaseConnection();
});
