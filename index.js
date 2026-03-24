const express = require('express');
const storage = require('./src/storage/storage');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Coffee app is working!' });
});

// Buckets
app.get('/buckets', async (req, res) => {
  try {
    const buckets = await storage.listBuckets();
    res.json({ buckets });
  } catch (error) {
    console.error('Buckets endpoint error:', error);
    res.status(500).json({
      message: 'Error listing buckets',
      error: error.message || String(error)
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;