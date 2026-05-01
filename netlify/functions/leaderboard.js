const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
        // Кэшируем на CDN-edge 60 сек, в браузере не кэшируем
        // Это значит: первый запрос за 60 сек идёт к функции,
        // все остальные — отдаются с CDN мгновенно
        'Cache-Control': 'no-store, no-cache, must-revalidate'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
    const supabaseKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing env vars:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' })
        };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase
            .from('leaderboard')
            .select('user_id, name, score, date')
            .order('score', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Supabase query error:', JSON.stringify(error));
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: error.message })
            };
        }

        const formatted = (data || []).map(entry => ({
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

    } catch (err) {
        console.error('Exception:', err.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};