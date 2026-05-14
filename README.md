# 🌟 Quiz Ariana — "¿Cuánto me conocen?"

Quiz interactivo en dos fases para grabar en vivo en el canal de YouTube de Ariana (10 años).

- **Fase 1 (privada):** Ariana responde 12 preguntas en su tablet → se guardan en Supabase.
- **Fase 2 (en vivo):** Papá y Mamá responden las mismas 12 preguntas en sus celulares, con 4 opciones (1 correcta + 3 falsas generadas por OpenAI gpt-4o-mini). Ariana ve el marcador en tiempo real en su tablet.

---

## 📁 Estructura

```
quiz-ariana/
├── form.html              → Tablet de Ariana (12 preguntas)
├── admin.html             → Christian: revisa respuestas, genera quiz con IA, activa
├── quiz.html              → Papá / Mamá: 4 opciones por pregunta
├── scoreboard.html        → Tablet de Ariana: marcador en vivo
├── netlify/functions/
│   └── generate-quiz.js   → Proxy de OpenAI API (CORS + protege la key)
├── netlify.toml
├── migration.sql          → SQL para crear las 4 tablas
└── README.md              ← este archivo
```

---

## 🚀 Setup paso a paso

### 1) Crear las tablas en Supabase

1. Abre el dashboard del proyecto **jrhmykilnqndvgnsmueo** → `SQL Editor`.
2. Pega el contenido de `migration.sql` y ejecútalo.
3. Verifica que se crearon `quiz_sessions`, `ariana_answers`, `quiz_questions`, `player_answers`.
4. Comprueba que **Realtime** quedó habilitado en `player_answers` y `quiz_sessions`
   (Dashboard → `Database` → `Replication` → la publicación `supabase_realtime`).

### 2) Conseguir la `anon key`

1. Dashboard → `Project Settings` → `API`.
2. Copia el valor de **`anon` `public`**.
3. Reemplaza `REEMPLAZAR_CON_ANON_KEY` en estos 4 archivos:
   - `form.html`
   - `admin.html`
   - `quiz.html`
   - `scoreboard.html`

### 3) Conseguir la `service role key` (solo para Netlify, NUNCA al frontend)

1. Dashboard → `Project Settings` → `API` → **`service_role` `secret`**.
2. Cópiala — la vamos a poner en Netlify (paso 5).

### 4) Crear sitio en Netlify y conectar el repo

```bash
cd ~/Documents/quiz-ariana
git init
git add .
git commit -m "init: quiz-ariana"
# Crear repo nuevo en GitHub (Neofox8/quiz-ariana) y pushear
gh repo create Neofox8/quiz-ariana --private --source=. --remote=origin --push
# En app.netlify.com → Add new site → Import from GitHub → Neofox8/quiz-ariana
```

Netlify detecta `netlify.toml` automáticamente. No hay build step.

### 5) Configurar variables de entorno en Netlify

Site → **Site configuration** → **Environment variables** → Add a variable:

| Key                          | Value                                        |
|------------------------------|----------------------------------------------|
| `OPENAI_API_KEY`             | tu API key de OpenAI (sk-...)                |
| `SUPABASE_SERVICE_ROLE_KEY`  | service role key del paso 3                  |
| `SUPABASE_URL`               | `https://jrhmykilnqndvgnsmueo.supabase.co`   |

Hacer **Trigger deploy → Clear cache and deploy site** para que la función las tome.

---

## 🎬 Cómo se usa el día de la grabación

### Antes (privado, Ariana sola)

1. **Tablet de Ariana** abre: `https://<sitio>.netlify.app/form.html`
2. Responde sinceramente las 12 preguntas y envía.
3. La pantalla final muestra un `session_id` — Ariana se lo dice a Christian.

### Pre-producción (Christian, en su laptop)

1. Abrir `https://<sitio>.netlify.app/admin.html`
2. PIN: `ariana2026`
3. Ver las 12 respuestas de Ariana → "Generar Quiz con IA ✨"
4. Revisar las 4 opciones por pregunta. Si alguna se ve mala → "🔁 Regenerar todo".
5. Cuando esté bien → "🚀 ¡Activar Quiz!"
6. El admin muestra las dos URLs:
   - **Para Papá y Mamá:** `…/quiz.html?session=<id>` (manda por WhatsApp)
   - **Para la tablet de Ariana:** `…/scoreboard.html?session=<id>` (abrir en pantalla completa)

### En vivo

1. Papá y Mamá abren su URL, ponen su nombre y quedan en pantalla "Esperando que Ariana arranque el juego..."
2. Christian (en admin.html) hace clic en **▶️ Empezar el juego** → el estado pasa a `playing`.
3. Los celulares de Papá y Mamá muestran la primera pregunta. Avanzan a su ritmo.
4. La tablet de Ariana (`scoreboard.html`) muestra puntajes en vivo, con confetti cada vez que alguien acierta.
5. Cuando los dos completan las 12 preguntas, el scoreboard cambia automáticamente a pantalla de ganador.

### Para volver a jugar la misma sesión

En `scoreboard.html` → botón **🔄 Reiniciar** (pide PIN). Borra respuestas, vuelve a `ready`.

---

## 🛠️ Desarrollo local

```bash
cd ~/Documents/quiz-ariana
npm install -g netlify-cli   # solo la primera vez
netlify dev
```

`netlify dev` levanta el sitio estático + la función en `http://localhost:8888`.
Las variables de entorno se toman de `.env` local (no commitear) o del entorno de Netlify si estás linkeado.

Si solo quieres servir los HTML (sin la función IA):

```bash
python3 -m http.server 8000
```

---

## 🎨 Estética

- Fondo oscuro tipo espacio con estrellas CSS animadas.
- Paleta: turquesa, navy, púrpura, rosa fucsia, amarillo.
- Tipografía: **Fredoka** para títulos/emojis, **Nunito** para texto.
- Mobile-first. Cada pantalla tiene su color dominante pero comparten el fondo estrellado.

---

## ❓ Troubleshooting

- **Anon key no funciona** → Verifica que sea la `anon public` (no la `service_role`).
- **"Error en /.netlify/functions/generate-quiz"** → Falta una env var en Netlify; mira los logs en `Site → Functions → generate-quiz → Logs`.
- **Realtime no actualiza el scoreboard** → Vuelve a correr el bloque final de `migration.sql`:
  ```sql
  alter publication supabase_realtime add table player_answers;
  alter publication supabase_realtime add table quiz_sessions;
  ```
- **OpenAI devuelve JSON con texto extra** → La función ya extrae el primer bloque `{...}`; si aun así falla, revisa el log de la función para ver el prompt/respuesta exacta.

---

## 📌 Pendientes

- [ ] Reemplazar `REEMPLAZAR_CON_ANON_KEY` en los 4 HTML después del primer setup.
- [ ] Configurar las 3 env vars en Netlify.
- [ ] Probar fin-a-fin con una sesión de prueba antes del día de grabación.
