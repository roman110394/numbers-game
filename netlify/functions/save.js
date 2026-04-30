const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ status: 'error', message: 'Method not allowed' })
        };
    }

    try {
        const { name, score, userId } = JSON.parse(event.body);

        if (!name || score === undefined || !userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    status: 'error',
                    message: 'Необходимо указать имя, результат и userId'
                })
            };
        }

        const trimmedName = name.trim() || 'Anonymous';

        // Find existing entry for this userId
        const { data: existing, error: findError } = await supabase
            .from('leaderboard')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (findError) throw findError;

        if (existing) {
            // User already has a name - update score if better
            if (score > existing.score) {
                const { error: updateError } = await supabase
                    .from('leaderboard')
                    .update({
                        score: score,
                        date: new Date().toISOString()
                    })
                    .eq('user_id', userId);

                if (updateError) throw updateError;

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: 'updated',
                        message: `Результат обновлён для вашего имени "${existing.name}"! Новый рекорд!`
                    })
                };
            } else {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: 'ignored',
                        message: `Ваш результат (${score}) не лучше предыдущего (${existing.score}). Имя "${existing.name}" нельзя изменить.`
                    })
                };
            }
        } else {
            // New user - check if name is taken (case-insensitive)
            const { data: nameCheck, error: nameError } = await supabase
                .from('leaderboard')
                .select('name')
                .ilike('name', trimmedName)
                .maybeSingle();

            if (nameError && nameError.code !== 'PGRST116') throw nameError;

            if (nameCheck) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: 'ignored',
                        message: `Имя "${trimmedName}" уже занято другим пользователем. Выберите другое.`
                    })
                };
            }

            // Add new entry
            const { error: insertError } = await supabase
                .from('leaderboard')
                .insert({
                    user_id: userId,
                    name: trimmedName,
                    score: score,
                    date: new Date().toISOString()
                });

            if (insertError) throw insertError;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: 'ok',
                    message: `Результат сохранён! Ваше имя "${trimmedName}" теперь фиксировано.`
                })
            };
        }
    } catch (error) {
        console.error('Error saving score:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                status: 'error',
                message: 'Ошибка сервера: ' + error.message
            })
        };
    }
};
