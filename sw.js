const CACHE_NAME = 'legal-task-manager-v1';
const urlsToCache = [
    '/',
    '/index.html',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event - cache resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Cache installation failed:', error);
            })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            })
            .catch(() => {
                // If both cache and network fail, return offline page
                if (event.request.destination === 'document') {
                    return caches.match('/core.html');
                }
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Background sync for task reminders (if supported)
self.addEventListener('sync', event => {
    if (event.tag === 'task-reminder') {
        event.waitUntil(checkTaskReminders());
    }
});

async function checkTaskReminders() {
    try {
        // This would sync with server if online
        // For now, we'll just trigger local notifications
        const registration = await self.registration;
        const tasks = JSON.parse(localStorage.getItem('legalTasks') || '[]');
        
        const now = new Date();
        const upcomingTasks = tasks.filter(task => {
            if (!task.reminderDateTime || task.completed) return false;
            const reminderTime = new Date(task.reminderDateTime);
            return reminderTime <= now && reminderTime > new Date(now.getTime() - 60000);
        });

        upcomingTasks.forEach(task => {
            registration.showNotification('Task Reminder', {
                body: task.title,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: `task-${task.id}`,
                requireInteraction: true,
                actions: [
                    {
                        action: 'complete',
                        title: 'Mark Complete'
                    },
                    {
                        action: 'dismiss',
                        title: 'Dismiss'
                    }
                ]
            });
        });
    } catch (error) {
        console.error('Error checking task reminders:', error);
    }
}

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'complete') {
        // Handle task completion
        const taskId = event.notification.tag.replace('task-', '');
        event.waitUntil(
            clients.openWindow('/core.html').then(windowClient => {
                if (windowClient) {
                    windowClient.postMessage({
                        type: 'COMPLETE_TASK',
                        taskId: taskId
                    });
                }
            })
        );
    } else if (event.action === 'dismiss') {
        // Just dismiss the notification
        return;
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.openWindow('/core.html')
        );
    }
});

// Listen for messages from the main thread
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

