const slackService = require('./services/slackService');

async function test() {
    console.log('Testing ingestData with slack_messages.json...');
    try {
        await slackService.ingestData();
        console.log('Ingestion test complete!');
    } catch (err) {
        console.error('Error during ingestion:', err);
    }
    process.exit(0);
}

test();
