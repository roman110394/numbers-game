const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { data, error } = await supabase
            .from('leaderboard')
            .select('user_id, name, score, date')
            .order('score', { ascending: false })
            .limit(10);

        if (error) throw error;

        // Format dates to ru-RU
        const formatted = data.map(entry => ({
            userId: entry.user_id,
            name: entry.name,
            score: entry.score,
            date: new Date(entry.date).toLocaleDateString('ru-RU')
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(formatted)
        };
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch leaderboard' })
        };
    }
};
