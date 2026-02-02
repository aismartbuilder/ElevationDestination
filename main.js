
import { calculateElevation } from './physicsEngine.js'
import { auth } from './src/auth.js'
import { database } from './src/db.js'
import { auth as firebaseAuth } from './src/firebase-config.js'
import html2canvas from 'html2canvas';

console.log('🚀 App Loaded - Version 1.2 - Debug Mode ON');
window.APP_VERSION = '1.2';

// Central State
let appData = {
    settings: {}, // weight, goal, units, theme
    workouts: [],
    challenges: {
        climbing: [],
        distance: [],
        my: [],
        active: null
    },
    badges: [],
    progress: {},
    trophies: []
};

const DEFAULT_CHALLENGES = [
    { id: 'everest', title: 'Mount Everest', height: 8849, type: 'climbing' },
    { id: 'k2', title: 'K2', height: 8611, type: 'climbing' },
    { id: 'kilimanjaro', title: 'Mount Kilimanjaro', height: 5895, type: 'climbing' },
    { id: 'montblanc', title: 'Mont Blanc', height: 4807, type: 'climbing' },
    { id: 'matterhorn', title: 'Matterhorn', height: 4478, type: 'climbing' },
    { id: 'fuji', title: 'Mount Fuji', height: 3776, type: 'climbing' },
    { id: 'marathon', title: 'Marathon', distance: 42.195, type: 'distance' },
    { id: 'ultra', title: 'Ultra Marathon', distance: 100, type: 'distance' },
    { id: 'half-marathon', title: 'Half Marathon', distance: 21.0975, type: 'distance' },
    { id: 'la-sf', title: 'LA to SF', distance: 617, type: 'distance' },
    { id: 'century', title: 'Century Ride', distance: 160.9, type: 'distance' },
    { id: 'london-paris', title: 'London to Paris', distance: 460, type: 'distance' },
    { id: 'proclaimers', title: 'The Proclaimers', distance: 804.67, type: 'distance' },
    { id: 'dia-de-los-muertos', title: 'Dia de los Muertos', distance: 158, type: 'distance' },
    { id: 'la-ny', title: 'LA to NY', distance: 4828, type: 'distance' }
];

document.addEventListener('DOMContentLoaded', () => {
    // --- View Elements ---
    const views = {
        landing: document.getElementById('landing-view'),
        login: document.getElementById('login-view'),
        signup: document.getElementById('signup-view'),
        app: document.getElementById('app-view')
    };

    // --- Notification Helper ---
    function showNotification(title, message, icon = '✅') {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'notification-toast';

        toast.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 3000);
    }

    // --- Confirmation Helper ---
    function showConfirmation(message, onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'confirmation-overlay';
        const modal = document.createElement('div');
        modal.className = 'confirmation-modal';

        modal.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 1rem;">🗑️</div>
            <p>${message}</p>
            <div class="confirmation-actions">
                <button class="btn-cancel">Cancel</button>
                <button class="btn-confirm">Delete</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const cancelBtn = modal.querySelector('.btn-cancel');
        const confirmBtn = modal.querySelector('.btn-confirm');

        function close() {
            overlay.classList.add('fade-out');
            overlay.remove();
        }

        cancelBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        confirmBtn.addEventListener('click', () => {
            onConfirm();
            close();
        });

        cancelBtn.focus();

    }


    // --- Workout Details Modal ---
    function showWorkoutDetailsModal(workout) {
        const overlay = document.createElement('div');
        overlay.className = 'confirmation-overlay'; // Reuse overlay style

        const modal = document.createElement('div');
        modal.className = 'confirmation-modal'; // Reuse modal base style
        modal.style.maxWidth = '500px'; // Slightly wider for more data
        modal.style.width = '95%';
        modal.style.textAlign = 'left';
        modal.style.background = 'linear-gradient(145deg, #1e1e1e, #252525)';
        modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        modal.style.border = '1px solid rgba(255,255,255,0.1)';

        // --- Helper: Format Value ---
        const fmt = (val, suffix = '') => val ? `<span style="color:white; font-weight:600;">${val}</span> <span style="font-size:0.8em; color:#aaa;">${suffix}</span>` : '<span style="color:#555;">-</span>';

        // --- Calculate Extras ---
        // Calories (Estimate if not present)
        let calories = workout.calories;
        if (!calories) {
            if (workout.outputKj) {
                // 1 kcal ~ 4.184 kJ
                calories = (parseFloat(workout.outputKj) / 4.184).toFixed(0);
            } else if (workout.miles) {
                // Rough estimate: 100 kcal / mile (running) or 40-50 / mile (cycling)
                // Defaulting to "Generic Cardio" ~100kcal/10 mins or based on miles
                const dist = parseFloat(workout.miles);
                calories = (dist * 50).toFixed(0); // Very rough guess for cycling/generic
            }
        }

        // Heart Rate
        const hr = workout.heartRate || workout.avgHr || null;

        // Grid Item helper
        const gridItem = (label, value) => `
        <div style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem;">${label}</div>
            <div style="font-size: 1.1rem;">${value}</div>
        </div>
    `;

        // Elevation calc
        let elevationDisplay = '-';
        if (workout.elevation) {
            let elMeters = (parseFloat(workout.elevation) * 0.3048).toFixed(0);
            elevationDisplay = `${elMeters}m / ${workout.elevation}ft`;
        } else if (workout.outputKj || workout.output) {
            let weight = parseFloat(appData.settings.weight) || 80;
            if (appData.settings.unit_weight === 'lbs') weight *= 0.453592;
            const inputVal = parseFloat(workout.outputKj || workout.output);
            if (!isNaN(inputVal)) {
                const el = calculateElevation(inputVal, weight);
                elevationDisplay = `${el.meters}m / ${el.feet}ft`;
            }
        }

        // Modal Content
        modal.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:1rem;">
            <div>
                <h3 style="margin:0; font-size:1.4rem; color: white;">${workout.title}</h3>
                <div style="color: var(--primary-color); font-size: 0.9rem; margin-top: 0.25rem;">
                    ${formatDateForDisplay(workout.date)} &bull; ${workout.type ? workout.type.toUpperCase() : 'WORKOUT'}
                </div>
            </div>
            <button class="btn-close-modal" style="background:none; border:none; color:#aaa; font-size:1.8rem; cursor:pointer; line-height: 1;">&times;</button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
            ${gridItem('Duration', workout.duration ? formatDurationForDisplay(workout.duration) : '-')}
            ${gridItem('Distance', workout.miles ? fmt(workout.miles, 'mi') + ' / ' + fmt((workout.miles * 1.609).toFixed(1), 'km') : '-')}
            
            ${gridItem('Total Output', workout.outputKj ? fmt(workout.outputKj, 'kJ') : '-')}
            ${gridItem('Calories', calories ? fmt(calories, 'kcal') : '-')}
            
            ${gridItem('Avg Cadence', workout.cadence ? fmt(workout.cadence, 'rpm') : '-')}
            ${gridItem('Avg Heart Rate', hr ? fmt(hr, 'bpm') : '-')}
            
            ${gridItem('Avg Speed', workout.speed ? fmt(workout.speed, 'mph') : '-')}
            ${gridItem('Avg Power', workout.output ? fmt(workout.output, 'w') : '-')}
            ${gridItem('Intensity', workout.intensity ? workout.intensity + '/10' : '-')}
        </div>

        <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 3px solid var(--primary-color);">
            <div style="font-size: 0.75rem; color: #888; text-transform: uppercase;">Est. Elevation Gain</div>
            <div style="font-size: 1.2rem; font-weight: bold; margin-top: 0.25rem;">${elevationDisplay}</div>
        </div>

        ${workout.notes ? `
        <div style="margin-bottom: 1.5rem;">
            <div style="font-size: 0.9rem; color: #ccc; margin-bottom: 0.5rem; font-weight: bold;">Notes</div>
            <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; color: #bbb; font-style: italic; line-height: 1.5;">
                ${workout.notes.replace(/\n/g, '<br>')}
            </div>
        </div>
        ` : ''}

        <div style="text-align: right;">
            <button class="btn-close-action" style="background: var(--primary-color); color: #000; border: none; padding: 0.75rem 2rem; border-radius: 30px; font-weight: bold; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: transform 0.2s;">Close</button>
        </div>
    `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        function close() {
            overlay.classList.add('fade-out'); // Ensure CSS exists or it just does nothing
            setTimeout(() => overlay.remove(), 200); // Small delay for hypothetical animation
        }

        modal.querySelector('.btn-close-modal').addEventListener('click', close);
        modal.querySelector('.btn-close-action').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    }


    const logoutBtn = document.getElementById('logout-btn');

    // --- State Management ---
    function switchView(viewName) {
        Object.values(views).forEach(el => el.classList.add('hidden'));
        if (views[viewName]) {
            views[viewName].classList.remove('hidden');
        }
    }

    // --- Data Loading ---
    async function loadCloudData() {
        showNotification('Syncing...', 'Downloading your data from the cloud.', '☁️');
        try {
            // 1. Profile
            const profile = await database.getUserProfile();
            if (profile) {
                appData.settings = profile;
                // Apply immediately
                if (profile.theme) setTheme(profile.theme);
                if (profile.unit_weight) setUnit('weight', profile.unit_weight);
                if (profile.unit_distance) setUnit('distance', profile.unit_distance);
            }

            // 2. Workouts
            const workouts = await database.getWorkouts();
            appData.workouts = workouts;

            // 3. Badges
            const badges = await database.getUnlockedBadges();
            appData.badges = badges;

            // 4. Challenges
            const myChallenges = await database.getChallenges('my');
            appData.challenges.my = Array.isArray(myChallenges) ? myChallenges : [];

            const customClimbing = await database.getChallenges('custom_climbing');
            appData.challenges.climbing = Array.isArray(customClimbing) ? customClimbing : [];

            const customDistance = await database.getChallenges('custom_distance');
            appData.challenges.distance = Array.isArray(customDistance) ? customDistance : [];

            // 5. Trophies
            const trophies = await database.getTrophies();
            appData.trophies = Array.isArray(trophies) ? trophies : [];

            console.log('✅ Cloud Data Loaded:', appData);

        } catch (e) {
            console.error('Error loading cloud data', e);
            showNotification('Sync Error', 'Could not load data. Working offline?', '⚠️');
        } finally {
            // Force Render immediately after load attempt
            renderWorkouts();
            renderMyChallenges();
            renderChallenges();
            loadBadges();
            renderTrophies();
            syncTrophies();
            renderAchievementFacts();
            loadSettingsToUI();

            // Auto-switch to favorite tab
            if (appData.settings.favoriteTab) {
                const favTabId = appData.settings.favoriteTab;
                const tabToClick = document.querySelector(`.tab-btn[data-tab="${favTabId}"]`);
                if (tabToClick) {
                    tabToClick.click();
                }
            }
        }
    }


    // --- Auth Logic ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('✅ User is signed in:', user.email);
            // switchView('app'); // Handled by checkAuth logic or manual flow?
            // Let's ensure we are in app view if we just loaded
            if (!views.app.classList.contains('active') && views.landing.classList.contains('active')) {
                // only auto-switch if we were on landing, not if we were clicking around
            }

            // Set Initials and Debug Info
            const currentUser = auth.getUser();
            if (currentUser && userInitials) {
                let text = 'U';
                if (currentUser.name) {
                    text = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                } else if (currentUser.username) {
                    text = currentUser.username.substring(0, 2).toUpperCase();
                }
                userInitials.textContent = text;
                // Debugging: Hover to see email
                userInitials.parentElement.title = `Logged in as: ${currentUser.email}`;
            }

            // Environment Indicator
            if (window.location.hostname.includes('dev') || window.location.hostname.includes('localhost')) {
                const badge = document.createElement('div');
                badge.style.cssText = 'position:fixed; bottom:10px; right:10px; background:red; color:white; padding:5px 10px; border-radius:5px; font-size:12px; z-index:9999; pointer-events:none; opacity:0.7;';
                badge.innerText = `DEV MODE (${window.location.hostname})`;
                document.body.appendChild(badge);
            }

            // MIGRATION & LOAD
            await database.migrateLocalStorageToCloud();
            await loadCloudData();

            switchView('app');

        } else {
            console.log('❌ User is signed out');
            switchView('landing');
            // Clear Data
            appData = {
                settings: {},
                workouts: [],
                challenges: { climbing: [], distance: [], my: [], active: null },
                badges: [],
                progress: {}
            };
        }
    });

    // Landing Page Buttons
    const landingSignupBtn = document.getElementById('landing-signup-btn');
    if (landingSignupBtn) {
        landingSignupBtn.addEventListener('click', () => switchView('signup'));
    }
    document.getElementById('landing-login-btn').addEventListener('click', () => {
        switchView('login');
        setTimeout(() => {
            const savedEmail = localStorage.getItem('saved_email'); // This is fine to keep local
            const loginUsername = document.getElementById('login-username');
            const loginRemember = document.getElementById('login-remember');
            if (savedEmail && loginUsername && loginRemember) {
                loginUsername.value = savedEmail;
                loginRemember.checked = true;
            }
        }, 50);
    });

    // Back Buttons
    document.getElementById('login-back-btn').addEventListener('click', () => switchView('landing'));
    document.getElementById('signup-back-btn').addEventListener('click', () => switchView('landing'));

    // Cross Links
    const toSignupLink = document.getElementById('to-signup-link');
    if (toSignupLink) {
        toSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('signup');
        });
    }
    document.getElementById('to-login-link').addEventListener('click', (e) => {
        e.preventDefault();
        switchView('login');
    });

    // LoginForm
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const user = document.getElementById('login-username').value;
        const pass = document.getElementById('login-password').value;
        const remember = document.getElementById('login-remember').checked;

        if (btn) btn.classList.add('loading');

        try {
            const success = await auth.login(user, pass, remember);
            if (success) {
                if (remember) {
                    localStorage.setItem('saved_email', user);
                } else {
                    localStorage.removeItem('saved_email');
                }
                e.target.reset();
            }
        } finally {
            if (btn) btn.classList.remove('loading');
        }
    });

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const user = document.getElementById('signup-username').value;
        const pass = document.getElementById('signup-password').value;

        if (btn) btn.classList.add('loading');

        try {
            const success = await auth.signup(name, email, user, pass);
            if (success) e.target.reset();
        } finally {
            if (btn) btn.classList.remove('loading');
        }
    });


    // --- Header & Settings ---
    const userAvatar = document.getElementById('user-avatar');
    const userInitials = document.getElementById('user-initials');
    const settingsDropdown = document.getElementById('settings-dropdown');

    if (userAvatar && settingsDropdown) {
        userAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsDropdown.classList.toggle('hidden');
            if (!settingsDropdown.classList.contains('hidden')) {
                loadSettingsToUI();
            }
        });

        document.addEventListener('click', (e) => {
            if (!settingsDropdown.classList.contains('hidden') &&
                !settingsDropdown.contains(e.target) &&
                e.target !== userAvatar) {
                settingsDropdown.classList.add('hidden');
            }
        });

        settingsDropdown.addEventListener('click', (e) => e.stopPropagation());

        const closeSettingsBtn = document.getElementById('close-settings-btn');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => {
                settingsDropdown.classList.add('hidden');
            });
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await auth.logout();
        });
    }

    // --- Calculator ---
    const calculateBtn = document.getElementById('calculate-btn');


    // --- Auto Determine Energy Toggle ---
    const autoDetermineCheckbox = document.getElementById('auto-determine-energy');
    if (autoDetermineCheckbox) {
        autoDetermineCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const fieldsToHighlight = [
                'challenge-log-duration-hours',
                'challenge-log-duration-minutes',
                'challenge-log-desc',
                'log-intensity',
                'log-hr',
                'details-container'
            ];


            fieldsToHighlight.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    if (isChecked) el.classList.add('highlight-required');
                    else el.classList.remove('highlight-required');
                }
            });

            // Update Heart Rate Label
            const hrLabel = document.querySelector('label[for="log-hr"]');
            if (hrLabel) {
                // Use formatting that matches the original ensuring clean display
                if (isChecked) {
                    hrLabel.innerHTML = 'Avg Heart Rate (bpm) <span style="font-weight:normal; opacity:0.8;">(Optional)</span>';
                } else {
                    hrLabel.innerHTML = 'Avg Heart Rate (bpm)';
                }
            }
        });
    }

    const outputInput = document.getElementById('output-kj');
    const weightInput = document.getElementById('user-weight');
    const resultsSection = document.getElementById('results');
    const resMeters = document.getElementById('res-meters');
    const resFeet = document.getElementById('res-feet');
    const resLandmark = document.getElementById('res-landmark');

    if (calculateBtn && outputInput && weightInput && resultsSection && resMeters) {
        calculateBtn.addEventListener('click', () => {
            const totalOutput = parseFloat(outputInput.value);
            let userWeight = parseFloat(weightInput.value);
            const activeWeightUnit = document.querySelector('[data-unit-type="calc-weight"].active');
            const calcWeightUnit = activeWeightUnit ? activeWeightUnit.dataset.unit : 'kg';

            if (calcWeightUnit === 'lbs') {
                userWeight = userWeight * 0.453592;
            }

            if (isNaN(totalOutput) || isNaN(userWeight) || totalOutput < 0 || userWeight < 0) {
                alert('Please enter valid positive numbers.');
                return;
            }

            const result = calculateElevation(totalOutput, userWeight);
            resMeters.textContent = result.meters;
            resFeet.textContent = result.feet;
            resLandmark.textContent = result.landmark;
            resultsSection.classList.remove('hidden');

            checkBadges(result.meters); // Just a fun check, doesn't save workout
        });
    }

    // --- Tabs ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = {
        myworkouts: document.getElementById('tab-myworkouts'),
        mychallenges: document.getElementById('tab-mychallenges'),
        profile: document.getElementById('tab-profile'),
        challenges: document.getElementById('tab-challenges')
    };

    function updateStarUI() {
        tabs.forEach(t => {
            const star = t.querySelector('.tab-favorite-star');
            if (star) {
                const isFav = t.dataset.tab === appData.settings.favoriteTab;
                star.innerHTML = isFav ? '★' : '☆';
                if (isFav) star.classList.add('is-favorite');
                else star.classList.remove('is-favorite');
            }
        });
    }

    tabs.forEach(tab => {
        // Handle Star Click
        const star = tab.querySelector('.tab-favorite-star');
        if (star) {
            star.addEventListener('click', async (e) => {
                e.stopPropagation();
                const tabId = tab.dataset.tab;

                // Toggle favorite
                if (appData.settings.favoriteTab === tabId) {
                    appData.settings.favoriteTab = null;
                    showNotification('Favorite Removed', 'Default tab restored to My Workouts.', '☆');
                } else {
                    appData.settings.favoriteTab = tabId;
                    showNotification('Favorite Set', `${tab.querySelector('.tab-text').textContent} is now your favorite tab!`, '★');
                }

                updateStarUI();
                await database.saveUserProfile(appData.settings);
            });
        }

        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            Object.values(tabContents).forEach(content => {
                content.classList.remove('active');
                content.classList.add('hidden');
            });
            tabContents[target].classList.remove('hidden');
            tabContents[target].classList.add('active');

            if (target === 'myworkouts') updateTargetChallengeSelect();
            if (target === 'profile') renderAchievementFacts();
        });
    });

    // --- Profile Settings ---
    const profileWeightInput = document.getElementById('profile-weight');
    const profileGenderInput = document.getElementById('profile-gender');
    const profileAgeInput = document.getElementById('profile-age');
    const profileHeightFtInput = document.getElementById('profile-height-ft');
    const profileHeightInInput = document.getElementById('profile-height-in');

    const profileGoalInput = document.getElementById('profile-goal');
    const profileWeightDateInput = document.getElementById('profile-weight-date');
    const profileGoalDateInput = document.getElementById('profile-goal-date');
    const saveProfileBtn = document.getElementById('save-profile-btn');

    let isWeightModified = false;
    let isGoalModified = false;

    const weightToggles = document.querySelectorAll('[data-unit-type="weight"]');
    const distanceToggles = document.querySelectorAll('[data-unit-type="distance"]');

    function setUnit(type, unit) {
        // Update State
        if (type === 'weight') appData.settings.unit_weight = unit;
        if (type === 'distance') appData.settings.unit_distance = unit;

        // Persist
        database.saveUserProfile(appData.settings);

        // Update UI
        const toggles = type === 'weight' ? weightToggles : distanceToggles;
        toggles.forEach(t => {
            if (t.dataset.unit === unit) t.classList.add('active');
            else t.classList.remove('active');
        });

        // Labels
        if (type === 'weight') {
            const profileLabel = document.querySelector("label[for='profile-weight']");
            if (profileLabel) profileLabel.textContent = `Default Weight`;
            const calcLabel = document.querySelector("label[for='user-weight']");
            if (calcLabel) calcLabel.textContent = `Your Weight (${unit})`;
        } else {
            const goalLabel = document.querySelector("label[for='profile-goal']");
            if (goalLabel) goalLabel.textContent = `Weekly Goal`;
        }
    }

    weightToggles.forEach(t => t.addEventListener('click', () => setUnit('weight', t.dataset.unit)));
    distanceToggles.forEach(t => t.addEventListener('click', () => setUnit('distance', t.dataset.unit)));

    // Load Settings into Input Fields
    function loadSettingsToUI() {
        if (appData.settings.weight) {
            if (weightInput) weightInput.value = appData.settings.weight;
            if (profileWeightInput) profileWeightInput.value = appData.settings.weight;
        }
        if (appData.settings.goal && profileGoalInput) {
            profileGoalInput.value = appData.settings.goal;
        }

        if (appData.settings.gender && profileGenderInput) {
            profileGenderInput.value = appData.settings.gender;
        }
        if (appData.settings.age && profileAgeInput) {
            profileAgeInput.value = appData.settings.age;
        }
        if (appData.settings.heightFt && profileHeightFtInput) {
            profileHeightFtInput.value = appData.settings.heightFt;
        }
        if (appData.settings.heightIn && profileHeightInInput) {
            profileHeightInInput.value = appData.settings.heightIn;
        }

        // Reset modification flags when loading
        isWeightModified = false;
        isGoalModified = false;

        // Update Tab Stars
        updateStarUI();
    }

    // Modification tracking
    if (profileWeightInput) profileWeightInput.addEventListener('input', () => { isWeightModified = true; });
    if (profileWeightDateInput) profileWeightDateInput.addEventListener('change', () => { isWeightModified = true; });
    if (profileGoalInput) profileGoalInput.addEventListener('input', () => { isGoalModified = true; });
    if (profileGoalDateInput) profileGoalDateInput.addEventListener('change', () => { isGoalModified = true; });

    saveProfileBtn.addEventListener('click', async () => {
        const weight = profileWeightInput.value;
        const goal = profileGoalInput.value;
        const weightDate = profileWeightDateInput ? profileWeightDateInput.value : null;
        const goalDate = profileGoalDateInput ? profileGoalDateInput.value : null;

        // Demographics
        const gender = profileGenderInput ? profileGenderInput.value : '';
        const age = profileAgeInput ? profileAgeInput.value : '';
        const heightFt = profileHeightFtInput ? profileHeightFtInput.value : '';
        const heightIn = profileHeightInInput ? profileHeightInInput.value : '';

        const oldWeight = appData.settings.weight;
        const oldGoal = appData.settings.goal;

        let profileUpdates = {
            gender: gender,
            age: age,
            heightFt: heightFt,
            heightIn: heightIn
        };

        // Log Weight if modified
        if (isWeightModified && weight) {
            await database.addWeightLog(weight, appData.settings.unit_weight || 'kg', weightDate || null);
            profileUpdates.weight = weight;
            isWeightModified = false;
        } else if (weight && weight !== oldWeight) {
            // Backup check for value change even if input event missed
            profileUpdates.weight = weight;
        }

        // Log Goal if modified
        if (isGoalModified && goal) {
            await database.addGoalLog(goal, appData.settings.unit_distance || 'km', goalDate || null);
            // Clear goal from UI and state as user requested it to be an event-like log
            if (profileGoalInput) profileGoalInput.value = '';
            appData.settings.goal = '';
            profileUpdates.goal = '';
            isGoalModified = false;
        }

        // Apply all profile updates at once
        Object.assign(appData.settings, profileUpdates);
        const success = await database.saveUserProfile(appData.settings);

        if (success) {
            showNotification('Settings Saved', 'Profile updated.', '✅');
            if (settingsDropdown) settingsDropdown.classList.add('hidden');
        } else {
            showNotification('Error', 'Failed to save settings.', '⚠️');
        }
    });

    // --- Weight & Goal History Rendering ---
    const weightHistoryBtn = document.getElementById('view-weight-history-btn');
    const goalHistoryBtn = document.getElementById('view-goal-history-btn');
    const weightHistoryList = document.getElementById('weight-history-list');
    const goalHistoryList = document.getElementById('goal-history-list');

    function formatLogDate(dateStr) {
        if (!dateStr) return 'Unknown Date';

        // Extract yyyy-mm-dd from either pure date string or ISO string
        const parts = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;

        if (parts.includes('-')) {
            const [y, m, d] = parts.split('-').map(Number);
            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                return `${m}/${d}/${y}`;
            }
        }

        // Fallback for any other format
        return dateStr;
    }

    async function renderWeightHistory() {
        if (!weightHistoryList) return;
        weightHistoryList.innerHTML = '<div style="text-align:center; padding: 0.5rem;">Loading...</div>';
        const logs = await database.getWeightLogs();
        if (logs.length === 0) {
            weightHistoryList.innerHTML = '<div style="text-align:center; color:#888;">No history yet.</div>';
            return;
        }

        weightHistoryList.innerHTML = '';
        logs.forEach(l => {
            const dateStr = formatLogDate(l.date);
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            item.style.padding = '4px 0';
            item.innerHTML = `
                <div style="flex: 1;">
                    <span style="font-weight: 600;">${l.value} ${l.unit}</span>
                    <span style="color:#888; font-size: 0.75rem; margin-left: 0.5rem;">${dateStr}</span>
                </div>
                <div style="display: flex; gap: 0.25rem;">
                    <button class="btn-icon edit-log" style="font-size: 0.8rem; opacity: 0.6;" title="Edit">✏️</button>
                    <button class="btn-icon delete-log" style="font-size: 0.8rem; opacity: 0.6; color: #ff5555;" title="Delete">🗑️</button>
                </div>
            `;

            item.querySelector('.edit-log').addEventListener('click', () => editWeightLog(l));
            item.querySelector('.delete-log').addEventListener('click', () => deleteWeightLog(l));

            weightHistoryList.appendChild(item);
        });
    }

    async function renderGoalHistory() {
        if (!goalHistoryList) return;
        goalHistoryList.innerHTML = '<div style="text-align:center; padding: 0.5rem;">Loading...</div>';
        const logs = await database.getGoalLogs();
        if (logs.length === 0) {
            goalHistoryList.innerHTML = '<div style="text-align:center; color:#888;">No history yet.</div>';
            return;
        }

        goalHistoryList.innerHTML = '';
        logs.forEach(l => {
            const isNumeric = !isNaN(parseFloat(l.value)) && isFinite(l.value);
            const displayValue = isNumeric ? `${l.value} ${l.unit}` : l.value;
            const dateStr = formatLogDate(l.date);

            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            item.style.padding = '4px 0';
            item.innerHTML = `
                <div style="flex: 1;">
                    <span style="font-weight: 600;">${displayValue}</span>
                    <span style="color:#888; font-size: 0.75rem; margin-left: 0.5rem;">${dateStr}</span>
                </div>
                <div style="display: flex; gap: 0.25rem;">
                    <button class="btn-icon edit-log" style="font-size: 0.8rem; opacity: 0.6;" title="Edit">✏️</button>
                    <button class="btn-icon delete-log" style="font-size: 0.8rem; opacity: 0.6; color: #ff5555;" title="Delete">🗑️</button>
                </div>
            `;

            item.querySelector('.edit-log').addEventListener('click', () => editGoalLog(l));
            item.querySelector('.delete-log').addEventListener('click', () => deleteGoalLog(l));

            goalHistoryList.appendChild(item);
        });
    }

    async function editWeightLog(log) {
        const newValue = prompt('Enter new weight:', log.value);
        if (newValue === null) return;
        const newDate = prompt('Enter date (YYYY-MM-DD):', log.date.includes('T') ? log.date.split('T')[0] : log.date);
        if (newDate === null) return;

        const success = await database.updateWeightLog(log.id, { value: newValue, date: newDate });
        if (success) {
            showNotification('Updated', 'Weight log updated.', '✅');
            renderWeightHistory();
        }
    }

    async function deleteWeightLog(log) {
        showConfirmation('Delete this weight log?', async () => {
            const success = await database.deleteWeightLog(log.id);
            if (success) {
                showNotification('Deleted', 'Weight log removed.', '🗑️');
                renderWeightHistory();
            }
        });
    }

    async function editGoalLog(log) {
        const newValue = prompt('Enter new goal:', log.value);
        if (newValue === null) return;
        const newDate = prompt('Enter date (YYYY-MM-DD):', log.date.includes('T') ? log.date.split('T')[0] : log.date);
        if (newDate === null) return;

        const success = await database.updateGoalLog(log.id, { value: newValue, date: newDate });
        if (success) {
            showNotification('Updated', 'Goal log updated.', '✅');
            renderGoalHistory();
        }
    }

    async function deleteGoalLog(log) {
        showConfirmation('Delete this goal log?', async () => {
            const success = await database.deleteGoalLog(log.id);
            if (success) {
                showNotification('Deleted', 'Goal log removed.', '🗑️');
                renderGoalHistory();
            }
        });
    }

    if (weightHistoryBtn) {
        weightHistoryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            weightHistoryList.classList.toggle('hidden');
            if (!weightHistoryList.classList.contains('hidden')) {
                renderWeightHistory();
            }
        });
    }

    if (goalHistoryBtn) {
        goalHistoryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            goalHistoryList.classList.toggle('hidden');
            if (!goalHistoryList.classList.contains('hidden')) {
                renderGoalHistory();
            }
        });
    }

    // --- Theme ---
    const themeBtns = document.querySelectorAll('.theme-btn');
    function setTheme(themeName) {
        document.body.classList.remove('theme-dark', 'theme-light', 'theme-neon');
        document.body.classList.add(themeName);
        themeBtns.forEach(btn => {
            if (btn.dataset.theme === themeName) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        appData.settings.theme = themeName;
        database.saveUserProfile({ theme: themeName });
    }
    themeBtns.forEach(btn => btn.addEventListener('click', () => setTheme(btn.dataset.theme)));

    // --- App Tabs (Connect/Sync tabs) ---
    // (Existing UI logic for manual inputs, keep as is)
    const appTabBtns = document.querySelectorAll('.app-tab-btn');
    const appContents = {
        peloton: document.getElementById('app-content-peloton'),
        apple: document.getElementById('app-content-apple')
    };
    appTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            appTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            Object.values(appContents).forEach(c => c.classList.add('hidden'));
            appContents[btn.dataset.appTab].classList.remove('hidden');
        });
    });

    // --- Workouts ---
    const workoutList = document.getElementById('workout-list');
    const logBtn = document.getElementById('challenge-log-workout-btn');

    // Changing the default display of bulk button in HTML might be better, but JS handles it on load.
    // Let's just fix the renderWorkouts call in logWorkout to update UI too.
    const logDescInput = document.getElementById('challenge-log-desc');
    const logKjInput = document.getElementById('challenge-log-kj');
    const logMilesInput = document.getElementById('challenge-log-miles');
    const logTypeInput = document.getElementById('challenge-log-type');
    const logCustomTypeInput = document.getElementById('challenge-log-custom-type');
    const logDateInput = document.getElementById('challenge-log-date');
    const logDurationHoursInput = document.getElementById('challenge-log-duration-hours');
    const logDurationMinutesInput = document.getElementById('challenge-log-duration-minutes');

    // Optional Inputs
    const logCadenceInput = document.getElementById('log-cadence');
    const logSpeedInput = document.getElementById('log-speed');
    const logResistanceInput = document.getElementById('log-resistance');
    const logElevationInput = document.getElementById('log-elevation');
    const logPaceInput = document.getElementById('log-pace');
    const logCaloriesInput = document.getElementById('log-calories');
    const logNotesInput = document.getElementById('log-notes');
    const logHrInput = document.getElementById('log-hr');
    const logIntensityInput = document.getElementById('log-intensity');

    // --- Calories to KJ Auto-Conversion ---
    if (logCaloriesInput && logKjInput) {
        // logCaloriesInput.addEventListener('input', () => {
        //     const kcal = parseFloat(logCaloriesInput.value);
        //     if (!isNaN(kcal)) {
        //         logKjInput.value = Math.round(kcal * 4.184);
        //     } else {
        //         logKjInput.value = '';
        //     }
        // });

        // logKjInput.addEventListener('input', () => {
        //     const kj = parseFloat(logKjInput.value);
        //     if (!isNaN(kj)) {
        //         logCaloriesInput.value = Math.round(kj / 4.184);
        //     } else {
        //         logCaloriesInput.value = '';
        //     }
        // });
    }



    // Set today's date as default
    function setTodayDate() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        if (logDateInput) logDateInput.value = todayStr;
        if (profileWeightDateInput) profileWeightDateInput.value = todayStr;
        if (profileGoalDateInput) profileGoalDateInput.value = todayStr;
    }
    // Initialize with today's date
    setTodayDate();

    const clearFormBtn = document.getElementById('clear-form-btn');
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', () => {
            cancelEdit(); // Re-use cancel logic to clear form, but we might want to keep the mode as 'adding'.
            // cancelEdit resets everything and also hides the cancel button/resets button text, which is fine as "Clear" usually implies aborting the current complex entry or starting fresh.
            // If we really just want to clear inputs but NOT exit edit mode if we were in it (edge case), we'd write a separate function.
            // But usually "Clear" = "Reset to default state".
            // Let's stick to using cancelEdit() for simplicity as it clears everything and resets state.
        });
    }

    // Helper for Calculation Popup
    function showCalculationPopup(title, message, isError = false) {
        const overlay = document.createElement('div');
        overlay.className = 'calc-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'calc-modal';
        if (isError) modal.classList.add('error-theme');

        const icon = document.createElement('span');
        icon.className = 'calc-modal-icon';
        icon.textContent = isError ? '⚠️' : '⚡';

        const h2 = document.createElement('h2');
        h2.className = 'calc-modal-title';
        h2.textContent = title;

        const content = document.createElement('div');
        content.className = 'calc-modal-content';
        content.textContent = message;

        const btn = document.createElement('button');
        btn.className = 'calc-modal-btn';
        btn.textContent = isError ? 'Fix Issues' : 'Awesome';

        btn.onclick = () => {
            // Animate out? Or just remove.
            // Simple interaction for now.
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };

        // Assemble
        modal.appendChild(icon);
        modal.appendChild(h2);
        modal.appendChild(content);
        modal.appendChild(btn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    // --- Advanced Calorie Calculator ---
    function calculateAdvancedCalories(profile, workoutData) {
        // 1. Inputs
        const age = parseFloat(profile.age) || 30;
        const gender = profile.gender || 'male';
        const weight = parseFloat(profile.weight) || 80;
        const weightUnit = profile.unit_weight || 'kg';
        const weightKg = weightUnit === 'lbs' ? weight * 0.453592 : weight;

        const description = (workoutData.description || '').toLowerCase();
        const intensity = parseFloat(workoutData.intensity) || 5; // 1-10
        const durationMins = parseFloat(workoutData.durationMinutes) || 0;
        const hr = parseFloat(workoutData.heartRate) || 0;
        const heightFt = parseFloat(profile.heightFt) || 0;
        const heightIn = parseFloat(profile.heightIn) || 0;

        if (durationMins <= 0) return { calories: 0, kj: 0, met: 0, explanation: 'Duration is 0' };

        // 2. Determine Base METs from Keywords
        let baseMet = 5; // Default "Moderate Activity"
        let activityName = "General Workout";

        const keywords = [
            { words: ['run', 'jog', 'sprint', 'marathon'], met: 8, name: 'Running' },
            { words: ['bike', 'cycle', 'cycling', 'spin'], met: 7, name: 'Cycling' },
            { words: ['swim', 'pool', 'laps'], met: 6, name: 'Swimming' },
            { words: ['walk', 'stroll'], met: 3.5, name: 'Walking' },
            { words: ['hike', 'hiking', 'climb'], met: 7, name: 'Hiking' },
            { words: ['lift', 'weight', 'strength', 'gym', 'muscle'], met: 5, name: 'Weightlifting' },
            { words: ['hiit', 'interval', 'crossfit', 'bootcamp'], met: 8, name: 'HIIT' },
            { words: ['yoga', 'pilates', 'stretch'], met: 3, name: 'Yoga' },
            { words: ['dance', 'zumba'], met: 6, name: 'Dancing' },
            { words: ['row', 'erg'], met: 7, name: 'Rowing' }
        ];

        for (const k of keywords) {
            if (k.words.some(w => description.includes(w))) {
                baseMet = k.met;
                activityName = k.name;
                break;
            }
        }

        // 3. Adjust METs based on Intensity (1-10)
        // Scale: 10 = 1.5x Base, 1 = 0.5x Base, 5 = 1.0x Base
        // Formula: Multiplier = 0.5 + (Intensity / 10)
        // Wait, standard range is usually +/-. Let's do:
        // Intensity 5 is baseline. 
        // 10 should probably be higher for things like running (8 -> 12+).
        // Let's use a dynamic scaler:
        // Adjusted = Base * (0.6 + (Intensity * 0.08)) -> Int 5 = 1.0x, Int 10 = 1.4x, Int 1 = 0.68x
        const intensityMultiplier = 0.6 + (intensity * 0.08);
        const finalMet = baseMet * intensityMultiplier;

        // 4. Calculate Calories (MET Formula)
        // Calories = MET * Weight(kg) * Duration(hours)
        const durationHours = durationMins / 60;
        let metCalories = finalMet * weightKg * durationHours;

        // 5. Heart Rate Calculation (Keytel Formula) - If HR available
        let hrCalories = 0;
        if (hr > 0) {
            if (gender === 'female') {
                hrCalories = (-20.4022 + (0.4472 * hr) - (0.1263 * weightKg) + (0.074 * age)) * durationMins / 4.184;
            } else {
                hrCalories = (-55.0969 + (0.6309 * hr) + (0.1988 * weightKg) + (0.2017 * age)) * durationMins / 4.184;
            }
        }

        // 6. Final Logic
        let finalCalories = metCalories;
        let explanation = `Estimated based on '${activityName}' (MET ${finalMet.toFixed(1)}) and intensity ${intensity}/10.`;

        // If we have HR data, it's usually more personalized for effort, but METs accounts for the specific biomechanics of the logic better if HR is low/high due to non-effort factors.
        // Let's average them if both exist for a "Balanced" approach, or lean on HR?
        // User asked to explain the MET value used. So we should prioritize the MET calculation but maybe verify with HR.
        // Let's stick to METs as requested for the explanation, but maybe incorporate HR if it's significantly different?
        // Simplest interpretation of request: "Explain the MET value used... determine calories... use formula for kJ".
        // I will return the MET-derived calories as primary, but maybe blend if HR differs wildy.
        // Actually, the prompt says "Heart Rate Data: [Optional]... Please provide estimated range... and explain MET".
        // I'll stick to the MET formula as the primary source of truth for "Explain MET", but if HR is present, I'll average it for the final number to be more accurate, noting it.

        if (hr > 0 && hrCalories > 0) {
            finalCalories = (metCalories + hrCalories) / 2;
            explanation += ` Adjusted using Heart Rate data (${hr} bpm).`;
        }

        // Kilojoules
        const kj = finalCalories * 4.184;

        return {
            calories: Math.round(finalCalories),
            kj: Math.round(kj),
            met: finalMet.toFixed(1),
            explanation: explanation
        };
    }

    // Main Log Workout Function
    async function logWorkout() {
        let type = logTypeInput.value;
        if (type === 'custom' && logCustomTypeInput) {
            type = logCustomTypeInput.value.trim() || 'Custom';
        }
        let dateInput = logDateInput.value.trim();

        // Construct duration string HH:MM
        let durationInput = '';
        const hrs = logDurationHoursInput ? logDurationHoursInput.value.trim() : '';
        const mins = logDurationMinutesInput ? logDurationMinutesInput.value.trim() : '';

        if (hrs || mins) {
            const h = hrs ? parseInt(hrs) : 0;
            const m = mins ? parseInt(mins) : 0;
            // Pad with leading zeros
            durationInput = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }

        const desc = logDescInput.value.trim();
        let kjValue = parseFloat(logKjInput.value) || null;
        const milesValue = parseFloat(logMilesInput.value) || null;

        // Capture Optional Values
        const cadence = logCadenceInput ? (parseFloat(logCadenceInput.value) || null) : null;
        const speed = logSpeedInput ? (parseFloat(logSpeedInput.value) || null) : null;
        const resistance = logResistanceInput ? (parseFloat(logResistanceInput.value) || null) : null;
        const elevation = logElevationInput ? (parseFloat(logElevationInput.value) || null) : null;
        const pace = logPaceInput ? logPaceInput.value.trim() : null;
        let calories = logCaloriesInput ? (parseFloat(logCaloriesInput.value) || null) : null;
        const notes = logNotesInput ? logNotesInput.value.trim() : null;
        const heartRate = logHrInput ? (parseFloat(logHrInput.value) || null) : null;
        const intensity = logIntensityInput ? (parseFloat(logIntensityInput.value) || null) : null;

        // --- Auto-Determine Logic ---
        const autoDetermine = document.getElementById('auto-determine-energy');
        if (autoDetermine && autoDetermine.checked) {
            // Validation: Check for missing required fields
            const missingFields = [];

            // Profile Checks
            if (!appData.settings.age) missingFields.push('Age (in Settings)');
            if (!appData.settings.weight) missingFields.push('Weight (in Settings)');
            if (!appData.settings.gender) missingFields.push('Gender (in Settings)');
            if (!appData.settings.heightFt && !appData.settings.heightIn) missingFields.push('Height (in Settings)');

            // Input Checks
            if (!desc) missingFields.push('Description');

            const h = logDurationHoursInput ? (parseInt(logDurationHoursInput.value) || 0) : 0;
            const m = logDurationMinutesInput ? (parseInt(logDurationMinutesInput.value) || 0) : 0;
            if (h === 0 && m === 0) missingFields.push('Duration');

            // Check intensity (explicit check for null since 0 might be coerced to null in extraction above, but 0 is technically a value)
            // However, current extraction: const intensity = ... (parseFloat() || null). 0 becomes null.
            if (intensity === null) missingFields.push('Intensity Level');

            if (missingFields.length > 0) {
                showCalculationPopup(
                    'Missing Information',
                    'Please fill in the following to calculate energy:\n\n' + missingFields.map(f => '• ' + f).join('\n'),
                    true
                );
                return;
            }

            let estimatedCal = calories;
            let estimatedKj = kjValue;

            // 1. Cross-fill if one exists (using 4.184 factor)
            if (estimatedKj && !estimatedCal) estimatedCal = Math.round(estimatedKj / 4.184);
            else if (estimatedCal && !estimatedKj) estimatedKj = Math.round(estimatedCal * 4.184);

            // 2. Calculate if both missing
            else if (!estimatedKj && !estimatedCal) {
                // Prepare Data for Calculator
                const durationH = logDurationHoursInput ? (parseInt(logDurationHoursInput.value) || 0) : 0;
                const durationM = logDurationMinutesInput ? (parseInt(logDurationMinutesInput.value) || 0) : 0;
                const totalMins = (durationH * 60) + durationM;

                const calcResult = calculateAdvancedCalories(appData.settings, {
                    description: desc,
                    intensity: intensity, // validated as not null/und earlier if checked
                    durationMinutes: totalMins,
                    heartRate: heartRate
                });

                if (calcResult.calories > 0) {
                    estimatedCal = calcResult.calories;
                    estimatedKj = calcResult.kj;

                    // Show the explanation to the user!
                    showCalculationPopup(
                        'Energy Estimate',
                        `Based on your workout:\n\nCalories: ${estimatedCal} kcal\nKilojoules: ${estimatedKj} kJ\n\n${calcResult.explanation}`
                    );

                    // Explicitly populate the inputs for visibility (even if cleared shortly after, it ensures data integrity flow)
                    if (logCaloriesInput) logCaloriesInput.value = estimatedCal;
                    if (logKjInput) logKjInput.value = estimatedKj;

                    // Add explanation to notes if empty
                    if (!notes) {
                        // We can't easily update the 'const notes' variable we read earlier without modifying the 'newWorkout' object construction later.
                        // But we can append it to the description or just let the user see the alert.
                        // The prompt implies we just need to "provide" it. The Alert does that.
                    }
                }
            }

            // Update variables
            if (estimatedCal) calories = estimatedCal;
            if (estimatedKj) kjValue = estimatedKj;
        }



        // HTML5 date input provides yyyy-mm-dd format
        let date;
        if (!dateInput) {
            // Default to today's date in ISO format
            date = new Date().toISOString().split('T')[0];
        } else {
            // Date input already in yyyy-mm-dd format from HTML5 date picker
            date = dateInput;
        }

        if (!desc) return showNotification('Error', 'Please enter a description.', '⚠️');
        if (!kjValue && !milesValue) return showNotification('Error', 'Enter kJ or miles.', '⚠️');

        const tempId = Date.now().toString(); // Generate temp ID
        const newWorkout = {
            type, date, duration: durationInput, title: desc, outputKj: kjValue, miles: milesValue,
            output: kjValue || milesValue,
            metricType: kjValue ? 'output' : 'miles',
            cadence, speed, resistance, elevation, pace, calories, notes, heartRate, intensity, // Add new fields
            id: tempId // Use temp ID initially
        };
        console.log('DEBUG: Logging Workout with temp ID:', tempId, newWorkout);

        // UI Update (Optimistic)
        appData.workouts.unshift(newWorkout);
        renderWorkouts();
        // Reset Bulk UI since new item is unchecked
        if (typeof updateSelectAllState === 'function') updateSelectAllState();
        if (typeof updateBulkActionUI === 'function') updateBulkActionUI();


        // Cloud Update
        try {
            const docId = await database.addWorkout(newWorkout);
            console.log(`🔄 Updating workout ID: ${tempId} -> ${docId}`);

            // Find the workout by its TEMP ID and update it with the real Firestore ID
            const workoutIndex = appData.workouts.findIndex(w => w.id === tempId);
            if (workoutIndex !== -1) {
                appData.workouts[workoutIndex].id = docId;
                console.log('✅ Successfully updated workout ID in local array');
            } else {
                console.error('⚠️ Could not find workout with temp ID:', tempId);
            }

            // Re-render to ensure DOM has the correct ID for selection
            renderWorkouts();

            showNotification('Logged', 'Workout saved to cloud!', '☁️');
        } catch (e) {
            console.error(e);
            showNotification('Saved Local', 'Could not sync to cloud.', '⚠️');
        }

        // Clear and reset to today's date
        logDescInput.value = '';
        logKjInput.value = '';
        logMilesInput.value = '';
        if (logDurationHoursInput) logDurationHoursInput.value = '';
        if (logDurationMinutesInput) logDurationMinutesInput.value = '';

        // Clear Optional Inputs
        if (logCadenceInput) logCadenceInput.value = '';
        if (logSpeedInput) logSpeedInput.value = '';
        if (logResistanceInput) logResistanceInput.value = '';
        if (logElevationInput) logElevationInput.value = '';
        if (logPaceInput) logPaceInput.value = '';
        if (logCaloriesInput) logCaloriesInput.value = '';
        if (logNotesInput) logNotesInput.value = '';
        if (logHrInput) logHrInput.value = '';
        if (logIntensityInput) logIntensityInput.value = '';
        setTodayDate();

        // Return to home view (My Workouts)
        const workoutTab = document.querySelector('.tab-btn[data-tab="myworkouts"]');
        if (workoutTab) workoutTab.click();

        // Ensure Optional Details are closed
        const details = document.getElementById('details-container');
        if (details) details.open = false;

        // Uncheck Auto-Determine Energy
        const autoDet = document.getElementById('auto-determine-energy');
        if (autoDet) {
            autoDet.checked = false;
            autoDet.dispatchEvent(new Event('change'));
        }
    }
    if (logBtn) logBtn.addEventListener('click', () => {
        if (editingWorkoutId) {
            updateWorkout();
        } else {
            logWorkout();
        }
    });

    // Helper function to format date from ISO (yyyy-mm-dd) to mm/dd/yyyy
    function formatDateForDisplay(isoDate) {
        if (!isoDate) return '';
        const parts = isoDate.split('-');
        if (parts.length !== 3) return isoDate;
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        return `${parseInt(month)}/${parseInt(day)}/${year}`;
    }

    // Helper function to format duration from HH:MM to readable format
    function formatDurationForDisplay(duration) {
        if (!duration) return '';
        const parts = duration.split(':');
        if (parts.length !== 2) return duration;
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);

        if (hours === 0 && minutes === 0) return '';
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    }

    // Helper function to calculate total duration from an array of workouts
    function calculateTotalDuration(workouts) {
        let totalMinutes = 0;

        workouts.forEach(w => {
            if (w.duration) {
                const parts = w.duration.split(':');
                if (parts.length === 2) {
                    const hours = parseInt(parts[0]) || 0;
                    const minutes = parseInt(parts[1]) || 0;
                    totalMinutes += (hours * 60) + minutes;
                }
            }
        });

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        // Return in HH:MM format
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        return `${hh}:${mm}`;
    }


    let editingWorkoutId = null;

    // Edit workout function
    function editWorkout(workout) {
        editingWorkoutId = workout.id;

        // Populate form with workout data
        const knownTypes = ['bike', 'run', 'walk', 'hike'];
        if (knownTypes.includes(workout.type)) {
            logTypeInput.value = workout.type;
            if (logCustomTypeInput) logCustomTypeInput.classList.add('hidden');
        } else {
            logTypeInput.value = 'custom';
            if (logCustomTypeInput) {
                logCustomTypeInput.value = workout.type;
                logCustomTypeInput.classList.remove('hidden');
            }
        }
        logDescInput.value = workout.title || '';
        logKjInput.value = workout.outputKj || '';
        logMilesInput.value = workout.miles || '';
        if (logCaloriesInput) logCaloriesInput.value = workout.calories || '';
        if (logHrInput) logHrInput.value = workout.heartRate || '';
        if (logIntensityInput) logIntensityInput.value = workout.intensity || '';
        // HTML5 date input expects yyyy-mm-dd format, which is what we store
        logDateInput.value = workout.date || '';
        // HTML5 date input expects yyyy-mm-dd format, which is what we store
        logDateInput.value = workout.date || '';

        if (workout.duration) {
            const parts = workout.duration.split(':');
            if (parts.length === 2) {
                if (logDurationHoursInput) logDurationHoursInput.value = parseInt(parts[0]);
                if (logDurationMinutesInput) logDurationMinutesInput.value = parseInt(parts[1]);
            }
        } else {
            if (logDurationHoursInput) logDurationHoursInput.value = '';
            if (logDurationMinutesInput) logDurationMinutesInput.value = '';
        }

        // Change button text to "Update" and show cancel button
        logBtn.textContent = 'Update Workout';
        logBtn.style.background = 'var(--accent-secondary)';

        const cancelBtn = document.getElementById('cancel-edit-btn');
        if (cancelBtn) cancelBtn.style.display = 'block';

        // Scroll to form
        logDescInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        logDescInput.focus();

        showNotification('Edit Mode', 'Modify the workout and click Update.', '✏️');
    }

    // Update workout function
    async function updateWorkout() {
        if (!editingWorkoutId) return;

        let type = logTypeInput.value;
        if (type === 'custom' && logCustomTypeInput) {
            type = logCustomTypeInput.value.trim() || 'Custom';
        }
        let dateInput = logDateInput.value.trim();

        // Construct duration string HH:MM
        let durationInput = '';
        const hrs = logDurationHoursInput ? logDurationHoursInput.value.trim() : '';
        const mins = logDurationMinutesInput ? logDurationMinutesInput.value.trim() : '';

        if (hrs || mins) {
            const h = hrs ? parseInt(hrs) : 0;
            const m = mins ? parseInt(mins) : 0;
            durationInput = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }

        const desc = logDescInput.value.trim();
        const kjValue = parseFloat(logKjInput.value) || null;
        const milesValue = parseFloat(logMilesInput.value) || null;
        const caloriesValue = logCaloriesInput ? (parseFloat(logCaloriesInput.value) || null) : null;
        const heartRateValue = logHrInput ? (parseFloat(logHrInput.value) || null) : null;
        const intensityValue = logIntensityInput ? (parseFloat(logIntensityInput.value) || null) : null;

        // HTML5 date input provides yyyy-mm-dd format
        let date;
        if (!dateInput) {
            date = new Date().toISOString().split('T')[0];
        } else {
            // Date input already in yyyy-mm-dd format from HTML5 date picker
            date = dateInput;
        }

        if (!desc) return showNotification('Error', 'Please enter a description.', '⚠️');
        if (!kjValue && !milesValue) return showNotification('Error', 'Enter kJ or miles.', '⚠️');

        // Find and update the workout in local array
        const workoutIndex = appData.workouts.findIndex(w => w.id === editingWorkoutId);
        if (workoutIndex === -1) {
            showNotification('Error', 'Workout not found.', '⚠️');
            cancelEdit();
            return;
        }

        const updatedWorkout = {
            ...appData.workouts[workoutIndex],
            type,
            date,
            duration: durationInput,
            title: desc,
            outputKj: kjValue,
            miles: milesValue,
            calories: caloriesValue,
            heartRate: heartRateValue,
            intensity: intensityValue,
            output: kjValue || milesValue,
            metricType: kjValue ? 'output' : 'miles'
        };

        // Update local array
        appData.workouts[workoutIndex] = updatedWorkout;

        // Update in cloud
        try {
            await database.updateWorkout(editingWorkoutId, updatedWorkout);
            showNotification('Updated', 'Workout updated successfully!', '✅');
        } catch (e) {
            console.error(e);
            showNotification('Warning', 'Updated locally but cloud sync failed.', '⚠️');
        }

        // Re-render and reset
        renderWorkouts();
        renderMyChallenges();
        renderAchievementFacts();
        cancelEdit();

        // Return to home view (My Workouts)
        const workoutTab = document.querySelector('.tab-btn[data-tab="myworkouts"]');
        if (workoutTab) workoutTab.click();

        // Ensure Optional Details are closed
        const details = document.getElementById('details-container');
        if (details) details.open = false;

        // Uncheck Auto-Determine Energy
        const autoDet = document.getElementById('auto-determine-energy');
        if (autoDet) {
            autoDet.checked = false;
            autoDet.dispatchEvent(new Event('change'));
        }
    }

    // Cancel edit mode
    function cancelEdit() {
        editingWorkoutId = null;
        logBtn.textContent = 'Log Workout';
        logBtn.style.background = '';

        const cancelBtn = document.getElementById('cancel-edit-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';

        logDescInput.value = '';
        logKjInput.value = '';
        logMilesInput.value = '';
        if (logDurationHoursInput) logDurationHoursInput.value = '';
        if (logDurationMinutesInput) logDurationMinutesInput.value = '';
        if (logCustomTypeInput) {
            logCustomTypeInput.value = '';
            logCustomTypeInput.classList.add('hidden');
        }
        if (logHrInput) logHrInput.value = '';
        if (logIntensityInput) logIntensityInput.value = '';
        setTodayDate();
    }

    // Cancel button event listener
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            cancelEdit();
            showNotification('Cancelled', 'Edit mode cancelled.', 'ℹ️');
        });
    }

    function renderWorkouts() {
        const historyList = document.getElementById('workout-history-list');
        const workoutList = document.getElementById('workout-list');

        if (workoutList) workoutList.innerHTML = '';
        if (historyList) historyList.innerHTML = '';

        if (appData.workouts.length === 0) {
            workoutList.innerHTML = '<p style="color: grey; font-style: italic;">No workouts yet.</p>';
            return;
        }

        // Defensive check
        if (!Array.isArray(appData.workouts)) {
            appData.workouts = [];
        }

        // Sort workouts descending by date (Safe Sort)
        try {
            appData.workouts.sort((a, b) => {
                const dateA = a.date ? new Date(a.date) : new Date(0);
                const dateB = b.date ? new Date(b.date) : new Date(0);
                return dateB - dateA;
            });
        } catch (e) {
            console.error('Error sorting workouts:', e);
        }

        const recentLogs = [];
        const historyLogs = [];
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 5);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        appData.workouts.forEach(w => {
            if (w.date >= cutoffStr) recentLogs.push(w);
            else historyLogs.push(w);
        });

        const renderItem = (w, container) => {
            const item = document.createElement('div');
            item.className = 'workout-item';

            // ... (Same Edit/Display Logic as before) ...

            // Simplified for brevity in replacement (keeping core logic):
            const icon = '💪'; // Simplified icon mapping
            let metricDisplay = '';
            if (w.outputKj && w.miles) metricDisplay = `${w.outputKj} kJ • ${w.miles} mi`;
            else if (w.outputKj) metricDisplay = `${w.outputKj} kJ`;
            else if (w.miles) metricDisplay = `${w.miles} mi`;
            else metricDisplay = `${w.output}`;

            const formattedDate = formatDateForDisplay(w.date);
            const formattedDuration = formatDurationForDisplay(w.duration);
            const durationDisplay = formattedDuration ? ` • ${formattedDuration}` : '';


            item.innerHTML = `
                <div style="display: flex; align-items: center; margin-right: 0.75rem;">
                    <input type="checkbox" class="workout-checkbox" data-id="${w.id}" style="cursor: pointer; transform: scale(1.2);">
                </div>
                <div class="workout-details" style="flex:1;">
                    <div class="workout-title" style="font-weight:600;">${w.title}</div>
                    <div class="workout-meta" style="font-size:0.8rem; color:#aaa;">${formattedDate} • ${metricDisplay}${durationDisplay}</div>
                </div>
                <div class="workout-actions" style="display: flex; gap: 0.5rem;">
                    <button class="btn-icon edit" data-id="${w.id}" title="Edit">✏️</button>
                    <button class="btn-icon delete" data-id="${w.id}" title="Delete">🗑️</button>
                </div>
            `;
            container.appendChild(item);

            // Edit button handler
            item.querySelector('.edit').addEventListener('click', () => {
                editWorkout(w);
            });

            item.querySelector('.delete').addEventListener('click', () => {
                showConfirmation('Delete workout?', async () => {
                    const revertedCount = await deleteWorkoutLogic(w.id);

                    renderWorkouts();
                    if (revertedCount > 0) renderMyChallenges();
                    renderAchievementFacts();
                    updateChallengeSummary();
                    updateBulkActionUI();

                    showNotification('Deleted', 'Workout removed.', '🗑️');
                });
            });
        };

        recentLogs.forEach(w => renderItem(w, workoutList));
        if (historyList) historyLogs.forEach(w => renderItem(w, historyList));

        // History Toggle Listener (Ensure it's attached)
        const historyHeader = document.getElementById('history-header');
        const historyToggleIcon = document.getElementById('history-toggle-icon');

        if (historyHeader) {
            // Remove old listener to prevent duplicates (cloneNode trick or just ensure single binding)
            // Ideally bind once, but renderWorkouts runs often. 
            // Better to check if listener attached? Hard.
            // Let's us cloneNode to clear previous listeners
            const newHeader = historyHeader.cloneNode(true);
            historyHeader.parentNode.replaceChild(newHeader, historyHeader);

            newHeader.addEventListener('click', () => {
                const list = document.getElementById('workout-history-list');
                const icon = newHeader.querySelector('#history-toggle-icon');
                if (list) {
                    list.classList.toggle('hidden');
                    if (icon) icon.style.transform = list.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            });
        }

        // Checkboxes Logic (Challenge Adding + Bulk Delete)
        document.querySelectorAll('.workout-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                updateChallengeSummary();
                updateBulkActionUI();
            });
        });

        // Update Select All Checkbox State based on individual selections
        updateSelectAllState();
        updateBulkActionUI();
    }

    // --- Bulk Action & Deletion Logic ---
    const selectAllCheckbox = document.getElementById('select-all-workouts');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');

    function updateSelectAllState() {
        const checkboxes = document.querySelectorAll('.workout-checkbox');
        if (checkboxes.length === 0) {
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            return;
        }
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        if (selectAllCheckbox) selectAllCheckbox.checked = allChecked;
    }

    function updateBulkActionUI() {
        const checked = document.querySelectorAll('.workout-checkbox:checked');
        const count = checked.length;

        if (bulkDeleteBtn) {
            bulkDeleteBtn.style.display = count > 0 ? 'block' : 'none';
            bulkDeleteBtn.innerHTML = `🗑️ Delete Selected (${count})`;
        }
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.workout-checkbox').forEach(cb => {
                cb.checked = isChecked;
            });
            updateChallengeSummary();
            updateBulkActionUI();
        });
    }

    async function deleteWorkoutLogic(workoutId) {
        console.log('🗑️ Attempting to delete workout:', workoutId);
        const w = appData.workouts.find(x => x.id === workoutId);
        if (!w) {
            console.warn('⚠️ Workout not found in local data:', workoutId);
            return 0;
        }

        console.log('📝 Found workout to delete:', w);

        // 1. Remove from local list
        const beforeCount = appData.workouts.length;
        appData.workouts = appData.workouts.filter(x => x.id !== w.id);
        const afterCount = appData.workouts.length;
        console.log(`✂️ Removed from local array: ${beforeCount} -> ${afterCount}`);

        // 2. Revert Challenge Progress
        let revertedCount = 0;
        appData.challenges.my.forEach(c => {
            if (c.contributions) {
                const relevantMap = c.contributions.filter(contrib => contrib.workoutId === w.id);
                if (relevantMap.length > 0) {
                    relevantMap.forEach(r => {
                        c.progress = Math.max(0, c.progress - r.amount);
                    });
                    // Remove contribution record
                    c.contributions = c.contributions.filter(contrib => contrib.workoutId !== w.id);
                    revertedCount++;
                }
            }
        });

        if (revertedCount > 0) {
            console.log(`↩️ Reverted ${revertedCount} challenge contributions`);
            await saveMyChallengesProp();
            await syncTrophies(); // Ensure trophies are synced after reverting progress
        }

        // 3. Delete from cloud
        try {
            const deleted = await database.deleteWorkout(w.id);
            if (deleted) {
                console.log('☁️ Successfully deleted from cloud:', w.id);
            } else {
                console.error('❌ Failed to delete from cloud:', w.id);
            }
        } catch (error) {
            console.error('❌ Error deleting from cloud:', error);
        }

        return revertedCount;
    }

    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', () => {
            const checked = document.querySelectorAll('.workout-checkbox:checked');
            if (checked.length === 0) return;

            const count = checked.length;
            showConfirmation(`Delete ${count} workout${count > 1 ? 's' : ''}?`, async () => {
                let totalReverted = 0;

                // Process deletions
                for (const cb of checked) {
                    const reverted = await deleteWorkoutLogic(cb.dataset.id);
                    if (reverted) totalReverted += reverted;
                }

                renderWorkouts();
                renderMyChallenges(); // Update progress rings
                renderAchievementFacts(); // Update Stats
                updateChallengeSummary();
                updateBulkActionUI();

                showNotification('Deleted', `Removed ${count} workouts.`, '🗑️');
                if (totalReverted > 0) {
                    showNotification('Reverted', `Updated ${totalReverted} challenge contributions.`, '↩️');
                }
            });
        });
    }


    // --- Challenges & Badge Logic ---
    const badges = [
        { id: 'first-ride', threshold: 10, name: 'First Ride' },
        { id: 'eiffel', threshold: 324, name: 'Eiffel Tower' },
        { id: 'montblanc', threshold: 4807, name: 'Mont Blanc' },
        { id: 'kilimanjaro', threshold: 5895, name: 'Kilimanjaro' },
        { id: 'k2', threshold: 8611, name: 'K2' },
        { id: 'everest', threshold: 8848, name: 'Mt. Everest' }
    ];

    function checkBadges(meters) {
        // This checks based on just input? Or total? 
        // Original logic checked input vs threshold? No, total progress vs threshold usually.
        // Actually original checkBadges was called with result.meters (single calc).
        // That seems wrong if achievements are cumulative. 
        // Let's implement based on Cumulative Total.
        const stats = calculateTotalProgress();
        const totalMeters = stats.climbingMeters; // Use total!

        badges.forEach(badge => {
            if (totalMeters >= badge.threshold && !appData.badges.includes(badge.id)) {
                unlockBadge(badge);
            }
        });
    }

    async function unlockBadge(badge) {
        appData.badges.push(badge.id);
        updateBadgeUI(badge.id);
        await database.saveUnlockedBadges(appData.badges);
        alert(`🏆 Unlocked: ${badge.name}!`);
    }

    function updateBadgeUI(badgeId) {
        const badgeEl = document.getElementById(`badge-${badgeId}`);
        if (badgeEl) {
            badgeEl.classList.remove('locked');
            badgeEl.classList.add('unlocked');
        }
    }

    function loadBadges() {
        appData.badges.forEach(id => updateBadgeUI(id));
    }

    // --- Trophy Logic ---
    async function syncTrophies() {
        console.log('🔄 Syncing trophies (awards and removals)...');
        const myChallenges = appData.challenges.my || [];
        const trophies = appData.trophies || [];
        let changed = false;

        console.log(`📊 Current State: ${myChallenges.length} active challenges, ${trophies.length} trophies.`);

        // 1. Add missing trophies
        myChallenges.forEach(challenge => {
            const total = challenge.type === 'climbing' ? challenge.height : challenge.distance;
            const progress = parseFloat(challenge.progress) || 0;
            const isCompleted = progress >= parseFloat(total) - 0.1;

            if (isCompleted) {
                const existing = trophies.find(t => t.instanceId === challenge.instanceId || (t.challengeId === challenge.id && !t.instanceId));
                if (!existing) {
                    console.log('✨ Awarding trophy for:', challenge.title);
                    const trophy = {
                        id: 'trophy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        instanceId: challenge.instanceId,
                        challengeId: challenge.id,
                        title: challenge.title,
                        type: challenge.type,
                        dateEarned: new Date().toISOString(),
                        height: challenge.height || null,
                        distance: challenge.distance || null
                    };
                    appData.trophies.unshift(trophy);
                    changed = true;
                }
            }
        });

        // 2. Remove orphaned trophies
        const initialCount = appData.trophies.length;
        appData.trophies = appData.trophies.filter(trophy => {
            // Find the corresponding challenge in active list
            const challenge = myChallenges.find(c =>
                c.instanceId === trophy.instanceId ||
                (c.id === trophy.challengeId && !trophy.instanceId) ||
                (c.title === trophy.title && !trophy.instanceId && !trophy.challengeId)
            );

            // If challenge exists in active list but is NOT complete, REMOVE trophy
            if (challenge) {
                const total = challenge.type === 'climbing' ? challenge.height : challenge.distance;
                const isCompleted = parseFloat(challenge.progress) >= parseFloat(total) - 0.1;

                if (!isCompleted) {
                    console.log(`🗑️ Removing trophy for incomplete challenge: "${trophy.title}" (Progress: ${challenge.progress}/${total})`);
                    return false;
                }
                return true;
            }

            // If challenge NOT found in active list:
            // This is tricky. Do we keep historical trophies for challenges the user has "removed"?
            // Usually YES, unless the user wants to nuke everything.
            // But if the user says "it's still there" after deleting a workout, they likely expect it to be gone.
            // However, a common scenario for it being "still there" but unexpected is if there's a DUPLICATE 
            // or a LEGACY trophy that doesn't share an instanceId.

            return true; // Keep trophies for challenges not in the active list (historic)
        });

        if (appData.trophies.length !== initialCount) {
            changed = true;
            console.log(`🧹 syncTrophies: Removed ${initialCount - appData.trophies.length} trophies.`);
        }

        if (changed) {
            await database.saveTrophies(appData.trophies);
            renderTrophies();
            if (appData.trophies.length < initialCount) {
                showNotification('Trophies Updated', 'Trophy case updated.', '🏆');
            } else if (appData.trophies.length > initialCount) {
                showNotification('Trophies Updated', 'New trophy awarded!', '🏆');
            }
        } else {
            console.log('✅ Trophies already in sync.');
        }
    }

    // Expose for manual console debug
    window.syncTrophies = syncTrophies;

    async function awardTrophy(challenge) {
        const existing = appData.trophies.find(t => t.instanceId === challenge.instanceId);
        if (existing) return;

        const trophy = {
            id: 'trophy_' + Date.now(),
            instanceId: challenge.instanceId,
            challengeId: challenge.id,
            title: challenge.title,
            type: challenge.type,
            dateEarned: new Date().toISOString(),
            height: challenge.height || null,
            distance: challenge.distance || null
        };

        appData.trophies.unshift(trophy); // Add to top

        try {
            await database.saveTrophies(appData.trophies);
        } catch (error) {
            console.error('Error saving trophy:', error);
        }

        renderTrophies();
        showNotification('Trophy Earned!', `${challenge.title} completed!`, '🏆');
    }

    function showTrophySummary(trophy) {
        console.log('🏆 Showing summary for:', trophy.title);

        // 1. Find the challenge data
        const challenge = appData.challenges.my.find(c => c.instanceId === trophy.instanceId);

        // 2. Aggregate Stats (Default to 0 if challenge missing)
        let totalTime = 0;
        let totalKj = 0;
        let totalDist = 0;
        let totalElev = 0;
        let workoutCount = 0;
        let firstDate = null;
        let lastDate = null;

        if (challenge && challenge.contributions) {
            const contributions = challenge.contributions || [];
            const contributingWorkouts = [];

            contributions.forEach(contrib => {
                const workout = appData.workouts.find(w => w.id === contrib.workoutId);
                if (workout) contributingWorkouts.push(workout);
            });

            contributingWorkouts.sort((a, b) => new Date(a.date) - new Date(b.date));

            contributingWorkouts.forEach(w => {
                workoutCount++;
                // Time
                if (w.duration) {
                    const parts = w.duration.split(':');
                    if (parts.length === 2) totalTime += (parseInt(parts[0]) * 60) + parseInt(parts[1]);
                }
                // KJ
                if (w.outputKj) totalKj += parseFloat(w.outputKj);
                // Distance
                if (w.miles) totalDist += parseFloat(w.miles);
                // Elevation
                if (w.elevation) totalElev += parseFloat(w.elevation);

                // Dates
                if (!firstDate) firstDate = w.date;
                lastDate = w.date;
            });
        }

        // 3. Format Data
        const daysTaken = firstDate && lastDate ? Math.max(1, Math.round((new Date(lastDate) - new Date(firstDate)) / (1000 * 60 * 60 * 24)) + 1) : 1;

        const hours = Math.floor(totalTime / 60);
        const minutes = totalTime % 60;
        const timeStr = `${hours}h ${minutes}m`;

        // 4. Render Modal
        const overlay = document.createElement('div');
        overlay.className = 'confirmation-overlay';

        const modal = document.createElement('div');
        modal.className = 'confirmation-modal';
        modal.style.maxWidth = '500px';
        modal.style.width = '95%';
        modal.style.textAlign = 'left';
        modal.style.background = 'linear-gradient(135deg, #1e293b, #0f172a)';
        modal.style.boxShadow = '0 10px 40px rgba(0,0,0,0.7)';
        modal.style.border = '1px solid rgba(255,255,255,0.1)';

        const gridItem = (label, value) => `
            <div style="background: rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem;">${label}</div>
                <div style="font-size: 1.1rem; font-weight: 600; color: #f8fafc;">${value}</div>
            </div>
        `;

        modal.innerHTML = `
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <div style="font-size: 3rem; margin-bottom: 0.5rem; text-shadow: 0 0 20px rgba(255,215,0,0.5);">🏆</div>
                <h2 style="margin: 0; font-size: 1.5rem; color: white;">${trophy.title}</h2>
                <div style="color: #94a3b8; font-size: 0.9rem; margin-top: 0.25rem;">Completed on ${new Date(trophy.dateEarned).toLocaleDateString()}</div>
                ${!challenge ? '<div style="color:#eab308; font-size:0.8rem; margin-top:0.5rem;">(Detailed history not available)</div>' : ''}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
                 ${gridItem('Workouts', workoutCount)}
                 ${gridItem('Days Taken', daysTaken)}
                 ${gridItem('Total Time', timeStr)}
                 ${gridItem('Total Output', Math.round(totalKj).toLocaleString() + ' kJ')}
                 ${gridItem('Total Distance', totalDist.toFixed(1) + ' mi')}
                 ${gridItem('Elevation Gain', Math.round(totalElev).toLocaleString() + ' ft')}
            </div>
            
            <div style="font-size: 0.85rem; color: #64748b; text-align: center; margin-bottom: 1.5rem; font-style: italic;">
                "${firstDate ? formatDateForDisplay(firstDate) : 'Unknown'}  ➔  ${lastDate ? formatDateForDisplay(lastDate) : 'Unknown'}"
            </div>

            <div class="celebration-actions" style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 1rem;">
                <button class="btn-celebrate-share btn-secondary" style="flex: 1; padding: 0.75rem;">Share 📤</button>
                <button class="btn-celebrate-copy btn-secondary" style="flex: 1; padding: 0.75rem;">Copy Image 📋</button>
            </div>
            
            <div class="close-actions-container" style="text-align: center; margin-top: 0.5rem;">
                <button class="btn-primary" id="close-trophy-modal" style="width: 100%; border-radius: 8px; padding: 0.75rem;">Close Summary</button>
            </div>
        `;

        const close = () => {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 200);
        };

        const closeBtn = modal.querySelector('#close-trophy-modal');
        if (closeBtn) closeBtn.addEventListener('click', close);

        // Attach Share Handlers
        const shareBtn = modal.querySelector('.btn-celebrate-share');
        const copyBtn = modal.querySelector('.btn-celebrate-copy');
        const actionsContainer = modal.querySelector('.celebration-actions');
        const closeContainer = modal.querySelector('.close-actions-container');

        const elementsToHide = [actionsContainer, closeContainer];

        if (shareBtn) {
            shareBtn.addEventListener('click', () =>
                handleModalCapture(modal, elementsToHide, shareBtn, shareBtn.textContent, trophy.title, 'share')
            );
        }
        if (copyBtn) {
            copyBtn.addEventListener('click', () =>
                handleModalCapture(modal, elementsToHide, copyBtn, copyBtn.textContent, trophy.title, 'copy')
            );
        }

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    }

    function renderTrophies() {
        const container = document.getElementById('trophy-case-grid');
        if (!container) return;

        // Clear container
        container.innerHTML = '';

        if (appData.trophies.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#888; font-style:italic; padding: 1rem;">Complete challenges to earn trophies!</div>';
        } else {
            appData.trophies.forEach(t => {
                const div = document.createElement('div');
                div.className = 'trophy-card';
                div.style.cursor = 'pointer';

                // Icon based on type
                let icon = '🏆';
                if (t.type === 'climbing') icon = '🏔️';
                if (t.type === 'distance') {
                    icon = '🏃';
                    const bikeIds = ['dia-de-los-muertos', 'century', 'la-sf', 'london-paris'];
                    if (bikeIds.includes(t.challengeId) || (t.title && t.title.toLowerCase().includes('ride'))) {
                        icon = '🚴';
                    }
                }

                const dateStr = new Date(t.dateEarned).toLocaleDateString();
                const index = appData.trophies.indexOf(t);

                div.innerHTML = `
                    <div class="trophy-icon">${icon}</div>
                    <div class="trophy-info">
                        <div class="trophy-title">${t.title}</div>
                        <div class="trophy-date">${dateStr}</div>
                    </div>
                `;

                div.setAttribute('onclick', `window.handleTrophyClick(${index})`);
                container.appendChild(div);
            });
        }

        // Add Sync Button at the bottom
        const syncWrapper = document.createElement('div');
        syncWrapper.style.cssText = 'position: absolute; bottom: 1.5rem; right: 1.5rem; z-index: 10;';
        syncWrapper.innerHTML = `
            <button id="manual-sync-trophies" style="background:none; border:none; color:#64748b; font-size:0.7rem; cursor:pointer; opacity: 0.5; transition: opacity 0.2s;">
                🔄 Sync Case
            </button>
        `;
        container.appendChild(syncWrapper);

        attachSyncListener();
        console.log('✅ Rendered trophies v1.4:', appData.trophies.length);
    }

    function attachSyncListener() {
        const btn = document.getElementById('manual-sync-trophies');
        if (btn) {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                btn.textContent = '⌛ Syncing...';
                await syncTrophies();
                btn.textContent = '🔄 Sync Case';
                showNotification('Synced', 'Trophy case synchronized.', '🏆');
            });
        }
    }

    // Expose summary globally for onclick
    window.handleTrophyClick = (index) => {
        const trophy = appData.trophies[index];
        if (trophy) {
            console.log('🏆 Global Trophy Click:', trophy.title);
            showTrophySummary(trophy);
        }
    };

    function showCelebrationModal(challenge) {
        console.log('Showing modal for:', challenge.title);
        const overlay = document.createElement('div');
        overlay.className = 'celebration-overlay';
        // Ensure overlay has a background for capture (captured image needs it)
        // Although CSS likely handles it, explicit background ensures no transparency issues in capture
        overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        const modal = document.createElement('div');
        modal.className = 'celebration-modal';

        modal.innerHTML = `
            <div class="celebration-trophy">🏆</div>
            <h2 class="celebration-title">Summit Reached!</h2>
            <p class="celebration-message">You conquered the <strong>${challenge.title}</strong> challenge!</p>
            <div class="celebration-actions">
                <button class="btn-celebrate-close">Close</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Confetti Effect - Append to MODAL so it's captured relative to the card
        // We need the modal to clip them or let them fly?
        // If we capture 'modal', we want confetti that are seemingly "inside" or "around" it.
        // Actually, best visual is to contain them in the modal.
        modal.style.position = 'relative';
        modal.style.overflow = 'hidden';
        // Enlarged Modal Visuals for "Pop Out" effect
        modal.style.transform = 'scale(1.2)'; // Make it visually bigger on screen too

        const colors = ['#FFD700', '#FF0055', '#00F2EA', '#FFFFFF'];
        for (let i = 0; i < 60; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            // Position relative to MODAL
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = -20 + 'px';
            confetti.style.position = 'absolute'; // Critical for inside modal
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 2 + 1.5) + 's';

            modal.appendChild(confetti);

            setTimeout(() => {
                if (confetti.parentNode) confetti.remove();
            }, 5000);
        }

        // modal.querySelector('.btn-celebrate-share').addEventListener('click', () => handleCapture('share'));
        // modal.querySelector('.btn-celebrate-copy').addEventListener('click', () => handleCapture('copy'));

        // Fix: Actually attach the new listeners if buttons exist (checking assuming you might add them back to HTML string above if needed, 
        // but based on previous code they weren't in the HTML string, so assuming they ARE in the HTML string now or should be?
        // Wait, the previous code had them commented out or removed?
        // Let's add them back to the HTML string in showCelebrationModal if they are missing or ensure we select them if they exist.
        // ... Actually looking at previous file content, it seems the buttons were NOT in the innerHTML string in line 2185!
        // You should probably add them to the celebration modal HTML if you want them there too.
        // But sticking to the strict task "allow a use to share the pop up" (trophy popup), let's fix trophy popup first.

        // HOWEVER, to reuse logic, I DO need to update showCelebrationModal to use handleModalCapture if it HAS buttons.

        // For now, let's just make sure showCelebrationModal uses the new helper if we were to adding buttons back.
        // But wait, the original file content 2220-2294 contained a huge inner function handleCapture. 
        // I should REMOVE that inner function since I moved it out.

        modal.querySelector('.btn-celebrate-close').addEventListener('click', close);

        function close() {
            overlay.remove();
        }
    }

    // --- Stats ---
    function calculateTotalProgress() {
        let weight = parseFloat(appData.settings.weight) || 80;
        if (appData.settings.unit_weight === 'lbs') weight *= 0.453592;

        let totalClimb = 0;
        let totalDist = 0;
        let cyclingDist = 0;
        let runningDist = 0;

        appData.workouts.forEach(w => {
            // Climbing
            if (w.outputKj) totalClimb += calculateElevation(w.outputKj, weight).meters;
            else if (w.metricType !== 'miles' && w.output) totalClimb += calculateElevation(w.output, weight).meters;

            // Distance
            let distKm = 0;
            if (w.miles) distKm = (w.miles * 1.60934);
            else if (w.metricType === 'miles') distKm = (w.output * 1.60934);

            totalDist += distKm;
            if (w.type === 'bike') cyclingDist += distKm;
            if (['run', 'walk', 'hike'].includes(w.type)) runningDist += distKm;
        });

        return {
            climbingMeters: totalClimb,
            climbingFeet: totalClimb * 3.28084,
            distanceKm: totalDist,
            distanceMiles: totalDist * 0.621371,
            cyclingDistanceKm: cyclingDist,
            cyclingDistanceMiles: cyclingDist * 0.621371,
            runningDistanceKm: runningDist,
            runningDistanceMiles: runningDist * 0.621371
        };
    }

    function renderAchievementFacts() {
        const container = document.getElementById('achievement-facts-container');
        if (!container) return;

        const totals = calculateTotalProgress();

        // Elevation Milestones (Meters)
        const climbingFacts = [
            { threshold: 0, comparison: "Start climbing!" },
            { threshold: 324, comparison: "Eiffel Tower 🗼" },
            { threshold: 828, comparison: "Burj Khalifa 🏙️" },
            { threshold: 1200, comparison: "Grand Canyon Depth 🏜️" },
            { threshold: 1600, comparison: "Mile High ☁️" },
            { threshold: 2228, comparison: "Mt. Kosciuszko (Australia) 🇦🇺" },
            { threshold: 3776, comparison: "Mt. Fuji 🗻" },
            { threshold: 4807, comparison: "Mont Blanc 🏔️" },
            { threshold: 5895, comparison: "Mt. Kilimanjaro 🦒" },
            { threshold: 6190, comparison: "Denali 🦅" },
            { threshold: 6961, comparison: "Aconcagua ⛰️" },
            { threshold: 8849, comparison: "Mt. Everest 🧗" },
            { threshold: 17698, comparison: "2x Mt. Everest ✌️" },
            { threshold: 26547, comparison: "3x Mt. Everest 🤯" },
            { threshold: 100000, comparison: "Space (Kármán line) 🚀" }
        ];

        // Distance Milestones (Kilometers)
        const distanceFacts = [
            { threshold: 0, comparison: "Start moving!" },
            { threshold: 42.195, comparison: "Marathon 🏃" },
            { threshold: 100, comparison: "Ultra Marathon 👟" },
            { threshold: 346, comparison: "London to Paris 🚄" },
            { threshold: 804, comparison: "The Proclaimers (500mi) 🎤" },
            { threshold: 1400, comparison: "Length of UK (Land's End to Land's End, almost) 🇬🇧" },
            { threshold: 2350, comparison: "Great Barrier Reef 🐠" },
            { threshold: 3755, comparison: "Tour de France (approx) 🚴" },
            { threshold: 3940, comparison: "Route 66 🇺🇸" },
            { threshold: 6400, comparison: "Amazon River 🐍" },
            { threshold: 10000, comparison: "Great Wall of China 🧱" },
            { threshold: 12742, comparison: "Diameter of Earth 🌍" },
            { threshold: 40075, comparison: "Circumference of Earth ✈️" },
            { threshold: 384400, comparison: "Distance to Moon 🌚" }
        ];

        // Celestial Elevation Milestones (Meters)
        const MOON_DISTANCE = 384400000; // Average distance to Moon in meters
        const SUN_DISTANCE = 149600000000; // Average distance to Sun in meters

        let celestialTarget = MOON_DISTANCE;
        let celestialLabel = "the Moon 🌙";
        let celestialIcon = "🌙";

        if (totals.climbingMeters >= MOON_DISTANCE) {
            celestialTarget = SUN_DISTANCE;
            celestialLabel = "the Sun ☀️";
            celestialIcon = "☀️";
        }

        const celestialPercent = (totals.climbingMeters / celestialTarget) * 100;

        // Find the highest threshold reached
        let climbFact = climbingFacts[0];
        for (let i = climbingFacts.length - 1; i >= 0; i--) {
            if (totals.climbingMeters >= climbingFacts[i].threshold) {
                climbFact = climbingFacts[i];
                break;
            }
        }

        let distFact = distanceFacts[0];
        for (let i = distanceFacts.length - 1; i >= 0; i--) {
            if (totals.distanceKm >= distanceFacts[i].threshold) {
                distFact = distanceFacts[i];
                break;
            }
        }

        const WORLD_CIRCUMFERENCE = 40075;
        const MOON_DISTANCE_KM = 384400;
        const worldMilesTarget = WORLD_CIRCUMFERENCE * 0.621371;

        let worldContent = "";
        if (totals.cyclingDistanceKm < MOON_DISTANCE_KM) {
            const worldPercent = (totals.cyclingDistanceKm / WORLD_CIRCUMFERENCE) * 100;
            worldContent = `
                <div class="fact-label">Around the World</div>
                <div class="fact-value">
                    <div>${worldPercent.toFixed(2)}%</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                        ${totals.cyclingDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km / 
                        ${totals.cyclingDistanceMiles.toLocaleString(undefined, { maximumFractionDigits: 1 })} mi
                    </div>
                </div>
                <div class="fact-comparison">Total Cycling Distance</div>
                <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 0.5rem; overflow: hidden;">
                    <div style="width: ${Math.min(worldPercent, 100)}%; height: 100%; background: #4ecdc4;"></div>
                </div>
                <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem;">
                    Target: ${WORLD_CIRCUMFERENCE.toLocaleString()} km / ${worldMilesTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })} mi
                </div>
            `;
        } else {
            const worldTrips = totals.cyclingDistanceKm / WORLD_CIRCUMFERENCE;
            worldContent = `
                <div class="fact-label">Around the World</div>
                <div class="fact-value">
                    <div>${worldTrips.toFixed(1)}x</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                        ${totals.cyclingDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km / 
                        ${totals.cyclingDistanceMiles.toLocaleString(undefined, { maximumFractionDigits: 1 })} mi
                    </div>
                </div>
                <div class="fact-comparison">Times Around the Earth! 🌍</div>
                <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 0.5rem; overflow: hidden;">
                    <div style="width: 100%; height: 100%; background: #ff6b6b; animation: pulse 2s infinite;"></div>
                </div>
                <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem;">
                    Lap Progress: ${(totals.cyclingDistanceKm % WORLD_CIRCUMFERENCE).toLocaleString(undefined, { maximumFractionDigits: 1 })} / ${WORLD_CIRCUMFERENCE.toLocaleString()} km
                </div>
            `;
        }

        const POLAR_DISTANCE = 20004; // North Pole to Antarctica approx
        const polarMilesTarget = POLAR_DISTANCE * 0.621371;
        let polarContent = "";

        if (totals.runningDistanceKm < POLAR_DISTANCE) {
            const polarPercent = (totals.runningDistanceKm / POLAR_DISTANCE) * 100;
            polarContent = `
                <div class="fact-label">North Pole to Antarctica</div>
                <div class="fact-value">
                    <div>${polarPercent.toFixed(2)}%</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                        ${totals.runningDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km / 
                        ${totals.runningDistanceMiles.toLocaleString(undefined, { maximumFractionDigits: 1 })} mi
                    </div>
                </div>
                <div class="fact-comparison">Running/Walking Progress</div>
                <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 0.5rem; overflow: hidden;">
                    <div style="width: ${Math.min(polarPercent, 100)}%; height: 100%; background: #a29bfe;"></div>
                </div>
                <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem;">
                    Target: ${POLAR_DISTANCE.toLocaleString()} km / ${polarMilesTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })} mi
                </div>
            `;
        } else {
            const polarTrips = totals.runningDistanceKm / POLAR_DISTANCE;
            polarContent = `
                <div class="fact-label">North Pole to Antarctica</div>
                <div class="fact-value">
                    <div>${polarTrips.toFixed(1)}x</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                        ${totals.runningDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km / 
                        ${totals.runningDistanceMiles.toLocaleString(undefined, { maximumFractionDigits: 1 })} mi
                    </div>
                </div>
                <div class="fact-comparison">Times Traveled North to South! ❄️</div>
                <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 0.5rem; overflow: hidden;">
                    <div style="width: 100%; height: 100%; background: #6c5ce7; animation: pulse 2s infinite;"></div>
                </div>
                <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem;">
                    Lap Progress: ${(totals.runningDistanceKm % POLAR_DISTANCE).toLocaleString(undefined, { maximumFractionDigits: 1 })} / ${POLAR_DISTANCE.toLocaleString()} km
                </div>
            `;
        }

        container.innerHTML = `
            <div class="fact-card">
                <div class="fact-icon">🌍</div>
                <div class="fact-content">
                    ${worldContent}
                </div>
            </div>
            <div class="fact-card">
                <div class="fact-icon">❄️</div>
                <div class="fact-content">
                    ${polarContent}
                </div>
            </div>
            <div class="fact-card">
                <div class="fact-icon">${celestialIcon}</div>
                <div class="fact-content">
                    <div class="fact-label">Way to ${celestialLabel}</div>
                    <div class="fact-value">
                        <div>${celestialPercent < 0.0001 ? "0.0000" : celestialPercent.toFixed(4)}%</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                            ${totals.climbingMeters.toLocaleString(undefined, { maximumFractionDigits: 0 })} m / 
                            ${totals.climbingFeet.toLocaleString(undefined, { maximumFractionDigits: 0 })} ft
                        </div>
                    </div>
                    <div class="fact-comparison">Total Elevation Distance</div>
                    <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 0.5rem; overflow: hidden;">
                        <div style="width: ${Math.min(celestialPercent, 100)}%; height: 100%; background: var(--primary-color);"></div>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem;">
                        Target: ${celestialTarget.toLocaleString()} m / ${(celestialTarget * 3.28084).toLocaleString(undefined, { maximumFractionDigits: 0 })} ft
                    </div>
                </div>
            </div>
        `;
    }

    // --- SHARED CAPTURE LOGIC ---
    async function handleModalCapture(modalElement, elementsToHide, btn, originalText, challengeTitle, shareType) {
        btn.textContent = 'Capturing...';
        btn.disabled = true;

        try {
            // Short delay to ensure rendering matches visuals
            await new Promise(r => setTimeout(r, 100));

            // Hide visual clutter for capture
            if (Array.isArray(elementsToHide)) {
                elementsToHide.forEach(el => {
                    if (el) el.dataset.originalDisplay = el.style.display;
                    if (el) el.style.display = 'none';
                });
            } else if (elementsToHide) {
                // Fallback for single element
                elementsToHide.style.display = 'none';
            }

            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas dependency not loaded. Please restart app.');
            }

            // Capture MODAL directly (removes blue overlay background)
            const canvas = await html2canvas(modalElement, {
                backgroundColor: '#0f172a', // Force dark background for visibility!
                scale: 3, // High Res
                useCORS: true,
                logging: false,
                allowTaint: true
            });

            // Restore buttons
            if (Array.isArray(elementsToHide)) {
                elementsToHide.forEach(el => {
                    if (el) el.style.display = el.dataset.originalDisplay || '';
                });
            } else if (elementsToHide) {
                elementsToHide.style.display = 'flex'; // simplistic restoration, but array method is preferred
            }

            btn.textContent = originalText;
            btn.disabled = false;

            canvas.toBlob(async blob => {
                if (!blob) {
                    alert('Error: Screenshot generation failed (empty blob).');
                    return;
                }
                if (blob.size === 0) {
                    alert('Error: Screenshot is empty (0 bytes).');
                    return;
                }

                // Sanitize filename for Windows compatibility
                const safeTitle = (challengeTitle || 'elevation-trophy').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const filename = `trophy_${safeTitle}.png`;

                const file = new File([blob], filename, { type: 'image/png' });

                if (shareType === 'share') {
                    await shareChallengeVisual(challengeTitle, file);
                } else if (shareType === 'copy') {
                    try {
                        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
                            await navigator.clipboard.write([
                                new ClipboardItem({ [file.type]: file })
                            ]);
                            showNotification('Copied', 'Image copied to clipboard!', '📋');
                        } else {
                            throw new Error('Clipboard API not supported');
                        }
                    } catch (err) {
                        console.error('Copy failed', err);
                        alert('Copy failed: ' + err.message + '. Try "Share Victory" instead.');
                    }
                }
            }, 'image/png'); // Explicit mime type in toBlob


        } catch (err) {
            console.error('Capture failed:', err);
            alert('Screen capture failed: ' + err.message);

            // Restore UI
            if (Array.isArray(elementsToHide)) {
                elementsToHide.forEach(el => {
                    if (el) el.style.display = el.dataset.originalDisplay || '';
                });
            } else if (elementsToHide) {
                elementsToHide.style.display = 'flex';
            }

            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    async function shareChallengeVisual(title, file) {
        if (!file || file.size === 0) {
            alert('Error: Image capture resulted in an empty file.');
            return;
        }

        const text = `I just crushed the ${title} challenge on ElevationDestination! 🏔️🚴 #ElevationDestination #FitnessGoals`;

        // 1. Try Native Share (Mobile/Supported)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Challenge Complete!',
                    text: text,
                    url: '' // Explicitly prevent URL sharing
                });
                return; // Success
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Native Share failed:', err);
                    alert('Share failed: ' + err.message + '. Saving image instead.');
                    // Fallback to Download
                    downloadImage(file, title);
                }
            }
            return;
        }

        // 2. Try Clipboard (Desktop) - skipping auto-copy here to avoid confusion if they clicked SHARE
        // Instead, just download if native share fails on desktop
        downloadImage(file, title);
    }

    function downloadImage(file, title) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(file);
        link.download = `elevation-destination-${title.replace(/\s+/g, '-').toLowerCase()}-complete.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('Saved', 'Image saved to device!', '📸');
    }


    // --- Challenges Management ---
    // (Consolidating helper functions)

    function getActiveChallenges() { return appData.challenges.my; }

    async function saveMyChallengesProp() {
        await database.saveChallenges('my', appData.challenges.my);
    }

    async function addToMyChallenges(templateId) {
        // Find in defaults or custom
        let template = [...appData.challenges.climbing, ...appData.challenges.distance].find(c => c.id === templateId);

        // If not found in custom, check defaults (hardcoded or fetched?)
        // Defaults need to be defined.
        if (!template) {
            template = DEFAULT_CHALLENGES.find(c => c.id === templateId);
        }

        if (template) {
            const newInst = {
                ...template,
                instanceId: 'my_' + Date.now(),
                progress: 0,
                dateStarted: new Date().toISOString().split('T')[0]
            };
            appData.challenges.my.push(newInst);
            await saveMyChallengesProp();
            renderMyChallenges();
            updateTargetChallengeSelect();
            showNotification('Added', `Added ${template.title}!`, '🎯');
        }
    }

    async function removeMyChallenge(instanceId) {
        appData.challenges.my = appData.challenges.my.filter(c => c.instanceId !== instanceId);
        await saveMyChallengesProp();
        renderMyChallenges();
    }

    // --- Challenge Renderers ---
    function renderMyChallenges() {
        const container = document.getElementById('active-challenge-display');
        if (!container) return;

        if (appData.challenges.my.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:2rem; color:#888;">No active challenges.</div>`;
            return;
        }

        container.innerHTML = '<div class="my-challenges-wrapper" id="my-challenges-grid"></div>';
        const grid = document.getElementById('my-challenges-grid');

        appData.challenges.my.forEach(c => {
            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = '1rem';

            const div = document.createElement('div');
            div.className = 'challenge-ring-container';
            div.style.cursor = 'pointer';

            // ... (Ring UI Logic)
            const percentage = c.type === 'climbing'
                ? (c.progress / c.height) * 100
                : (c.progress / c.distance) * 100;

            const isComplete = percentage >= 100;
            const progressColor = isComplete ? '#FFD700' : 'var(--primary-color)'; // Gold if complete

            div.innerHTML = `
                <div class="challenge-circle-inner" style="position:relative;">
                     <button class="circle-remove-btn" data-id="${c.instanceId}">x</button>
                     <div class="circle-title">${c.title}</div>
                     <div class="circle-percent">${Math.min(percentage, 100).toFixed(1)}%</div>
                     <div class="circle-stats">
                        ${c.type === 'climbing'
                    ? `<div>${c.progress.toFixed(0)}m / ${c.height}m</div><div>${(c.progress * 3.28084).toFixed(0)}ft / ${(c.height * 3.28084).toFixed(0)}ft</div>`
                    : `<div>${c.progress.toFixed(1)}km / ${c.distance}km</div><div>${(c.progress * 0.621371).toFixed(1)}mi / ${(c.distance * 0.621371).toFixed(1)}mi</div>`
                }
                     </div>
                     
                     <!-- New Stats: Duration and Calories -->
                     ${(() => {
                    let totalMinutes = 0;
                    let totalCalories = 0;
                    if (c.contributions) {
                        c.contributions.forEach(contrib => {
                            const w = appData.workouts.find(x => x.id === contrib.workoutId);
                            if (w) {
                                // Duration
                                if (w.duration) {
                                    const [h, m] = w.duration.split(':').map(v => parseInt(v) || 0);
                                    totalMinutes += (h * 60) + m;
                                }

                                // Calories (Estimate)
                                // 1 kJ ~= 1 kcal (Cycling mechanical work roughly equals metabolic cost in kcal)
                                // Run/Walk: ~100 kcal per mile (gross approx)
                                if (w.outputKj) {
                                    totalCalories += (parseFloat(w.outputKj) / 4.184);
                                } else if (w.miles || (w.metricType === 'miles' && w.output)) {
                                    const dist = parseFloat(w.miles || w.output);
                                    totalCalories += (dist * 100);
                                }
                            }
                        });
                    }

                    // Format Duration
                    const hours = Math.floor(totalMinutes / 60);
                    const mins = totalMinutes % 60;
                    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

                    return `
                        <div class="circle-extra-stats" style="font-size: 0.75rem; color: rgba(255,255,255,0.7); margin-top: 0.25rem;">
                            ⏱️ ${timeStr} • 🔥 ~${totalCalories.toFixed(0)} kcal
                        </div>
                        `;
                })()}

                     ${isComplete ? `<button class="btn-share" data-id="${c.instanceId}" style="margin-top:0.5rem; background: #FFD700; color: #000; border: none; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-weight: bold;">Share 🏆</button>` : ''}
                     <div class="circle-expand-hint" style="font-size: 0.7rem; color: rgba(255,255,255,0.5); margin-top: 0.25rem;">▼ View Workouts</div>
                </div>
             `;
            div.style.background = `conic-gradient(${progressColor} ${percentage}%, #333 0)`;

            // Create workout list dropdown
            const workoutDropdown = document.createElement('div');
            workoutDropdown.className = 'challenge-workout-dropdown';
            workoutDropdown.style.display = 'none';
            workoutDropdown.style.marginTop = '0.5rem';
            workoutDropdown.style.padding = '1rem';
            workoutDropdown.style.background = 'rgba(255,255,255,0.05)';
            workoutDropdown.style.borderRadius = '8px';
            workoutDropdown.style.maxHeight = '300px';
            workoutDropdown.style.overflowY = 'auto';

            // Get workouts for this challenge
            let contributions = c.contributions || [];

            // Sort contributions by workout date desc
            contributions.sort((a, b) => {
                const wA = appData.workouts.find(w => w.id === a.workoutId);
                const wB = appData.workouts.find(w => w.id === b.workoutId);
                const dateA = wA ? new Date(wA.date) : new Date(0);
                const dateB = wB ? new Date(wB.date) : new Date(0);
                return dateB - dateA;
            });

            if (contributions.length === 0) {
                workoutDropdown.innerHTML = '<p style="color: #888; font-style: italic; text-align: center; margin: 0;">No workouts added yet</p>';
            } else {
                workoutDropdown.innerHTML = '<h4 style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: rgba(255,255,255,0.8);">Connected Workouts:</h4>';
                const workoutList = document.createElement('div');

                contributions.forEach(contrib => {
                    const workout = appData.workouts.find(w => w.id === contrib.workoutId);
                    if (workout) {
                        const workoutItem = document.createElement('div');
                        workoutItem.style.padding = '0.5rem';
                        workoutItem.style.marginBottom = '0.5rem';
                        workoutItem.style.background = 'rgba(255,255,255,0.03)';
                        workoutItem.style.borderRadius = '4px';
                        workoutItem.style.borderLeft = '3px solid var(--primary-color)';
                        workoutItem.style.cursor = 'pointer'; // Make clickable

                        const contributionDisplay = c.type === 'climbing'
                            ? `${contrib.amount.toFixed(0)}m`
                            : `${contrib.amount.toFixed(1)}km (${(contrib.amount * 0.621371).toFixed(1)}mi)`;

                        workoutItem.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; font-size: 0.9rem;">${workout.title}</div>
                                    <div style="font-size: 0.75rem; color: #aaa;">${formatDateForDisplay(workout.date)}</div>
                                </div>
                                <div style="text-align: right; font-size: 0.85rem; color: var(--primary-color); font-weight: 600;">
                                    +${contributionDisplay}
                                </div>
                            </div>
                        `;

                        // Attach click listener
                        workoutItem.addEventListener('click', (e) => {
                            e.stopPropagation(); // Prevent bubbling if needed
                            showWorkoutDetailsModal(workout);
                        });

                        workoutList.appendChild(workoutItem);
                    }
                });

                workoutDropdown.appendChild(workoutList);
            }

            wrapper.appendChild(div);
            wrapper.appendChild(workoutDropdown);
            grid.appendChild(wrapper);

            // Toggle dropdown on circle click
            div.addEventListener('click', (e) => {
                // Don't toggle if clicking remove or share buttons
                if (e.target.classList.contains('circle-remove-btn') ||
                    e.target.classList.contains('btn-share')) {
                    return;
                }

                const isVisible = workoutDropdown.style.display !== 'none';
                workoutDropdown.style.display = isVisible ? 'none' : 'block';

                // Update hint arrow
                const hint = div.querySelector('.circle-expand-hint');
                if (hint) {
                    hint.textContent = isVisible ? '▼ View Workouts' : '▲ Hide Workouts';
                }
            });

            div.querySelector('.circle-remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                removeMyChallenge(c.instanceId);
            });

            if (isComplete) {
                div.querySelector('.btn-share').addEventListener('click', (e) => {
                    e.stopPropagation();
                    shareChallenge(c);
                });
            }
        });

        // Ensure dropdown is synced with list
        updateTargetChallengeSelect();
    }

    function updateTargetChallengeSelect() {
        const sel = document.getElementById('target-challenge-select');
        if (!sel) return;

        // Save current selection to restore after rebuild
        const currentVal = sel.value;

        sel.innerHTML = '';
        appData.challenges.my.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.instanceId;
            opt.textContent = c.title;
            sel.appendChild(opt);
        });

        if (appData.challenges.my.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = "No active challenges";
            sel.appendChild(opt);
        } else {
            // Restore selection if still valid, otherwise select first
            if (currentVal && appData.challenges.my.find(c => c.instanceId === currentVal)) {
                sel.value = currentVal;
            } else {
                sel.value = appData.challenges.my[0].instanceId;
            }
        }

        // Update summary immediately after repopulating
        updateChallengeSummary();
    }

    // --- Add Progress Logic ---
    const addToChallengeBtn = document.getElementById('add-to-challenge-btn');
    const challengeSummary = document.getElementById('challenge-summary');

    function updateChallengeSummary() {
        const targetId = document.getElementById('target-challenge-select').value;
        const challenge = appData.challenges.my.find(c => c.instanceId === targetId);
        const checked = document.querySelectorAll('.workout-checkbox:checked');

        let total = 0;
        let label = '';

        checked.forEach(cb => {
            // Debug ID matching
            const w = appData.workouts.find(x => String(x.id) === String(cb.dataset.id));
            console.log('DEBUG: Summary Check', {
                cbId: cb.dataset.id,
                foundWorkout: w,
                miles: w?.miles,
                metricType: w?.metricType,
                challengeType: challenge?.type
            });

            if (w) {
                if (challenge && challenge.type === 'distance') {
                    const mi = w.miles || (w.metricType === 'miles' ? w.output : 0) || 0;
                    total += (mi * 1.60934); // km
                } else {
                    // Default to KJ/Climbing check
                    const kj = w.outputKj || (w.metricType !== 'miles' ? w.output : 0) || 0;
                    let weight = parseFloat(appData.settings.weight) || 80;
                    if (appData.settings.unit_weight === 'lbs') weight *= 0.453592;
                    total += calculateElevation(kj, weight).meters;
                }
            }
        });

        if (challengeSummary) {
            if (!challenge) {
                challengeSummary.textContent = "Select a challenge above";
            } else if (challenge.type === 'distance') {
                challengeSummary.textContent = `${total.toFixed(1)} km (${(total * 0.621371).toFixed(1)} mi) selected`;
            } else {
                challengeSummary.textContent = `${total.toFixed(0)}m (${(total * 3.28084).toFixed(0)}ft) climbed from selection`;
            }
        }

        if (addToChallengeBtn) addToChallengeBtn.disabled = checked.length === 0;
        return total;
    }

    // Listen for dropdown change to update summary unit
    const targetSelect = document.getElementById('target-challenge-select');
    if (targetSelect) {
        targetSelect.addEventListener('change', updateChallengeSummary);
    }

    if (addToChallengeBtn) {
        addToChallengeBtn.addEventListener('click', async () => {
            const targetId = document.getElementById('target-challenge-select').value;
            const challenge = appData.challenges.my.find(c => c.instanceId === targetId);

            if (challenge) {
                let weight = parseFloat(appData.settings.weight) || 80;
                if (appData.settings.unit_weight === 'lbs') weight *= 0.453592;

                const checked = document.querySelectorAll('.workout-checkbox:checked');
                let added = 0;

                if (!challenge.contributions) challenge.contributions = [];

                checked.forEach(cb => {
                    const w = appData.workouts.find(x => x.id == cb.dataset.id || x.id === cb.dataset.id);
                    if (w) {
                        let amount = 0;
                        if (challenge.type === 'climbing') {
                            const kj = w.outputKj || (w.metricType !== 'miles' ? w.output : 0) || 0;
                            amount = calculateElevation(kj, weight).meters;
                        } else {
                            const mi = w.miles || (w.metricType === 'miles' ? w.output : 0) || 0;
                            amount = (mi * 1.60934);
                        }

                        added += amount;
                        // Track contribution
                        challenge.contributions.push({
                            workoutId: w.id,
                            amount: amount,
                            date: new Date().toISOString()
                        });
                    }
                });

                challenge.progress += added;

                await saveMyChallengesProp();
                renderMyChallenges();

                // Check for completion
                const total = challenge.type === 'climbing' ? challenge.height : challenge.distance;
                console.log('DEBUG: Checking completion', { progress: challenge.progress, total, title: challenge.title });

                // Use epsilon for float comparison safety
                if (parseFloat(challenge.progress) >= parseFloat(total) - 0.1) {
                    console.log('DEBUG: Celebration Triggered!');
                    // Ensure it's capped at max for clean display if overshot
                    // challenge.progress = Math.max(challenge.progress, total); 
                    // (Optional: don't cap if they want to see over-achievement)

                    awardTrophy(challenge);

                    // Redirect to Achievements Tag
                    const profileTabBtn = document.querySelector('button[data-tab="profile"]');
                    if (profileTabBtn) profileTabBtn.click();

                    // Show Celebration Modal
                    showCelebrationModal(challenge);
                } else {
                    showNotification('Added', `Added progress to ${challenge.title}`, '🚀');
                }

                // Deselect
                checked.forEach(cb => cb.checked = false);
                updateChallengeSummary();
            }
        });
    }

    function renderChallenges() {
        // Render available challenges (Defaults + Custom)
        // ... (Similar logic using appData.challenges.climbing/distance)
        // Ensure to populate defaults:
        const defaults = DEFAULT_CHALLENGES;

        const cGrid = document.getElementById('climbing-challenges-grid');
        const dGrid = document.getElementById('distance-challenges-grid');

        if (cGrid) {
            cGrid.innerHTML = '';
            const allClimbing = [...defaults.filter(x => x.type === 'climbing'), ...appData.challenges.climbing];

            allClimbing
                .sort((a, b) => a.height - b.height)
                .forEach(c => {
                    try {
                        const div = document.createElement('div');
                        div.className = 'challenge-card';
                        div.innerHTML = `
                        <div class="challenge-title">${c.title}</div>
                        <div class="challenge-height">${c.height}m / ${(c.height * 3.28084).toFixed(0)}ft</div>
                        <button class="btn-challenge simple-add-btn" data-id="${c.id}">+ Add</button>
                     `;
                        cGrid.appendChild(div);
                    } catch (err) {
                        console.error('Error rendering challenge card:', c, err);
                    }
                });
        }

        if (dGrid) {
            dGrid.innerHTML = '';
            const allDistance = [...defaults.filter(x => x.type === 'distance'), ...appData.challenges.distance];

            // Define which challenges get which icon
            const runningChallenges = ['marathon', 'ultra', 'half-marathon', 'la-sf'];
            const bikingChallenges = ['century', 'london-paris', 'proclaimers', 'dia-de-los-muertos', 'la-ny'];

            allDistance
                .sort((a, b) => {
                    const aIsBiking = bikingChallenges.includes(a.id);
                    const bIsBiking = bikingChallenges.includes(b.id);
                    const aIsRunning = runningChallenges.includes(a.id);
                    const bIsRunning = runningChallenges.includes(b.id);

                    // Sort order: Biking, Running, Others
                    let aOrder = 3;
                    if (aIsBiking) aOrder = 1;
                    else if (aIsRunning) aOrder = 2;

                    let bOrder = 3;
                    if (bIsBiking) bOrder = 1;
                    else if (bIsRunning) bOrder = 2;

                    if (aOrder !== bOrder) return aOrder - bOrder;
                    return a.distance - b.distance; // Then by distance
                })
                .forEach(c => {
                    try {
                        // Determine icon based on challenge ID or subtype
                        let icon = '';
                        if (runningChallenges.includes(c.id) || c.subtype === 'run') {
                            icon = '🏃 ';
                        } else if (bikingChallenges.includes(c.id) || c.subtype === 'bike') {
                            icon = '🚴 ';
                        }

                        const div = document.createElement('div');
                        div.className = 'challenge-card';
                        div.innerHTML = `
                        <div class="challenge-title">${icon}${c.title}</div>
                        <div class="challenge-height">${c.distance}km / ${(c.distance * 0.621371).toFixed(1)}mi</div>
                        <button class="btn-challenge simple-add-btn" data-id="${c.id}">+ Add</button>
                     `;
                        dGrid.appendChild(div);
                    } catch (err) {
                        console.error('Error rendering distance card:', c, err);
                    }
                });
        }

        document.querySelectorAll('.simple-add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => addToMyChallenges(e.target.dataset.id));
        });
    }

    // --- Challenge Sections ---
    // Both climbing and distance sections are now always visible in side-by-side dropdowns.
    // We no longer need the challenge-type-btn switching logic.

    // --- Custom Challenge Logic ---
    // (Inputs for custom challenges)
    const createClimbBtn = document.getElementById('create-climbing-challenge-btn');
    if (createClimbBtn) {
        createClimbBtn.addEventListener('click', async () => {
            const name = document.getElementById('new-climbing-challenge-name').value;
            const height = document.getElementById('new-climbing-challenge-height').value;
            const unit = document.querySelector('.unit-option.active[data-unit-type="new-climb-unit"]')?.dataset.unit || 'm';

            if (name && height) {
                let heightMeters = parseFloat(height);
                if (unit === 'ft') heightMeters = heightMeters * 0.3048;

                const newC = { id: 'custom_c_' + Date.now(), title: name, height: heightMeters, type: 'climbing' };
                appData.challenges.climbing.push(newC);
                await database.saveChallenges('custom_climbing', appData.challenges.climbing);
                renderChallenges();
                document.getElementById('new-climbing-challenge-name').value = '';
                document.getElementById('new-climbing-challenge-height').value = '';
                showNotification('Created', 'Climbing challenge created!', '🏔️');
            }
        });
    }

    const createDistBtn = document.getElementById('create-distance-challenge-btn');
    if (createDistBtn) {
        createDistBtn.addEventListener('click', async () => {
            const name = document.getElementById('new-distance-challenge-name').value;
            const dist = document.getElementById('new-distance-challenge-distance').value;
            const unit = document.querySelector('.unit-option.active[data-unit-type="new-dist-unit"]')?.dataset.unit || 'km';
            const subtype = document.getElementById('new-distance-challenge-subtype')?.value || 'bike';

            if (name && dist) {
                let distKm = parseFloat(dist);
                if (unit === 'mi') distKm = distKm * 1.60934;

                const newC = {
                    id: 'custom_d_' + Date.now(),
                    title: name,
                    distance: distKm,
                    type: 'distance',
                    subtype: subtype
                };

                appData.challenges.distance.push(newC);
                await database.saveChallenges('custom_distance', appData.challenges.distance);
                renderChallenges();

                document.getElementById('new-distance-challenge-name').value = '';
                document.getElementById('new-distance-challenge-distance').value = '';
                showNotification('Created', `${subtype === 'run' ? 'Running' : 'Cycling'} challenge created!`, (subtype === 'run' ? '🏃' : '🚴'));
            }
        });
    }

    // Toggle unit buttons for new challenges
    document.querySelectorAll('.unit-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            const group = e.target.dataset.unitType;
            if (!group) return;
            document.querySelectorAll(`.unit-option[data-unit-type="${group}"]`).forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // --- DIAGNOSTIC TOOL: Fix Workout IDs ---
    // This function helps identify workouts with mismatched IDs
    window.debugWorkouts = async function () {
        console.log('🔍 DIAGNOSTIC: Checking workout IDs...');
        console.log('📊 Total workouts in local array:', appData.workouts.length);

        // Show all workout IDs
        appData.workouts.forEach((w, index) => {
            console.log(`  [${index}] ID: ${w.id} | Date: ${w.date} | Title: ${w.title}`);
        });

        // Fetch fresh from Firestore
        console.log('\n🔥 Fetching workouts from Firestore...');
        const freshWorkouts = await database.getWorkouts();
        console.log('📊 Total workouts in Firestore:', freshWorkouts.length);

        freshWorkouts.forEach((w, index) => {
            console.log(`  [${index}] ID: ${w.id} | Date: ${w.date} | Title: ${w.title}`);
        });

        // Find mismatches
        console.log('\n⚠️ Checking for ID mismatches...');
        const localIds = new Set(appData.workouts.map(w => w.id));
        const firestoreIds = new Set(freshWorkouts.map(w => w.id));

        const onlyInLocal = appData.workouts.filter(w => !firestoreIds.has(w.id));
        const onlyInFirestore = freshWorkouts.filter(w => !localIds.has(w.id));

        if (onlyInLocal.length > 0) {
            console.log('❌ Workouts in LOCAL but NOT in Firestore (these will fail to delete):');
            onlyInLocal.forEach(w => console.log(`  - ID: ${w.id} | ${w.date} | ${w.title}`));
        }

        if (onlyInFirestore.length > 0) {
            console.log('❌ Workouts in FIRESTORE but NOT in local (orphaned):');
            onlyInFirestore.forEach(w => console.log(`  - ID: ${w.id} | ${w.date} | ${w.title}`));
        }

        if (onlyInLocal.length === 0 && onlyInFirestore.length === 0) {
            console.log('✅ All workout IDs match! No issues found.');
        }

        return { localIds, firestoreIds, onlyInLocal, onlyInFirestore };
    };

    console.log('💡 TIP: Run debugWorkouts() in the console to check for ID mismatches');

    // --- CLEANUP TOOL: Delete All Orphaned Workouts ---
    window.cleanupOrphanedWorkouts = async function () {
        console.log('🧹 CLEANUP: Starting orphaned workout cleanup...');

        try {
            // Fetch all workouts from Firestore
            const firestoreWorkouts = await database.getWorkouts();
            console.log(`📊 Found ${firestoreWorkouts.length} workouts in Firestore`);

            if (firestoreWorkouts.length === 0) {
                console.log('✅ No workouts in Firestore to clean up!');
                // But still clear local array
                appData.workouts = [];
                renderWorkouts();
                console.log('✅ Cleared local workouts array');
                return;
            }

            // Delete each one from Firestore
            let deletedCount = 0;
            for (const workout of firestoreWorkouts) {
                console.log(`🗑️ Deleting workout: ${workout.id} | ${workout.date} | ${workout.title}`);
                const success = await database.deleteWorkout(workout.id);
                if (success) {
                    deletedCount++;
                } else {
                    console.error(`❌ Failed to delete: ${workout.id}`);
                }
            }

            console.log(`✅ Deleted ${deletedCount} workouts from Firestore`);

            // Clear local array
            appData.workouts = [];
            console.log('🧹 Cleared local workouts array');

            // Re-render UI
            renderWorkouts();
            renderMyChallenges();
            renderAchievementFacts();
            console.log('🎨 Re-rendered UI');

            console.log('✅ Cleanup complete! Your workouts are now in sync.');
            showNotification('Cleanup Complete', `Deleted ${deletedCount} orphaned workouts`, '🧹');

        } catch (error) {
            console.error('❌ Error during cleanup:', error);
            showNotification('Cleanup Failed', 'Check console for details', '⚠️');
        }
    };

    console.log('💡 TIP: Run cleanupOrphanedWorkouts() to delete all workouts and start fresh');

    // --- FORCE CLEANUP: Nuclear option ---
    window.forceDeleteAllWorkouts = async function () {
        console.log('💣 FORCE DELETE: Deleting ALL workouts from Firestore...');

        if (!confirm('⚠️ This will DELETE ALL WORKOUTS from Firestore. Are you sure?')) {
            console.log('❌ Cancelled by user');
            return;
        }

        try {
            const firestoreWorkouts = await database.getWorkouts();
            console.log(`📊 Found ${firestoreWorkouts.length} workouts to delete`);

            if (firestoreWorkouts.length === 0) {
                console.log('✅ No workouts in Firestore');
                appData.workouts = [];
                renderWorkouts();
                showNotification('Already Clean', 'No workouts to delete', '✅');
                return;
            }

            // Delete one by one with detailed logging
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < firestoreWorkouts.length; i++) {
                const workout = firestoreWorkouts[i];
                console.log(`[${i + 1}/${firestoreWorkouts.length}] Deleting: ${workout.id}`);

                try {
                    const deleted = await database.deleteWorkout(workout.id);
                    if (deleted) {
                        successCount++;
                        console.log(`  ✅ Deleted successfully`);
                    } else {
                        failCount++;
                        console.error(`  ❌ Delete returned false`);
                    }
                } catch (err) {
                    failCount++;
                    console.error(`  ❌ Error:`, err.message);
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`\n📊 Results: ${successCount} deleted, ${failCount} failed`);

            // Clear local data
            appData.workouts = [];
            renderWorkouts();
            renderMyChallenges();
            renderAchievementFacts();

            showNotification('Force Delete Complete', `Deleted ${successCount} workouts`, '💣');
            console.log('✅ Force delete complete!');

        } catch (error) {
            console.error('❌ Force delete failed:', error);
            showNotification('Delete Failed', error.message, '⚠️');
        }
    };

    console.log('💡 TIP: Run forceDeleteAllWorkouts() for aggressive cleanup');

    // --- CLEAR LOCALSTORAGE WORKOUTS ---
    window.clearLocalStorageWorkouts = function () {
        console.log('🧹 Clearing localStorage workout_history...');

        const history = localStorage.getItem('workout_history');
        if (history) {
            const workouts = JSON.parse(history);
            console.log(`📊 Found ${workouts.length} workouts in localStorage`);
            localStorage.removeItem('workout_history');
            console.log('✅ Cleared workout_history from localStorage');
            showNotification('LocalStorage Cleared', 'Workout history removed', '🧹');
        } else {
            console.log('✅ No workout_history in localStorage');
            showNotification('Already Clean', 'No workout history found', '✅');
        }
    };

    console.log('💡 TIP: Run clearLocalStorageWorkouts() to prevent re-migration');

    // --- NUCLEAR OPTION: Complete Cleanup ---
    window.nukeAllWorkouts = async function () {
        console.log('💣 NUKE: Complete workout cleanup starting...');

        if (!confirm('⚠️ This will PERMANENTLY DELETE all workouts from localStorage AND Firestore. Continue?')) {
            console.log('❌ Cancelled');
            return;
        }

        try {
            // STEP 1: Clear localStorage FIRST to prevent re-migration
            console.log('\n📍 STEP 1: Clearing localStorage...');
            const history = localStorage.getItem('workout_history');
            if (history) {
                const workouts = JSON.parse(history);
                console.log(`  Found ${workouts.length} workouts in localStorage`);
                localStorage.removeItem('workout_history');
                console.log('  ✅ Cleared workout_history from localStorage');
            } else {
                console.log('  ✅ No workout_history in localStorage');
            }

            // STEP 2: Delete from Firestore
            console.log('\n📍 STEP 2: Deleting from Firestore...');
            const firestoreWorkouts = await database.getWorkouts();
            console.log(`  Found ${firestoreWorkouts.length} workouts in Firestore`);

            if (firestoreWorkouts.length > 0) {
                let successCount = 0;
                for (let i = 0; i < firestoreWorkouts.length; i++) {
                    const workout = firestoreWorkouts[i];
                    console.log(`  [${i + 1}/${firestoreWorkouts.length}] Deleting: ${workout.id}`);
                    const deleted = await database.deleteWorkout(workout.id);
                    if (deleted) successCount++;
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                console.log(`  ✅ Deleted ${successCount} workouts from Firestore`);
            }

            // STEP 3: Clear local app data
            console.log('\n📍 STEP 3: Clearing local app data...');
            appData.workouts = [];
            console.log('  ✅ Cleared appData.workouts array');

            // STEP 4: Re-render UI
            console.log('\n📍 STEP 4: Re-rendering UI...');
            renderWorkouts();
            renderMyChallenges();
            renderAchievementFacts();
            console.log('  ✅ UI updated');

            console.log('\n✅ NUKE COMPLETE! All workouts destroyed.');
            console.log('💡 Now log out and log back in to verify.');
            showNotification('Nuke Complete', 'All workouts deleted', '💣');

        } catch (error) {
            console.error('❌ Nuke failed:', error);
            showNotification('Nuke Failed', error.message, '⚠️');
        }
    };

    console.log('💡 TIP: Run nukeAllWorkouts() for complete cleanup (localStorage + Firestore)');

});
