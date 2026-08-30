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

// Rhea bucket
app.get('/rhea', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      columns: frame.getColumnNames(),
      rowCount: frame.count(),
      drecords: frame.toJSON()
    });
  } catch (error) {
    console.error('Rhea endpoint error:', error);
    res.status(500).json({
      message: 'Error downloading and parsing rhea CSV',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/preview', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    const rows = frame.head(limit).toJSON();
    res.json({
      bucket: 'rhea',
      previewCount: rows.length,
      rows
    });
  } catch (error) {
    console.error('Rhea preview error:', error);
    res.status(500).json({
      message: 'Error generating rhea preview',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/stats', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    const stats = storage.getNumericStats(frame);
    res.json({
      bucket: 'rhea',
      rowCount: frame.count(),
      stats
    });
  } catch (error) {
    console.error('Rhea stats error:', error);
    res.status(500).json({
      message: 'Error generating rhea stats',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/numberOfCoffee', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      count: storage.countRheaRows(frame)
    });
  } catch (error) {
    console.error('Rhea numberOfCoffee error:', error);
    res.status(500).json({
      message: 'Error counting coffee rows',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/numberCoffeeWithBright', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    const count = storage.countRheaRowsWithTimestamp(frame, 'Order date');
    res.json({
      bucket: 'rhea',
      column: 'Order date',
      count
    });
  } catch (error) {
    console.error('Rhea numberCoffeeWithBright error:', error);
    res.status(500).json({
      message: 'Error counting timestamped coffee rows',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/mostCoffeeMonth', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      result: storage.getMostCommonMonth(frame)
    });
  } catch (error) {
    console.error('Rhea mostCoffeeMonth error:', error);
    res.status(500).json({
      message: 'Error counting most common month',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/favoriteDrink', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      result: storage.getFavoriteDrink(frame)
    });
  } catch (error) {
    console.error('Rhea favoriteDrink error:', error);
    res.status(500).json({
      message: 'Error finding favorite drink',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/drinkTally', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      tally: storage.getDrinkTally(frame)
    });
  } catch (error) {
    console.error('Rhea drinkTally error:', error);
    res.status(500).json({
      message: 'Error generating drink tally',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/locationMode', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      topLocations: storage.getLocationMode(frame, 5)
    });
  } catch (error) {
    console.error('Rhea locationMode error:', error);
    res.status(500).json({
      message: 'Error generating location mode',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/hotOrCold', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      result: storage.getHotOrCold(frame)
    });
  } catch (error) {
    console.error('Rhea hotOrCold error:', error);
    res.status(500).json({
      message: 'Error determining hot or cold majority',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/topDrinkSizes', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      sizes: storage.getTopDrinkSizes(frame)
    });
  } catch (error) {
    console.error('Rhea topDrinkSizes error:', error);
    res.status(500).json({
      message: 'Error finding top drink sizes',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/numberOfSpecial', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      count: storage.countSpecialDrinks(frame)
    });
  } catch (error) {
    console.error('Rhea numberOfSpecial error:', error);
    res.status(500).json({
      message: 'Error counting special drinks',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/specialsRank', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      specials: storage.getSpecialsRank(frame)
    });
  } catch (error) {
    console.error('Rhea specialsRank error:', error);
    res.status(500).json({
      message: 'Error ranking special drinks',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/earliestCoffee', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      result: storage.getEarliestCoffee(frame)
    });
  } catch (error) {
    console.error('Rhea earliestCoffee error:', error);
    res.status(500).json({
      message: 'Error finding earliest coffee',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/latestCoffee', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      result: storage.getLatestCoffee(frame)
    });
  } catch (error) {
    console.error('Rhea latestCoffee error:', error);
    res.status(500).json({
      message: 'Error finding latest coffee',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/numberCoffeeWithoutBright', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      count: storage.countCoffeeWithoutBright(frame)
    });
  } catch (error) {
    console.error('Rhea numberCoffeeWithoutBright error:', error);
    res.status(500).json({
      message: 'Error counting non-bright coffee rows',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/orderNameTally', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      tally: storage.getOrderNameTally(frame)
    });
  } catch (error) {
    console.error('Rhea orderNameTally error:', error);
    res.status(500).json({
      message: 'Error tallying order names',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/oddOrderName', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      result: storage.getOddOrderName(frame)
    });
  } catch (error) {
    console.error('Rhea oddOrderName error:', error);
    res.status(500).json({
      message: 'Error finding odd order name',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/leastVisited', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      leastVisited: storage.getLeastVisited(frame, 5)
    });
  } catch (error) {
    console.error('Rhea leastVisited error:', error);
    res.status(500).json({
      message: 'Error finding least visited locations',
      error: error.message || String(error)
    });
  }
});

app.get('/rhea/starbucksLocations', async (req, res) => {
  try {
    const frame = await storage.loadRheaCsvFrame(undefined, {
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      bucket: 'rhea',
      starbucksLocations: storage.getStarbucksLocations(frame, 5)
    });
  } catch (error) {
    console.error('Rhea starbucksLocations error:', error);
    res.status(500).json({
      message: 'Error finding starbucks locations',
      error: error.message || String(error)
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;