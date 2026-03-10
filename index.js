const express = require("express")
const app = express()

function setCORS(_req, res, next) {
  res.header(`Access-Control-Allow-Origin`, `*`);
  res.header(`Access-Control-Allow-Methods`, `GET,PUT,POST,DELETE`);
  res.header(`Access-Control-Allow-Headers`, `Content-Type`);
  next();
}
app.use(setCORS);

app.use(express.static('public'))
app.set('view engine', 'ejs');

const fsPromises = require("fs/promises")
function ReadManifest() {
  return fsPromises.readFile('./package.json', 'utf8').then((data) => {
    const packageJSON = JSON.parse(data);

    let manifest = {
      "id": 'leo.' + packageJSON.name.replaceAll('-', '.'),
      "version": packageJSON.version,
      "name": "AnimeAV1",
      "logo": "https://animeav1.com/img/logo-dark.svg",
      "description": packageJSON.description,
      "catalogs": [
        {
          id: "animeav1", type: "AnimeAV1", name: "search results",
          extra: [{ name: "search", isRequired: true },
          {
            name: "genre",
            options: ["accion", "artes-marciales", "aventura", "carreras", "ciencia-ficcion", "comedia",
              "demencia", "demonios", "deportes", "drama", "ecchi", "escolares", "espacial", "fantasia",
              "harem", "historico", "infantil", "josei", "juegos", "magia", "mecha", "militar", "misterio",
              "musica", "parodia", "policia", "psicologico", "recuentos-de-la-vida", "romance", "samurai",
              "seinen", "shoujo", "shounen", "sobrenatural", "superpoderes", "suspenso", "terror", "vampiros",
              "yaoi", "yuri"],
            optionsLimit: 1, isRequired: false
          },
          { name: "skip", isRequired: false }
          ]
        },
        {
          id: "animeav1|genres", type: "AnimeAV1", name: "AnimeAV1",
          extra: [
            {
              name: "genre",
              options: ["accion", "artes-marciales", "aventura", "carreras", "ciencia-ficcion", "comedia",
                "demencia", "demonios", "deportes", "drama", "ecchi", "escolares", "espacial", "fantasia",
                "harem", "historico", "infantil", "josei", "juegos", "magia", "mecha", "militar", "misterio",
                "musica", "parodia", "policia", "psicologico", "recuentos-de-la-vida", "romance", "samurai",
                "seinen", "shoujo", "shounen", "sobrenatural", "superpoderes", "suspenso", "terror", "vampiros",
                "yaoi", "yuri"],
              optionsLimit: 1, isRequired: true
            },
            { name: "skip", isRequired: false }
          ]
        },
        {
          id: "animeav1|onair", type: "AnimeAV1", name: "On Air"
        }
      ],
      "resources": ["stream", "meta", "catalog"],
      "types": ["movie", "series", "anime", "other"],
      "idPrefixes": [
        "tt",
        "animeav1:",
        "tmdb:",
        "anilist:",
        "kitsu:",
        "mal:",
        "anidb:"
      ],
      "behaviorHints": {
        "newEpisodeNotifications": true
      }
    }
    return manifest;
  })
}

app.get("/manifest.json", (_req, res) => {
  ReadManifest().then((manif) => {
    res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
    res.json(manif);
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})

app.get("/:config/manifest.json", (_req, res) => {
  ReadManifest().then((manif) => {
    res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
    res.json(manif);
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})

const streams = require("./routes/streams");
app.use(streams);

const meta = require("./routes/meta");
app.use(meta);

const catalog = require("./routes/catalog");
app.use(catalog);

app.listen(process.env.PORT || 3000, () => {
  console.log(`\x1b[32mAnimeAV1 addon is listening on port ${process.env.PORT || 3000}\x1b[39m`)

  const animeAV1API = require('./routes/animeav1.js')
  animeAV1API.UpdateAiringAnimeFile().then(() => {
    setInterval(animeAV1API.UpdateAiringAnimeFile.bind(animeAV1API), 86400000);
  })
});
