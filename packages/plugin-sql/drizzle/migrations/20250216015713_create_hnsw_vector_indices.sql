-- Custom SQL migration file, put your code below! --
CREATE INDEX IF NOT EXISTS idx_embeddings_dim384 ON embeddings USING hnsw ("dim_384" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_embeddings_dim512 ON embeddings USING hnsw ("dim_512" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_embeddings_dim768 ON embeddings USING hnsw ("dim_768" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_embeddings_dim1024 ON embeddings USING hnsw ("dim_1024" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_embeddings_dim1536 ON embeddings USING hnsw ("dim_1536" vector_cosine_ops);