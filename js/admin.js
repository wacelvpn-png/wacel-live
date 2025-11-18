import { db, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from './firebase-config.js';

// إضافة قناة جديدة
document.getElementById('channel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('channel-name').value;
    const logo = document.getElementById('channel-logo').value;
    const url = document.getElementById('channel-url').value;
    const category = document.getElementById('channel-category').value;

    try {
        await addDoc(collection(db, "channels"), {
            name: name,
            logo: logo,
            url: url,
            category: category,
            createdAt: new Date()
        });

        alert('تمت إضافة القناة بنجاح!');
        document.getElementById('channel-form').reset();
        loadChannelsList();
    } catch (error) {
        console.error("Error adding channel: ", error);
        alert('حدث خطأ أثناء إضافة القناة');
    }
});

// تحميل وعرض قائمة القنوات
async function loadChannelsList() {
    const channelsList = document.getElementById('channels-list');
    channelsList.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';

    try {
        const querySnapshot = await getDocs(collection(db, "channels"));
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
                        <div>
                            <img src="${channel.logo}" alt="${channel.name}" style="width: 50px; height: 50px; object-fit: contain;">
                            <span class="ms-2">${channel.name}</span>
                            <small class="text-muted ms-2">(${channel.category})</small>
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
                        loadChannelsList();
                    } catch (error) {
                        console.error("Error deleting channel: ", error);
                        alert('حدث خطأ أثناء حذف القناة');
                    }
                }
            });
        });

    } catch (error) {
        console.error("Error loading channels: ", error);
        channelsList.innerHTML = '<p class="text-center text-danger">حدث خطأ في تحميل القنوات</p>';
    }
}

// تحميل القنوات عند فتح الصفحة
document.addEventListener('DOMContentLoaded', loadChannelsList);
