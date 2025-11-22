require('dotenv').config();
const slackController = require('./controllers/slackController');
const fs = require('fs');
const path = require('path');

async function runTest() {
    console.log('🧪 Testing SlackDump AI Analysis...');

    // Mock Request/Response
    const req = {};
    const res = {
        json: (data) => {
            console.log('✅ Response JSON:', JSON.stringify(data, null, 2));
            if (data.success) {
                console.log('🎉 Analysis Successful!');

                // Verify file creation
                const dataPath = path.join(process.cwd(), 'data', 'slack_analysis.json');
                if (fs.existsSync(dataPath)) {
                    console.log('✅ slack_analysis.json created.');
                } else {
                    console.error('❌ slack_analysis.json NOT found.');
                }
            } else {
                console.error('❌ Analysis Failed:', data.error);
            }
        },
        status: (code) => {
            console.log(`Response Status: ${code}`);
            return res;
        }
    };

    try {
        await slackController.analyzeSlackDump(req, res);
    } catch (error) {
        console.error('❌ Test Error:', error);
    }
}

runTest();
