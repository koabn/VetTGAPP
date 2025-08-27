const CACHE_NAME = 'vetpuls-cache-v2';
const APP_SHELL = [
	'./',
	'./index.html',
	'./styles.css',
	'./app.v2.js',
	'./manifest.webmanifest',
];

const RUNTIME_API = [
	'./api/drugs.json',
	'./api/symptoms.json',
];

self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
	);
	self.skipWaiting();
});

self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys().then(keys => Promise.all(
			keys.map(key => key !== CACHE_NAME ? caches.delete(key) : undefined)
		))
	);
	self.clients.claim();
});

self.addEventListener('fetch', event => {
	const { request } = event;
	const url = new URL(request.url);

	// Runtime cache for API JSON
	if (RUNTIME_API.some(path => url.pathname.endsWith(path.replace('./','/docs/')) || url.pathname.endsWith(path.replace('./','/VetTGAPP/')))) {
		event.respondWith(
			caches.open(CACHE_NAME).then(async cache => {
				const cached = await cache.match(request);
				const fetchPromise = fetch(request).then(response => {
					if (response && response.status === 200) {
						cache.put(request, response.clone());
					}
					return response;
				}).catch(() => cached);
				return cached || fetchPromise;
			})
		);
		return;
	}

	// App shell: cache-first
	if (APP_SHELL.some(path => url.pathname.endsWith(path.replace('./','/docs/')) || url.pathname.endsWith(path.replace('./','/VetTGAPP/')))) {
		event.respondWith(
			caches.match(request).then(resp => resp || fetch(request))
		);
		return;
	}

	// Default: network-first with fallback to cache
	event.respondWith(
		fetch(request).then(response => {
			return response;
		}).catch(() => caches.match(request))
	);
}); 