// Example: fetchEventsFromDB
async function fetchEventsFromDB() {
  // Replace with your actual database query
  // Example event structure required by the ics library
  return [
    {
      title: 'Demo Event',
      description: 'This is a test event.',
      start: [2025, 11, 25, 14, 30], // [year, month, day, hour, minute]
      duration: { hours: 2, minutes: 0 }
    }
    // Add more events...
  ];
}

const { createEvents } = require('ics');
app.get('/calendar.ics', async (req, res) => {
  // Fetch events from your database
  const events = fetchEventsFromDB(); // Implement this
  const { error, value } = createEvents(events); // value is ICS text
  if (error) return res.status(500).send(error);
  res.header('Content-Type', 'text/calendar');
  res.send(value);
});