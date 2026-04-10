/**
 * Generate embeddings for all movies and populate Vectorize
 * 
 * Usage:
 *   node --loader ts-node/esm scripts/generate_embeddings.ts
 */

import type { Env } from '../app/server/env';

interface MovieRecord {
    id: string;
    title_ar: string;
    title_en: string | null;
    summary_ar: string;
    year: number;
    slug: string;
}

interface VectorInsert {
    id: string;
    values: number[];
    metadata: {
        title_ar: string;
        title_en?: string;
        year: number;
        slug: string;
        genres?: string[];
    };
}

/**
 * Generate embeddings for all movies in batches
 */
export async function generateAllEmbeddings(env: Env) {
    console.log('🎬 ElFilm Embedding Generation');
    console.log('='.repeat(60));

    // 1. Fetch all movies with summaries
    const result = await env.DB.prepare(`
    SELECT id, title_ar, title_en, summary_ar, year, slug
    FROM movies
    WHERE summary_ar IS NOT NULL AND summary_ar != ''
    ORDER BY year DESC
  `).all<MovieRecord>();

    const movies = result.results;
    console.log(`\n📊 Found ${movies.length} movies with summaries`);

    if (movies.length === 0) {
        console.log('⚠️  No movies to process');
        return;
    }

    // 2. Process in batches
    const BATCH_SIZE = 25; // Conservative batch size for AI inference
    const vectors: VectorInsert[] = [];
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < movies.length; i += BATCH_SIZE) {
        const batch = movies.slice(i, Math.min(i + BATCH_SIZE, movies.length));
        console.log(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(movies.length / BATCH_SIZE)}...`);

        for (const movie of batch) {
            try {
                // Generate embedding for Arabic summary
                const response = await env.AI.run('@cf/baai/bge-m3', {
                    text: movie.summary_ar,
                }) as { data: number[][] };

                const embedding = response.data[0];

                // Validate embedding
                if (!embedding || embedding.length !== 1024) {
                    throw new Error(`Invalid embedding dimension: ${embedding?.length || 0}`);
                }

                vectors.push({
                    id: movie.id,
                    values: embedding,
                    metadata: {
                        title_ar: movie.title_ar,
                        title_en: movie.title_en || undefined,
                        year: movie.year,
                        slug: movie.slug,
                    },
                });

                processed++;

                // Progress indicator
                if (processed % 10 === 0) {
                    console.log(`   ✓ Processed ${processed}/${movies.length} movies`);
                }

            } catch (error) {
                errors++;
                console.error(`   ✗ Error processing "${movie.title_ar}":`, error);
            }
        }

        // 3. Insert batch into Vectorize
        if (vectors.length > 0) {
            try {
                const batchVectors = vectors.slice(-batch.length);
                await env.VECTORIZE.insert(batchVectors);
                console.log(`   ✓ Inserted ${batchVectors.length} vectors into Vectorize`);
            } catch (error) {
                console.error(`   ✗ Error inserting batch into Vectorize:`, error);
                errors += batch.length;
            }
        }

        // Small delay between batches to avoid rate limits
        if (i + BATCH_SIZE < movies.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // 4. Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Embedding generation complete!');
    console.log(`   Processed: ${processed}/${movies.length} movies`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Success rate: ${((processed / movies.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));
}

/**
 * Test embedding generation with a sample movie
 */
export async function testEmbedding(env: Env, movieSlug: string) {
    console.log(`\n🧪 Testing embedding for: ${movieSlug}`);

    // Fetch movie
    const movie = await env.DB.prepare(`
    SELECT id, title_ar, summary_ar
    FROM movies
    WHERE slug = ?
  `).bind(movieSlug).first<MovieRecord>();

    if (!movie) {
        console.log('❌ Movie not found');
        return;
    }

    console.log(`\n📽️  Movie: ${movie.title_ar}`);
    console.log(`📝 Summary: ${movie.summary_ar?.substring(0, 100)}...`);

    // Generate embedding
    console.log('\n🔄 Generating embedding...');
    const start = Date.now();

    const response = await env.AI.run('@cf/baai/bge-m3', {
        text: movie.summary_ar,
    }) as { data: number[][] };

    const embedding = response.data[0];
    const duration = Date.now() - start;

    console.log(`✅ Embedding generated in ${duration}ms`);
    console.log(`📊 Dimensions: ${embedding.length}`);
    console.log(`📈 Sample values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);

    // Insert into Vectorize
    console.log('\n🔄 Inserting into Vectorize...');
    await env.VECTORIZE.insert([{
        id: movie.id,
        values: embedding,
        metadata: {
            title_ar: movie.title_ar,
            year: 0, // Will be updated in full generation
            slug: movieSlug,
        },
    }]);

    console.log('✅ Successfully inserted into Vectorize');

    // Test retrieval
    console.log('\n🔄 Testing retrieval...');
    const retrieved = await env.VECTORIZE.getByIds([movie.id]);
    console.log(`✅ Retrieved ${retrieved.length} vector(s)`);
}

/**
 * Query wrapper for testing semantic search
 */
export async function testSemanticSearch(env: Env, query: string, limit: number = 5) {
    console.log(`\n🔍 Testing semantic search for: "${query}"`);

    // Generate query embedding
    const response = await env.AI.run('@cf/baai/bge-m3', {
        text: query,
    }) as { data: number[][] };

    const queryVector = response.data[0];

    // Search Vectorize
    const results = await env.VECTORIZE.query(queryVector, {
        topK: limit,
        returnMetadata: true,
    });

    console.log(`\n📊 Found ${results.matches.length} results:`);
    results.matches.forEach((match, idx) => {
        console.log(`\n${idx + 1}. ${match.metadata?.title_ar || match.id}`);
        console.log(`   Similarity: ${(match.score * 100).toFixed(1)}%`);
        console.log(`   Slug: ${match.metadata?.slug}`);
    });
}

// Example usage:
// const env: Env = getEnvFromWorker();
// await generateAllEmbeddings(env);
// await testEmbedding(env, 'zynab_1930');
// await testSemanticSearch(env, 'فيلم عن الغيرة في الزواج', 5);
