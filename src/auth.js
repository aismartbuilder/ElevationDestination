export const auth = {
    isAuthenticated() {
        return !!localStorage.getItem('bike_user') || !!sessionStorage.getItem('bike_user');
    },

    getUser() {
        const user = localStorage.getItem('bike_user') || sessionStorage.getItem('bike_user');
        return user ? JSON.parse(user) : null;
    },

    signup(name, email, username, password) {
        // In a real app, this would check against a database
        // For now, we just "log them in" immediately (default to session only for safety or local? let's stick to local for signup convenience or mirroring logic. 
        // Actually typically signup logs you in "remembered" or not? Let's just default to sessionStorage for signup unless implied otherwise, but simpler to just default to local as before or match login.
        // The original code used localStorage. Let's keep it consistent or just default to session. 
        // Let's use sessionStorage for new signups to be safe, or just localStorage as it was. 
        // Let's stick to localStorage for signup to minimize friction, or maybe session makes more sense if they didn't explicitly check "remember me" (which isn't on signup).
        // Let's use localStorage to maintain previous behavior of always "remembering" effectively, or switch to session. 
        // I'll stick to localStorage for signup as it was the default behavior before.
        const user = { name, email, username, password };
        localStorage.setItem('bike_user', JSON.stringify(user));
        return true;
    },

    login(username, password, remember = false) {
        // Mock login - accepts any username/password for now as we don't have a DB of users
        // Or we could strictly check against what was just signed up, but that's brittle for a demo

        // Let's just set the user for this session
        const user = { username };

        if (remember) {
            localStorage.setItem('bike_user', JSON.stringify(user));
        } else {
            sessionStorage.setItem('bike_user', JSON.stringify(user));
        }
        return true;
    },

    logout() {
        localStorage.removeItem('bike_user');
        sessionStorage.removeItem('bike_user');
    }
};
