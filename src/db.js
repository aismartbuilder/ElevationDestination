
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';
import { db, auth } from './firebase-config.js';

// Helper to get current user ID
const getUserId = () => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }
    return user.uid;
};

export const database = {
    // --- User Profile ---
    async saveUserProfile(profileData) {
        try {
            const uid = getUserId();
            const userRef = doc(db, 'users', uid);
            // Merge with existing data
            await setDoc(userRef, profileData, { merge: true });
            console.log('✅ Profile saved to Cloud');
            return true;
        } catch (e) {
            console.error('Error saving profile:', e);
            return false;
        }
    },

    async getUserProfile() {
        try {
            const uid = getUserId();
            const userRef = doc(db, 'users', uid);
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) {
                return docSnap.data();
            }
            return null;
        } catch (e) {
            console.error('Error fetching profile:', e);
            return null;
        }
    },

    // --- Workouts ---
    async addWorkout(workoutData) {
        try {
            const uid = getUserId();
            const workoutsRef = collection(db, 'users', uid, 'workouts');
            // Add timestamp
            const dataWithTime = {
                ...workoutData,
                createdAt: new Date().toISOString()
            };
            const docRef = await addDoc(workoutsRef, dataWithTime);
            console.log('✅ Workout added to Cloud with ID:', docRef.id);
            return docRef.id;
        } catch (e) {
            console.error('Error adding workout:', e);
            throw e;
        }
    },

    async getWorkouts() {
        try {
            const uid = getUserId();
            const workoutsRef = collection(db, 'users', uid, 'workouts');
            const q = query(workoutsRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            const workouts = [];
            querySnapshot.forEach((doc) => {
                // FIXED: Spread data first, then overwrite ID with the real Firestore Doc ID
                // This prevents the internal "tempId" (timestamp) stored in data from shadowing the real doc key
                workouts.push({ ...doc.data(), id: doc.id });
            });
            return workouts;
        } catch (e) {
            console.error('Error fetching workouts:', e);
            return [];
        }
    },

    async updateWorkout(workoutId, workoutData) {
        try {
            const uid = getUserId();
            const idString = String(workoutId);
            const workoutRef = doc(db, 'users', uid, 'workouts', idString);
            await setDoc(workoutRef, workoutData, { merge: true });
            console.log('✅ Workout updated in Cloud');
            return true;
        } catch (e) {
            console.error('Error updating workout:', e);
            return false;
        }
    },

    async deleteWorkout(workoutId) {
        try {
            const uid = getUserId();
            // Ensure ID is a string
            const idString = String(workoutId);
            const workoutPath = `users/${uid}/workouts/${idString}`;
            console.log('🔥 Firestore: Deleting workout at path:', workoutPath);
            await deleteDoc(doc(db, 'users', uid, 'workouts', idString));
            console.log('✅ Workout deleted from Cloud:', idString);
            return true;
        } catch (e) {
            console.error('❌ Error deleting workout from Firestore:', e);
            console.error('   Workout ID:', workoutId);
            console.error('   Error details:', e.message);
            return false;
        }
    },

    // --- Challenges ---
    async saveChallenges(type, challenges) {
        try {
            const uid = getUserId();
            const challengeRef = doc(db, 'users', uid, 'app_data', `challenges_${type}`);
            await setDoc(challengeRef, { list: challenges });
            console.log(`✅ ${type} challenges saved to Cloud`);
            return true;
        } catch (e) {
            console.error('Error saving challenges:', e);
            return false;
        }
    },

    async getChallenges(type) {
        try {
            const uid = getUserId();
            const challengeRef = doc(db, 'users', uid, 'app_data', `challenges_${type}`);
            const docSnap = await getDoc(challengeRef);
            if (docSnap.exists()) {
                return docSnap.data().list || [];
            }
            return [];
        } catch (e) {
            console.error('Error fetching challenges:', e);
            return [];
        }
    },

    // --- Badges ---
    async saveUnlockedBadges(badgeIds) {
        try {
            const uid = getUserId();
            const badgesRef = doc(db, 'users', uid, 'app_data', 'badges');
            await setDoc(badgesRef, { unlocked: badgeIds });
            return true;
        } catch (e) {
            console.error('Error saving badges:', e);
            return false;
        }
    },

    async getUnlockedBadges() {
        try {
            const uid = getUserId();
            const badgesRef = doc(db, 'users', uid, 'app_data', 'badges');
            const docSnap = await getDoc(badgesRef);
            if (docSnap.exists()) {
                return docSnap.data().unlocked || [];
            }
            return [];
        } catch (e) {
            console.error('Error fetching badges:', e);
            return [];
        }
    },

    // --- Migration Logic ---
    async migrateLocalStorageToCloud() {
        if (!auth.currentUser) return;
        const uid = auth.currentUser.uid;
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        // V2 Migration Check: 'my_challenges'
        const needsChallengesMigration = !userData.challengesMigrated && localStorage.getItem('my_challenges');

        if (userData.migrated && !needsChallengesMigration) {
            // Already migrated, ensure local storage is clean to prevent zombies
            if (localStorage.getItem('workout_history')) {
                console.warn('🧹 Found stale local data after migration. Cleaning up...');
                localStorage.removeItem('workout_history');
                localStorage.removeItem('my_challenges');
                localStorage.removeItem('unlocked_badges');
            }
            return;
        }

        // --- ZOMBIE GUARD ---
        // Verify if cloud already has data (in case migrated flag was missed)
        if (!userData.migrated) {
            try {
                const cloudWorkouts = await this.getWorkouts();
                if (cloudWorkouts.length > 0) {
                    console.warn('🧟 Zombie Guard: Cloud data detected but migration flag missing. Aborting migration.');

                    // Force flag update
                    await setDoc(userRef, {
                        migrated: true,
                        migratedAt: new Date().toISOString(),
                        zombieGuarded: true
                    }, { merge: true });

                    // Nuke local storage to prevent conflicts
                    console.log('🧹 Clearing local storage (Zombie Guard)...');
                    localStorage.removeItem('workout_history');
                    localStorage.removeItem('my_challenges');
                    localStorage.removeItem('unlocked_badges');
                    localStorage.removeItem('bike_weight');
                    localStorage.removeItem('bike_goal');
                    localStorage.removeItem('unit_weight');
                    localStorage.removeItem('unit_distance');
                    localStorage.removeItem('app_theme');
                    localStorage.removeItem('custom_climbing_challenges');
                    localStorage.removeItem('custom_distance_challenges');

                    return;
                }
            } catch (zErr) {
                console.warn('Zombie Guard check failed, proceeding with caution:', zErr);
            }
        }

        console.log('🔄 Checking data migration...');
        const batch = writeBatch(db);
        let updatesCount = 0;
        let workoutPromises = [];

        // --- MAIN MIGRATION (V1) ---
        if (!userData.migrated) {
            // 1. Profile Settings
            const profileData = {
                weight: localStorage.getItem('bike_weight') || null,
                goal: localStorage.getItem('bike_goal') || null,
                unit_weight: localStorage.getItem('unit_weight') || 'kg',
                unit_distance: localStorage.getItem('unit_distance') || 'km',
                theme: localStorage.getItem('app_theme') || 'theme-dark',
                migrated: true,
                migratedAt: new Date().toISOString()
            };
            batch.set(userRef, profileData, { merge: true });
            updatesCount++;

            // 2. Badges
            try {
                const unlockedBadges = JSON.parse(localStorage.getItem('unlocked_badges') || '[]');
                if (unlockedBadges.length > 0) {
                    const badgesRef = doc(db, 'users', uid, 'app_data', 'badges');
                    batch.set(badgesRef, { unlocked: unlockedBadges });
                    updatesCount++;
                }
            } catch (e) { console.warn('Error parsing local badges', e); }

            // 3. Custom Templates
            try {
                const climbingChallenges = JSON.parse(localStorage.getItem('custom_climbing_challenges') || '[]');
                if (climbingChallenges.length > 0) {
                    const cRef = doc(db, 'users', uid, 'app_data', 'challenges_climbing');
                    batch.set(cRef, { list: climbingChallenges });
                    updatesCount++;
                }
            } catch (e) { console.warn('Error parsing local climbing challenges', e); }

            try {
                const distanceChallenges = JSON.parse(localStorage.getItem('custom_distance_challenges') || '[]');
                if (distanceChallenges.length > 0) {
                    const dRef = doc(db, 'users', uid, 'app_data', 'challenges_distance');
                    batch.set(dRef, { list: distanceChallenges });
                    updatesCount++;
                }
            } catch (e) { console.warn('Error parsing local distance challenges', e); }

            // 5. Workouts (Handle separately after batch because they can be numerous)
            try {
                const history = JSON.parse(localStorage.getItem('workout_history') || '[]');
                if (history.length > 0) {
                    console.log(`Migrating ${history.length} workouts...`);
                    const workoutsRef = collection(db, 'users', uid, 'workouts');
                    history.forEach(w => {
                        const p = addDoc(workoutsRef, {
                            ...w,
                            migratedFromLocal: true,
                            createdAt: new Date().toISOString()
                        });
                        workoutPromises.push(p);
                    });
                }
            } catch (e) { console.warn('Error parsing local workouts', e); }
        }

        // --- CHALLENGES MIGRATION (V2) ---
        if (needsChallengesMigration || (!userData.migrated && localStorage.getItem('my_challenges'))) {
            try {
                const myChallenges = JSON.parse(localStorage.getItem('my_challenges') || '[]');
                if (myChallenges.length > 0) {
                    console.log('Migrating Active Challenges...');
                    const myRef = doc(db, 'users', uid, 'app_data', 'challenges_my');
                    batch.set(myRef, { list: myChallenges });

                    batch.set(userRef, { challengesMigrated: true }, { merge: true });
                    updatesCount++;
                }
            } catch (e) { console.warn('Error parsing local active challenges', e); }
        }

        try {
            if (updatesCount > 0) {
                await batch.commit();
                console.log('✅ Migration Batch Committed.');
            }

            if (workoutPromises.length > 0) {
                await Promise.all(workoutPromises);
                console.log('✅ All workouts migrated.');
            }

            // --- CLEANUP ---
            // If we got here without error, it's safe to clear local storage
            console.log('🧹 Clearing local storage to prevent duplicate migration...');
            localStorage.removeItem('workout_history');
            localStorage.removeItem('my_challenges');
            localStorage.removeItem('unlocked_badges');
            localStorage.removeItem('bike_weight');
            localStorage.removeItem('bike_goal');
            // We might want to keep theme or units locally for fast load, but source of truth is now cloud.
            // Let's clear them to ensure single source of truth.
            localStorage.removeItem('unit_weight');
            localStorage.removeItem('unit_distance');
            localStorage.removeItem('app_theme');
            localStorage.removeItem('custom_climbing_challenges');
            localStorage.removeItem('custom_distance_challenges');

            console.log('✨ Migration Complete & Cleaned Up');

        } catch (e) {
            console.error('❌ Migration interrupted:', e);
            // Do NOT clear local storage if migration failed, so we can try again next time.
        }
    }
};
