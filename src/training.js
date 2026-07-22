// training.js - Frontend controller for Badi Katori Staff Training Module

(function() {
    let activeHandbook = null;
    let handbookProgress = { pagesViewed: [], percentCompleted: 0, timeSpent: 0 };
    let currentChapterIdx = 0;
    let currentPageIdx = 0;
    let zoomLevel = 1.0;
    let handbookTimeInterval = null;
    let timeSpentThisSession = 0;

    let trainingVideos = [];
    let videoProgressList = [];
    let activeVideoId = null;
    let activeVideoCategory = "All";
    let videoTimeInterval = null;

    let activeQuiz = null;

    let API_BASE = window.location.origin;

    // Initialization hook
    window.initStaffTrainingModule = async function() {
        const token = localStorage.getItem("bk_jwt_token");
        if (!token) return;

        // Toggle Admin Actions visibility
        const role = localStorage.getItem("bk_user_role") || "employee";
        const adminActions = document.getElementById("trainingAdminActions");
        const tabBtnTrainees = document.getElementById("tabBtnTrainees");

        if (role === "owner" || role === "admin" || role === "bm") {
            if (adminActions) adminActions.style.display = "flex";
            if (tabBtnTrainees) tabBtnTrainees.style.display = "flex";
        } else {
            if (adminActions) adminActions.style.display = "none";
            if (tabBtnTrainees) tabBtnTrainees.style.display = "none";
        }

        // Fetch data
        await Promise.all([
            loadHandbookData(),
            loadVideosData(),
            loadCertificatesData()
        ]);

        if (role === "owner" || role === "admin" || role === "bm") {
            await loadTraineesLedger();
        }

        updateDashboardMetrics();
    };

    // Auto-initialize if the active screen is already staff-training when the module loads
    setTimeout(() => {
        const targetScreen = document.getElementById("screen-staff-training");
        if (targetScreen && targetScreen.classList.contains("active")) {
            window.initStaffTrainingModule();
        }
    }, 100);

    // Tab Switching
    window.switchTrainingTab = function(tabName) {
        // Stop timer listeners
        clearInterval(handbookTimeInterval);
        clearInterval(videoTimeInterval);
        
        document.querySelectorAll(".training-tab-btn").forEach(btn => {
            btn.classList.remove("active");
            btn.style.color = "#a1a1aa";
            btn.style.borderBottomColor = "transparent";
        });
        document.querySelectorAll(".training-tab-panel").forEach(panel => {
            panel.style.display = "none";
        });

        if (tabName === 'handbook') {
            const btn = document.getElementById("tabBtnHandbook");
            if (btn) {
                btn.classList.add("active");
                btn.style.color = "#d4af37";
                btn.style.borderBottomColor = "#d4af37";
            }
            document.getElementById("trainingTabHandbookContent").style.display = "block";
            startHandbookTrackingTimer();
        } else if (tabName === 'practice') {
            const btn = document.getElementById("tabBtnPractice");
            if (btn) {
                btn.classList.add("active");
                btn.style.color = "#d4af37";
                btn.style.borderBottomColor = "#d4af37";
            }
            document.getElementById("trainingTabPracticeContent").style.display = "block";
        } else if (tabName === 'trainees') {
            const btn = document.getElementById("tabBtnTrainees");
            if (btn) {
                btn.classList.add("active");
                btn.style.color = "#d4af37";
                btn.style.borderBottomColor = "#d4af37";
            }
            document.getElementById("trainingTabTraineesContent").style.display = "block";
            loadTraineesLedger();
        }
    };

    // ==========================================
    // 1. HANDBOOK READER LOGIC
    // ==========================================

    async function loadHandbookData() {
        const spinner = document.getElementById("handbookLoadingSpinner");
        if (spinner) spinner.style.display = "flex";

        try {
            // Load Handbook metadata
            const hbRes = await fetch(`${API_BASE}/api/training/handbook`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}` }
            });
            const hbData = await hbRes.json();
            
            // Load User Progress
            const progRes = await fetch(`${API_BASE}/api/training/handbook/progress`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}` }
            });
            const progData = await progRes.json();

            if (hbData.success && hbData.handbook) {
                activeHandbook = hbData.handbook;
                document.getElementById("lblHandbookVersion").textContent = `Ver ${activeHandbook.version || '1.0'}`;
            } else {
                activeHandbook = null;
            }

            if (progData.success && progData.progress) {
                handbookProgress = progData.progress;
            }

            renderHandbookTOC();
            restoreLastReadPage();

            // Start timer if handbook panel is visible
            const handbookPanel = document.getElementById("trainingTabHandbookContent");
            if (handbookPanel && handbookPanel.style.display !== "none") {
                startHandbookTrackingTimer();
            }

        } catch (e) {
            console.error("Error loading handbook data:", e);
        } finally {
            if (spinner) spinner.style.display = "none";
        }
    }

    function renderHandbookTOC() {
        const list = document.getElementById("handbookChaptersList");
        if (!list) return;
        list.innerHTML = "";

        if (!activeHandbook || !activeHandbook.chapters || activeHandbook.chapters.length === 0) {
            list.innerHTML = `<span style="color:#888; font-size:0.8rem; font-style:italic;">No chapters loaded</span>`;
            return;
        }

        activeHandbook.chapters.forEach((chap, cIdx) => {
            const chapHeader = document.createElement("div");
            chapHeader.style.fontWeight = "700";
            chapHeader.style.fontSize = "0.85rem";
            chapHeader.style.color = "#d4af37";
            chapHeader.style.marginTop = "8px";
            chapHeader.style.marginBottom = "4px";
            chapHeader.textContent = chap.title;
            list.appendChild(chapHeader);

            const pagesDiv = document.createElement("div");
            pagesDiv.style.display = "flex";
            pagesDiv.style.flexDirection = "column";
            pagesDiv.style.gap = "4px";
            pagesDiv.style.paddingLeft = "8px";

            chap.pages.forEach((pText, pIdx) => {
                const flatPageIdx = getFlatPageIndex(cIdx, pIdx);
                const pageBtn = document.createElement("button");
                pageBtn.type = "button";
                pageBtn.style.background = "none";
                pageBtn.style.border = "none";
                pageBtn.style.textAlign = "left";
                pageBtn.style.fontSize = "0.8rem";
                pageBtn.style.cursor = "pointer";
                pageBtn.style.padding = "4px 8px";
                pageBtn.style.borderRadius = "4px";
                pageBtn.style.transition = "all 0.1s";

                const isViewed = handbookProgress.pagesViewed.includes(flatPageIdx);
                const isCurrent = (currentChapterIdx === cIdx && currentPageIdx === pIdx);

                if (isCurrent) {
                    pageBtn.style.color = "#000";
                    pageBtn.style.background = "#d4af37";
                    pageBtn.style.fontWeight = "700";
                } else {
                    pageBtn.style.color = isViewed ? "#a1a1aa" : "#fff";
                    pageBtn.style.opacity = isViewed ? "0.6" : "1";
                    pageBtn.style.background = "rgba(255,255,255,0.02)";
                }

                pageBtn.innerHTML = `📄 Page ${pIdx + 1} ${isViewed ? '✔️' : ''}`;
                pageBtn.onclick = () => jumpToPage(cIdx, pIdx);
                pagesDiv.appendChild(pageBtn);
            });

            list.appendChild(pagesDiv);
        });
    }

    function getFlatPageIndex(cIdx, pIdx) {
        if (!activeHandbook) return 0;
        let count = 0;
        for (let i = 0; i < cIdx; i++) {
            count += activeHandbook.chapters[i].pages.length;
        }
        return count + pIdx;
    }

    function getTotalPages() {
        if (!activeHandbook || !activeHandbook.chapters) return 0;
        return activeHandbook.chapters.reduce((acc, c) => acc + c.pages.length, 0);
    }

    function getChapterAndPageFromFlat(flatIdx) {
        if (!activeHandbook || !activeHandbook.chapters) return { cIdx: 0, pIdx: 0 };
        let count = 0;
        for (let i = 0; i < activeHandbook.chapters.length; i++) {
            const chapPages = activeHandbook.chapters[i].pages.length;
            if (flatIdx >= count && flatIdx < count + chapPages) {
                return { cIdx: i, pIdx: flatIdx - count };
            }
            count += chapPages;
        }
        return { cIdx: 0, pIdx: 0 };
    }

    function jumpToPage(cIdx, pIdx) {
        currentChapterIdx = cIdx;
        currentPageIdx = pIdx;
        renderActivePage();
        renderHandbookTOC();
        localStorage.setItem("bk_handbook_last_chap", cIdx);
        localStorage.setItem("bk_handbook_last_page", pIdx);
        saveHandbookProgress();
    }

    function renderActivePage() {
        const body = document.getElementById("handbookPagesReaderBody");
        const progressLabel = document.getElementById("lblHandbookCurrentPage");
        if (!body || !activeHandbook) {
            if (progressLabel) progressLabel.textContent = "No Handbook Uploaded";
            if (body) {
                body.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:40px; text-align:center; color:#a1a1aa;">
                        <span style="font-size:3rem;">📖</span>
                        <h4 style="color:#d4af37; font-size:1.2rem; font-weight:800; margin:0;">No Handbook Uploaded</h4>
                        <p style="font-size:0.8rem; max-width:320px; margin:0; line-height:1.5;">Operations manuals are managed by owner/admin credentials. Check back soon for updates!</p>
                    </div>
                `;
            }
            return;
        }

        const chapter = activeHandbook.chapters[currentChapterIdx];
        if (chapter) {
            const pageText = chapter.pages[currentPageIdx];
            body.style.fontSize = `${zoomLevel}rem`;
            body.innerHTML = `
                <h3 style="color:#d4af37; font-size:1.25rem; font-weight:700; margin-top:0; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">${chapter.title}</h3>
                <p style="margin-top:16px; white-space: pre-wrap; line-height: 1.6;">${pageText || 'Empty page'}</p>
            `;
            const flatIdx = getFlatPageIndex(currentChapterIdx, currentPageIdx);
            markPageAsViewed(flatIdx);
        }

        const totalPages = getTotalPages();
        const currentFlat = getFlatPageIndex(currentChapterIdx, currentPageIdx) + 1;
        if (progressLabel) progressLabel.textContent = `Page ${currentFlat} of ${totalPages}`;
    }

    function restoreLastReadPage() {
        if (handbookProgress && handbookProgress.currentPage > 0) {
            const { cIdx, pIdx } = getChapterAndPageFromFlat(handbookProgress.currentPage);
            if (activeHandbook && activeHandbook.chapters && activeHandbook.chapters[cIdx]) {
                currentChapterIdx = cIdx;
                currentPageIdx = pIdx;
            }
        } else {
            const savedChap = parseInt(localStorage.getItem("bk_handbook_last_chap") || "0");
            const savedPage = parseInt(localStorage.getItem("bk_handbook_last_page") || "0");
            if (activeHandbook && activeHandbook.chapters && activeHandbook.chapters[savedChap]) {
                currentChapterIdx = savedChap;
                currentPageIdx = savedPage;
            } else {
                currentChapterIdx = 0;
                currentPageIdx = 0;
            }
        }
        renderActivePage();
    }

    async function markPageAsViewed(flatPageIdx) {
        if (!handbookProgress.pagesViewed.includes(flatPageIdx)) {
            handbookProgress.pagesViewed.push(flatPageIdx);
            const total = getTotalPages();
            handbookProgress.percentCompleted = total > 0 ? (handbookProgress.pagesViewed.length / total) * 100 : 100;
            updateDashboardMetrics();
            await saveHandbookProgress();
        }
    }

    async function saveHandbookProgress() {
        try {
            const curFlatPage = getFlatPageIndex(currentChapterIdx, currentPageIdx);
            await fetch(`${API_BASE}/api/training/handbook/progress`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`
                },
                body: JSON.stringify({
                    pagesViewed: handbookProgress.pagesViewed,
                    percentCompleted: handbookProgress.percentCompleted,
                    timeSpentSeconds: timeSpentThisSession,
                    currentPage: curFlatPage,
                    handbookId: activeHandbook ? activeHandbook.id : 'default'
                })
            });
            timeSpentThisSession = 0; // Reset session tracking accumulator
        } catch (e) {
            console.error("Failed to save progress:", e);
        }
    }

    function startHandbookTrackingTimer() {
        clearInterval(handbookTimeInterval);
        timeSpentThisSession = 0;
        handbookTimeInterval = setInterval(() => {
            timeSpentThisSession += 5; // Accumulate time
            if (timeSpentThisSession >= 15) {
                saveHandbookProgress(); // Autosave progress every 15 seconds
            }
        }, 5000);
    }

    window.navigateHandbookPage = function(dir) {
        if (!activeHandbook) return;
        const currentChap = activeHandbook.chapters[currentChapterIdx];
        if (!currentChap) return;

        let newPage = currentPageIdx + dir;
        if (newPage >= 0 && newPage < currentChap.pages.length) {
            jumpToPage(currentChapterIdx, newPage);
        } else if (newPage < 0 && currentChapterIdx > 0) {
            // Jump to end page of previous chapter
            const prevChapIdx = currentChapterIdx - 1;
            const prevChap = activeHandbook.chapters[prevChapIdx];
            jumpToPage(prevChapIdx, prevChap.pages.length - 1);
        } else if (newPage >= currentChap.pages.length && currentChapterIdx < activeHandbook.chapters.length - 1) {
            // Jump to page 0 of next chapter
            jumpToPage(currentChapterIdx + 1, 0);
        } else {
            showToast("You have reached the boundary of the operations manual!");
        }
    };

    window.zoomHandbookText = function(val) {
        zoomLevel = Math.max(0.8, Math.min(1.6, zoomLevel + val));
        const body = document.getElementById("handbookPagesReaderBody");
        if (body) body.style.fontSize = `${zoomLevel}rem`;
    };

    window.toggleHandbookFullScreen = function() {
        const reader = document.getElementById("handbookPagesReaderBody").parentElement;
        if (!reader) return;

        if (!document.fullscreenElement) {
            reader.requestFullscreen().catch(err => {
                alert(`Error enabling fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    // Table of contents search inside handbook
    document.getElementById("handbookSearchInput")?.addEventListener("input", function(e) {
        const query = e.target.value.toLowerCase().trim();
        const reader = document.getElementById("handbookPagesReaderBody");
        if (!activeHandbook || !reader) return;

        if (!query) {
            renderActivePage();
            return;
        }

        // Search text occurrences
        let searchResults = [];
        activeHandbook.chapters.forEach((chap, cIdx) => {
            chap.pages.forEach((pText, pIdx) => {
                if (pText.toLowerCase().includes(query)) {
                    searchResults.push({ cIdx, pIdx, title: chap.title });
                }
            });
        });

        if (searchResults.length > 0) {
            reader.innerHTML = `
                <h4 style="color:#d4af37; margin-top:0;">Search Results (${searchResults.length} matches):</h4>
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:16px;">
                    ${searchResults.map((r, i) => `
                        <button type="button" class="saas-btn" style="text-align:left; background:rgba(255,255,255,0.03); border:1px solid rgba(159,124,70,0.15); padding:10px; border-radius:8px; width:100%; cursor:pointer; color:#fff;" onclick="window.jumpToPage(${r.cIdx}, ${r.pIdx})">
                            <strong>${r.title}</strong> - Page ${r.pIdx + 1}
                            <span style="display:block; font-size:0.75rem; color:#a1a1aa; margin-top:4px;">Click to view page content...</span>
                        </button>
                    `).join('')}
                </div>
            `;
        } else {
            reader.innerHTML = `<span style="color:#ef4444; font-style:italic;">No matching text found in handbook pages</span>`;
        }
    });

    window.openUploadHandbookModal = function() {
        document.getElementById("modalUploadHandbook").style.display = "flex";
        if (window.lucide) window.lucide.createIcons();
    }
    window.submitNewHandbook = async function(e) {
        e.preventDefault();
        const version = document.getElementById("uploadHandbookVersion").value.trim();
        const fileInput = document.getElementById("uploadHandbookFile");
        
        if (!fileInput.files || fileInput.files.length === 0) {
            showToast("Please select a PDF file to upload.");
            return;
        }
        
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append("version", version);
        formData.append("file", file);

        const submitBtn = e.target.querySelector("button[type='submit']");
        let originalText = "Upload Version";
        if (submitBtn) {
            originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = "Processing PDF...";
        }

        try {
            const response = await fetch(`${API_BASE}/api/training/handbook/upload`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`
                },
                body: formData
            });
            const data = await response.json();

            if (response.ok && data.success) {
                showToast("Handbook uploaded and parsed successfully!");
                document.getElementById("modalUploadHandbook").style.display = "none";
                document.getElementById("formUploadHandbook").reset();
                
                // Clear any stored last read positions to start the new book fresh
                localStorage.removeItem("bk_handbook_last_chap");
                localStorage.removeItem("bk_handbook_last_page");
                if (handbookProgress) {
                    handbookProgress.currentPage = 0;
                    handbookProgress.pagesViewed = [];
                    handbookProgress.percentCompleted = 0;
                }
                
                await loadHandbookData();
            } else {
                throw new Error(data.error || "Upload API failed");
            }
        } catch (err) {
            alert(`Error uploading handbook: ${err.message}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    };


    // ==========================================
    // 2. VIDEO PRACTICE TRAINING LOGIC
    // ==========================================

    async function loadVideosData() {
        try {
            const videosRes = await fetch(`${API_BASE}/api/training/videos`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}` }
            });
            const vData = await videosRes.json();

            const progressRes = await fetch(`${API_BASE}/api/training/videos/progress`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}` }
            });
            const pData = await progressRes.json();

            if (vData.success && vData.videos) {
                trainingVideos = vData.videos;
            }

            if (pData.success && pData.list) {
                videoProgressList = pData.list;
            }

            renderVideoCategories();
            renderVideosGrid();

        } catch (e) {
            console.error("Error loading video training logs:", e);
        }
    }

    function renderVideoCategories() {
        const filters = document.getElementById("videoCategoryFilters");
        if (!filters) return;
        filters.innerHTML = "";

        const baseCategories = ["All", "Kitchen Training", "Billing Training", "Safety Training", "Customer Handling"];
        
        // Add custom categories that might exist in loaded videos
        trainingVideos.forEach(v => {
            if (v.category && !baseCategories.includes(v.category)) {
                baseCategories.push(v.category);
            }
        });

        baseCategories.forEach(cat => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.style.background = (activeVideoCategory === cat) ? "#d4af37" : "rgba(255,255,255,0.03)";
            btn.style.color = (activeVideoCategory === cat) ? "#000" : "#fff";
            btn.style.border = (activeVideoCategory === cat) ? "none" : "1px solid rgba(255,255,255,0.05)";
            btn.style.padding = "10px 14px";
            btn.style.borderRadius = "8px";
            btn.style.fontWeight = "700";
            btn.style.fontSize = "0.8rem";
            btn.style.cursor = "pointer";
            btn.style.textAlign = "left";
            btn.style.transition = "all 0.2s";
            btn.textContent = cat;
            
            btn.onclick = () => {
                activeVideoCategory = cat;
                renderVideoCategories();
                renderVideosGrid();
            };
            filters.appendChild(btn);
        });
    }

    function renderVideosGrid() {
        const grid = document.getElementById("trainingVideosGrid");
        if (!grid) return;
        grid.innerHTML = "";

        const filtered = activeVideoCategory === "All"
            ? trainingVideos
            : trainingVideos.filter(v => v.category === activeVideoCategory);

        if (filtered.length === 0) {
            if (trainingVideos.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column:1/-1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:60px; text-align:center; color:#a1a1aa; width:100%;">
                        <span style="font-size:3rem;">🎥</span>
                        <h4 style="color:#d4af37; font-size:1.2rem; font-weight:800; margin:0;">No Training Videos Available</h4>
                        <p style="font-size:0.8rem; max-width:320px; margin:0; line-height:1.5;">Videos lessons have not been loaded yet. Check back soon for updates!</p>
                    </div>
                `;
            } else {
                grid.innerHTML = `
                    <div style="grid-column:1/-1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:40px; text-align:center; color:#a1a1aa; width:100%;">
                        <span style="font-size:2rem; opacity:0.6;">🔍</span>
                        <h5 style="color:#d4af37; font-size:1rem; font-weight:700; margin:0;">No lessons in this category</h5>
                        <p style="font-size:0.75rem; margin:0;">Select a different training filter tab above to continue learning.</p>
                    </div>
                `;
            }
            return;
        }

        filtered.forEach(v => {
            const prog = videoProgressList.find(p => p.videoId === v.id) || { watchPercent: 0, completed: 0 };
            
            const card = document.createElement("div");
            card.style.background = "rgba(15,15,15,0.8)";
            card.style.border = "1px solid rgba(159,124,70,0.15)";
            card.style.borderRadius = "12px";
            card.style.overflow = "hidden";
            card.style.display = "flex";
            card.style.flexDirection = "column";

            // Cover placeholder (Black/Gold design)
            const thumb = document.createElement("div");
            thumb.style.width = "100%";
            thumb.style.aspectRatio = "16/9";
            thumb.style.background = "linear-gradient(135deg, #1e1b15, #0c0a07)";
            thumb.style.borderBottom = "1px solid rgba(159,124,70,0.15)";
            thumb.style.display = "flex";
            thumb.style.alignItems = "center";
            thumb.style.justifyContent = "center";
            thumb.style.position = "relative";
            thumb.innerHTML = `
                <div style="border: 2px solid #d4af37; border-radius:50%; width:44px; height:44px; display:flex; align-items:center; justify-content:center; color:#d4af37; background:rgba(0,0,0,0.4);">
                    <i data-lucide="play" style="width:20px; height:20px; fill:#d4af37;"></i>
                </div>
                ${prog.completed ? `
                    <span style="position:absolute; top:8px; right:8px; background:#10b981; color:#fff; font-size:0.65rem; font-weight:700; padding:2px 8px; border-radius:4px;">COMPLETED</span>
                ` : `
                    <span style="position:absolute; top:8px; right:8px; background:#eab308; color:#000; font-size:0.65rem; font-weight:700; padding:2px 8px; border-radius:4px;">${Math.round(prog.watchPercent)}% WATCHED</span>
                `}
            `;

            const body = document.createElement("div");
            body.style.padding = "16px";
            body.style.flex = "1";
            body.style.display = "flex";
            body.style.flexDirection = "column";
            body.style.gap = "8px";

            body.innerHTML = `
                <span style="font-size:0.7rem; color:#d4af37; font-weight:700; text-transform:uppercase; letter-spacing:1px;">${v.category}</span>
                <h4 style="font-size:0.95rem; font-weight:800; color:#fff; margin:0;">${v.title}</h4>
                <p style="font-size:0.75rem; color:#a1a1aa; margin:0; line-height:1.4; flex:1;">${v.description}</p>
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <button type="button" class="saas-btn" style="flex:1; background: linear-gradient(to right, #9f7c46, #d4af37); color:#000; font-weight:800; border:none; padding:8px 12px; border-radius:6px; font-size:0.75rem; cursor:pointer;" onclick="window.playActiveTrainingVideo('${v.id}')">
                        Watch & Learn
                    </button>
                </div>
            `;

            card.appendChild(thumb);
            card.appendChild(body);
            grid.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    window.playActiveTrainingVideo = function(videoId) {
        const video = trainingVideos.find(v => v.id === videoId);
        if (!video) return;

        activeVideoId = videoId;
        document.getElementById("lblActiveVideoTitle").textContent = video.title;
        document.getElementById("lblActiveVideoDescription").textContent = video.description;
        
        const card = document.getElementById("trainingVideoPlayerCard");
        card.style.display = "block";
        card.scrollIntoView({ behavior: "smooth" });

        const player = document.getElementById("trainingActiveVideo");
        // We use a beautiful royalty-free loop or video mock to avoid player errors on empty streams
        player.src = video.videoData ? video.videoData : "https://assets.mixkit.co/videos/preview/mixkit-kitchen-chef-preparing-vegetables-for-cooking-41585-large.mp4";
        
        // Restore last watched position
        const prog = videoProgressList.find(p => p.videoId === videoId);
        player.load();
        
        player.onloadedmetadata = () => {
            if (prog && prog.watchPercent > 0 && prog.watchPercent < 90) {
                const resumeTime = player.duration * (prog.watchPercent / 100);
                player.currentTime = resumeTime;
            }
        };

        // Hide overlay initially
        document.getElementById("videoQuizPromptOverlay").style.display = "none";

        // Listen for completeness triggers
        player.ontimeupdate = () => {
            const pct = (player.currentTime / player.duration) * 100;
            if (pct > 0 && Math.round(pct) % 10 === 0) {
                saveVideoProgress(videoId, pct, 10);
            }
        };

        player.onended = () => {
            saveVideoProgress(videoId, 100, 10);
            // Show quiz trigger overlay
            document.getElementById("videoQuizPromptOverlay").style.display = "flex";
        };
    };

    window.closeActiveVideoPlayer = function() {
        const player = document.getElementById("trainingActiveVideo");
        if (player) {
            player.pause();
            player.src = "";
        }
        document.getElementById("trainingVideoPlayerCard").style.display = "none";
        activeVideoId = null;
    };

    async function saveVideoProgress(videoId, watchPercent, elapsedSeconds) {
        try {
            const res = await fetch(`${API_BASE}/api/training/videos/progress`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`
                },
                body: JSON.stringify({ videoId, watchPercent, timeWatchedSeconds: elapsedSeconds })
            });
            if (res.ok) {
                // Refresh local status
                const existing = videoProgressList.find(p => p.videoId === videoId);
                if (existing) {
                    existing.watchPercent = Math.max(existing.watchPercent, watchPercent);
                    if (watchPercent >= 90) existing.completed = 1;
                } else {
                    videoProgressList.push({ videoId, watchPercent, completed: watchPercent >= 90 ? 1 : 0 });
                }
                updateDashboardMetrics();
            }
        } catch (e) {
            console.error("Error saving video watch progress:", e);
        }
    }

    window.openUploadVideoModal = function() {
        document.getElementById("modalUploadVideo").style.display = "flex";
        if (window.lucide) window.lucide.createIcons();
    };

    document.getElementById("uploadVideoFile")?.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (file) {
            document.getElementById("lblVideoFilename").textContent = file.name;
        } else {
            document.getElementById("lblVideoFilename").textContent = "Drag & drop video file or click to select";
        }
    });

    window.submitNewVideo = async function(e) {
        e.preventDefault();
        const title = document.getElementById("uploadVideoTitle").value.trim();
        const category = document.getElementById("uploadVideoCategory").value;
        const description = document.getElementById("uploadVideoDescription").value.trim();
        const quizContent = document.getElementById("uploadVideoQuizContent").value.trim();
        const videoInput = document.getElementById("uploadVideoFile");

        let videoBase64 = "";
        if (videoInput.files && videoInput.files[0]) {
            const file = videoInput.files[0];
            videoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        }

        try {
            let parsedQuiz = null;
            if (quizContent) parsedQuiz = JSON.parse(quizContent);

            const res = await fetch(`${API_BASE}/api/training/videos/upload`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`
                },
                body: JSON.stringify({
                    title, category, description, videoData: videoBase64, quizQuestions: parsedQuiz
                })
            });

            if (res.ok) {
                showToast("Training video lesson added successfully!");
                document.getElementById("modalUploadVideo").style.display = "none";
                document.getElementById("formUploadVideo").reset();
                await loadVideosData();
            } else {
                throw new Error("Video upload API failed");
            }
        } catch (err) {
            alert(`Error parsing quiz JSON content! Ensure it is correctly formatted:\n[{"question":"Q?","type":"MCQ","options":["A","B"],"answer":"A"}]`);
        }
    };


    // ==========================================
    // 3. QUIZ ASSESSMENT LOGIC
    // ==========================================

    window.startVideoQuiz = async function() {
        if (!activeVideoId) return;
        try {
            const res = await fetch(`${API_BASE}/api/training/quizzes/${activeVideoId}`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}` }
            });
            const data = await res.json();
            
            if (data.success && data.quiz) {
                activeQuiz = data.quiz;
                renderQuizQuestions();
                document.getElementById("modalTrainingQuiz").style.display = "flex";
                if (window.lucide) window.lucide.createIcons();
            } else {
                showToast("No assessment quiz configured for this lesson.");
            }
        } catch (e) {
            console.error("Failed to load quiz questions:", e);
        }
    };

    function renderQuizQuestions() {
        const container = document.getElementById("trainingQuizQuestionsList");
        if (!container || !activeQuiz) return;
        container.innerHTML = "";

        activeQuiz.questions.forEach((q, qIdx) => {
            const qDiv = document.createElement("div");
            qDiv.style.background = "rgba(255,255,255,0.03)";
            qDiv.style.border = "1px solid rgba(159,124,70,0.15)";
            qDiv.style.borderRadius = "8px";
            qDiv.style.padding = "14px";
            qDiv.style.display = "flex";
            qDiv.style.flexDirection = "column";
            qDiv.style.gap = "8px";

            const title = document.createElement("strong");
            title.style.fontSize = "0.9rem";
            title.style.color = "#d4af37";
            title.textContent = `${qIdx + 1}. ${q.question}`;
            qDiv.appendChild(title);

            const optionsDiv = document.createElement("div");
            optionsDiv.style.display = "flex";
            optionsDiv.style.flexDirection = "column";
            optionsDiv.style.gap = "6px";

            q.options.forEach((opt, oIdx) => {
                const label = document.createElement("label");
                label.style.display = "flex";
                label.style.alignItems = "center";
                label.style.gap = "10px";
                label.style.fontSize = "0.8rem";
                label.style.cursor = "pointer";

                const isMulti = q.type === 'Multiple Select';
                const input = document.createElement("input");
                input.type = isMulti ? "checkbox" : "radio";
                input.name = `question-${qIdx}`;
                input.value = opt;
                input.style.accentColor = "#d4af37";

                label.appendChild(input);
                label.appendChild(document.createTextNode(opt));
                optionsDiv.appendChild(label);
            });

            qDiv.appendChild(optionsDiv);
            container.appendChild(qDiv);
        });
    }

    window.submitActiveQuiz = async function(e) {
        e.preventDefault();
        if (!activeQuiz) return;

        const answers = [];
        activeQuiz.questions.forEach((q, qIdx) => {
            const inputs = document.querySelectorAll(`input[name="question-${qIdx}"]:checked`);
            if (q.type === 'Multiple Select') {
                const selected = [];
                inputs.forEach(i => selected.push(i.value));
                answers.push(selected);
            } else {
                answers.push(inputs[0] ? inputs[0].value : null);
            }
        });

        // Validate complete answers
        const hasUnanswered = answers.some(a => a === null || (Array.isArray(a) && a.length === 0));
        if (hasUnanswered) {
            alert("Please answer all questions before submitting!");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/training/quizzes/${activeQuiz.videoId}/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}`
                },
                body: JSON.stringify({ answers })
            });
            const result = await res.json();

            if (result.success) {
                document.getElementById("modalTrainingQuiz").style.display = "none";
                if (result.passed) {
                    alert(`Congratulations! You passed the quiz with a score of ${result.score.toFixed(1)}%!\nYour training completion certificate has been generated!`);
                } else {
                    alert(`Quiz finished. Score: ${result.score.toFixed(1)}%. Min pass score is 80%. Please try watching the video again to re-attempt.`);
                }
                
                // Hide video player overlays
                document.getElementById("videoQuizPromptOverlay").style.display = "none";
                closeActiveVideoPlayer();
                
                // Reload data
                await loadVideosData();
                await loadCertificatesData();
            }
        } catch (err) {
            console.error("Quiz submission evaluation failed:", err);
        }
    };


    // ==========================================
    // 4. CERTIFICATES & METRICS
    // ==========================================

    async function loadCertificatesData() {
        try {
            const res = await fetch(`${API_BASE}/api/training/certificates`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}` }
            });
            const data = await res.json();
            
            const countLabel = document.getElementById("lblCertificatesCount");
            if (data.success && data.certificates) {
                if (countLabel) countLabel.textContent = data.certificates.length;
                renderCertificatesDashboardList(data.certificates);
            }
        } catch (e) {
            console.error("Error loading certificates:", e);
        }
    }

    function renderCertificatesDashboardList(certs) {
        const countLabel = document.getElementById("lblCertificatesCount");
        if (!countLabel) return;
        const card = countLabel.parentElement;
        if (!card) return;

        if (certs.length > 0) {
            card.style.cursor = "pointer";
            card.onclick = () => {
                const latest = certs[0];
                window.viewEarnedCertificate(latest.employeeName, latest.type, latest.issueDate, latest.certificateCode);
            };
            card.title = "Click to view latest certificate of accomplishment";
        }
    }

    window.viewEarnedCertificate = function(name, type, date, code) {
        document.getElementById("lblCertEmployeeName").textContent = name;
        document.getElementById("lblCertTrainingTitle").textContent = type;
        document.getElementById("lblCertDate").textContent = date;
        document.getElementById("lblCertCode").textContent = code;
        
        document.getElementById("modalViewCertificate").style.display = "flex";
        if (window.lucide) window.lucide.createIcons();
    };

    function updateDashboardMetrics() {
        const hbPct = Math.round(handbookProgress.percentCompleted || 0);
        const totalVids = trainingVideos.length;
        const completedVids = videoProgressList.filter(p => p.completed === 1).length;
        const vPct = totalVids > 0 ? Math.round((completedVids / totalVids) * 100) : 0;

        // Update gauges
        const hbCircle = document.getElementById("handbookProgressCircle");
        if (hbCircle) {
            const offset = 157 - (157 * hbPct) / 100;
            hbCircle.style.strokeDashoffset = offset;
        }
        const lblHbPct = document.getElementById("lblHandbookProgressPct");
        if (lblHbPct) lblHbPct.textContent = `${hbPct}%`;
        const lblHbRatio = document.getElementById("lblHandbookProgressRatio");
        if (lblHbRatio) {
            const totalHbPages = getTotalPages();
            const readCount = handbookProgress.pagesViewed ? handbookProgress.pagesViewed.length : 0;
            lblHbRatio.textContent = `${readCount} / ${totalHbPages} Pages`;
        }

        const vCircle = document.getElementById("videoProgressCircle");
        if (vCircle) {
            const offset = 157 - (157 * vPct) / 100;
            vCircle.style.strokeDashoffset = offset;
        }
        const lblVPct = document.getElementById("lblVideoProgressPct");
        if (lblVPct) lblVPct.textContent = `${vPct}%`;
        const lblVRatio = document.getElementById("lblVideoProgressRatio");
        if (lblVRatio) lblVRatio.textContent = `${completedVids} / ${totalVids} Videos`;
    }

    // ==========================================
    // 5. TRAINEE PERFORMANCE LEDGER (ADMIN ONLY)
    // ==========================================

    async function loadTraineesLedger() {
        const tbody = document.getElementById("tblTraineeRecordsBody");
        if (!tbody) return;

        try {
            const res = await fetch(`${API_BASE}/api/training/admin/dashboard`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("bk_jwt_token") || ''}` }
            });
            const data = await res.json();
            
            if (data.success && data.trainees) {
                tbody.innerHTML = "";
                data.trainees.forEach(t => {
                    const row = document.createElement("tr");
                    row.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
                    
                    const lastActiveStr = t.lastOpened ? new Date(t.lastOpened).toLocaleDateString() : 'Never';
                    
                    row.innerHTML = `
                        <td style="padding:12px; font-weight:700;">${t.name}</td>
                        <td style="padding:12px; color:#d4af37;">${t.role.toUpperCase()}</td>
                        <td style="padding:12px; text-align:center;">${Math.round(t.handbookPct)}%</td>
                        <td style="padding:12px; text-align:center;">${t.completedVideos} Videos</td>
                        <td style="padding:12px; text-align:center; font-weight:700; color:#10b981;">${t.avgQuizScore.toFixed(1)}%</td>
                        <td style="padding:12px;">${lastActiveStr}</td>
                        <td style="padding:12px; text-align:center; color:#eab308; font-weight:700;">${t.certsCount} Earned</td>
                    `;
                    tbody.appendChild(row);
                });
            }
        } catch (e) {
            console.error("Error loading trainees records:", e);
        }
    }

})();
