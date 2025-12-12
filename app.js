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
                const userPRs = searchResults.items.map(pr => ({...pr, repoName: repo}));
                allUserPRs.push(...userPRs);
            } catch (err) {
                console.warn(`Error loading PRs from ${repo}:`, err);
            }
        }
        
        if (allUserPRs.length === 0) {
            prList.innerHTML = '<p style="color: #8b949e;">No PRs found for this user in selected repositories</p>';
            return;
        }
        
        // Sort by creation date (newest first)
        allUserPRs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Display PRs
        let html = '';
        allUserPRs.forEach(pr => {
            // Determine actual status (merged, closed, open)
            let status, statusColor, statusIcon;
            if (pr.merged_at) {
                status = 'merged';
                statusColor = '#a371f7';
                statusIcon = '✓';
            } else if (pr.state === 'closed') {
                status = 'closed';
                statusColor = '#f85149';
                statusIcon = '✕';
            } else {
                status = 'open';
                statusColor = '#3fb950';
                statusIcon = '○';
            }
            
            html += `
                <div class="pr-item">
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
            `;
        });
        
        prList.innerHTML = html;
        
    } catch (err) {
        errorElement.textContent = '❌ Network error. Try again.';
        prList.innerHTML = '';
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
