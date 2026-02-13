// Firebase Authentication Module
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { auth as firebaseAuth } from './firebase-config.js';

export const auth = {
    // Current user cache
    currentUser: null,

    // Check if user is authenticated
    isAuthenticated() {
        return firebaseAuth.currentUser !== null;
    },

    // Get current user data
    getUser() {
        const user = firebaseAuth.currentUser;
        if (user) {
            return {
                uid: user.uid,
                email: user.email,
                name: user.displayName || user.email?.split('@')[0] || 'User',
                username: user.displayName || user.email?.split('@')[0] || 'User'
            };
        }
        return null;
    },

    // Sign up new user with Firebase Authentication
    async signup(name, email, username, password) {
        try {
            // Create user account with email and password
            const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);

            // Update user profile with display name
            await updateProfile(userCredential.user, {
                displayName: name || username
            });

            console.log('✅ User signed up successfully:', userCredential.user.email);
            return true;
        } catch (error) {
            console.error('❌ Signup error:', error.code, error.message);

            // User-friendly error messages
            if (error.code === 'auth/email-already-in-use') {
                alert('This email is already registered. Please login instead.');
            } else if (error.code === 'auth/weak-password') {
                alert('Password should be at least 6 characters.');
            } else if (error.code === 'auth/invalid-email') {
                alert('Please enter a valid email address.');
            } else {
                alert('Signup failed: ' + error.message);
            }
            return false;
        }
    },

    // Login user with Firebase Authentication
    async login(username, password, remember = false) {
        try {
            // Configure Firebase persistence based on "Remember Me" setting
            // - browserLocalPersistence: User stays logged in across browser sessions
            // - browserSessionPersistence: User is logged out when browser/tab closes
            const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(firebaseAuth, persistence);

            // Note: Firebase uses email for login, so 'username' parameter should be email
            const userCredential = await signInWithEmailAndPassword(firebaseAuth, username, password);

            console.log('✅ User logged in successfully:', userCredential.user.email);
            console.log(`🔐 Persistence mode: ${remember ? 'LOCAL (persistent)' : 'SESSION (temporary)'}`);

            return true;
        } catch (error) {
            console.error('❌ Login error:', error.code, error.message);

            // User-friendly error messages
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                alert('No account found with this email, or incorrect password. Please check your credentials or sign up.');
            } else if (error.code === 'auth/wrong-password') {
                alert('Incorrect password. Please try again.');
            } else if (error.code === 'auth/invalid-email') {
                alert('Please enter a valid email address.');
            } else if (error.code === 'auth/too-many-requests') {
                alert('Too many failed login attempts. Please try again later.');
            } else {
                alert('Login failed: ' + error.message);
            }
            return false;
        }
    },

    // Logout user
    async logout() {
        try {
            await signOut(firebaseAuth);
            console.log('✅ User logged out successfully');
        } catch (error) {
            console.error('❌ Logout error:', error);
            alert('Logout failed: ' + error.message);
        }
    },

    // Change user password
    async changePassword(currentPassword, newPassword) {
        try {
            const user = firebaseAuth.currentUser;

            if (!user || !user.email) {
                alert('No user is currently logged in.');
                return false;
            }

            // Re-authenticate user first (required for sensitive operations like password change)
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Update password
            await updatePassword(user, newPassword);

            console.log('✅ Password changed successfully');
            return true;
        } catch (error) {
            console.error('❌ Password change error:', error.code, error.message);

            // User-friendly error messages
            if (error.code === 'auth/wrong-password') {
                alert('Current password is incorrect. Please try again.');
            } else if (error.code === 'auth/weak-password') {
                alert('New password should be at least 6 characters.');
            } else if (error.code === 'auth/requires-recent-login') {
                alert('For security reasons, please log out and log back in before changing your password.');
            } else {
                alert('Password change failed: ' + error.message);
            }
            return false;
        }
    },

    // Send password reset email
    async forgotPassword(email) {
        try {
            await sendPasswordResetEmail(firebaseAuth, email);
            console.log('✅ Password reset email sent successfully to:', email);
            return true;
        } catch (error) {
            console.error('❌ Forgot password error:', error.code, error.message);

            // User-friendly error messages
            if (error.code === 'auth/user-not-found') {
                alert('No account found with this email address.');
            } else if (error.code === 'auth/invalid-email') {
                alert('Please enter a valid email address.');
            } else {
                alert('Failed to send reset email: ' + error.message);
            }
            return false;
        }
    },

    // Initialize auth state listener
    // Call this when your app loads to handle automatic login
    onAuthStateChanged(callback) {
        return onAuthStateChanged(firebaseAuth, (user) => {
            this.currentUser = user;
            callback(user);
        });
    }
};
