import sqlite3 from "sqlite3";
import * as cheerio from "cheerio";
import { Movie } from "./types/Movie";
import { MongoClient, ServerApiVersion } from "mongodb";
import { config } from "dotenv";

function getIds(db: any): Promise<string[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT tconst FROM movies ORDER BY numVotes DESC LIMIT 50000`,
      [],
      (err: any, rows: any) => {
        if (err) {
          return reject(err);
        }
        resolve(rows.map((r: any) => r.tconst));
      },
    );
  });
}

async function getMovie(id: string): Promise<Movie | null> {
  try {
    console.log(`Scraping: ${id}`);
    const response = await fetch(
      `https://www.opensubtitles.org/en/search/sublanguageid-all/imdbid-${id}`,
    );
    const $ = cheerio.load(await response.text());
    const title = $("title").text().split("subtitles")[0].trim();
    const links: string[] = [];
    $("#search_results td a.bnone").each((i, element) => {
      const href = $(element).attr("href");
      if (href) {
        let subIdSplit = href.split("subtitles/");
        if (subIdSplit) {
          let subId = subIdSplit[1].split("/")[0];

          links.push(
            `https://www.opensubtitles.org/en/subtitleserve/sub/${subId}`,
          );
        }
      }
    });
    let splitYear = $("#search_results td a.bnone").first().text().split("(");
    let year = 0;

    if (splitYear.length > 1) {
      year = parseInt(splitYear[1].split(")")[0]);
    }

    const result = new Movie(id, title, links, year);
    return result;
  } catch (e: any) {
    console.log(e);
    return null;
  }
}

async function getMovies(ids: string[]): Promise<Movie[]> {
  const numPromises = 25;
  let movies: Movie[] = [];

  for (let i = 0; i < ids.length; i += numPromises) {
    const promises: Promise<Movie | null>[] = [];
    for (let j = i; j < i + numPromises && j < ids.length; j++) {
      promises.push(getMovie(ids[j]));
    }
    const results = await Promise.all(promises);
    movies = movies.concat(
      results.filter((movie) => movie !== null) as Movie[],
    );
  }

  return movies;
}

async function main() {
  const db = new sqlite3.Database("./database.db");
  const ids: string[] = await getIds(db);

  const movies = await getMovies(ids);
  console.log(`Scraped ${movies.length} movies`);

  config();

  const client = new MongoClient(process.env.MONGO || "", {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();

  const database = client.db("subtle");
  const subtitles = database.collection("subtitles");

  const result = await subtitles.insertMany(movies);
  console.log(`Added ${result.insertedIds} movies to db`);
}

main();
