import { db, collection, getDocs, onSnapshot } from './firebase-config.js';

// تحميل وعرض القنوات
async function loadChannels() {
    const channelsContainer = document.getElementById('channels-container');
    channelsContainer.innerHTML = '<div class="col-12 text-center"><div class="spinner-border" role="status"></div><p class="mt-2">جاري تحميل القنوات...</p></div>';

    try {
        console.log("بدء تحميل القنوات...");
        
        const querySnapshot = await getDocs(collection(db, "channels"));
        console.log("تم الحصول على البيانات:", querySnapshot.size, "قناة");
        
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
            const channel = doc.data();
            console.log("عرض القناة:", channel.name);
            
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

// تشغيل الفيديو في المودال
function playVideo(url, title) {
    const videoPlayer = document.getElementById('videoPlayer');
    const videoModalTitle = document.getElementById('videoModalTitle');
    
    console.log("تشغيل القناة:", title, "الرابط:", url);
    
    videoPlayer.src = url;
    videoModalTitle.textContent = title;
    
    const videoModal = new bootstrap.Modal(document.getElementById('videoModal'));
    videoModal.show();
    
    // إعادة التشغيل عند فتح المودال
    videoPlayer.load();
}

// تحديث تلقائي للقنوات (اختياري)
function setupRealtimeUpdates() {
    onSnapshot(collection(db, "channels"), (snapshot) => {
        console.log("تحديث تلقائي للقنوات");
        loadChannels();
    });
}

// تحميل القنوات عند فتح الصفحة
document.addEventListener('DOMContentLoaded', function() {
    loadChannels();
    setupRealtimeUpdates(); // تفعيل التحديث التلقائي
});

// جعل الدوال متاحة globally للتصحيح
window.loadChannels = loadChannels;
window.playVideo = playVideo;
