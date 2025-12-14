let repositories = [
    { name: 'intel/torch-xpu-ops', checked: true, valid: true },
    { name: 'pytorch/pytorch', checked: true, valid: true },
    { name: 'pytorch/kineto', checked: true, valid: true },
    { name: 'uxlfoundation/oneDNN', checked: false, valid: true }
];

function getPreferredTheme() {
    const savedTheme = localStorage.getItem('githubActivityTheme');
    if (savedTheme) {
        return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme) {
    const stylesheet = document.getElementById('theme-stylesheet');
    const themeIcon = document.querySelector('.theme-icon');
    
    if (theme === 'dark') {
        stylesheet.href = 'style-dark.css';
        themeIcon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    } else {
        stylesheet.href = 'style-light.css';
        themeIcon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    }
    
    localStorage.setItem('githubActivityTheme', theme);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('githubActivityTheme') || getPreferredTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('githubActivityTheme')) {
        setTheme(e.matches ? 'dark' : 'light');
    }
});

function loadRepositoriesFromCache() {
    const cached = localStorage.getItem('githubActivityRepos');
    if (cached) {
        try {
            repositories = JSON.parse(cached);
        } catch (e) {
            console.warn('Failed to load cached repositories');
        }
    }
}

function saveRepositoriesToCache() {
    localStorage.setItem('githubActivityRepos', JSON.stringify(repositories));
}

async function validateRepository(repoName) {
    try {
        const response = await fetch(`https://api.github.com/repos/${repoName}`, { method: 'HEAD' });
        return response.ok;
    } catch (e) {
        return false;
    }
}

async function validateAllRepositories() {
    for (let i = 0; i < repositories.length; i++) {
        if (repositories[i].valid === undefined) {
            repositories[i].valid = await validateRepository(repositories[i].name);
        }
    }
    saveRepositoriesToCache();
    renderRepoList();
}

function renderRepoList() {
    const listElement = document.getElementById('repoList');
    
    let html = '';
    repositories.forEach((repo, index) => {
        const validClass = repo.valid ? '' : 'repo-invalid';
        const disabledAttr = repo.valid ? '' : 'disabled';
        const checkedAttr = (repo.checked && repo.valid) ? 'checked' : '';
        html += `
            <div class="repo-item ${validClass}">
                <div class="repo-checkbox-wrapper">
                    <input type="checkbox" id="repo-${index}" ${checkedAttr} ${disabledAttr} onchange="toggleRepo(${index})">
                    <label for="repo-${index}" class="checkbox-label"></label>
                    <a href="https://github.com/${repo.name}" target="_blank" class="repo-link">${repo.name}</a>
                </div>
                <button class="remove-btn" onclick="removeRepo(${index})">×</button>
            </div>
        `;
    });
    
    listElement.innerHTML = html;
}

function toggleRepo(index) {
    repositories[index].checked = !repositories[index].checked;
    saveRepositoriesToCache();
}

async function addCustomRepo() {
    const customRepoInput = document.getElementById('customRepo');
    const repoValue = customRepoInput.value.trim();
    const repoErrorElement = document.getElementById('repoErrorMessage');

    if (!repoValue || !repoValue.match(/^[\w-]+\/[\w.-]+$/)) {
        repoErrorElement.textContent = '⚠️ Please enter a valid repository format: owner/repo';
        return;
    }

    if (repositories.some(r => r.name === repoValue)) {
        repoErrorElement.textContent = '⚠️ This repository is already added';
        return;
    }

    repoErrorElement.textContent = '';
    const isValid = await validateRepository(repoValue);
    
    repositories.push({ name: repoValue, checked: true, valid: isValid });
    saveRepositoriesToCache();
    renderRepoList();
    customRepoInput.value = '';
    
    if (!isValid) {
        repoErrorElement.textContent = `⚠️ Repository "${repoValue}" does not exist or is not accessible.`;
    }
}

function removeRepo(index) {
    repositories.splice(index, 1);
    saveRepositoriesToCache();
    renderRepoList();
    // Clear error message when repo is removed
    const repoErrorElement = document.getElementById('repoErrorMessage');
    if (repoErrorElement) {
        repoErrorElement.textContent = '';
    }
}

function getSelectedRepos() {
    return repositories.filter(r => r.checked).map(r => r.name);
}

// Convert date from DD-MM-YYYY to YYYY-MM-DD for GitHub API
function convertToAPIFormat(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
    }
    return dateStr;
}

async function loadUserAndPRs() {
    const errorElement = document.getElementById('userErrorMessage');
    const prList = document.getElementById('prList');
    errorElement.textContent = '';
    
    const username = document.getElementById('usernameInput').value.trim();
    const selectedRepos = getSelectedRepos();
    
    if (!username) {
        errorElement.textContent = '⚠️ Please enter a username';
        return;
    }
    
    if (selectedRepos.length === 0) {
        errorElement.textContent = '⚠️ Please select at least one repository';
        return;
    }
    
    try {
        const userResponse = await fetch(`https://api.github.com/users/${username}`);
        
        if (!userResponse.ok) {
            errorElement.textContent = '❌ User not found';
            return;
        }
        
        const userData = await userResponse.json();

        // Show results section
        document.getElementById('resultsSection').style.display = 'block';
        
        document.getElementById('avatar').src = userData.avatar_url;
        const loginLink = document.getElementById('userLogin');
        loginLink.textContent = userData.login;
        loginLink.href = `https://github.com/${userData.login}`;
        prList.innerHTML = '<p style="color: #8b949e;">Loading PRs...</p>';
        
        let allUserPRs = [];
        
        // Get dates and convert from DD-MM-YYYY to YYYY-MM-DD for GitHub API
        const startDateInput = document.getElementById('startDate').value;
        const endDateInput = document.getElementById('endDate').value;
        
        const startDate = startDateInput ? convertToAPIFormat(startDateInput) : '';
        const endDate = endDateInput ? convertToAPIFormat(endDateInput) : '';
        
        for (const repo of selectedRepos) {
            try {
                let searchQuery = `repo:${repo} author:${username} type:pr created:${startDate}..${endDate}`;
                const prResponse = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=100`);
                
                if (!prResponse.ok) {
                    console.warn(`Failed to load PRs from ${repo}`);
                    continue;
                }
                
                const searchResults = await prResponse.json();
                
                // Fetch full PR details to get merged status
                for (const issue of searchResults.items) {
                    try {
                        const prDetailUrl = issue.pull_request.url;
                        const prDetailResponse = await fetch(prDetailUrl);
                        
                        if (prDetailResponse.ok) {
                            const prDetail = await prDetailResponse.json();
                            allUserPRs.push({...issue, ...prDetail, repoName: repo});
                        } else {
                            allUserPRs.push({...issue, repoName: repo});
                        }
                    } catch (err) {
                        console.warn(`Error loading PR details:`, err);
                        allUserPRs.push({...issue, repoName: repo});
                    }
                }
            } catch (err) {
                console.warn(`Error loading PRs from ${repo}:`, err);
            }
        }
        
        if (allUserPRs.length === 0) {
            prList.innerHTML = '<p style="color: #8b949e;">No PRs found for this user in selected repositories</p>';
            return;
        }
        
        // Store globally for download functionality
        window.allPRs = allUserPRs;
        
        // Sort by creation date (newest first)
        allUserPRs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Calculate stats
        let openCount = 0, mergedCount = 0, closedCount = 0;
        allUserPRs.forEach(pr => {
            if (pr.merged_at || pr.pull_request?.merged_at) {
                mergedCount++;
            } else if (pr.state === 'closed') {
                closedCount++;
            } else if (pr.state === 'open') {
                openCount++;
            }
        });
        
        // Update stats display
        document.getElementById('openCount').textContent = openCount;
        document.getElementById('mergedCount').textContent = mergedCount;
        document.getElementById('closedCount').textContent = closedCount;
        
        // Display PRs
        let html = '';
        allUserPRs.forEach((pr, index) => {
            // Determine actual status (merged, closed, open)
            let status, statusColor, statusIcon;
            if (pr.merged_at || pr.pull_request?.merged_at) {
                status = 'merged';
                statusColor = '#a371f7';
                statusIcon = '<svg class="pr-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm.45 1.9a2.25 2.25 0 10-1.95.218v5.256a2.25 2.25 0 101.5 0V7.123A5.735 5.735 0 009.25 9h1.378a2.251 2.251 0 100-1.5H9.25a4.25 4.25 0 01-3.8-2.346zM12.75 9a.75.75 0 100-1.5.75.75 0 000 1.5zm-8.5 4.5a.75.75 0 100-1.5.75.75 0 000 1.5z"></path></svg>';
            } else if (pr.state === 'closed') {
                status = 'closed';
                statusColor = '#f85149';
                statusIcon = '<svg class="pr-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.97.97.97.97a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-.97-.97-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97a.75.75 0 0 1 0-1.06ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>';
            } else {
                status = 'open';
                statusColor = '#3fb950';
                statusIcon = '<svg class="pr-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/></svg>';
            }
            
            html += `
                <div class="pr-item">
                    <div class="pr-content">
                        <div class="pr-repo-tag">${pr.repoName}</div>
                        <span class="pr-status" style="color: ${statusColor};">
                            ${statusIcon} ${status.toUpperCase()}
                        </span>
                        <a href="${pr.html_url}" target="_blank" class="pr-title">
                            #${pr.number}: ${pr.title}
                        </a>
                        <div class="pr-meta">
                            Created: ${new Date(pr.created_at).toLocaleDateString('pl-PL')}
                            ${pr.merged_at ? ` | Merged: ${new Date(pr.merged_at).toLocaleDateString('pl-PL')}` : ''}
                        </div>
                    </div>
                    <input type="checkbox" id="pr-${index}" class="pr-checkbox" onchange="updateDownloadButton()">
                    <label for="pr-${index}" class="pr-checkbox-label"></label>
                </div>
            `;
        });
        
        prList.innerHTML = html;
        updateDownloadButton();
        
    } catch (err) {
        errorElement.textContent = '❌ Network error. Try again.';
        prList.innerHTML = '';
    }
}

function updateDownloadButton() {
    const checkboxes = document.querySelectorAll('.pr-checkbox:checked');
    const downloadBtn = document.getElementById('downloadBtn');
    
    // Update selected visual state for all PR items
    document.querySelectorAll('.pr-item').forEach(item => {
        const checkbox = item.querySelector('.pr-checkbox');
        if (checkbox && checkbox.checked) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    if (checkboxes.length > 0) {
        downloadBtn.style.display = 'block';
        downloadBtn.textContent = `Download Selected (${checkboxes.length})`;
    } else {
        downloadBtn.style.display = 'none';
    }
}

async function downloadSelectedDiffs() {
    const checkboxes = document.querySelectorAll('.pr-checkbox:checked');
    if (checkboxes.length === 0) return;
    
    const downloadBtn = document.getElementById('downloadBtn');
    const originalText = downloadBtn.textContent;
    downloadBtn.textContent = 'Downloading...';
    downloadBtn.disabled = true;
    
    try {
        const zip = new JSZip();
        
        for (const checkbox of checkboxes) {
            const index = parseInt(checkbox.id.split('-')[1]);
            const pr = window.allPRs[index];
            
            try {
                // Fetch the diff using GitHub API
                const response = await fetch(pr.pull_request.url, {
                    headers: {
                        'Accept': 'application/vnd.github.v3.diff'
                    }
                });
                
                if (response.ok) {
                    const diffContent = await response.text();
                    const filename = `${pr.repoName.replace('/', '-')}-${pr.number}.diff`;
                    zip.file(filename, diffContent);
                }
            } catch (err) {
                console.warn(`Failed to download diff for PR #${pr.number}:`, err);
            }
        }
        
        // Generate and download the zip file
        const content = await zip.generateAsync({type: 'blob'});
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pr-diffs-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (err) {
        console.error('Error creating zip:', err);
        alert('Failed to download diffs. Please try again.');
    } finally {
        downloadBtn.textContent = originalText;
        downloadBtn.disabled = false;
    }
}

function setLast31Days() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 31);
    
    // Use Flatpickr's setDate to properly update the pickers
    if (startDatePicker) {
        startDatePicker.setDate(startDate, true);
    }
    if (endDatePicker) {
        endDatePicker.setDate(endDate, true);
    }
}

function validateDateRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (startDate && endDate && startDate > endDate) {
        // If start date is after end date, adjust end date to match start date
        document.getElementById('endDate').value = startDate;
    }
}

let startDatePicker, endDatePicker;

function initializeDates() {
    // Initialize Flatpickr for start date
    startDatePicker = flatpickr("#startDate", {
        dateFormat: "d-m-Y",
        altInput: true,
        altFormat: "d-m-Y",
        onChange: function(selectedDates, dateStr) {
            // Auto-adjust end date if it's before the new start date
            if (endDatePicker) {
                const endDateValue = document.getElementById('endDate').value;
                if (endDateValue) {
                    const endDateObj = endDatePicker.parseDate(endDateValue, "d-m-Y");
                    const startDateObj = selectedDates[0];
                    if (endDateObj && startDateObj && endDateObj < startDateObj) {
                        endDatePicker.setDate(startDateObj, true);
                    }
                }
            }
        }
    });
    
    // Initialize Flatpickr for end date
    endDatePicker = flatpickr("#endDate", {
        dateFormat: "d-m-Y",
        altInput: true,
        altFormat: "d-m-Y",
        onChange: function(selectedDates, dateStr) {
            // Auto-adjust start date if it's after the new end date
            if (startDatePicker) {
                const startDateValue = document.getElementById('startDate').value;
                if (startDateValue) {
                    const startDateObj = startDatePicker.parseDate(startDateValue, "d-m-Y");
                    const endDateObj = selectedDates[0];
                    if (startDateObj && endDateObj && startDateObj > endDateObj) {
                        startDatePicker.setDate(endDateObj, true);
                    }
                }
            }
        }
    });
    
    setLast31Days();
}

document.addEventListener('DOMContentLoaded', () => {
    setTheme(getPreferredTheme());
    
    initializeDates();
    loadRepositoriesFromCache();
    renderRepoList();
    validateAllRepositories();
    
    document.getElementById('usernameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadUserAndPRs();
        }
    });
    
    document.getElementById('customRepo').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addCustomRepo();
        }
    });
});
