async function loadUserAndPRs() {
    const errorElement = document.getElementById('errorMessage');
    const prList = document.getElementById('prList');
    errorElement.textContent = '';
    
    const username = document.getElementById('usernameInput').value.trim();
    
    if (!username) {
        errorElement.textContent = '⚠️ Please enter a username';
        return;
    }
    
    try {
        // Load user info
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
        
        // Load PRs
        prList.innerHTML = '<p style="color: #8b949e;">Loading PRs...</p>';
    
        const prResponse = await fetch('https://api.github.com/repos/intel/torch-xpu-ops/pulls?state=all&per_page=100');
        
        if (!prResponse.ok) {
            prList.innerHTML = '<p style="color: #f85149;">Failed to load PRs</p>';
            return;
        }
        
        const allPRs = await prResponse.json();
        
        // Filter PRs by the current user (author or assignee)
        const userPRs = allPRs.filter(pr => 
            pr.user.login === username || 
            (pr.assignee && pr.assignee.login === username) ||
            (pr.assignees && pr.assignees.some(a => a.login === username))
        );
        
        if (userPRs.length === 0) {
            prList.innerHTML = '<p style="color: #8b949e;">No PRs found for this user</p>';
            return;
        }
        
        // Display PRs
        let html = '';
        userPRs.forEach(pr => {
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
                    <span class="pr-status" style="color: ${statusColor};">
                        ${statusIcon} ${status.toUpperCase()}
                    </span>
                    <a href="${pr.html_url}" target="_blank" class="pr-title">
                        #${pr.number}: ${pr.title}
                    </a>
                    <div class="pr-meta">
                        Created: ${new Date(pr.created_at).toLocaleDateString()}
                        ${pr.merged_at ? ` | Merged: ${new Date(pr.merged_at).toLocaleDateString()}` : ''}
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

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('usernameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadUserAndPRs();
        }
    });
});
