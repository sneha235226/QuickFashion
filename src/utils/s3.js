const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region:      process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Delete a file from S3 by its key (the path after the bucket, e.g. "products/abc.jpg").
 */
const deleteFile = async (key) => {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

/**
 * Extract the S3 key from a full S3 URL.
 * e.g. https://bucket.s3.region.amazonaws.com/products/abc.jpg  → products/abc.jpg
 */
const keyFromUrl = (url) => {
  try {
    const { pathname } = new URL(url);
    return pathname.replace(/^\//, '');
  } catch {
    return url;
  }
};

module.exports = { s3, BUCKET, deleteFile, keyFromUrl };
