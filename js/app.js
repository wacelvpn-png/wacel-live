import { db, collection, getDocs, onSnapshot } from './firebase-config.js';

// دالة مساعدة لاستخراج البيانات بغض النظر عن لغة الحقول
function getChannelData(docData) {
    return {
        name: docData.name || docData.اسم || 'بدون اسم',
        logo: docData.logo || docData.الشعار || 'https://via.placeholder.com/150?text=No+Image',
        url: docData.url || docData['عنوان URL'] || docData.رابط || '#',
        category: docData.category || docData.فئة || 'عام'
    };
}

// تحميل وعرض القنوات
async function loadChannels() {
    const channelsContainer = document.getElementById('channels-container');
    channelsContainer.innerHTML = '<div class="col-12 text-center"><div class="spinner-border" role="status"></div><p class="mt-2">جاري تحميل القنوات...</p></div>';

    try {
        console.log("بدء تحميل القنوات...");
        
        const querySnapshot = await getDocs(collection(db, "channels"));
        console.log("تم الحصول على البيانات:", querySnapshot.size, "قناة");
        
        // عرض البيانات الخام للت debug
        querySnapshot.forEach((doc) => {
            console.log("بيانات القناة الخام:", doc.id, doc.data());
        });
        
        channelsContainer.innerHTML = '';

        if (querySnapshot.empty) {
            channelsContainer.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        <h5>لا توجد قنوات متاحة</h5>
                        <p>قم بإضافة قنوات من لوحة التحكم</p>
                    </div>
                </div>
            `;
            return;
        }

        querySnapshot.forEach((doc) => {
            const rawData = doc.data();
            const channel = getChannelData(rawData);
            
            console.log("عرض القناة بعد المعالجة:", channel);
            
            const channelCard = `
                <div class="col-md-3 mb-4">
                    <div class="card channel-card h-100">
                        <img src="${channel.logo}" class="card-img-top" alt="${channel.name}" 
                             style="height: 150px; object-fit: contain; padding: 10px;"
                             onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
                        <div class="card-body text-center">
                            <h5 class="card-title">${channel.name}</h5>
                            <p class="card-text text-muted">${channel.category}</p>
                            <button class="btn btn-primary watch-btn" data-url="${channel.url}" data-name="${channel.name}">
                                مشاهدة
                            </button>
                        </div>
                    </div>
                </div>
            `;
            channelsContainer.innerHTML += channelCard;
        });

        // إضافة مستمعي الأحداث لأزرار المشاهدة
        document.querySelectorAll('.watch-btn').forEach(button => {
            button.addEventListener('click', function() {
                const videoUrl = this.getAttribute('data-url');
                const channelName = this.getAttribute('data-name');
                playVideo(videoUrl, channelName);
            });
        });

    } catch (error) {
        console.error("Error loading channels: ", error);
        channelsContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-danger">
                    <h5>حدث خطأ في تحميل القنوات</h5>
                    <p>${error.message}</p>
                    <button onclick="loadChannels()" class="btn btn-warning">إعادة المحاولة</button>
                </div>
            </div>
        `;
    }
}

// الباقي بدون تغيير...
function playVideo(url, title) {
    const videoPlayer = document.getElementById('videoPlayer');
    const videoModalTitle = document.getElementById('videoModalTitle');
    
    console.log("تشغيل القناة:", title, "الرابط:", url);
    
    videoPlayer.src = url;
    videoModalTitle.textContent = title;
    
    const videoModal = new bootstrap.Modal(document.getElementById('videoModal'));
    videoModal.show();
    
    videoPlayer.load();
}

// تحديث تلقائي للقنوات
function setupRealtimeUpdates() {
    onSnapshot(collection(db, "channels"), (snapshot) => {
        console.log("تحديث تلقائي للقنوات");
        loadChannels();
    });
}

document.addEventListener('DOMContentLoaded', function() {
    loadChannels();
    setupRealtimeUpdates();
});

window.loadChannels = loadChannels;
window.playVideo = playVideo;
