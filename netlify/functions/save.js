const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

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

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing env vars:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ status: 'error', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' })
        };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { name, score, userId } = JSON.parse(event.body);

        if (!name || score === undefined || !userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ status: 'error', message: 'Необходимо указать имя, результат и userId' })
            };
        }

        const trimmedName = name.trim() || 'Anonymous';

        // Ищем запись по userId
        const { data: existing, error: findError } = await supabase
            .from('leaderboard')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (findError) {
            console.error('Find error:', findError);
            throw findError;
        }

        if (existing) {
            // Пользователь уже есть — обновляем если лучше
            if (score > existing.score) {
                const { error: updateError } = await supabase
                    .from('leaderboard')
                    .update({ score, date: new Date().toISOString() })
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
                        message: `Ваш результат (${score}) не лучше предыдущего (${existing.score}).`
                    })
                };
            }
        } else {
            // Новый пользователь — проверяем что имя не занято
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
                        message: `Имя "${trimmedName}" уже занято. Выберите другое.`
                    })
                };
            }

            // Добавляем новую запись
            const { error: insertError } = await supabase
                .from('leaderboard')
                .insert({
                    user_id: userId,
                    name: trimmedName,
                    score,
                    date: new Date().toISOString()
                });

            if (insertError) throw insertError;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    status: 'ok',
                    message: `Результат сохранён! Ваше имя "${trimmedName}" зафиксировано.`
                })
            };
        }

    } catch (err) {
        console.error('Unexpected error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ status: 'error', message: 'Ошибка сервера: ' + err.message })
        };
    }
};
