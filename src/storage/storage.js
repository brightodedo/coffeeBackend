require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const dataForge = require('data-forge');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // or ANON for limited ops
const RHEA_CACHE_TTL_MS = Number(process.env.RHEA_CACHE_TTL_MS) || 24 * 60 * 60 * 1000; // default 24 hours

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

let cachedRheaFrame = null;
let cachedRheaMetadata = null;
let cachedRheaTimestamp = 0;

async function listBuckets() {
    const { data, error } = await supabase
        .storage
        .listBuckets();

    if (error) {
        console.error('Error listing buckets:', error);
        throw error;
    }
    return data;
}

async function listRheaObjects() {
    const { data, error } = await supabase
        .storage
        .from('rhea')
        .list('', {
            limit: 100,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' }
        });

    if (error) {
        console.error('Error listing objects in rhea bucket:', error);
        throw error;
    }
    return data;
}

async function streamToBuffer(stream) {
    if (Buffer.isBuffer(stream)) {
        return stream;
    }

    if (typeof stream.arrayBuffer === 'function') {
        return Buffer.from(await stream.arrayBuffer());
    }

    if (typeof stream.text === 'function') {
        return Buffer.from(await stream.text(), 'utf8');
    }

    if (stream && typeof stream.on === 'function' && typeof stream.pipe === 'function') {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    }

    throw new Error('Unsupported download stream type');
}

async function loadRheaCsvFrame(filePath = 'rheas_drink.csv', { forceRefresh = false } = {}) {
    const now = Date.now();
    const cacheExpired = now - cachedRheaTimestamp >= RHEA_CACHE_TTL_MS;

    if (cachedRheaFrame && !forceRefresh && !cacheExpired) {
        return cachedRheaFrame;
    }

    const { data, error } = await supabase
        .storage
        .from('rhea')
        .download(filePath);

    if (error) {
        console.error('Error downloading CSV from rhea bucket:', error);
        throw error;
    }

    const buffer = await streamToBuffer(data);
    const csvText = buffer.toString('utf8');
    const frame = dataForge.fromCSV(csvText);

    cachedRheaFrame = frame;
    cachedRheaMetadata = data;
    cachedRheaTimestamp = now;
    return frame;
}

function getNumericStats(frame) {
    const numericColumns = frame
        .getColumnNames()
        .filter((column) => {
            const series = frame.getSeries(column).parseFloats();
            return series.where((value) => !Number.isNaN(value)).count() > 0;
        });

    const stats = {};
    for (const column of numericColumns) {
        const series = frame.getSeries(column).parseFloats().where((value) => !Number.isNaN(value));
        stats[column] = {
            count: series.count(),
            min: series.min(),
            max: series.max(),
            mean: series.average(),
            sum: series.sum()
        };
    }
    return stats;
}

function countRheaRows(frame) {
    return frame.count();
}

function countRheaRowsWithTimestamp(frame, columnName = 'Order date') {
    const dateSeries = frame.getSeries(columnName);
    const nameSeries = frame.getSeries('Name Used');

    if (!dateSeries || !nameSeries) {
        return 0;
    }

    const dateValues = dateSeries.toArray();
    const nameValues = nameSeries.toArray();
    let count = 0;

    for (let i = 0; i < dateValues.length; i += 1) {
        const nameValue = nameValues[i];
        const dateValue = dateValues[i];

        if (nameValue === null || nameValue === undefined) continue;
        if (String(nameValue).trim() === '') continue;

        if (dateValue === null || dateValue === undefined) continue;

        const text = String(dateValue).trim();
        if (!text) continue;

        const timestampPattern = /(?:[T\s]\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)/i;
        if (!timestampPattern.test(text)) continue;
        if (Number.isNaN(Date.parse(text))) continue;

        count += 1;
    }

    return count;
}

function getMostCommonMonth(frame) {
    const values = frame.getSeries('Order date').toArray();
    const monthCounts = {};

    for (const value of values) {
        if (value === null || value === undefined) continue;
        const text = String(value).trim();
        if (!text || Number.isNaN(Date.parse(text))) continue;

        const date = new Date(text);
        if (Number.isNaN(date.getTime())) continue;

        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
    }

    const entries = Object.entries(monthCounts).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
        return { month: null, count: 0 };
    }

    const [monthKey, count] = entries[0];
    const [year, monthNumber] = monthKey.split('-');
    const fullMonthName = new Date(Number(year), Number(monthNumber) - 1, 1).toLocaleString('en-US', { month: 'long' });

    return { month: fullMonthName, year: Number(year), count };
}

function getDrinkTally(frame) {
    const series = frame.getSeries('Order');
    if (!series) return {};

    const counts = {};
    for (const value of series.toArray()) {
        const drink = String(value || '').trim();
        if (!drink) continue;
        counts[drink] = (counts[drink] || 0) + 1;
    }

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([drink, count]) => ({ drink, count }));
}

function getFavoriteDrink(frame) {
    const tally = getDrinkTally(frame);
    if (tally.length === 0) {
        return { drink: null, count: 0 };
    }

    return { drink: tally[0].drink, count: tally[0].count };
}

function getLocationMode(frame, limit = 5) {
    const series = frame.getSeries('Order Location');
    if (!series) return [];

    const counts = {};
    for (const value of series.toArray()) {
        const location = String(value || '').trim();
        if (!location) continue;
        counts[location] = (counts[location] || 0) + 1;
    }

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([location, count]) => ({ location, count }));
}

function getHotOrCold(frame) {
    const temperatureSeries = frame.getSeries('Drink Temperature');
    if (!temperatureSeries) {
        return { result: 'unknown', hot: 0, cold: 0 };
    }

    let hot = 0;
    let cold = 0;

    for (const value of temperatureSeries.toArray()) {
        const temp = String(value || '').trim().toLowerCase();
        if (temp === 'hot') hot += 1;
        if (temp === 'cold') cold += 1;
    }

    if (hot > cold) return { result: 'hot', hot, cold };
    if (cold > hot) return { result: 'cold', hot, cold };
    return { result: 'tie', hot, cold };
}

function getTopDrinkSizes(frame) {
    const series = frame.getSeries('Order size');
    if (!series) return [];

    const counts = {};
    for (const value of series.toArray()) {
        const size = String(value || '').trim();
        if (!size) continue;
        counts[size] = (counts[size] || 0) + 1;
    }

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([size, count]) => ({ size, count }));
}

function countSpecialDrinks(frame) {
    const series = frame.getSeries('Special');
    if (!series) return 0;

    let count = 0;
    for (const value of series.toArray()) {
        const special = String(value || '').trim().toLowerCase();
        if (special === 'yes') count += 1;
    }
    return count;
}

function getSpecialsRank(frame) {
    const specialSeries = frame.getSeries('Special');
    const orderSeries = frame.getSeries('Order');
    if (!specialSeries || !orderSeries) return [];

    const specialValues = specialSeries.toArray();
    const orderValues = orderSeries.toArray();
    const counts = {};

    for (let i = 0; i < specialValues.length; i += 1) {
        const isSpecial = String(specialValues[i] || '').trim().toLowerCase() === 'yes';
        const drink = String(orderValues[i] || '').trim();

        if (!isSpecial || !drink) continue;
        counts[drink] = (counts[drink] || 0) + 1;
    }

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([drink, count]) => ({ drink, count }));
}

function getEarliestCoffee(frame) {
    const values = frame.getSeries('Order date').toArray();
    const parsed = values
        .map((value) => ({ raw: value, date: value ? new Date(value) : null }))
        .filter((entry) => entry.date && !Number.isNaN(entry.date.getTime()))
        .sort((a, b) => a.date - b.date);

    return parsed.length ? { value: parsed[0].raw, timestamp: parsed[0].date.toISOString() } : { value: null, timestamp: null };
}

function getLatestCoffee(frame) {
    const values = frame.getSeries('Order date').toArray();
    const parsed = values
        .map((value) => ({ raw: value, date: value ? new Date(value) : null }))
        .filter((entry) => entry.date && !Number.isNaN(entry.date.getTime()))
        .sort((a, b) => b.date - a.date);

    return parsed.length ? { value: parsed[0].raw, timestamp: parsed[0].date.toISOString() } : { value: null, timestamp: null };
}

function countCoffeeWithoutBright(frame) {
    return countRheaRows(frame) - countRheaRowsWithTimestamp(frame, 'Order date');
}

function getOrderNameTally(frame) {
    const series = frame.getSeries('Name Used');
    if (!series) return [];

    const counts = {};
    for (const value of series.toArray()) {
        const name = String(value || '').trim();
        if (!name) continue;
        counts[name] = (counts[name] || 0) + 1;
    }

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));
}

function getOddOrderName(frame) {
    const tally = getOrderNameTally(frame);
    if (tally.length === 0) {
        return { name: null, count: 0 };
    }

    return tally.slice().sort((a, b) => a.count - b.count)[0];
}

function getLeastVisited(frame, limit = 5) {
    const series = frame.getSeries('Order Location');
    if (!series) return [];

    const counts = {};
    for (const value of series.toArray()) {
        const location = String(value || '').trim();
        if (!location) continue;
        counts[location] = (counts[location] || 0) + 1;
    }

    return Object.entries(counts)
        .sort((a, b) => a[1] - b[1])
        .slice(0, limit)
        .map(([location, count]) => ({ location, count }));
}

function getStarbucksLocations(frame, limit = 5) {
    const series = frame.getSeries('Order Location');
    if (!series) return [];

    const counts = {};
    for (const value of series.toArray()) {
        const location = String(value || '').trim();
        if (!location || !location.toLowerCase().includes('starbucks')) continue;
        counts[location] = (counts[location] || 0) + 1;
    }

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([location, count]) => ({ location, count }));
}

module.exports = {
    listBuckets,
    listRheaObjects,
    loadRheaCsvFrame,
    getNumericStats,
    countRheaRows,
    countRheaRowsWithTimestamp,
    getMostCommonMonth,
    getDrinkTally,
    getFavoriteDrink,
    getLocationMode,
    getHotOrCold,
    getTopDrinkSizes,
    countSpecialDrinks,
    getSpecialsRank,
    getEarliestCoffee,
    getLatestCoffee,
    countCoffeeWithoutBright,
    getOrderNameTally,
    getOddOrderName,
    getLeastVisited,
    getStarbucksLocations
};