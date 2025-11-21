#!/usr/bin/env node

/**
 * Database seeding script for ElFilm
 * Reads ElFilm JSON and populates D1 database
 *
 * Usage: node scripts/seed.js <path-to-elfilm-json>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seedDatabase() {
  try {
    // Get JSON path from arguments
    const jsonPath = process.argv[2];

    if (!jsonPath) {
      console.error('Usage: node scripts/seed.js <path-to-elfilm-json>');
      process.exit(1);
    }

    // Check if file exists
    if (!fs.existsSync(jsonPath)) {
      console.error(`File not found: ${jsonPath}`);
      process.exit(1);
    }

    console.log(`📖 Loading ElFilm data from: ${jsonPath}`);

    // Read JSON file
    const elfilmData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    console.log(`✓ Loaded ElFilm data`);
    console.log(`  Years: ${Object.keys(elfilmData).sort().join(', ')}`);

    const totalFilms = Object.values(elfilmData).reduce(
      (sum, films) => sum + (Array.isArray(films) ? films.length : 0),
      0
    );
    console.log(`  Total films: ${totalFilms}`);

    // Generate SQL insert statements
    const filmInserts = [];
    const personMap = new Map(); // Track people to avoid duplicates
    const personInserts = [];
    const castInserts = [];
    const crewInserts = [];
    const genreInserts = [];
    const tagInserts = [];
    const filmGenreInserts = [];
    const filmTagInserts = [];

    let filmId = 1;
    let personId = 1;
    let tagId = 1;
    const genreMap = new Map(); // Standard genres from schema

    // Process each year
    for (const [year, films] of Object.entries(elfilmData)) {
      if (!Array.isArray(films)) continue;

      console.log(`\n📽️  Processing year ${year}: ${films.length} films`);

      for (const film of films) {
        // Insert film
        const filmSql = `
          INSERT INTO films (slug, title_en, title_ar, production_year, film_type, duration_minutes, summary_ar)
          VALUES (
            '${escapeSql(film.slug)}',
            '${escapeSql(film.title_en)}',
            ${film.title_ar ? `'${escapeSql(film.title_ar)}'` : 'NULL'},
            ${film.production_year || parseInt(year)},
            ${film.type ? `'${escapeSql(film.type)}'` : 'NULL'},
            ${film.duration_minutes || 'NULL'},
            ${film.summary_ar ? `'${escapeSql(film.summary_ar.substring(0, 1000))}'` : 'NULL'}
          );
        `;
        filmInserts.push(filmSql);

        // Process genres
        if (film.genres_en && Array.isArray(film.genres_en)) {
          for (const genre of film.genres_en) {
            if (!genreMap.has(genre)) {
              genreMap.set(genre, filmGenreInserts.length + 1);
            }
            filmGenreInserts.push(
              `INSERT OR IGNORE INTO film_genres (film_id, genre_id) VALUES (${filmId}, ${genreMap.get(genre)});`
            );
          }
        }

        // Process tags
        if (film.tags_en && Array.isArray(film.tags_en)) {
          for (const tag of film.tags_en) {
            filmTagInserts.push(
              `INSERT OR IGNORE INTO film_tags (film_id, tag_id, language) VALUES (${filmId}, (SELECT id FROM tags WHERE name_en = '${escapeSql(tag)}'), 'en');`
            );
          }
        }

        if (film.tags_ar && Array.isArray(film.tags_ar)) {
          for (const tag of film.tags_ar) {
            filmTagInserts.push(
              `INSERT OR IGNORE INTO film_tags (film_id, tag_id, language) VALUES (${filmId}, (SELECT id FROM tags WHERE name_ar = '${escapeSql(tag)}'), 'ar');`
            );
          }
        }

        // Process cast
        if (film.cast_en && Array.isArray(film.cast_en)) {
          for (const member of film.cast_en) {
            let pid;
            if (personMap.has(member.name)) {
              pid = personMap.get(member.name);
            } else {
              pid = personId;
              personMap.set(member.name, personId);
              personInserts.push(
                `INSERT OR IGNORE INTO people (name_en) VALUES ('${escapeSql(member.name)}');`
              );
              personId++;
            }

            castInserts.push(
              `INSERT OR IGNORE INTO cast (film_id, person_id, imdb_rating) VALUES (${filmId}, ${pid}, ${member.rating || 'NULL'});`
            );
          }
        }

        // Process crew
        if (film.crew && typeof film.crew === 'object') {
          const roleMap = {
            screenwriter_en: 'Screenwriter',
            screenplay_en: 'Screenplay',
            dialogue_en: 'Dialogue',
            producer_en: 'Producer',
            director_en: 'Director',
            assistant_director_en: 'Assistant Director',
            photography_en: 'Photography',
            art_director_en: 'Art Director',
            music_en: 'Music',
            montage_en: 'Montage',
            makeup_en: 'Makeup',
            sound_en: 'Sound',
          };

          for (const [key, names] of Object.entries(film.crew)) {
            if (Array.isArray(names)) {
              const roleName = roleMap[key] || key;

              for (const name of names) {
                let pid;
                if (personMap.has(name)) {
                  pid = personMap.get(name);
                } else {
                  pid = personId;
                  personMap.set(name, personId);
                  personInserts.push(
                    `INSERT OR IGNORE INTO people (name_en) VALUES ('${escapeSql(name)}');`
                  );
                  personId++;
                }

                crewInserts.push(
                  `INSERT OR IGNORE INTO crew (film_id, person_id, crew_role_id) VALUES (${filmId}, ${pid}, (SELECT id FROM crew_roles WHERE name_en = '${escapeSql(roleName)}'));`
                );
              }
            }
          }
        }

        filmId++;
      }
    }

    // Generate the complete SQL migration file
    const migrationContent = `-- ElFilm data seed migration
-- Generated from ElFilm JSON dataset

BEGIN TRANSACTION;

${filmInserts.join('\n')}

${personInserts.join('\n')}

${castInserts.join('\n')}

${crewInserts.join('\n')}

${filmGenreInserts.join('\n')}

${filmTagInserts.join('\n')}

COMMIT;
`;

    const outputPath = path.join(__dirname, '../migrations/0002_seed_elfilm.sql');
    fs.writeFileSync(outputPath, migrationContent);

    console.log(`\n✅ Seed migration generated!`);
    console.log(`   Output: ${outputPath}`);
    console.log(`   Films: ${filmId - 1}`);
    console.log(`   People: ${personId - 1}`);
    console.log(`   Total statements: ${filmInserts.length + personInserts.length + castInserts.length + crewInserts.length}`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Review the generated migration file`);
    console.log(`   2. Run: wrangler migrations apply --env production`);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''").replace(/\x00/g, '\\0').replace(/\x1a/g, '\\Z');
}

// Run the seeding process
seedDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
