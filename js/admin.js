import { db, collection, addDoc, getDocs, deleteDoc, doc } from './firebase-config.js';

// إضافة قناة جديدة
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
        
        console.log("محاولة إضافة قناة:", { name, logo, url, category });
        
        const docRef = await addDoc(collection(db, "channels"), {
            name: name,
            logo: logo,
            url: url,
            category: category,
            createdAt: new Date()
        });

        console.log("تم إضافة القناة بنجاح مع ID:", docRef.id);
        
        alert('تمت إضافة القناة بنجاح!');
        document.getElementById('channel-form').reset();
        loadChannelsList();
        
    } catch (error) {
        console.error("Error adding channel: ", error);
        alert('حدث خطأ أثناء إضافة القناة: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// تحميل وعرض قائمة القنوات
async function loadChannelsList() {
    const channelsList = document.getElementById('channels-list');
    channelsList.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><p class="mt-2">جاري تحميل القنوات...</p></div>';

    try {
        console.log("جاري تحميل قائمة القنوات...");
        
        const querySnapshot = await getDocs(collection(db, "channels"));
        console.log("عدد القنوات في قاعدة البيانات:", querySnapshot.size);
        
        channelsList.innerHTML = '';

        if (querySnapshot.empty) {
            channelsList.innerHTML = '<p class="text-center text-muted">لا توجد قنوات مضافة</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const channel = doc.data();
            const channelItem = `
                <div class="channel-item border-bottom py-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <img src="${channel.logo}" alt="${channel.name}" 
                                 style="width: 50px; height: 50px; object-fit: contain;"
                                 onerror="this.src='https://via.placeholder.com/50?text=No+Image'">
                            <div class="ms-3">
                                <strong>${channel.name}</strong>
                                <br>
                                <small class="text-muted">${channel.category}</small>
                            </div>
                        </div>
                        <button class="btn btn-danger btn-sm delete-btn" data-id="${doc.id}">حذف</button>
                    </div>
                </div>
            `;
            channelsList.innerHTML += channelItem;
        });

        // إضافة مستمعي الأحداث لأزرار الحذف
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const channelId = this.getAttribute('data-id');
                if (confirm('هل أنت متأكد من حذف هذه القناة؟')) {
                    try {
                        await deleteDoc(doc(db, "channels", channelId));
                        console.log("تم حذف القناة:", channelId);
                        loadChannelsList();
                    } catch (error) {
                        console.error("Error deleting channel: ", error);
                        alert('حدث خطأ أثناء حذف القناة: ' + error.message);
                    }
                }
            });
        });

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

// تحميل القنوات عند فتح الصفحة
document.addEventListener('DOMContentLoaded', loadChannelsList);
