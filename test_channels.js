const slackService = require('./services/slackService');

async function testChannels() {
    console.log('Testing getChannels...');
    try {
        const channels = await slackService.getChannels();
        console.log(`\nRetrieved ${channels.length} channels:`);
        channels.slice(0, 10).forEach(ch => {
            console.log(`  ${ch.id} -> ${ch.name}`);
        });
        if (channels.length > 10) {
            console.log(`  ... and ${channels.length - 10} more`);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

testChannels();
