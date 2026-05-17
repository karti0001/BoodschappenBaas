require('dotenv').config();

const app = require('./app');
const { connectDatabase } = require('./core/database');

const port = process.env.PORT || 3001;

async function startServer() {
  await connectDatabase();

  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
