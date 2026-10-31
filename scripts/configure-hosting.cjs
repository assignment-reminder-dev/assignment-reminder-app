// Generates the Vercel API proxy once the Render backend address is known.
const fs = require('node:fs');
const path = require('node:path');
const raw = process.argv[2] || process.env.BACKEND_URL;
if (!raw) {
    console.error('Provide the HTTPS Render backend address: npm run configure:hosting -- https://your-service.onrender.com');
    process.exit(1);
}
let url;
try { url = new URL(raw); } catch { console.error('Enter a valid HTTPS backend URL.'); process.exit(1); }
if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    console.error('Use only the HTTPS origin, with no password, path, query, or fragment.'); process.exit(1);
}
const configuration = {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    framework: 'vite',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    rewrites: [
        { source: '/api/:path*', destination: `${url.origin}/api/:path*` },
        { source: '/((?!api(?:/|$)).*)', destination: '/index.html' },
    ],
};
fs.writeFileSync(path.join(__dirname, '..', 'vercel.json'), JSON.stringify(configuration, null, 2) + '\n');
console.log('Vercel configuration created. The frontend will use the hosted API through /api.');
