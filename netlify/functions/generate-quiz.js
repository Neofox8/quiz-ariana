// =============================================================
// generate-quiz.js
// Netlify Function — proxy de OpenAI API
// - Recibe las 12 respuestas sinceras de Ariana
// - Para cada pregunta pide a gpt-4o-mini 3 alternativas falsas plausibles
// - Randomiza qué letra (a/b/c/d) es la correcta
// - Inserta cada quiz_question en Supabase (service role key)
// - Marca la sesión como 'ready' al terminar
// =============================================================

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://jrhmykilnqndvgnsmueo.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function askAI(question, answer) {
  const prompt = `Estás generando un quiz divertido sobre Ariana, niña peruana de 10 años, para YouTube.
Pregunta: ${question}
Respuesta correcta de Ariana: ${answer}
Genera 3 respuestas incorrectas pero plausibles y divertidas para niños peruanos.
Responde SOLO JSON puro: {"wrong1":"...","wrong2":"...","wrong3":"..."}`;

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";

  // Robustez: extraer el primer bloque JSON aunque venga con texto extra
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Respuesta sin JSON: ${raw}`);
  const parsed = JSON.parse(match[0]);

  const wrong1 = String(parsed.wrong1 ?? "").trim();
  const wrong2 = String(parsed.wrong2 ?? "").trim();
  const wrong3 = String(parsed.wrong3 ?? "").trim();
  if (!wrong1 || !wrong2 || !wrong3) {
    throw new Error(`JSON incompleto: ${match[0]}`);
  }
  return [wrong1, wrong2, wrong3];
}

async function supabase(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status} ${path}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  if (!OPENAI_API_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error:
          "Faltan variables de entorno: OPENAI_API_KEY y/o SUPABASE_SERVICE_ROLE_KEY",
      }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Body JSON inválido" }),
    };
  }

  const { session_id, questions } = payload;
  if (!session_id || !Array.isArray(questions) || questions.length === 0) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "session_id y questions[] son requeridos" }),
    };
  }

  const generated = [];

  try {
    for (const q of questions) {
      const { question_number, question_text, answer } = q;
      if (!question_number || !question_text || !answer) {
        throw new Error(
          `Pregunta inválida: ${JSON.stringify(q)} (faltan campos)`
        );
      }

      const wrongs = await askAI(question_text, answer);

      // Mezclar las 4 opciones y recordar la letra correcta
      const all = shuffle([
        { text: answer, isCorrect: true },
        { text: wrongs[0], isCorrect: false },
        { text: wrongs[1], isCorrect: false },
        { text: wrongs[2], isCorrect: false },
      ]);
      const letters = ["a", "b", "c", "d"];
      const correctIndex = all.findIndex((o) => o.isCorrect);
      const correct_option = letters[correctIndex];

      const row = {
        session_id,
        question_number,
        question_text,
        option_a: all[0].text,
        option_b: all[1].text,
        option_c: all[2].text,
        option_d: all[3].text,
        correct_option,
      };

      // Upsert por (session_id, question_number) para permitir regenerar
      await supabase(
        "quiz_questions?on_conflict=session_id,question_number",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify(row),
        }
      );

      generated.push(row);
    }

    // Marcar sesión como lista
    await supabase(`quiz_sessions?id=eq.${session_id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ready" }),
    });

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, count: generated.length, generated }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: String(err && err.message ? err.message : err),
        generated_so_far: generated.length,
      }),
    };
  }
};
