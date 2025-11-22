const fs = require('fs');

console.log('Looking for channel files...');
const channelFiles = fs.readdirSync('.').filter(f => f.startsWith('channels-') && f.endsWith('.txt'));

console.log(`Found ${channelFiles.length} channel files:`, channelFiles);

if (channelFiles.length > 0) {
    console.log(`\nReading ${channelFiles[0]}...`);
    const content = fs.readFileSync(channelFiles[0], 'utf8');
    const channels = [];
    const lines = content.split('\n');
    const regex = /^(C[A-Z0-9]+)\s+(?:arch|-)\s+(#[a-z0-9_-]+)/i;

    console.log(`Total lines: ${lines.length}`);

    lines.forEach((line, idx) => {
        const match = line.match(regex);
        if (match) {
            if (!line.includes('arch')) {
                channels.push({
                    id: match[1],
                    name: match[2]
                });
                if (channels.length <= 5) {
                    console.log(`  Line ${idx}: ${match[1]} -> ${match[2]}`);
                }
            }
        }
    });

    console.log(`\nTotal active channels found: ${channels.length}`);
}
