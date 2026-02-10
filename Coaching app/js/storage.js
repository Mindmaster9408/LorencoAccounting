// Storage management - supports both localStorage (offline) and backend API (online)
import { STORAGE_KEY, JOURNEY_STEPS } from './config.js';
import { api, isAuthenticated } from './api.js';
import { getCurrentUser, getUserStorageKey } from './auth.js';

// Check if using backend (authenticated) or localStorage (offline mode)
const USE_BACKEND = isAuthenticated();

export async function readStore() {
    if (USE_BACKEND) {
        // Fetch from backend API
        try {
            const data = await api.getClients('all');
            return {
                clients: data.clients || [],
                training: { uploads: [], prompts: [] }
            };
        } catch (error) {
            console.error('Failed to fetch from backend, using localStorage:', error);
            return readLocalStore();
        }
    } else {
        return readLocalStore();
    }
}

function readLocalStore() {
    try {
        // Use user-specific storage key
        const currentUser = getCurrentUser();
        const storageKey = currentUser ? getUserStorageKey(currentUser.username) : STORAGE_KEY;
        return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch(e) {
        return {};
    }
}

export function writeStore(state) {
    // Use user-specific storage key
    const currentUser = getCurrentUser();
    const storageKey = currentUser ? getUserStorageKey(currentUser.username) : STORAGE_KEY;
    localStorage.setItem(storageKey, JSON.stringify(state));

    // Trigger automatic backup to file
    triggerAutoBackup(state, storageKey);
}

// Automatic backup system - saves to downloadable file
function triggerAutoBackup(state, storageKey) {
    try {
        // Only backup if there are clients to save
        if (!state.clients || state.clients.length === 0) return;

        // Create backup every time data changes
        const backupData = {
            timestamp: new Date().toISOString(),
            storageKey: storageKey,
            clientCount: state.clients.length,
            data: state
        };

        // Store in a special backup key in localStorage
        const backupKey = `${storageKey}_auto_backup`;
        localStorage.setItem(backupKey, JSON.stringify(backupData));

        // Also keep last 5 backups in a rolling list
        const backupHistoryKey = `${storageKey}_backup_history`;
        let backupHistory = [];
        try {
            backupHistory = JSON.parse(localStorage.getItem(backupHistoryKey) || '[]');
        } catch(e) {}

        backupHistory.unshift({
            timestamp: backupData.timestamp,
            clientCount: backupData.clientCount,
            key: backupKey
        });

        // Keep only last 5 backups
        if (backupHistory.length > 5) {
            backupHistory = backupHistory.slice(0, 5);
        }

        localStorage.setItem(backupHistoryKey, JSON.stringify(backupHistory));

        // Update UI indicator if element exists
        const backupIndicator = document.getElementById('backup-indicator');
        if (backupIndicator) {
            backupIndicator.textContent = '✓ Auto-backed up';
            backupIndicator.style.color = '#10b981';
            setTimeout(() => {
                backupIndicator.textContent = '● Auto-backup enabled';
                backupIndicator.style.color = '#6b7280';
            }, 2000);
        }
    } catch(e) {
        console.error('Auto-backup failed:', e);
    }
}

export function ensureStore() {
    const s = readLocalStore();
    if(!s.clients) s.clients = [];
    if(!s.training) s.training = {uploads:[], prompts:[]};
    writeStore(s);
    return s;
}

export async function saveClient(client) {
    if (USE_BACKEND) {
        try {
            // Save to backend
            if (client.id && typeof client.id === 'number') {
                // Update existing client
                await api.updateClient(client.id, client);
            } else {
                // Create new client
                const result = await api.createClient(client);
                client.id = result.client.id;
            }
            return client;
        } catch (error) {
            console.error('Failed to save client to backend:', error);
            throw error;
        }
    } else {
        // Save to localStorage
        const store = readLocalStore();
        const idx = store.clients.findIndex(x => x.id === client.id);
        if(idx > -1) {
            store.clients[idx] = client;
        } else {
            store.clients.push(client);
        }
        writeStore(store);
        return client;
    }
}

export function createNewClient(name) {
    return {
        id: USE_BACKEND ? null : ('c_' + Date.now()),
        name: name,
        preferred_lang: 'English',
        status: 'active',
        last_session: new Date().toISOString().slice(0,10),
        summary: '',
        dream: '',
        progress: {completed: 0, total: JOURNEY_STEPS.length},
        progress_completed: 0,
        progress_total: JOURNEY_STEPS.length,
        current_step: 0,
        steps: JOURNEY_STEPS.map(s => ({
            id: s.id,
            name: s.name,
            completed: false,
            notes: [],
            why: '',
            fields: {}
        })),
        gauges: {
            fuel: 50,
            horizon: 50,
            thrust: 50,
            engine: 50,
            compass: 50,
            weight: 50,
            positive: 50,
            negative: 50,
            nav: 50
        }
    };
}

export function isPast(client) {
    return client.status && (
        client.status.toLowerCase().includes('completed') ||
        client.status.toLowerCase().includes('archived')
    );
}
