exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId: process.env.GOOGLE_CLIENT_ID || '' })
});
