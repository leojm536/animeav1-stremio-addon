const express = require("express")
const stream = express.Router()

require('dotenv').config()

const Metadata = require('./metadata_copy.js')
const relationsAPI = require('./relations.js')
const animeAV1API = require('./animeav1.js')
const fuzzysort = require('fuzzysort')

function HandleLongStreamRequest(req, res, next) {
  console.log(`\x1b[96mEntered HandleLongStreamRequest with\x1b[39m ${req.originalUrl}`)
  res.locals.extraParams = SearchParamsRegex(req.params[0])
  next()
}

function HandleStreamRequest(req, res, next) {
  console.log(`\x1b[96mEntered HandleStreamRequest with\x1b[39m ${req.originalUrl}`)
  let streams = []
  const idDetails = req.params.videoId.split(':')
  const videoID = idDetails[0]

  // ── AnimeAV1 native ID ──────────────────────────────────────────────
  if (videoID?.startsWith("animeav1")) {
    const ID = idDetails[1]
    let episode = idDetails[2]
    console.log(`\x1b[33mGot animeav1 ID:\x1b[39m ${ID}, ep: ${episode}`)

    animeAV1API.GetItemStreams(ID, episode).then((av1Streams) => {
      console.log(`\x1b[36mGot ${av1Streams.length} AnimeAV1 streams\x1b[39m`)
      res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
      res.json({ streams: av1Streams, message: "Got streams!" })
      next()
    }).catch((err) => {
      console.error('\x1b[31mFailed on AnimeAV1:\x1b[39m ' + err)
      res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
      res.json({ streams, message: "Failed getting streams" })
      next()
    })

  // ── IMDB ID ─────────────────────────────────────────────────────────
  } else if (videoID?.startsWith("tt")) {
    const ID = videoID
    const season = idDetails[1]
    const episode = idDetails[2]
    console.log(`\x1b[33mGot IMDB ID:\x1b[39m ${ID}`)

    resolveAndSearch(ID, season, episode, req.params.type, res, next, streams)

  // ── TMDB ID ──────────────────────────────────────────────────────────
  } else if (videoID?.startsWith("tmdb")) {
    const ID = idDetails[1]
    const season = idDetails[2]
    const episode = idDetails[3]
    console.log(`\x1b[33mGot TMDB ID:\x1b[39m ${ID}`)

    Metadata.GetIMDBIDFromTMDBID(ID, req.params.type).then((imdbID) => {
      resolveAndSearch(imdbID, season, episode, req.params.type, res, next, streams)
    }).catch((err) => {
      console.error('\x1b[31mFailed resolving TMDB ID:\x1b[39m ' + err)
      res.json({ streams, message: "Failed resolving TMDB ID" }); next()
    })

  // ── kitsu / mal / anilist / anidb ID ─────────────────────────────────
  } else if (videoID.match(/^(?:kitsu|mal|anidb|anilist)$/)) {
    const ID = idDetails[1]
    const episode = idDetails[2]
    console.log(`\x1b[33mGot ${videoID} ID:\x1b[39m ${ID}`)

    relationsAPI.GetIMDBIDFromANIMEID(videoID, ID).then((imdbID) => {
      resolveAndSearch(imdbID, undefined, episode, req.params.type, res, next, streams)
    }).catch((err) => {
      console.error('\x1b[31mFailed resolving anime ID:\x1b[39m ' + err)
      res.json({ streams, message: "Failed resolving anime ID" }); next()
    })

  } else {
    res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
    res.json({ streams, message: "Wrong ID format" }); next()
  }
}

// Busca en AnimeAV1 por título y devuelve los streams
function resolveAndSearch(imdbID, season, episode, type, res, next, streams) {
  if (!imdbID || imdbID === "null") {
    res.json({ streams, message: "No IMDB ID found" }); next(); return
  }

  Metadata.GetTMDBMeta(imdbID).then((meta) => meta)
    .catch(() => Metadata.GetCinemetaMeta(imdbID, type))
    .then((metadata) => {
      const searchTerm = (season && parseInt(season) !== 1) ? `${metadata.title} ${season}` : metadata.title
      console.log(`\x1b[33mBuscando en AnimeAV1:\x1b[39m ${searchTerm}`)

      return animeAV1API.SearchAnimeAV1(searchTerm, type).then((results) => {
        const result = fuzzysort.go(searchTerm, results, { key: 'title', limit: 1, all: true })[0]?.obj || results[0]
        console.log(`\x1b[36mAnimeAV1 match:\x1b[39m ${result.title}`)
        return animeAV1API.GetItemStreams(result.slug, episode)
      })
    })
    .then((av1Streams) => {
      console.log(`\x1b[36mGot ${av1Streams.length} streams\x1b[39m`)
      res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
      res.json({ streams: av1Streams, message: "Got streams!" })
      next()
    })
    .catch((err) => {
      console.error('\x1b[31mFailed:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
        res.json({ streams, message: "Failed getting streams" })
        next()
      }
    })
}

function ParseConfig(req, res, next) {
  res.locals.config = new URLSearchParams(decodeURIComponent(req.params.config))
  next()
}

function SearchParamsRegex(extraParams) {
  if (extraParams !== undefined) {
    const paramMap = new Map()
    const keyVals = extraParams.split('&');
    for (let keyVal of keyVals) {
      const keyValArr = keyVal.split('=')
      paramMap.set(keyValArr[0], keyValArr[1])
    }
    return Object.fromEntries(paramMap)
  } else return {}
}

stream.get("/:config/stream/:type/:videoId/*.json", ParseConfig, HandleLongStreamRequest, HandleStreamRequest)
stream.get("/:config/stream/:type/:videoId.json", ParseConfig, HandleStreamRequest)
stream.get("/stream/:type/:videoId/*.json", HandleLongStreamRequest, HandleStreamRequest)
stream.get("/stream/:type/:videoId.json", HandleStreamRequest)

module.exports = stream;
