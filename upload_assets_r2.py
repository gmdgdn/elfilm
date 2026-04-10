import os
import boto3
from botocore.exceptions import NoCredentialsError

# R2 Configuration (User needs to provide these or set env vars)
# For now, I'll use placeholders or try to read from env if set.
# But usually R2 needs specific credentials (access key, secret key, endpoint).
# I'll check if I can get them from the user or if they are in .env

# Assuming they are in .env or I need to ask.
# Let's check .env first.

R2_ACCOUNT_ID = "e18437e0f43bf91a8a38bd39c988001c"
R2_ACCESS_KEY_ID = "785efcf2b1efa3dfb73403ea6024f69f"
R2_SECRET_ACCESS_KEY = "676829c5875149f8e03db7fe6d0b336ba97b06446174c3b2e740ff54e24d7e5e"
BUCKET_NAME = "elfilm-assets"

ASSETS_DIR = "assets"

def get_r2_client():
    if not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY:
        print("Error: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables must be set.")
        return None
        
    return boto3.client(
        's3',
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY
    )

def upload_directory(client, local_dir, bucket_prefix):
    print(f"Uploading {local_dir} to {BUCKET_NAME}/{bucket_prefix}...")
    
    for root, dirs, files in os.walk(local_dir):
        for file in files:
            local_path = os.path.join(root, file)
            
            # Calculate relative path for S3 key
            relative_path = os.path.relpath(local_path, local_dir)
            s3_key = os.path.join(bucket_prefix, relative_path).replace("\\", "/")
            
            try:
                # Check if exists (optional, skips if exists to save time)
                client.head_object(Bucket=BUCKET_NAME, Key=s3_key)
                print(f"Skipping {s3_key} (already exists)")
                
                # Just upload
                print(f"Uploading {s3_key}...")
                client.upload_file(local_path, BUCKET_NAME, s3_key)
                
            except Exception as e:
                print(f"Error uploading {s3_key}: {e}")

def main():
    client = get_r2_client()
    if not client:
        return

    # Upload Movies
    movies_dir = os.path.join(ASSETS_DIR, "movies")
    if os.path.exists(movies_dir):
        upload_directory(client, movies_dir, "movies")
        
    # Upload People
    people_dir = os.path.join(ASSETS_DIR, "people")
    if os.path.exists(people_dir):
        upload_directory(client, people_dir, "people")

if __name__ == "__main__":
    main()
