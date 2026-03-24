require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // or ANON for limited ops

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listBuckets() {
    const { data, error } = await supabase
        .storage
        .listBuckets()

    if (error) {
        console.error('Error listing buckets:', error);
        throw error;
    }
    return data;
}

module.exports = { listBuckets };